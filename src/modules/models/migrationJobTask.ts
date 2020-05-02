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

    get cSVFilename(): string {
        return this.getCSVFilename(this.scriptObject.script.basePath);
    }

    get sourceCSVFilename(): string {
        let filepath = path.join(this.scriptObject.script.basePath, CONSTANTS.CSV_SOURCE_SUBDIRECTORY);
        if (!fs.existsSync(filepath)) {
            fs.mkdirSync(filepath);
        }
        return this.getCSVFilename(filepath);
    }

    get targetCSVFilename(): string {
        let filepath = path.join(this.scriptObject.script.basePath, CONSTANTS.CSV_TARGET_SUBDIRECTORY);
        if (!fs.existsSync(filepath)) {
            fs.mkdirSync(filepath);
        }
        return this.getCSVFilename(filepath);
    }

    // ----------------------- Public methods -------------------------------------------    


    /**
     * Checks the structure of the CSV source file.
     *
     * @returns {Promise<void>}
     * @memberof MigrationJob
     */
    async validateCSVStructure(): Promise<Array<ICSVIssues>> {

        let csvIssues = new Array<ICSVIssues>();

        // Check csv file --------------------------------------
        // Read the csv header row
        let csvColumnsRow = await CommonUtils.readCsvFileAsync(this.sourceCSVFilename, 1);

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
    async repairCSV(cachedCSVContent: CachedCSVContent): Promise<Array<ICSVIssues>> {

        let self = this;
        let csvIssues = new Array<ICSVIssues>();

        let currentFileMap: Map<string, any> = await CommonUtils.readCsvFileOnceAsync(cachedCSVContent.csvDataCacheMap,
            this.sourceCSVFilename,
            null, null,
            false, false);

        if (currentFileMap.size == 0) {
            // CSV file is empty or does not exist.
            // Missing csvs were already reported. No additional report provided.
            return csvIssues;
        }

        let firstRow = currentFileMap.values().next().value;

        if (!firstRow.hasOwnProperty("Id")) {
            // Add missing id column 
            ___addMissingIdColumn();

            // Update child lookup id columns
            let child__rSFields = this.scriptObject.externalIdSFieldDescribe.child__rSFields;
            for (let fieldIndex = 0; fieldIndex < child__rSFields.length; fieldIndex++) {
                const childIdSField = child__rSFields[fieldIndex].idSField;
                await ___updateChildOriginalIdColumns(childIdSField);
            }
        }

        // Add missing lookup columns 
        for (let fieldIndex = 0; fieldIndex < this.fieldsInQuery.length; fieldIndex++) {
            const sField = this.fieldsInQueryMap.get(this.fieldsInQuery[fieldIndex]);
            if (sField.isReference && (!firstRow.hasOwnProperty(sField.fullName__r) || !firstRow.hasOwnProperty(sField.nameId))) {
                await ___addMissingLookupColumns(sField);
            }
        }

        return csvIssues;


        // ------------------ internal function ------------------------- //
        /**
         * Add Id column to the current csv file (if it is missing), 
         * then update all its child lookup "__r" columns in other csv files
         */
        function ___addMissingIdColumn() {
            [...currentFileMap.keys()].forEach(id => {
                let csvRow = currentFileMap.get(id);
                csvRow["Id"] = id;
            });
            cachedCSVContent.updatedFilenames.add(self.sourceCSVFilename);
        }

        /**
         * Adds all missing lookup columns (like Account__c, Account__r.Name)
         *
         * @param {SFieldDescribe} sField sField to process
         * @returns {Promise<void>}
         */
        async function ___addMissingLookupColumns(sField: SFieldDescribe): Promise<void> {
            let columnName__r = sField.fullName__r;
            let columnNameId = sField.nameId;
            let parentExternalId = sField.parentLookupObject.externalId;
            let parentTask = self.job.getTaskBySObjectName(sField.parentLookupObject.name);
            if (parentTask) {
                let parentFileMap: Map<string, any> = await CommonUtils.readCsvFileOnceAsync(cachedCSVContent.csvDataCacheMap, parentTask.sourceCSVFilename);
                let parentCSVRowsMap = new Map<string, any>();
                [...parentFileMap.values()].forEach(parentCsvRow => {
                    let key = parentTask.getRecordValue(parentCsvRow, parentExternalId);
                    if (key) {
                        parentCSVRowsMap.set(key, parentCsvRow);
                    }
                });
                let isFileChanged = false;
                [...currentFileMap.keys()].forEach(id => {
                    let csvRow = currentFileMap.get(id);
                    if (!csvRow.hasOwnProperty(columnNameId)) {
                        if (!csvRow.hasOwnProperty(columnName__r)) {
                            // Missing both id and __r columns 
                            //        => fill them with next incremental numbers
                            // Since the missing columns were already reported no additional report provided.
                            isFileChanged = true;
                            csvRow[columnNameId] = cachedCSVContent.nextId;
                            csvRow[columnName__r] = cachedCSVContent.nextId;
                            return;
                        }
                        // Missing id column but __r column provided.
                        let desiredExternalIdValue = parentTask.getRecordValue(csvRow, parentExternalId, self.sObjectName, columnName__r);
                        if (desiredExternalIdValue) {
                            isFileChanged = true;
                            let parentCsvRow = parentCSVRowsMap.get(desiredExternalIdValue);
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
                                csvRow[columnNameId] = cachedCSVContent.nextId;
                            } else {
                                csvRow[columnNameId] = parentCsvRow["Id"];
                            }
                        }
                    } else if (!csvRow.hasOwnProperty(columnName__r)) {
                        if (!csvRow.hasOwnProperty(columnNameId)) {
                            // Missing both id and __r columns 
                            //        => fill them with next incremental numbers
                            // Since the missing columns were already reported no additional report provided.
                            isFileChanged = true;
                            csvRow[columnNameId] = cachedCSVContent.nextId;
                            csvRow[columnName__r] = cachedCSVContent.nextId;
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
                                csvRow[columnName__r] = cachedCSVContent.nextId;
                            } else {
                                isFileChanged = true;
                                csvRow[columnName__r] = parentCsvRow[parentExternalId];
                            }
                        }
                    }
                });
                if (isFileChanged) {
                    cachedCSVContent.updatedFilenames.add(self.sourceCSVFilename);
                }
            }
        }

        /**
         * When Id column was added 
         *      - updates child lookup id columns
         *      for all other objects.
         * For ex. if the current object is "Account", it will update 
         *     the child lookup id column "Account__c" of the child "Case" object
         *
         * @param {SFieldDescribe} childIdSField Child lookup id sField to process
         * @returns {Promise<void>}
         */
        async function ___updateChildOriginalIdColumns(childIdSField: SFieldDescribe): Promise<void> {
            let columnChildOriginalName__r = childIdSField.fullOriginalName__r;
            let columnChildIdName__r = childIdSField.fullIdName__r;
            let columnChildNameId = childIdSField.nameId;
            let parentOriginalExternalIdColumnName = self.scriptObject.originalExternalId;
            if (parentOriginalExternalIdColumnName != "Id") {
                let childTask = self.job.getTaskBySObjectName(childIdSField.scriptObject.name);
                if (childTask) {
                    let childFileMap: Map<string, any> = await CommonUtils.readCsvFileOnceAsync(cachedCSVContent.csvDataCacheMap, childTask.sourceCSVFilename);
                    let isFileChanged = false;
                    if (childFileMap.size > 0) {
                        let childCSVFirstRow = childFileMap.values().next().value;
                        if (childCSVFirstRow.hasOwnProperty(columnChildOriginalName__r)) {
                            let parentCSVExtIdMap = new Map<string, any>();
                            [...currentFileMap.values()].forEach(csvRow => {
                                let key = self.getRecordValue(csvRow, parentOriginalExternalIdColumnName);
                                if (key) {
                                    parentCSVExtIdMap.set(key, csvRow);
                                }
                            });
                            [...childFileMap.values()].forEach(csvRow => {
                                let extIdValue = self.getRecordValue(csvRow, parentOriginalExternalIdColumnName, childTask.sObjectName, columnChildOriginalName__r);
                                if (extIdValue && parentCSVExtIdMap.has(extIdValue)) {
                                    csvRow[columnChildNameId] = parentCSVExtIdMap.get(extIdValue)["Id"];
                                    csvRow[columnChildIdName__r] = csvRow[columnChildNameId];
                                    isFileChanged = true;
                                }
                            });
                        } else {
                            csvIssues.push({
                                Date: CommonUtils.formatDateTime(new Date()),
                                "Child sObject": childTask.sObjectName,
                                "Child field": columnChildOriginalName__r,
                                "Child value": null,
                                "Parent sObject": self.sObjectName,
                                "Parent field": "Id",
                                "Parent value": null,
                                "Error": self.logger.getResourceString(RESOURCES.cantUpdateChildLookupCSVColumn)
                            });
                        }
                    }
                    if (isFileChanged) {
                        cachedCSVContent.updatedFilenames.add(childTask.sourceCSVFilename);
                    }
                }
            }
        }

    }

    /**
     * Returns record value by given property name
     *     for the current task object
     *
     * @param {*} record The record
     * @param {string} propName The property name to extract value from the record object
     * @param {string} [sObjectName] If the current task is RecordType and propName = DeveloperName - 
     *                               pass here the SobjectType
     * @param {string} [sFieldName]  If the current task is RecordType and propName = DeveloperName -
     *                               pass here the property name to extract value from the record object
     *                               instead of passing it with the "propName" parameter
     * @returns {*}
     * @memberof MigrationJobTask
     */
    getRecordValue(record: any, propName: string, sObjectName?: string, sFieldName?: string): any {
        if (!record) return null;
        let value = record[sFieldName || propName];
        if (!value) return value;
        sObjectName = sObjectName || record["SobjectType"];
        if (this.sObjectName == "RecordType" && propName == "DeveloperName") {
            return value + ";" + sObjectName;
        } else {
            return value;
        }
    }

    /**
     * Returns full filename for the sobject of the current task
     *
     * @param {string} basePath
     * @returns {string}
     * @memberof MigrationJobTask
     */
    getCSVFilename(basePath: string): string {
        if (this.sObjectName == "User" || this.sObjectName == "Group") {
            return path.join(basePath, CONSTANTS.USER_AND_GROUP_FILENAME) + ".csv";
        } else {
            return path.join(basePath, this.sObjectName) + ".csv";
        }
    }

}