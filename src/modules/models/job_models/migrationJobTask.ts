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
import { ScriptObject, MigrationJob as Job, ICSVIssues, CommandExecutionError, ScriptOrg, Script } from "..";
import SFieldDescribe from "../script_models/sfieldDescribe";
import * as path from 'path';
import * as fs from 'fs';
import { CachedCSVContent } from "./migrationJob";
import * as deepClone from 'deep.clone';
import { BulkApiV2_0Engine } from "../../components/api_engines/bulkApiV2_0Engine";
import { IApiEngine } from "../api_models/interfaces";
import ApiInfo from "../api_models/apiInfo";
import { BulkApiV1_0Engine } from "../../components/api_engines/bulkApiV1_0Engine";
import { RestApiEngine } from "../../components/api_engines/restApiEngine";




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

    get script(): Script {
        return this.scriptObject.script;
    }

    get logger(): Logger {
        return this.script.logger;
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
        return this.getCSVFilename(this.script.basePath);
    }

    get sourceCSVFilename(): string {
        let filepath = path.join(this.script.basePath, CONSTANTS.CSV_SOURCE_SUBDIRECTORY);
        if (!fs.existsSync(filepath)) {
            fs.mkdirSync(filepath);
        }
        return this.getCSVFilename(filepath, '_source');
    }

    targetCSVFilename(operation: OPERATION): string {
        let filepath = path.join(this.script.basePath, CONSTANTS.CSV_TARGET_SUBDIRECTORY);
        if (!fs.existsSync(filepath)) {
            fs.mkdirSync(filepath);
        }
        return this.getCSVFilename(filepath, `_${ScriptObject.getStrOperation(operation).toLowerCase()}_target`);
    }

    get sourceOrg() {
        return this.script.sourceOrg;
    }

    get targetOrg() {
        return this.script.targetOrg;
    }

    get useBulkQueryApiForSource() {
        return this.sourceTotalRecorsCount > CONSTANTS.QUERY_BULK_API_THRESHOLD;
    }

    get useBulkQueryApiForTarget() {
        return this.targetTotalRecorsCount > CONSTANTS.QUERY_BULK_API_THRESHOLD;
    }

    get operation(): OPERATION {
        return this.scriptObject.operation;
    }

    get strOperation(): string {
        return this.scriptObject.strOperation;
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
        let csvColumnsRow = await Common.readCsvFileAsync(this.sourceCSVFilename, 1);

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
        [...this.fieldsToUpdateMap.keys()].forEach(fieldName => {
            const columnExists = Object.keys(csvColumnsRow[0]).some(columnName => {
                let nameParts = columnName.split('.');
                return columnName == fieldName || nameParts.some(namePart => namePart == fieldName);
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
                await ___updateChildOriginalIdColumnsAsync(childIdSField);
            }
        }

        // Add missing lookup columns 
        for (let fieldIndex = 0; fieldIndex < this.fieldsInQuery.length; fieldIndex++) {
            const sField = this.fieldsInQueryMap.get(this.fieldsInQuery[fieldIndex]);
            if (sField.isReference && (!firstRow.hasOwnProperty(sField.fullName__r) || !firstRow.hasOwnProperty(sField.nameId))) {
                await ___addMissingLookupColumnsAsync(sField);
            }
        }

        return csvIssues;
        // ------------------ internal functions ------------------------- //
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
                let parentFileMap: Map<string, any> = await Common.readCsvFileOnceAsync(cachedCSVContent.csvDataCacheMap, parentTask.sourceCSVFilename);
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
        async function ___updateChildOriginalIdColumnsAsync(childIdSField: SFieldDescribe): Promise<void> {
            let columnChildOriginalName__r = childIdSField.fullOriginalName__r;
            let columnChildIdName__r = childIdSField.fullIdName__r;
            let columnChildNameId = childIdSField.nameId;
            let parentOriginalExternalIdColumnName = self.scriptObject.originalExternalId;
            if (parentOriginalExternalIdColumnName != "Id") {
                let childTask = self.job.getTaskBySObjectName(childIdSField.scriptObject.name);
                if (childTask) {
                    let childFileMap: Map<string, any> = await Common.readCsvFileOnceAsync(cachedCSVContent.csvDataCacheMap, childTask.sourceCSVFilename);
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
                        cachedCSVContent.updatedFilenames.add(childTask.sourceCSVFilename);
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
        if (!record) return null;
        let value = record[sFieldName || propName];
        if (!value) return value;
        sObjectName = sObjectName || record["SobjectType"];
        if (this.sObjectName == "RecordType" && propName == "DeveloperName") {
            return value + CONSTANTS.COMPLEX_FIELDS_SEPARATOR + sObjectName;
        } else {
            return value;
        }
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
            tempQuery.fields = this.fieldsInQuery.map(fieldName => getComposedField(fieldName));
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

        this.logger.infoMinimal(RESOURCES.gettingRecordsCount, this.sObjectName);
        let query = this.createQuery(['COUNT(Id) CNT'], true);

        if (this.sourceOrg.media == DATA_MEDIA_TYPE.Org) {
            let apiSf = new Sfdx(this.sourceOrg);
            let ret = await apiSf.queryAsync(query, false);
            this.sourceTotalRecorsCount = Number.parseInt(ret.records[0]["CNT"]);
            this.logger.infoNormal(RESOURCES.totalRecordsAmount, this.sObjectName,
                this.logger.getResourceString(RESOURCES.source), String(this.sourceTotalRecorsCount));
        }

        if (this.targetOrg.media == DATA_MEDIA_TYPE.Org) {
            let apiSf = new Sfdx(this.targetOrg);
            let ret = await apiSf.queryAsync(query, false);
            this.targetTotalRecorsCount = Number.parseInt(ret.records[0]["CNT"]);
            this.logger.infoNormal(RESOURCES.totalRecordsAmount, this.sObjectName,
                this.logger.getResourceString(RESOURCES.target), String(this.targetTotalRecorsCount));
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
        if (!(this.targetOrg.media == DATA_MEDIA_TYPE.Org
            && this.scriptObject.operation != OPERATION.Readonly
            && this.scriptObject.deleteOldData)) {
            this.logger.infoNormal(RESOURCES.nothingToDelete, this.sObjectName);
            return false;
        }
        // Querying
        this.logger.infoNormal(RESOURCES.deletingTargetSObject, this.sObjectName);
        let soql = this.createDeleteQuery();
        let apiSf = new Sfdx(this.targetOrg);
        let queryResult = await apiSf.queryAsync(soql, this.useBulkQueryApiForTarget);
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
        this.createApiEngine(this.targetOrg, OPERATION.Delete, recordsToDelete.length, true);
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
     * Query records for this task
     *
     * @returns {Promise<void>}
     * @memberof MigrationJobTask
     */
    async queryRecords(): Promise<void> {
        // TODO: Implement this
        // Checking
        if (this.operation == OPERATION.Delete) return;
        let soql = "SELECT Id, Name, Data__c, Language__c, $$Language__r.Name$Language__r.LangCode__c$Language__r.Name, TestObject__r.$$TestObject3__r.Name$Account__r.Name$TestObject3__r.Name$Account__r.TestObject3__r.Name FROM TestObject_Description__c";
        let sfdx = new Sfdx(this.sourceOrg);
        let ret = await sfdx.queryFullAsync(soql, false, "");        

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
                        targetCSVFullFilename: this.targetCSVFilename(operation),
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
                        targetCSVFullFilename: this.targetCSVFilename(operation),
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
                targetCSVFullFilename: this.targetCSVFilename(operation),
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


}