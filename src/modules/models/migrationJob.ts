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
    cachedCSVContent: CachedCSVContent = new CachedCSVContent();

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
     * Checks and repairs all CSV source files.
     *
     * @returns {Promise<void>}
     * @memberof MigrationJob
     */
    async validateAndRepairSourceCSVFiles(): Promise<void> {

        let self = this;

        async function abortwithPrompt(): Promise<void> {
            await CommonUtils.abortWithPrompt(self.logger,
                RESOURCES.issuesFoundDuringCSVValidation,
                self.script.promptOnInvalidCSVFiles,
                RESOURCES.continueTheJobPrompt,
                "",
                async () => {
                    // Report csv issues
                    await self.saveCSVFileAsync(CONSTANTS.CSV_ISSUES_ERRORS_FILENAME, self.csvIssues);
                },
                String(self.csvIssues.length), CONSTANTS.CSV_ISSUES_ERRORS_FILENAME);
        }

        // Validate csv structure
        for (let index = 0; index < this.tasks.length; index++) {
            const task = this.tasks[index];
            this.csvIssues = this.csvIssues.concat(await task.validateCSVFileStructure());
        }

        // Prompt to abort the job if structure issues were found
        let abortWasPrompted = false;
        if (this.csvIssues.length > 0) {
            await abortwithPrompt();
            abortWasPrompted = true;
        }

        for (let index = 0; index < this.tasks.length; index++) {
            const task = this.tasks[index];
            // Try to add missing lookup csv columns (Account__r.Name & Account__c)                        
            this.csvIssues = this.csvIssues.concat(await task.createMissingCSVColumns(this.cachedCSVContent));
        }

        // Save changed files
        if (this.cachedCSVContent.updatedFilenames.size > 0 && !this.script.importCSVFilesAsIs) {
            await this.saveCachedCsvDataFiles();
            this.logger.infoVerbose(RESOURCES.csvFilesWereUpdated, String(this.cachedCSVContent.updatedFilenames.size));
        } else {
            this.logger.infoVerbose(RESOURCES.csvFilesWereUpdated, "0");
        }

        // Prompt to abort the job if csv data issues were found
        //  and save the report
        if (this.csvIssues.length > 0) {
            if (!abortWasPrompted) {
                await abortwithPrompt();
            } else {
                await self.saveCSVFileAsync(CONSTANTS.CSV_ISSUES_ERRORS_FILENAME, self.csvIssues);                
                this.logger.warn(RESOURCES.issuesFoundDuringCSVValidation, String(this.csvIssues.length), CONSTANTS.CSV_ISSUES_ERRORS_FILENAME);
            }
        } else {
            this.logger.infoVerbose(RESOURCES.noIssuesFoundDuringCSVValidation);
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



    /**
     * Save csv file from the data of the input array
     *
     * @param {string} fileName It is just a filename (test.csv) not the full path
     * @param {Array<any>} data The data to write to csv file
     * @returns {Promise<void>}
     * @memberof MigrationJob
     */
    async saveCSVFileAsync(fileName: string, data: Array<any>): Promise<void> {
        let filePath = path.join(this.script.basePath, fileName);
        this.logger.infoVerbose(RESOURCES.writingToCSV, filePath);
        await CommonUtils.writeCsvFileAsync(filePath, data, true);
    }



    /**
     * Save all updated cached csv files
     *
     * @returns {Promise<any>}
     * @memberof MigrationJob
     */
    async saveCachedCsvDataFiles(): Promise<any> {
        let filePaths = [...this.cachedCSVContent.csvDataCacheMap.keys()];
        for (let i = 0; i < filePaths.length; i++) {
            const filePath = filePaths[i];
            let csvData = this.cachedCSVContent.csvDataCacheMap.get(filePath);
            if (this.cachedCSVContent.updatedFilenames.has(filePath)) {
                this.logger.infoVerbose(RESOURCES.writingToCSV, filePath);
                await CommonUtils.writeCsvFileAsync(filePath, [...csvData.values()], true);
            }
        }
    }

}



// --------------------------- Helper classes -------------------------------------
/**
 * The format of columns for a CSV issues report file
 *
 * @export
 * @interface ICSVIssues
 */
export interface ICSVIssues {
    "Date": string,
    "Child value": string,
    "Child sObject": string,
    "Child field": string,
    "Parent value": string,
    "Parent sObject": string,
    "Parent field": string,
    "Error": string
}




export class CachedCSVContent {
    csvDataCacheMap: Map<string, Map<string, any>> = new Map<string, Map<string, any>>();
    updatedFilenames: Set<string> = new Set<string>();
    idCounter: number = 1;

    get nextId() : string {
        return "ID" + CommonUtils.addLeadnigZeros(this.idCounter++, 16);
    }
}