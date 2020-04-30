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
import { CommonUtils, CsvChunks } from "../components/commonUtils";
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
import { ScriptMockField, Script, SObjectDescribe, CommandInitializationError, OrgMetadataError, ScriptOrg, ScriptObject, MigrationJob as Job, ICSVIssues } from ".";
import SFieldDescribe from "./sfieldDescribe";
import * as path from 'path';
import * as fs from 'fs';



export default class MigrationJobTask {

    scriptObject: ScriptObject;
    job: Job;

    constructor(init: Partial<MigrationJobTask>) {
        if (init) {
            Object.assign(this, init);
        }
    }

    get sObjectName(): string {
        return this.scriptObject && this.scriptObject.name;
    }

    get logger(): MessageUtils {
        return this.scriptObject.script.logger;
    }

    get fieldsToUpdateMap(): Map<string, SFieldDescribe> {
        return this.scriptObject.fieldsToUpdateMap;
    }

    get fieldsInQueryMap(): Map<string, SFieldDescribe> {
        return this.scriptObject.fieldsInQueryMap;
    }

    get fieldsToUpdate(): string[] {
        return this.scriptObject.fieldsToUpdate;
    }

    get fieldsInQuery(): string[] {
        return this.scriptObject.fieldsInQuery;
    }


    /**
     * Returns CSV filename for the current task
     *
     * @returns {string}
     * @memberof MigrationJobTask
     */
    getCSVFilename(): string {
        let filepath = path.join(this.scriptObject.script.basePath, this.sObjectName);
        if (this.sObjectName == "User" || this.sObjectName == "Group") {
            filepath = path.join(this.scriptObject.script.basePath, CONSTANTS.USER_AND_GROUP_FILENAME);
        }
        filepath += ".csv";
        return filepath;
    }




    /**
     * Checks the structure of the CSV source file.
     *
     * @returns {Promise<void>}
     * @memberof MigrationJob
     */
    async validateCSVFileStructure(): Promise<Array<ICSVIssues>> {

        let csvIssues = new Array<ICSVIssues>();

        // Read the csv header row
        let csvColumnsRow = await CommonUtils.readCsvFileAsync(this.getCSVFilename(), 1);

        if (csvColumnsRow.length == 0) {
            // Missing or empty file
            csvIssues.push({
                Date: CommonUtils.formatDateTime(new Date()),
                "Severity level": "HIGHEST",
                "Child sObject name": this.sObjectName,
                "Child field name": null,
                "Parent sObject name": null,
                "Parent sObject external Id field name": null,
                "Parent record Id": null,
                "Error description": this.logger.getResourceString(RESOURCES.csvFileIsEmpty)
            });
            return csvIssues;
        }


        // Check if all necessary fields are provided in the CSV file.
        // Only checking for the mandatory fields (to be updated), 
        // Not checking for all fields in the query (like RecordType.DevelopeName).
        [...this.fieldsToUpdateMap.keys()].forEach(fieldName => {
            const columnExists = Object.keys(csvColumnsRow[0]).some(columnName => {
                let nameParts = columnName.split('.');
                return columnName == fieldName || nameParts.some(namePart => namePart == fieldName);
            });
            if (!columnExists) {
                // Column is missing in the csv file
                csvIssues.push({
                    Date: CommonUtils.formatDateTime(new Date()),
                    "Severity level": "NORMAL",
                    "Child sObject name": this.sObjectName,
                    "Child field name": fieldName,
                    "Parent sObject name": null,
                    "Parent sObject external Id field name": null,
                    "Parent record Id": null,
                    "Error description": this.logger.getResourceString(RESOURCES.columnsMissingInCSV)
                });
            }
        });

        return csvIssues;
    }



    /**
     * Creates missing csv columns for lookup SFields like: Account__r.Name, Account__c
     *
     * @param {Map<string, Map<string, any>>} csvDataCacheMap The cached content of the source csv fiels
     * @returns {Promise<Array<ICSVIssues>>}
     * @memberof MigrationJobTask
     */
    async createMissingLookupCSVColumns(csvDataCacheMap: Map<string, Map<string, any>>): Promise<Array<ICSVIssues>> {

        let self = this;
        let csvIssues = new Array<ICSVIssues>();

        async function addMissing__rColumn(idSField: SFieldDescribe): Promise<void> {
            let columnName__r = idSField.fullName__r;
            let __rTask = self.job.getTaskBySObjectName(idSField.parentLookupObject.name);
            if (__rTask) {
                let __rFileMap: Map<string, any> = await CommonUtils.readCsvFileOnceAsync(csvDataCacheMap, __rTask.getCSVFilename());
                // TODO:
                let test = "";
            }
        }

        async function addMissingIdColumn(__rSField: SFieldDescribe): Promise<void> {
            // FIXME: Why it is not go here?
            let columnNameId = __rSField.nameId;
            let idTask = self.job.getTaskBySObjectName(__rSField.parentLookupObject.name);
            if (idTask) {
                let idFileMap: Map<string, any> = await CommonUtils.readCsvFileOnceAsync(csvDataCacheMap, idTask.getCSVFilename());
                // TODO:
                let test = "";
            }
        }

        let currentFileMap: Map<string, any> = await CommonUtils.readCsvFileOnceAsync(csvDataCacheMap, this.getCSVFilename());
        if (currentFileMap.size == 0) {
            // CSV file is empty or does not exist
            return csvIssues;
        }

        let firstRow = [...currentFileMap.values()][0];

        for (let fieldIndex = 0; fieldIndex < this.fieldsInQuery.length; fieldIndex++) {
            const sField = this.fieldsInQueryMap.get(this.fieldsInQuery[fieldIndex]);
            if (sField.is__r && sField.isReference && !firstRow.hasOwnProperty(sField.nameId)) {
                // Missing id column for __r field
                await addMissingIdColumn(sField);
            }
            if (!sField.is__r && sField.isReference && !firstRow.hasOwnProperty(sField.fullName__r)) {
                // Missing __r column for id field
                await addMissing__rColumn(sField);
            }
        }

        return csvIssues;
    }


}