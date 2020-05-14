/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import { Query } from 'soql-parser-js';
import { Common } from "../../components/common_components/common";
import { DATA_MEDIA_TYPE, OPERATION, CONSTANTS, RESULT_STATUSES, MESSAGE_IMPORTANCE } from "../../components/common_components/statics";
import { Logger, RESOURCES, LOG_MESSAGE_VERBOSITY, LOG_MESSAGE_TYPE } from "../../components/common_components/logger";
import { Sfdx } from "../../components/common_components/sfdx";
import {
    composeQuery,
    getComposedField
} from 'soql-parser-js';
import { ScriptObject, MigrationJob as Job, ICSVIssues, CommandExecutionError, ScriptOrg, Script, ScriptMockField } from "..";
import SFieldDescribe from "../script_models/sfieldDescribe";
import * as path from 'path';
import * as fs from 'fs';
import { CachedCSVContent, IMissingParentLookupRecordCsvRow } from "./migrationJob";
import * as deepClone from 'deep.clone';
import { BulkApiV2_0Engine } from "../../components/api_engines/bulkApiV2_0Engine";
import { IApiEngine } from "../api_models/interfaces";
import ApiInfo from "../api_models/apiInfo";
import { BulkApiV1_0Engine } from "../../components/api_engines/bulkApiV1_0Engine";
import { RestApiEngine } from "../../components/api_engines/restApiEngine";
const alasql = require("alasql");
import casual = require("casual");
import { MockGenerator } from '../../components/common_components/mockGenerator';


MockGenerator.createCustomGenerators(casual);

export default class MigrationJobTask {

    scriptObject: ScriptObject;
    job: Job;
    sourceTotalRecorsCount: number = 0;
    targetTotalRecorsCount: number = 0;
    apiEngine: IApiEngine;
    apiProgressCallback: (apiResult: ApiInfo) => void;


    constructor(init: Partial<MigrationJobTask>) {
        if (init) {
            Object.assign(this, init);
        }
    }

    get sObjectName(): string {
        return this.scriptObject && this.scriptObject.name;
    }

    get isPersonAccountOrContact(): boolean {
        return this.script.isPersonAccountEnabled
            && (this.sObjectName == "Account" || this.sObjectName == "Contact");
    }

    get script(): Script {
        return this.scriptObject.script;
    }

    get logger(): Logger {
        return this.script.logger;
    }

    get operation(): OPERATION {
        return this.scriptObject.operation;
    }

    get externalId(): string {
        return this.scriptObject.externalId;
    }

    get complexExternalId(): string {
        return Common.getComplexField(this.scriptObject.externalId);
    }

    data: TaskData = new TaskData(this);
    sourceData: TaskOrgData = new TaskOrgData(this, true);
    targetData: TaskOrgData = new TaskOrgData(this, false);

    //------------------
    tempData = {
        /**
        true if the script object 
        related to this task 
        has some child master-detail tasks
         */
        isMasterDetailTask: false,
        filteredQueryValueCache: new Map<string, Set<string>>()
    }



