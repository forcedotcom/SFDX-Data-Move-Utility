/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import "reflect-metadata";
import "es6-shim";
import { Type } from "class-transformer";
import { Query } from 'soql-parser-js';
import { CommonUtils } from "../components/commonUtils";
import { DATA_MEDIA_TYPE, OPERATION, CONSTANTS } from "../components/statics";
import { MessageUtils, RESOURCES } from "../components/messages";
import { ApiSf } from "../components/apiSf";
var jsforce = require("jsforce");
import {
    parseQuery,
    composeQuery,
    OrderByClause,
    Field as SOQLField,
    getComposedField
} from 'soql-parser-js';
import { ScriptMockField, Script, SObjectDescribe, CommandInitializationError, OrgMetadataError, ScriptOrg, ScriptObject, MigrationJobTask as Task } from ".";
import SFieldDescribe from "./sfieldDescribe";
import * as path from 'path';
import * as fs from 'fs';


export default class MigrationJob {

    script: Script;
    tasks: Task[] = new Array<Task>();

    csvValuesMapping: Map<string, Map<string, string>> = new Map<string, Map<string, string>>();
    csvIssues: Array<ICSVIssues> = new Array<ICSVIssues>();
    csvDataCacheMap: Map<string, Map<string, any>> = new Map<string, Map<string, any>>();

    constructor(init: Partial<MigrationJob>) {
        if (init) {
            Object.assign(this, init);
        }
    }


    get logger(): MessageUtils {
        return this.script.logger;
    }


    get objects(): ScriptObject[] {
        return this.script.objects;
    }


    /**
     * Reads CSVValues mapping definition file
     *
     * @returns {Promise<void>}
     * @memberof MigrationJob
     */
    async readCSVValueMappingFileAsync(): Promise<void> {
        let valueMappingFilePath = path.join(this.script.basePath, CONSTANTS.VALUE_MAPPING_CSV_FILENAME);
        let csvRows = await CommonUtils.readCsvFileAsync(valueMappingFilePath);
        if (csvRows.length > 0) {
            this.logger.infoVerbose(RESOURCES.readingValuesMappingFile, CONSTANTS.VALUE_MAPPING_CSV_FILENAME);
            csvRows.forEach(row => {
                if (row["ObjectName"] && row["FieldName"]) {
                    let key = String(row["ObjectName"]).trim() + String(row["FieldName"]).trim();
                    if (!this.csvValuesMapping.has(key)) {
                        this.csvValuesMapping.set(key, new Map<string, string>());
                    }
                    this.csvValuesMapping.get(key).set(String(row["RawValue"]).trim(), (String(row["Value"]) || "").trim());
                }
            });
        }
    }



    /**
     * Merges User.csv and Group.csv into single file
     *
     * @returns {Promise<void>}
     * @memberof MigrationJob
     */
    async mergeUserGroupCSVfiles(): Promise<void> {
        let filepath1 = path.join(this.script.basePath, "User.csv");
        let filepath2 = path.join(this.script.basePath, "Group.csv");
        let filepath3 = path.join(this.script.basePath, CONSTANTS.USER_AND_GROUP_FILENAME + ".csv");
        await CommonUtils.mergeCsvFilesAsync(filepath1, filepath2, filepath3, true, "Id", "Name");
    }


    /**
     * Checks and fixes all CSV source files.
     *
     * @returns {Promise<void>}
     * @memberof MigrationJob
     */
    async validateAndFixSourceCSVFiles(): Promise<void> {

        // Validate csv structure
        for (let index = 0; index < this.tasks.length; index++) {
            const task = this.tasks[index];
            this.csvIssues = this.csvIssues.concat(await task.validateCSVFileStructure());
        }

        if (this.csvIssues.length > 0) {
            // TODO: Write this.csvIssues to file

            await CommonUtils.abortWithPrompt(this.logger,
                RESOURCES.issuesFoundDuringCSVValidation,
                this.script.promptOnInvalidCSVFiles,
                RESOURCES.continueTheJobPrompt,
                "",
                RESOURCES.issuesFoundDuringCSVValidation, String(this.csvIssues.length), CONSTANTS.CSV_ISSUES_ERRORS_FILENAME);
        }


        this.csvIssues = new Array<ICSVIssues>();
        for (let index = 0; index < this.tasks.length; index++) {
            const task = this.tasks[index];
            // Add missing lookup columns (Account__r.Name & Account__c)
            this.csvIssues = this.csvIssues.concat(await task.createLookupCSVColumns(this.csvDataCacheMap));
        }

        if (this.csvIssues.length > 0) {
            // TODO: Write this.csvIssues to file
            // TODO: Prompt for abort

        }
    }



    /**
     * Returns a task by the given sObject name
     *
     * @param {string} sObjectName The sobject name
     * @returns
     * @memberof MigrationJob
     */
    getTaskBySObjectName(sObjectName: string) {
        return this.tasks.filter(x => x.sObjectName == sObjectName)[0];
    }

}



/**
 * The format of columns for a CSV issues report file
 *
 * @export
 * @interface ICSVIssues
 */
export interface ICSVIssues {
    "Date": string,
    "Severity level": "HIGH" | "LOW" | "NORMAL" | "HIGHEST",
    "Child sObject name": string,
    "Child field name": string,
    "Parent record Id": string,
    "Parent sObject name": string,
    "Parent sObject external Id field name": string,
    "Error description": string
}