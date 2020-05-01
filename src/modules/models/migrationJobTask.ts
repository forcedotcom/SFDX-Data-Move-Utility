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
import { CachedCSVContent } from "./migrationJob";



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

        // Check csv file --------------------------------------
        // Read the csv header row
        let csvColumnsRow = await CommonUtils.readCsvFileAsync(this.getCSVFilename(), 1);

        if (csvColumnsRow.length == 0) {
            // Missing or empty file
            csvIssues.push({
                Date: CommonUtils.formatDateTime(new Date()),
                "Child sObject": this.sObjectName,
                "Child field": null,
                "Child value": null,
                "Parent sObject": null,
                "Parent field": null,
                "Parent value": null,
                "Error": this.logger.getResourceString(RESOURCES.csvFileIsEmpty)
            });
            return csvIssues;
        }


        // Check columns in the csv file ------------------------
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
                    "Child sObject": this.sObjectName,
                    "Child field": fieldName,
                    "Child value": null,
                    "Parent sObject": null,
                    "Parent field": null,
                    "Parent value": null,
                    "Error": this.logger.getResourceString(RESOURCES.columnsMissingInCSV)
                });
            }
        });

        return csvIssues;
    }



    /**
     * Try to add missing lookup csv columns
     * - Adds missing id column on Insert operation.
     * - Adds missing lookup columns like: Account__r.Name, Account__c
     *
     * @param {CachedCSVContent} cachedCSVContent The cached content of the source csv fiels
     * @returns {Promise<Array<ICSVIssues>>}
     * @memberof MigrationJobTask
     */
    async createMissingCSVColumns(cachedCSVContent: CachedCSVContent): Promise<Array<ICSVIssues>> {

        let self = this;
        let csvIssues = new Array<ICSVIssues>();

        async function ___addMissingLookupColumn(currentFileMap: Map<string, any>, sField: SFieldDescribe): Promise<void> {
            let columnName__r = sField.fullName__r;
            let columnNameId = sField.nameId;
            let parentExternalId = sField.parentLookupObject.externalId;
            let parentTask = self.job.getTaskBySObjectName(sField.parentLookupObject.name);
            if (parentTask) {
                let parentFileMap: Map<string, any> = await CommonUtils.readCsvFileOnceAsync(cachedCSVContent.csvDataCacheMap, parentTask.getCSVFilename());
                let parentCSVRows = [...parentFileMap.values()];
                let isFileChanged = false;
                [...currentFileMap.keys()].forEach(id => {
                    let csvRow = currentFileMap.get(id);
                    if (!csvRow.hasOwnProperty(columnNameId)) {
                        if (!csvRow.hasOwnProperty(columnName__r)) {
                            // Missing both id and __r columns 
                            //        => fill them with next incremental numbers
                            // Since the missing columns were already reported no additional report provided.
                            isFileChanged = true;
                            csvRow[columnNameId] = String(cachedCSVContent.idCounter++);
                            csvRow[columnName__r] = String(cachedCSVContent.idCounter++);
                            return;
                        }
                        // Missing id column but __r column provided.
                        let desiredExternalIdValue = csvRow[columnName__r];
                        if (desiredExternalIdValue) {
                            isFileChanged = true;
                            let parentCsvRow = parentCSVRows.filter(v => v[parentExternalId] == desiredExternalIdValue)[0];
                            if (!parentCsvRow) {
                                csvIssues.push({
                                    Date: CommonUtils.formatDateTime(new Date()),
                                    "Child sObject": self.sObjectName,
                                    "Child field": columnName__r,
                                    "Child value": desiredExternalIdValue,
                                    "Parent sObject": sField.parentLookupObject.name,
                                    "Parent field": parentExternalId,
                                    "Parent value": null,
                                    "Error": self.logger.getResourceString(RESOURCES.missingParentRecordForGivenLookupValue)
                                });
                                csvRow[columnNameId] = String(cachedCSVContent.idCounter++);
                            } else {
                                csvRow[columnNameId] = parentCsvRow["Id"];
                            }
                        }
                    }
                    if (!csvRow.hasOwnProperty(columnName__r)) {
                        if (!csvRow.hasOwnProperty(columnNameId)) {
                            // Missing both id and __r columns 
                            //        => fill them with next incremental numbers
                            // Since the missing columns were already reported no additional report provided.
                            isFileChanged = true;
                            csvRow[columnNameId] = String(cachedCSVContent.idCounter++);
                            csvRow[columnName__r] = String(cachedCSVContent.idCounter++);
                            return;
                        }
                        // Missing __r column but id column provided.
                        // Create __r column.
                        let idValue = csvRow[columnNameId];
                        if (idValue) {
                            isFileChanged = true;
                            let parentCsvRow = parentFileMap.get(idValue);
                            if (!parentCsvRow) {
                                csvIssues.push({
                                    Date: CommonUtils.formatDateTime(new Date()),
                                    "Child sObject": self.sObjectName,
                                    "Child field": columnNameId,
                                    "Child value": idValue,
                                    "Parent sObject": sField.parentLookupObject.name,
                                    "Parent field": "Id",
                                    "Parent value": null,
                                    "Error": self.logger.getResourceString(RESOURCES.missingParentRecordForGivenLookupValue)
                                });
                                csvRow[columnName__r] = String(cachedCSVContent.idCounter++);
                            } else {
                                isFileChanged = true;
                                csvRow[columnName__r] = parentCsvRow[parentExternalId];
                            }
                        }
                    }
                });
                if (isFileChanged) {
                    cachedCSVContent.updatedFilenames.add(self.getCSVFilename());
                }
            }
        }

        let currentFileMap: Map<string, any> = await CommonUtils.readCsvFileOnceAsync(cachedCSVContent.csvDataCacheMap,
            this.getCSVFilename(),
            null, null,
            false, false);
        if (currentFileMap.size == 0) {
            // CSV file is empty or does not exist.
            // Missing csvs were already reported. No additional report provided.
            return csvIssues;
        }

        let firstRow = [...currentFileMap.values()][0];

        // Add missing id column --------------------------------
        if (!firstRow.hasOwnProperty("Id")) {
            // Missing id column
            if (this.scriptObject.operation == OPERATION.Insert) {
                [...currentFileMap.keys()].forEach(id => {
                    let csvRow = currentFileMap.get(id);
                    csvRow["Id"] = id;
                });
            }
            cachedCSVContent.updatedFilenames.add(this.getCSVFilename());
        }

        // Add missing lookup columns --------------------
        for (let fieldIndex = 0; fieldIndex < this.fieldsInQuery.length; fieldIndex++) {
            const sField = this.fieldsInQueryMap.get(this.fieldsInQuery[fieldIndex]);
            if (sField.isReference && (!firstRow.hasOwnProperty(sField.fullName__r) || !firstRow.hasOwnProperty(sField.nameId))) {
                await ___addMissingLookupColumn(currentFileMap, sField);
            }
        }

        return csvIssues;
    }


}