    // ----------------------- Public methods -------------------------------------------    
    /**
     * Check the structure of the CSV source file.
     *
     * @returns {Promise<void>}
     * @memberof MigrationJob
     */
    async validateCSV(): Promise<Array<ICSVIssues>> {

        let csvIssues = new Array<ICSVIssues>();

        // Check csv file --------------------------------------
        // Read the csv header row
        let csvColumnsRow = await Common.readCsvFileAsync(this.data.sourceCsvFilename, 1);

        if (csvColumnsRow.length == 0) {
            // Missing or empty file
            csvIssues.push({
                Date: Common.formatDateTime(new Date()),
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
        [...this.data.fieldsToUpdateMap.keys()].forEach(fieldName => {
            const columnExists = Object.keys(csvColumnsRow[0]).some(columnName => {
                columnName = columnName.trim();
                let nameParts = columnName.split('.');
                return columnName == fieldName
                    || nameParts.some(namePart => namePart == fieldName);
            });
            if (!columnExists) {
                // Column is missing in the csv file
                csvIssues.push({
                    Date: Common.formatDateTime(new Date()),
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

        let currentFileMap: Map<string, any> = await Common.readCsvFileOnceAsync(cachedCSVContent.csvDataCacheMap,
            this.data.sourceCsvFilename,
            null, null,
            false, false);

        if (currentFileMap.size == 0) {
            // CSV file is empty or does not exist.
            // Missing csvs were already reported. No additional report provided.
            return csvIssues;
        }

        let firstRow = currentFileMap.values().next().value;

        // Removes extra spaces from column headers
        ___trimColumnNames(firstRow);

        if (this.scriptObject.useCSVValuesMapping && this.job.csvValuesMapping.size > 0) {
            // Update csv rows with csv value mapping
            ___updateWithCSVValueMapping(firstRow);
        }

        if (!firstRow.hasOwnProperty("Id")) {
            // Add missing id column 
            ___addMissingIdColumn();

            // Update child lookup id columns
            let child__rSFields = this.scriptObject.externalIdSFieldDescribe.child__rSFields;
            for (let fieldIndex = 0; fieldIndex < child__rSFields.length; fieldIndex++) {
                const childIdSField = child__rSFields[fieldIndex].idSField;
                await ___updateChildOriginalIdColumnsAsync(childIdSField);
            }
        }

        // Add missing lookup columns 
        for (let fieldIndex = 0; fieldIndex < this.data.fieldsInQuery.length; fieldIndex++) {
            const sField = this.data.fieldsInQueryMap.get(this.data.fieldsInQuery[fieldIndex]);
            if (sField.lookup && (!firstRow.hasOwnProperty(sField.fullName__r) || !firstRow.hasOwnProperty(sField.nameId))) {
                await ___addMissingLookupColumnsAsync(sField);
            }
        }

        return csvIssues;


        // ------------------ Internal functions ------------------------- //
        /**
         * Updates csv rows according to provided value mapping file
         *
         * @param {*} firstRow
         */
        function ___updateWithCSVValueMapping(firstRow: any) {
            self.logger.infoNormal(RESOURCES.mappingRawCsvValues, self.sObjectName);
            let fields = Object.keys(firstRow);
            let csvRows = [...currentFileMap.values()];
            fields.forEach(field => {
                let key = self.sObjectName + field;
                let valuesMap = self.job.csvValuesMapping.get(key);
                if (valuesMap && valuesMap.size > 0) {
                    csvRows.forEach((csvRow: any) => {
                        let rawValue = (String(csvRow[field]) || "").trim();
                        if (valuesMap.has(rawValue)) {
                            csvRow[field] = valuesMap.get(rawValue);
                        }
                    });
                }
            });
            cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
        }

        /**
         * Trim csv header columns to remove extra unvisible symbols and spaces
         *
         * @param {*} firstRow
         */
        function ___trimColumnNames(firstRow: any) {
            let columnsToUpdate = new Array<string>();
            Object.keys(firstRow).forEach(field => {
                if (field != field.trim()) {
                    columnsToUpdate.push(field);
                }
            });
            if (columnsToUpdate.length > 0) {
                let csvRows = [...currentFileMap.values()];
                columnsToUpdate.forEach(column => {
                    let newColumn = column.trim();
                    csvRows.forEach((csvRow: any) => {
                        csvRow[newColumn] = csvRow[column];
                        delete csvRow[column];
                    });
                });
                cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
            }
        }

        /**
         * Add Id column to the current csv file (if it is missing), 
         * then update all its child lookup "__r" columns in other csv files
         */
        function ___addMissingIdColumn() {
            [...currentFileMap.keys()].forEach(id => {
                let csvRow = currentFileMap.get(id);
                csvRow["Id"] = id;
            });
            cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
        }

        /**
         * Add all missing lookup columns (like Account__c, Account__r.Name)
         *
         * @param {SFieldDescribe} sField sField to process
         * @returns {Promise<void>}
         */
        async function ___addMissingLookupColumnsAsync(sField: SFieldDescribe): Promise<void> {
            let columnName__r = sField.fullName__r;
            let columnNameId = sField.nameId;
            let parentExternalId = sField.parentLookupObject.externalId;
            let parentTask = self.job.getTaskBySObjectName(sField.parentLookupObject.name);
            if (parentTask) {
                let parentFileMap: Map<string, any> = await Common.readCsvFileOnceAsync(cachedCSVContent.csvDataCacheMap, parentTask.data.sourceCsvFilename);
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
                                    Date: Common.formatDateTime(new Date()),
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
                                    Date: Common.formatDateTime(new Date()),
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
                    cachedCSVContent.updatedFilenames.add(self.data.sourceCsvFilename);
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
        async function ___updateChildOriginalIdColumnsAsync(childIdSField: SFieldDescribe): Promise<void> {
            let columnChildOriginalName__r = childIdSField.fullOriginalName__r;
            let columnChildIdName__r = childIdSField.fullIdName__r;
            let columnChildNameId = childIdSField.nameId;
            let parentOriginalExternalIdColumnName = self.scriptObject.originalExternalId;
            if (parentOriginalExternalIdColumnName != "Id") {
                let childTask = self.job.getTaskBySObjectName(childIdSField.scriptObject.name);
                if (childTask) {
                    let childFileMap: Map<string, any> = await Common.readCsvFileOnceAsync(cachedCSVContent.csvDataCacheMap, childTask.data.sourceCsvFilename);
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
                                Date: Common.formatDateTime(new Date()),
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
                        cachedCSVContent.updatedFilenames.add(childTask.data.sourceCsvFilename);
                    }
                }
            }
        }

    }

    /**
     * Get record value by given property name
     *     for this sobject
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
        return Common.getRecordValue(this.sObjectName, record, propName, sObjectName, sFieldName);
    }

    /**
     * Get CSV filename for this sobject including the full directory path
     *
     * @param {string} rootPath The root path to append the filename to it
     * @returns {string}
     * @memberof MigrationJobTask
     */
    getCSVFilename(rootPath: string, pattern?: string): string {
        let suffix = `${pattern || ''}.csv`;
        if (this.sObjectName == "User" || this.sObjectName == "Group") {
            return path.join(rootPath, CONSTANTS.USER_AND_GROUP_FILENAME) + suffix;
        } else {
            return path.join(rootPath, this.sObjectName) + suffix;
        }
    }

    /**
     * Creates SOQL query to retrieve records
     *
     * @param {Array<string>} [fieldNames] Field names to include in the query, 
     *                                     pass undefined value to use all fields 
     *                                      of the current task
     * @param {boolean} [removeLimits=false]  true to remove LIMIT, OFFSET, ORDERBY clauses
     * @param {Query} [parsedQuery]  Default parsed query.
     * @returns {string}
     * @memberof MigrationJobTask
     */
    createQuery(fieldNames?: Array<string>, removeLimits: boolean = false, parsedQuery?: Query): string {
        parsedQuery = parsedQuery || this.scriptObject.parsedQuery;
        let tempQuery = deepClone.deepCloneSync(parsedQuery, {
            absolute: true,
        });
        if (!fieldNames)
            tempQuery.fields = this.data.fieldsInQuery.map(fieldName => getComposedField(fieldName));
        else
            tempQuery.fields = fieldNames.map(fieldName => getComposedField(fieldName));
        if (removeLimits) {
            tempQuery.limit = undefined;
            tempQuery.offset = undefined;
            tempQuery.orderBy = undefined;
        }
        return composeQuery(tempQuery);
    }

    /**
     * Converts full query string into short form
     * to be displayed in the stdout
     *
     * @param {string} query
     * @returns {string}
     * @memberof MigrationJobTask
     */
    createShortQueryString(longString: string): string {
        let parts = longString.split("FROM");
        return parts[0].substr(0, CONSTANTS.SHORT_QUERY_STRING_MAXLENGTH) +
            (parts[0].length > CONSTANTS.SHORT_QUERY_STRING_MAXLENGTH ? "..." : "") +
            " FROM "
            + parts[1].substr(0, CONSTANTS.SHORT_QUERY_STRING_MAXLENGTH) +
            (parts[1].length > CONSTANTS.SHORT_QUERY_STRING_MAXLENGTH ? "..." : "");
    }

    /**
     * Create SOQL query to delete records
     *
     * @returns
     * @memberof MigrationJobTask
     */
    createDeleteQuery() {
        if (!this.scriptObject.parsedDeleteQuery) {
            return this.createQuery(["Id"], true);
        } else {
            return this.createQuery(["Id"], true, this.scriptObject.parsedDeleteQuery);
        }
    }

    /**
    * Retireve the total records count 
    *
    * @returns {Promise<void>}
    * @memberof MigrationJobTask
    */
    async getTotalRecordsCountAsync(): Promise<void> {

        let queryOrNumber = this.createQuery(['COUNT(Id) CNT'], true);

        if (this.sourceData.media == DATA_MEDIA_TYPE.Org) {
            let apiSf = new Sfdx(this.sourceData.org);
            let ret = await apiSf.queryAsync(queryOrNumber, false);
            this.sourceTotalRecorsCount = Number.parseInt(ret.records[0]["CNT"]);
            if (this.scriptObject.parsedQuery.limit) {
                this.sourceTotalRecorsCount = Math.min(this.sourceTotalRecorsCount, this.scriptObject.parsedQuery.limit);
            }
            this.logger.infoNormal(RESOURCES.totalRecordsAmount, this.sObjectName,
                this.sourceData.resourceString_Source_Target, String(this.sourceTotalRecorsCount));
        }

        if (this.targetData.media == DATA_MEDIA_TYPE.Org) {
            let apiSf = new Sfdx(this.targetData.org);
            let ret = await apiSf.queryAsync(queryOrNumber, false);
            this.targetTotalRecorsCount = Number.parseInt(ret.records[0]["CNT"]);
            if (this.scriptObject.parsedQuery.limit) {
                this.targetTotalRecorsCount = Math.min(this.targetTotalRecorsCount, this.scriptObject.parsedQuery.limit);
            }
            this.logger.infoNormal(RESOURCES.totalRecordsAmount, this.sObjectName,
                this.targetData.resourceString_Source_Target, String(this.targetTotalRecorsCount));
        }
    }

    /**
     * Delete old records from the target org
     *
     * @returns {Promise<void>}
     * @memberof MigrationJobTask
     */
    async deleteOldTargetRecords(): Promise<boolean> {
        // Checking
        if (!(this.targetData.media == DATA_MEDIA_TYPE.Org
            && this.scriptObject.operation != OPERATION.Readonly
            && this.scriptObject.deleteOldData)) {
            this.logger.infoNormal(RESOURCES.nothingToDelete, this.sObjectName);
            return false;
        }
        // Querying
        this.logger.infoNormal(RESOURCES.deletingTargetSObject, this.sObjectName);
        let soql = this.createDeleteQuery();
        let apiSf = new Sfdx(this.targetData.org);
        let queryResult = await apiSf.queryAsync(soql, this.targetData.useBulkQueryApi);
        if (queryResult.totalSize == 0) {
            this.logger.infoNormal(RESOURCES.nothingToDelete, this.sObjectName);
            return false;
        }
        // Deleting
        this.logger.infoVerbose(RESOURCES.deletingFromTheTargetNRecordsWillBeDeleted, this.sObjectName, String(queryResult.totalSize));
        let recordsToDelete = queryResult.records.map(x => {
            return {
                Id: x["Id"]
            }
        });

        // TODO*PUTBACKIT! Enable rows below to delete records
        this.createApiEngine(this.targetData.org, OPERATION.Delete, recordsToDelete.length, true);
        let resultRecords = await this.apiEngine.executeCRUD(recordsToDelete, this.apiProgressCallback);
        if (resultRecords == null) {
            // API ERROR. Exiting.
            this._apiOperationError(OPERATION.Delete);
        }

        // Done
        this.logger.infoVerbose(RESOURCES.deletingFromTheTargetCompleted, this.sObjectName);
        return true;
    }

    /**
     * Retrieve records for this task
     * 
     * @param {number} queryMode The mode of record processing
     * @param {boolean} reversed If TRUE - queries from the child related object to parent object
     *                           (selects all parent objects that exist in the child objects)
     *                                      forward:   parent <== *child (before, prev)
     *                                      backward:  *child ==> parent (after, next)
     *                           If FALSE - queries from the parent related object to child object
     *                           (selects all child objects that exist in the parent objects)
     *                                      forward:   child ==> *parent (before, prev)
     *                                      backward:  *parent <== child (after, next)
     * @returns {Promise<void>}
     * @memberof MigrationJobTask
     */
    async retrieveRecords(queryMode: "forwards" | "backwards" | "target", reversed: boolean): Promise<boolean> {

        let self = this;

        // Checking status *********
        if (this.operation == OPERATION.Delete) return;

        let records: Array<any> = new Array<any>();

        // Read SOURCE DATA *********************************************************************************************
        // **************************************************************************************************************
        let hasRecords = false;
        if (queryMode != "target") {
            // Read main data *************************************
            // ****************************************************
            if (this.sourceData.media == DATA_MEDIA_TYPE.File && queryMode == "forwards") {
                // Read from the SOURCE CSV FILE ***********************************
                if (!reversed) {
                    let query = this.createQuery();
                    // Start message ------
                    this.logger.infoNormal(RESOURCES.queryingAll, this.sObjectName, this.sourceData.resourceString_Source_Target, this.data.resourceString_csvFile, this.data.resourceString_Step(queryMode));
                    let sfdx = new Sfdx(this.targetData.org);
                    records = await sfdx.retrieveRecordsAsync(query, false, this.data.sourceCsvFilename, this.targetData.fieldsMap);
                    hasRecords = true;
                }
            } else if (this.sourceData.media == DATA_MEDIA_TYPE.Org) {
                // Read from the SOURCE ORG **********************************************
                if (this.scriptObject.processAllSource && queryMode == "forwards" && !reversed) {
                    // All records *********** //
                    let query = this.createQuery();
                    // Start message ------
                    this.logger.infoNormal(RESOURCES.queryingAll, this.sObjectName, this.sourceData.resourceString_Source_Target, this.data.resourceString_org,
                        this.data.resourceString_Step(queryMode));
                    // Query string message ------    
                    this.logger.infoVerbose(RESOURCES.queryString, this.sObjectName, this.createShortQueryString(query));
                    // Fetch records                
                    let sfdx = new Sfdx(this.sourceData.org);
                    records = await sfdx.retrieveRecordsAsync(query, this.sourceData.useBulkQueryApi);
                    hasRecords = true;
                } else if (!this.scriptObject.processAllSource) {
                    // Filtered records ************ //
                    let queries = this._createFilteredQueries(queryMode, reversed);
                    if (queries.length > 0) {
                        // Start message ------
                        this.logger.infoNormal(RESOURCES.queryingIn, this.sObjectName, this.sourceData.resourceString_Source_Target, this.data.resourceString_org, this.data.resourceString_Step(queryMode));
                        // Fetch records
                        records = await ___retrieveFilteredRecords(queries, this.sourceData);
                        hasRecords = true;
                    }
                }
            }
            if (hasRecords) {
                // Set external id map ---------
                let newRecordsCount = this._setExternalIdMap(records, this.sourceData.extIdRecordsMap, this.sourceData.idRecordsMap);
                // Completed message ------
                this.logger.infoNormal(RESOURCES.queryingFinished, this.sObjectName, this.sourceData.resourceString_Source_Target, String(newRecordsCount));
            }

            // Read SELF REFERENCE records from the SOURCE *************
            // *********************************************************
            if (this.sourceData.media == DATA_MEDIA_TYPE.Org && queryMode == "forwards") {
                records = new Array<any>();
                let inValues: Array<string> = new Array<string>();
                for (let fieldIndex = 0; fieldIndex < this.data.fieldsInQuery.length; fieldIndex++) {
                    const describe = this.data.fieldsInQueryMap.get(this.data.fieldsInQuery[fieldIndex]);
                    if (describe.isSimpleSelfReference) {
                        this.sourceData.records.forEach(sourceRec => {
                            if (sourceRec[describe.name]) {
                                inValues.push(sourceRec[describe.name]);
                            }
                        });
                    }
                }
                if (inValues.length > 0) {
                    // Start message ------
                    this.logger.infoNormal(RESOURCES.queryingSelfReferenceRecords, this.sObjectName, this.sourceData.resourceString_Source_Target);
                    inValues = Common.distinctStringArray(inValues);
                    let sfdx = new Sfdx(this.sourceData.org);
                    let queries = Common.createFieldInQueries(this.data.fieldsInQuery, "Id", this.sObjectName, inValues);
                    for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
                        const query = queries[queryIndex];
                        // Query string message ------
                        this.logger.infoVerbose(RESOURCES.queryString, this.sObjectName, this.createShortQueryString(query));
                        // Fetch records
                        records = records.concat(await sfdx.retrieveRecordsAsync(query));
                    }
                    if (queries.length > 0) {
                        // Set external id map ---------
                        let newRecordsCount = this._setExternalIdMap(records, this.sourceData.extIdRecordsMap, this.sourceData.idRecordsMap);
                        // Completed message ------
                        this.logger.infoNormal(RESOURCES.queryingFinished, this.sObjectName, this.sourceData.resourceString_Source_Target, String(newRecordsCount));
                    }
                }
            }
        }


        // Read TARGET DATA ***********************************************************************************
        // ****************************************************************************************************
        if (queryMode == "target") {
            hasRecords = false;
            if (this.targetData.media == DATA_MEDIA_TYPE.Org && this.operation != OPERATION.Insert) {
                // Read from the TARGET ORG *********
                records = new Array<any>();
                if (this.scriptObject.processAllTarget) {
                    // All records ****** //
                    let query = this.createQuery();
                    // Start message ------
                    this.logger.infoNormal(RESOURCES.queryingAll, this.sObjectName, this.targetData.resourceString_Source_Target, this.data.resourceString_org, this.data.resourceString_Step(queryMode));
                    // Query string message ------
                    this.logger.infoVerbose(RESOURCES.queryString, this.sObjectName, this.createShortQueryString(query));
                    // Fetch records
                    let sfdx = new Sfdx(this.targetData.org);
                    records = await sfdx.retrieveRecordsAsync(query, this.targetData.useBulkQueryApi);
                    hasRecords = true;
                } else {
                    // Filtered records ***** //
                    let queries = this._createFilteredQueries(queryMode, reversed);
                    if (queries.length > 0) {
                        // Start message ------
                        this.logger.infoNormal(RESOURCES.queryingIn, this.sObjectName, this.targetData.resourceString_Source_Target, this.data.resourceString_org, this.data.resourceString_Step(queryMode));
                        // Fetch records
                        records = await ___retrieveFilteredRecords(queries, this.targetData);
                        hasRecords = true;
                    }
                }
            }
            if (hasRecords) {
                // Set external id map --------- TARGET
                let newRecordsCount = this._setExternalIdMap(records, this.targetData.extIdRecordsMap, this.targetData.idRecordsMap, true);
                // Completed message ------
                this.logger.infoNormal(RESOURCES.queryingFinished, this.sObjectName, this.targetData.resourceString_Source_Target, String(newRecordsCount));
            }
        }

        return hasRecords;

        // ------------------------ Internal functions --------------------------

        async function ___retrieveFilteredRecords(queries: string[], orgData: TaskOrgData): Promise<Array<any>> {
            let sfdx = new Sfdx(orgData.org);
            let records = new Array<any>();
            for (let index = 0; index < queries.length; index++) {
                const query = queries[index];
                // Query message ------
                self.logger.infoVerbose(RESOURCES.queryString, self.sObjectName, self.createShortQueryString(query));
                // Fetch records
                records = records.concat(await sfdx.retrieveRecordsAsync(query, false));
            }
            return records;
        }
    }

    /**
     * Perform record update
     *
     * @param {("forwards" | "backwards")} updateMode
     * @param {(data : ProcessedData) => boolean} warnUserCallbackAsync true to abort the job
     * @returns {Promise<number>} Total amount of updated records
     * @memberof MigrationJobTask
     */
    async updateRecords(updateMode: "forwards" | "backwards", warnUserCallbackAsync: (data: ProcessedData) => Promise<void>): Promise<number> {

        let self = this;

        if (this.targetData.media == DATA_MEDIA_TYPE.File) {
            //  WRITE CSV ::::::::::
            if (this.operation != OPERATION.Delete && updateMode == "forwards") {
                this.logger.infoNormal(RESOURCES.writingToFile, this.sObjectName, this.data.csvFilename);
                let records = await ___filterRecords(this.sourceData.records);
                records = ___mockRecords(records);
                records.forEach(record => {
                    delete records[CONSTANTS.__ID_FIELD];
                });
                await ___writeToTargetCSVFile(records);
                await Common.writeCsvFileAsync(self.data.csvFilename, records, true);
                return records.length;
            }
            return 0;
        }

        //  UPDATE ORG :::::::::
        let totalProcessedRecordsAmount = 0;

        if (this.operation != OPERATION.Readonly && this.operation != OPERATION.Delete) {
            // Non-person Accounts/Contacts + other objects //////////
            // Create data ****
            let data = await ___createUpdateData(false);
            if (data.missingParentLookups.length > 0) {
                // Warn user
                await warnUserCallbackAsync(data);
            }
            // Process data ****
            totalProcessedRecordsAmount += (await ___updatetOrg(data));

            // Person Accounts/Contacts only /////////////           
            if (this.isPersonAccountOrContact) {
                // Create data ****
                data = await ___createUpdateData(true);
                if (data.missingParentLookups.length > 0) {
                    // Warn user
                    await warnUserCallbackAsync(data);
                }
                // Process data ****
                totalProcessedRecordsAmount += (await ___updatetOrg(data));
            }

        }
        return totalProcessedRecordsAmount;


        // ------------------------ Internal functions --------------------------
        async function ___createUpdateData(personAccounts: boolean): Promise<ProcessedData> {

            let processedData = new ProcessedData();

            // Get list of sFields to process /////////
            processedData.fields = self.data.sFieldsToUpdate.filter((field: SFieldDescribe) => {
                if (updateMode == "forwards")
                    // For Step 1 : Simple sFields or reference fields with the parent lookup BEFORE
                    return field.isSimple || field.isSimpleReference && self.data.prevTasks.indexOf(field.parentLookupObject.task) >= 0;
                else
                    // For Step 2 : Reference sFields with the parent lookup AFTER
                    return field.isSimpleReference && self.data.nextTasks.concat(self).indexOf(field.parentLookupObject.task) >= 0;
            }).concat(new SFieldDescribe({
                name: CONSTANTS.__ID_FIELD
            }));

            // Add recordId sField //////////
            if (self.operation != OPERATION.Insert) {
                processedData.fields.push(self.data.sFieldsInQuery.filter(field => field.nameId == "Id")[0]);
            }

            // Fields for person accounts/contacts /////////
            if (self.isPersonAccountOrContact) {
                processedData.fields = self.sObjectName == "Account" ?
                    processedData.fields.filter((field: SFieldDescribe) => {
                        // For Person account
                        return !field.person && CONSTANTS.FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_PERSON_ACCOUNT.indexOf(field.nameId) < 0;
                    }) : processedData.fields.filter(field => {
                        // For Person contact
                        return CONSTANTS.FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_PERSON_CONTACT.indexOf(field.nameId) < 0;
                    });
            }

            // Prepare records //////////////
            // Map: cloned => source 
            let tempClonedToSourceMap = Common.cloneArrayOfObjects(self.sourceData.records, processedData.fieldNames);

            // Map: "___Id" => cloned
            let ___IdToClonedMap = new Map<string, any>();
            [...tempClonedToSourceMap.keys()].forEach(cloned => {
                ___IdToClonedMap.set(cloned[CONSTANTS.__ID_FIELD], cloned);
            });

            // Map: cloned => source 
            //    + update lookup Id fields (f.ex. Account__c)
            if (self.isPersonAccountOrContact) {
                if (personAccounts) {
                    // Only non-person Acounts/Contacts (IsPersonAccount == null)
                    tempClonedToSourceMap.forEach((source, cloned) => {
                        if (!source["IsPersonAccount"]) {
                            ___updateLookupIdFields(processedData, source, cloned);
                            processedData.clonedToSourceMap.set(cloned, source);
                        }
                    });
                } else {
                    // Only person Acounts/Contacts (IsPersonAccount != null)
                    tempClonedToSourceMap.forEach((source, cloned) => {
                        if (!!source["IsPersonAccount"]) {
                            ___updateLookupIdFields(processedData, source, cloned);
                            processedData.clonedToSourceMap.set(cloned, source);
                        }
                    });
                }
            } else {
                // Other objects (all items)
                tempClonedToSourceMap.forEach((source, cloned) => {
                    ___updateLookupIdFields(processedData, source, cloned);
                    processedData.clonedToSourceMap.set(cloned, source);
                });
            }

            // Filter records /////////////
            tempClonedToSourceMap = processedData.clonedToSourceMap;
            processedData.clonedToSourceMap = new Map<any, any>();
            let clonedRecords = await ___filterRecords([...tempClonedToSourceMap.keys()]);
            clonedRecords = ___mockRecords(clonedRecords);
            clonedRecords.forEach(cloned => {
                let initialCloned = ___IdToClonedMap.get(cloned[CONSTANTS.__ID_FIELD]);
                let source = tempClonedToSourceMap.get(initialCloned);
                processedData.clonedToSourceMap.set(cloned, source);
            });

            // Finalizing: Create separated record sets to Update/Insert /////////////
            processedData.clonedToSourceMap.forEach((source, cloned) => {
                delete cloned[CONSTANTS.__ID_FIELD];
                let target = self.data.sourceToTargetRecordMap.get(source);
                if (target && updateMode == "backwards") {
                    cloned["Id"] = target["Id"];
                    processedData.recordsToUpdate.push(cloned);
                } else if (!target && self.operation == OPERATION.Upsert || self.operation == OPERATION.Insert) {
                    delete cloned["Id"];
                    processedData.recordsToInsert.push(cloned);
                } else if (target && (self.operation == OPERATION.Upsert || self.operation == OPERATION.Update)) {
                    cloned["Id"] = target["Id"];
                    processedData.recordsToUpdate.push(cloned);
                }
            });

            // Free memory and return
            tempClonedToSourceMap = null;
            return processedData;
        }

        /**
        * @returns {Promise<number>} Number of records actually processed
        */
        async function ___updatetOrg(data: ProcessedData): Promise<number> {
            let totalProcessedAmount = 0;
            if (data.recordsToInsert.length > 0) {
                self.createApiEngine(self.targetData.org, OPERATION.Insert, data.recordsToInsert.length, true);
                let targetRecords = await self.apiEngine.executeCRUD(data.recordsToInsert, self.apiProgressCallback);
                if (targetRecords == null) {
                    // API ERROR. Exiting.
                    self._apiOperationError(OPERATION.Insert);
                }
                totalProcessedAmount += targetRecords.length;
                if (self.sObjectName == "TestObject2__c"){
                    let eee = "";
                }
                self._setExternalIdMap(targetRecords, self.targetData.extIdRecordsMap, self.targetData.idRecordsMap);
                targetRecords.forEach(target => {
                    let source = data.clonedToSourceMap.get(target);
                    if (source) {
                        self.data.sourceToTargetRecordMap.set(source, target);
                    }
                });
            }
            if (data.recordsToUpdate.length > 0) {
                self.createApiEngine(self.targetData.org, OPERATION.Update, data.recordsToUpdate.length, false);
                let targetRecords = await self.apiEngine.executeCRUD(data.recordsToUpdate, self.apiProgressCallback);
                if (targetRecords == null) {
                    // API ERROR. Exiting.
                    self._apiOperationError(OPERATION.Update);
                }
                totalProcessedAmount += targetRecords.length;
            }


            return totalProcessedAmount;
        }

        function ___updateLookupIdFields(processedData: ProcessedData, source: any, cloned: any) {
            processedData.lookupIdFields.forEach(idField => {
                cloned[idField.nameId] = null;
                let found = false;
                let parentId = source[idField.nameId];
                if (parentId) {
                    let parentTask = idField.parentLookupObject.task;
                    let parentRecord = parentTask.sourceData.idRecordsMap.get(parentId);
                    if (parentRecord) {
                        let targetRecord = parentTask.data.sourceToTargetRecordMap.get(parentRecord);
                        if (targetRecord) {
                            let id = targetRecord["Id"];
                            if (id) {
                                cloned[idField.nameId] = id;
                                found = true;
                            }
                        }
                    }
                }
                if (parentId && !found) {
                    let csvRow: IMissingParentLookupRecordCsvRow = {
                        "Date update": Common.formatDateTime(new Date()),
                        "Child ExternalId field": idField.fullName__r,
                        "Child lookup field": idField.nameId,
                        "Child lookup object": idField.scriptObject.name,
                        "Missing parent ExternalId value": source[idField.fullName__r],
                        "Parent ExternalId field": idField.parentLookupObject.externalId,
                        "Parent lookup object": idField.parentLookupObject.name
                    };
                    processedData.missingParentLookups.push(csvRow);
                }
            });
        }

        async function ___filterRecords(records: Array<any>): Promise<Array<any>> {
            return new Promise<Array<any>>(resolve => {
                if (!self.scriptObject.targetRecordsFilter) {
                    resolve(records);
                    return;
                }
                try {
                    return alasql(`SELECT * FROM ? WHERE ${self.scriptObject.targetRecordsFilter}`, [records], function (selectedRecords: any) {
                        resolve(selectedRecords);
                    });
                } catch (ex) {
                    resolve(records);
                }
            });
        }

        async function ___writeToTargetCSVFile(records: Array<any>): Promise<void> {
            if (self.script.createTargetCSVFiles) {
                await Common.writeCsvFileAsync(self.data.targetCSVFilename(self.operation), records, true);
            }
        }

        function ___mockRecords(records: Array<any>): Array<any> {
            let updatedRecords = new Array<any>();
            if (records.length == 0) {
                return updatedRecords;
            }
            let recordIds = records.map(x => x["Id"]);
            let recordProperties = Object.keys(records[0]);
            if (self.scriptObject.updateWithMockData && self.scriptObject.mockFields.length > 0) {
                let fieldNameToMockFieldMap: Map<string, IMockField> = new Map<string, IMockField>();
                [...self.data.fieldsToUpdateMap.values()].forEach(fieldDescribe => {
                    let mockField = ___getMockPatternByFieldName(fieldDescribe.name);
                    if (recordProperties.indexOf(mockField.name) >= 0 && mockField.pattern) {
                        let fn = mockField.pattern;
                        if (CONSTANTS.SPECIAL_MOCK_COMMANDS.some(x => fn.startsWith(x + "("))) {
                            fn = fn.replace(/\(/, `('${mockField.name}',`);
                        }
                        mockField.excludedRegex = mockField.excludedRegex || '';
                        mockField.includedRegex = mockField.includedRegex || '';
                        fieldNameToMockFieldMap.set(mockField.name, <IMockField>{
                            fn,
                            regExcl: mockField.excludedRegex.split(CONSTANTS.MOCK_PATTERN_ENTIRE_ROW_FLAG)[0].trim(),
                            regIncl: mockField.includedRegex.split(CONSTANTS.MOCK_PATTERN_ENTIRE_ROW_FLAG)[0].trim(),
                            disallowMockAllRecord: mockField.excludedRegex.indexOf(CONSTANTS.MOCK_PATTERN_ENTIRE_ROW_FLAG) >= 0,
                            allowMockAllRecord: mockField.includedRegex.indexOf(CONSTANTS.MOCK_PATTERN_ENTIRE_ROW_FLAG) >= 0,
                        });
                    }
                });
                MockGenerator.resetCounter();
                records.forEach((originalRecord: any, index: number) => {
                    let updatedRecord = Object.assign({}, originalRecord);
                    let doNotMock = false;
                    let mockAllRecord = false;
                    let fieldsToMockMap: Map<string, boolean> = new Map<string, boolean>();
                    [...fieldNameToMockFieldMap.keys()].forEach(fieldName => {
                        if (!doNotMock) {
                            let mockField = fieldNameToMockFieldMap.get(fieldName);
                            let value = String(updatedRecord[fieldName]);
                            let excluded = mockField.regExcl && (new RegExp(mockField.regExcl, 'ig').test(value));
                            let included = mockField.regIncl && (new RegExp(mockField.regIncl, 'ig').test(value));
                            if (included && mockField.allowMockAllRecord) {
                                mockAllRecord = true;
                            }
                            if (excluded && mockField.disallowMockAllRecord) {
                                doNotMock = true;
                            } else {
                                if (mockAllRecord || (!mockField.regExcl || !excluded) && (!mockField.regIncl || included)) {
                                    fieldsToMockMap.set(fieldName, true);
                                }
                            }
                        }
                    });
                    if (!doNotMock) {
                        [...fieldNameToMockFieldMap.keys()].forEach(fieldName => {
                            if (mockAllRecord || fieldsToMockMap.has(fieldName)) {
                                let mockField = fieldNameToMockFieldMap.get(fieldName);
                                if (mockField.fn == "ids") {
                                    updatedRecord[fieldName] = recordIds[index];
                                } else {
                                    updatedRecord[fieldName] = eval(`casual.${mockField.fn}`);
                                }
                            }
                        });
                    }

                    updatedRecords.push(updatedRecord);
                });
            } else {
                return records;
            }
            return updatedRecords;
        }

        function ___getMockPatternByFieldName(fieldName: string): ScriptMockField {
            return self.scriptObject.mockFields.filter(field => field.name == fieldName)[0] || new ScriptMockField();
        }
    }

    /**
     * Creates new api engine for the given org and operation
     *
     * @param {ScriptOrg} org The org to connect the api engine
     * @param {OPERATION} operation The operation to perform
     * @param {boolean} updateRecordId Allow update Id property 
     *                                of the processed (the source) records 
     *                                with the target record ids
     * @param {number} amountOfRecordsToProcess The total amount of records that should 
     *                                          be processed using this engine instance
     * @returns {IApiEngine}
     * @memberof MigrationJobTask
     */
    createApiEngine(org: ScriptOrg, operation: OPERATION, amountOfRecordsToProcess: number, updateRecordId: boolean): IApiEngine {

        if (amountOfRecordsToProcess > this.script.bulkThreshold && !this.script.alwaysUseRestApiToUpdateRecords) {
            // Use bulk api
            switch (this.script.bulkApiVersionNumber) {
                case 2: // Bulk Api V2.0
                    this.apiEngine = new BulkApiV2_0Engine({
                        logger: this.logger,
                        connectionData: org.connectionData,
                        sObjectName: this.sObjectName,
                        operation,
                        pollingIntervalMs: this.script.pollingIntervalMs,
                        updateRecordId,
                        targetCSVFullFilename: this.data.targetCSVFilename(operation),
                        createTargetCSVFiles: this.script.createTargetCSVFiles
                    });
                    break;
                default: // Bulk Api V1.0
                    this.apiEngine = new BulkApiV1_0Engine({
                        logger: this.logger,
                        connectionData: org.connectionData,
                        sObjectName: this.sObjectName,
                        operation,
                        pollingIntervalMs: this.script.pollingIntervalMs,
                        updateRecordId,
                        bulkApiV1BatchSize: this.script.bulkApiV1BatchSize,
                        targetCSVFullFilename: this.data.targetCSVFilename(operation),
                        createTargetCSVFiles: this.script.createTargetCSVFiles
                    });
                    break;
            }
        } else {
            // Use rest api
            this.apiEngine = new RestApiEngine({
                logger: this.logger,
                connectionData: org.connectionData,
                sObjectName: this.sObjectName,
                operation,
                pollingIntervalMs: this.script.pollingIntervalMs,
                updateRecordId,
                allOrNone: this.script.allOrNone,
                targetCSVFullFilename: this.data.targetCSVFilename(operation),
                createTargetCSVFiles: this.script.createTargetCSVFiles
            });
        }
        this.apiProgressCallback = this.apiProgressCallback || this._apiProgressCallback.bind(this);
        return this.apiEngine;
    }


    // ----------------------- Private members -------------------------------------------
    private _apiProgressCallback(apiResult: ApiInfo): void {

        let verbosity = LOG_MESSAGE_VERBOSITY.MINIMAL;
        let logMessageType = LOG_MESSAGE_TYPE.STRING;

        switch (apiResult.messageImportance) {
            case MESSAGE_IMPORTANCE.Low:
                verbosity = LOG_MESSAGE_VERBOSITY.VERBOSE;
                break;
            case MESSAGE_IMPORTANCE.Normal:
                verbosity = LOG_MESSAGE_VERBOSITY.NORMAL;
                break;
            case MESSAGE_IMPORTANCE.Warn:
                logMessageType = LOG_MESSAGE_TYPE.WARN;
                break;
            case MESSAGE_IMPORTANCE.Error:
                logMessageType = LOG_MESSAGE_TYPE.ERROR;
                break;
        }
        switch (apiResult.resultStatus) {
            case RESULT_STATUSES.Information:
                if (apiResult.informationMessageData.length > 0) {
                    // [0] - always is the RESOURCE message
                    // [1...] - the rest of the RESOURCE message tokens
                    let resourceString = this.logger.getResourceString.apply(this.logger, [apiResult.informationMessageData[0], ...apiResult.informationMessageData.slice(1)])
                    this.logger.log.apply(this.logger, [resourceString, logMessageType, verbosity]);
                }
                break;
            case RESULT_STATUSES.ApiOperationStarted:
                this.logger.log(RESOURCES.apiOperationStarted, logMessageType, verbosity, this.sObjectName, this.apiEngine.getStrOperation(), this.apiEngine.getEngineName());
                break;
            case RESULT_STATUSES.ApiOperationFinished:
                this.logger.log(RESOURCES.apiOperationFinished, logMessageType, verbosity, this.sObjectName, this.apiEngine.getStrOperation());
                break;
            case RESULT_STATUSES.JobCreated:
                this.logger.log(RESOURCES.apiOperationJobCreated, logMessageType, verbosity, apiResult.jobId, this.apiEngine.getStrOperation(), this.sObjectName);
                break;
            case RESULT_STATUSES.BatchCreated:
                this.logger.log(RESOURCES.apiOperationBatchCreated, logMessageType, verbosity, apiResult.batchId, this.apiEngine.getStrOperation(), this.sObjectName);
                break;
            case RESULT_STATUSES.DataUploaded:
                this.logger.log(RESOURCES.apiOperationDataUploaded, logMessageType, verbosity, apiResult.batchId, this.apiEngine.getStrOperation(), this.sObjectName);
                break;
            case RESULT_STATUSES.InProgress:
                this.logger.log(RESOURCES.apiOperationInProgress, logMessageType, verbosity, apiResult.batchId, this.apiEngine.getStrOperation(), this.sObjectName, String(apiResult.numberRecordsProcessed), String(apiResult.numberRecordsFailed));
                break;
            case RESULT_STATUSES.Completed:
                this.logger.log(logMessageType != LOG_MESSAGE_TYPE.WARN ? RESOURCES.apiOperationCompleted : RESOURCES.apiOperationWarnCompleted, logMessageType, verbosity, apiResult.batchId, this.apiEngine.getStrOperation(), this.sObjectName, String(apiResult.numberRecordsProcessed), String(apiResult.numberRecordsFailed));
                break;
            case RESULT_STATUSES.ProcessError:
            case RESULT_STATUSES.FailedOrAborted:
                if (apiResult.errorMessage)
                    this.logger.log(RESOURCES.apiOperationProcessError, logMessageType, verbosity, this.sObjectName, this.apiEngine.getStrOperation(), apiResult.errorMessage);
                else
                    this.logger.log(RESOURCES.apiOperationFailed, logMessageType, verbosity, this.sObjectName, this.apiEngine.getStrOperation());
                break;
        }
    }

    private _apiOperationError(operation: OPERATION) {
        throw new CommandExecutionError(this.logger.getResourceString(RESOURCES.apiOperationFailed, this.sObjectName, this.apiEngine.getStrOperation()));
    }

    private _createFilteredQueries(queryMode: "forwards" | "backwards" | "target", reversed: boolean): Array<string> {

        let queries = new Array<string>();
        let fieldsToQueryMap: Map<SFieldDescribe, Array<string>> = new Map<SFieldDescribe, Array<string>>();
        let isSource = queryMode != "target";

        if (reversed) {
            if (CONSTANTS.OBJECTS_NOT_TO_USE_IN_FILTERED_QUERYIN_CLAUSE.indexOf(this.sObjectName) < 0) {
                // ONLY SOURCE + FORWARDS FOR reversed == true !
                let fields: SFieldDescribe[] = Common.flatMap([...this.data.fieldsInQueryMap.values()]
                    .filter(field => field.child__rSFields.length > 0), (field: SFieldDescribe) => {
                        return field.child__rSFields.map(f => f.idSField);
                    });
                let values = new Array<string>();
                fields.forEach((field: SFieldDescribe) => {
                    values = values.concat(field.scriptObject.task.sourceData.records
                        .map((value: any) => value[field.nameId])
                        .filter(value => !!value));
                });
                values = Common.distinctStringArray(values);
                fieldsToQueryMap.set(new SFieldDescribe({
                    name: "Id"
                }), values);
            }
        } else {
            [...this.data.fieldsInQueryMap.values()].forEach(field => {
                if (isSource) {
                    // SOURCE
                    // For source => |SOURCE Case|Account__c IN (|SOURCE Account|Id....)            
                    if (field.isSimpleReference && CONSTANTS.OBJECTS_NOT_TO_USE_IN_FILTERED_QUERYIN_CLAUSE.indexOf(field.referencedObjectType) < 0) {
                        // Only for simple reference lookup fields (f.ex.: Account__c)
                        if (!field.parentLookupObject.task.sourceData.allRecords || field.parentLookupObject.isLimitedQuery) {
                            if (queryMode != "forwards") {
                                // FORWARDS
                                // For forwards => build the query using all the PREVIOUS related tasks by the tasks order
                                if (this.data.prevTasks.indexOf(field.parentLookupObject.task) >= 0) {
                                    // The parent task is before => create child lookup query for all Id values of the parent lookup object
                                    fieldsToQueryMap.set(field, [...field.parentLookupObject.task.sourceData.idRecordsMap.keys()]);
                                }
                            } else {
                                // BACKWARDS
                                // For backwards => build the query using all the NEXT related tasks by the tasks order
                                if (this.data.nextTasks.indexOf(field.parentLookupObject.task) >= 0) {
                                    // The parent task is before => create child lookup query for all Id values of the parent lookup object
                                    fieldsToQueryMap.set(field, [...field.parentLookupObject.task.sourceData.idRecordsMap.keys()]);
                                }
                            }
                        }
                    }
                } else {
                    // TARGET
                    // For target => |TARGET Account|Name IN (|SOURCE Account|Name....)
                    if (field.isSimple && field.isExternalIdField) {
                        // Only for current object's external id (f.ex.: Name) - not complex and not Id - only simple
                        fieldsToQueryMap.set(field, [...this.sourceData.extIdRecordsMap.keys()].map(value => Common.getFieldValue(this.sObjectName, value, field.name)));
                    }
                }
            });
        }

        if (isSource && this.scriptObject.isLimitedQuery && !reversed) {
            queries.push(this.createQuery());
        }
        fieldsToQueryMap.forEach((inValues, field) => {
            // Filter by cached values => get out all duplicated IN values thet
            // were previously queried
            let valueCache = this.tempData.filteredQueryValueCache.get(field.name);
            if (!valueCache) {
                valueCache = new Set<string>();
                this.tempData.filteredQueryValueCache.set(field.name, valueCache);
            }
            inValues = inValues.filter(inValue => !valueCache.has(inValue));
            if (inValues.length > 0) {
                inValues.forEach(inValue => {
                    valueCache.add(inValue);
                });
                // Create and add query
                Common.createFieldInQueries(this.data.fieldsInQuery, field.name, this.sObjectName, inValues).forEach(query => {
                    queries.push(query);
                });
            }
        });
        return queries;

    }

    /**
     * @returns {number} New records count
     */
    private _setExternalIdMap(records: Array<any>,
        sourceExtIdRecordsMap: Map<string, string>,
        sourceIdRecordsMap: Map<string, string>,
        isTarget: boolean = false): number {

        let newRecordsCount = 0;

        records.forEach(record => {
            if (record["Id"]) {
                let value = this.getRecordValue(record, this.complexExternalId);
                if (value) {
                    sourceExtIdRecordsMap.set(value, record["Id"]);
                }
                if (!sourceIdRecordsMap.has(record["Id"])) {
                    sourceIdRecordsMap.set(record["Id"], record);
                    record[CONSTANTS.__ID_FIELD] = record["Id"];
                    if (isTarget) {
                        let extIdValue = this.getRecordValue(record, this.externalId);
                        if (extIdValue) {
                            let sourceId = this.sourceData.extIdRecordsMap.get(extIdValue);
                            if (sourceId) {
                                let sourceRecord = this.sourceData.idRecordsMap.get(sourceId);
                                this.data.sourceToTargetRecordMap.set(sourceRecord, record);
                            }
                        }
                    }
                    newRecordsCount++;
                }
            } else {
                record[CONSTANTS.__ID_FIELD] = Common.makeId(18);
            }
        });
        return newRecordsCount;
    }
}

// ---------------------------------------- Helper classes & interfaces ---------------------------------------------------- //
export class TaskData {

    task: MigrationJobTask;
    sourceToTargetRecordMap: Map<any, any> = new Map<any, any>();

    constructor(task: MigrationJobTask) {
        this.task = task;
    }

    get fieldsToUpdateMap(): Map<string, SFieldDescribe> {
        return this.task.scriptObject.fieldsToUpdateMap;
    }

    get fieldsInQueryMap(): Map<string, SFieldDescribe> {
        return this.task.scriptObject.fieldsInQueryMap;
    }

    get sFieldsInQuery(): SFieldDescribe[] {
        return [...this.fieldsInQueryMap.values()];
    }

    get fieldsToUpdate(): string[] {
        return this.task.scriptObject.fieldsToUpdate;
    }

    get sFieldsToUpdate(): SFieldDescribe[] {
        return [...this.fieldsToUpdateMap.values()];
    }

    get fieldsInQuery(): string[] {
        return this.task.scriptObject.fieldsInQuery;
    }

    get csvFilename(): string {
        return this.task.getCSVFilename(this.task.script.basePath);
    }

    get sourceCsvFilename(): string {
        let filepath = path.join(this.task.script.basePath, CONSTANTS.CSV_SOURCE_SUB_DIRECTORY);
        if (!fs.existsSync(filepath)) {
            fs.mkdirSync(filepath);
        }
        return this.task.getCSVFilename(filepath, CONSTANTS.CSV_SOURCE_FILE_SUFFIX);
    }

    targetCSVFilename(operation: OPERATION): string {
        let filepath = path.join(this.task.script.basePath, CONSTANTS.CSV_TARGET_SUB_DIRECTORY);
        if (!fs.existsSync(filepath)) {
            fs.mkdirSync(filepath);
        }
        return this.task.getCSVFilename(filepath, `_${ScriptObject.getStrOperation(operation).toLowerCase()}${CONSTANTS.CSV_TARGET_FILE_SUFFIX}`);
    }

    get resourceString_csvFile(): string {
        return this.task.logger.getResourceString(RESOURCES.csvFile);
    }

    get resourceString_org(): string {
        return this.task.logger.getResourceString(RESOURCES.org);
    }

    resourceString_Step(mode: "forwards" | "backwards" | "target"): string {
        return mode == "forwards" ? this.task.logger.getResourceString(RESOURCES.Step1)
            : this.task.logger.getResourceString(RESOURCES.Step2);
    }

    get prevTasks(): MigrationJobTask[] {
        return this.task.job.tasks.filter(task => this.task.job.tasks.indexOf(task) < this.task.job.tasks.indexOf(this.task));
    }

    get nextTasks(): MigrationJobTask[] {
        return this.task.job.tasks.filter(task => this.task.job.tasks.indexOf(task) > this.task.job.tasks.indexOf(this.task));
    }
}

export class TaskOrgData {

    task: MigrationJobTask;
    isSource: boolean;

    extIdRecordsMap: Map<string, string> = new Map<string, string>();
    idRecordsMap: Map<string, any> = new Map<string, any>();

    constructor(task: MigrationJobTask, isSource: boolean) {
        this.task = task;
        this.isSource = isSource;
    }

    get org(): ScriptOrg {
        return this.isSource ? this.task.script.sourceOrg : this.task.script.targetOrg;
    }

    get useBulkQueryApi(): boolean {
        return this.isSource ? this.task.sourceTotalRecorsCount > CONSTANTS.QUERY_BULK_API_THRESHOLD :
            this.task.targetTotalRecorsCount > CONSTANTS.QUERY_BULK_API_THRESHOLD;
    }

    get fieldsMap(): Map<string, SFieldDescribe> {
        return this.isSource ? this.task.scriptObject.sourceSObjectDescribe.fieldsMap :
            this.task.scriptObject.targetSObjectDescribe.fieldsMap;
    }

    get resourceString_Source_Target(): string {
        return this.isSource ? this.task.logger.getResourceString(RESOURCES.source) :
            this.task.logger.getResourceString(RESOURCES.target);
    }

    get allRecords(): boolean {
        return this.isSource ? this.task.scriptObject.processAllSource : this.task.scriptObject.processAllTarget;
    }

    get media(): DATA_MEDIA_TYPE {
        return this.org.media;
    }

    get records(): Array<any> {
        return [...this.idRecordsMap.values()];
    }
}

export class ProcessedData {

    clonedToSourceMap: Map<any, any> = new Map<any, any>();

    fields: Array<SFieldDescribe>;

    recordsToUpdate: Array<any> = new Array<any>();
    recordsToInsert: Array<any> = new Array<any>();

    missingParentLookups: IMissingParentLookupRecordCsvRow[] = new Array<IMissingParentLookupRecordCsvRow>();

    get lookupIdFields(): Array<SFieldDescribe> {
        return this.fields.filter(field => field.isSimpleReference);
    }

    get fieldNames(): Array<string> {
        return this.fields.map(field => field.nameId);
    }
}

interface IMockField {
    fn: string;
    regIncl: string;
    regExcl: string;
    disallowMockAllRecord: boolean;
    allowMockAllRecord: boolean;
}