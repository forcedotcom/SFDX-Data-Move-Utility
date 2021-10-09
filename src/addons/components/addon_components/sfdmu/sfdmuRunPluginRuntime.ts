/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import * as path from 'path';
import * as fs from 'fs';


import { BulkApiV1_0Engine } from "../../../../modules/components/api_engines/bulkApiV1_0Engine";
import { RestApiEngine } from "../../../../modules/components/api_engines/restApiEngine";
import { Common } from "../../../../modules/components/common_components/common";
import { Logger } from "../../../../modules/components/common_components/logger";
import { Sfdx } from "../../../../modules/components/common_components/sfdx";
import { CONSTANTS } from "../../../../modules/components/common_components/statics";
import { Script, TaskData } from "../../../../modules/models";
import { IApiEngine, IBlobField } from "../../../../modules/models/api_models";
import { STANDARD_MESSAGES } from "../../../messages/standard";



import SfdmuContentVersion from "./sfdmuContentVersion";
import SfdmuPluginJob from "./sfdmuPluginJob";

import ICommandRunInfo from '../../../../modules/models/common_models/ICommandRunInfo';
import IAddonModuleBase from '../base/IAddonModuleBase';
import { API_ENGINE, DATA_MEDIA_TYPE, OPERATION } from '../../../../modules/components/common_components/enumerations';
import SfdmuRunPluginTask from './sfdmuRunPluginTask';
import { ISfdmuAddonRuntimeSystem } from './ISfdmuAddonRuntimeSystem';
import PluginRuntimeBase from '../base/pluginRuntimeBase';



export default class SfdmuPluginRuntime extends PluginRuntimeBase implements ISfdmuAddonRuntimeSystem  {

    // Hidden properties to not expose them to the Addon code.
    // The Addon can access only the members of IPluginRuntime.
    #script: Script;
    #logger: Logger;


    constructor(script: Script) {
        super(script.logger, script.runInfo);
        this.#script = script;
        this.#logger = script.logger;
    }

    /* -------- ISfdmuRuntimeSystem ----------- */
    ____$createSfdmuPluginJob() {
        this.pluginJob = new SfdmuPluginJob(this.#script.job);
    }



    /* -------- Own members ----------- */
    runInfo: ICommandRunInfo;
    pluginJob: SfdmuPluginJob;


    getPluginTask(module: IAddonModuleBase): SfdmuRunPluginTask {
        return this.pluginJob.tasks.find(task => task.sObjectName == module.context.objectName);
    }


    /**
     * The base path to the currently executing job (export.json file)
     *
     * @type {string}
    
     */
    get basePath(): string {
        return this.#script.basePath;
    }

    /**
     * The base path to the source CSV files
     *
     * @type {string}
   
     */
    get sourcePath(): string {
        return this.#script.sourceDirectory;
    }

    /**
     * The base path to the target CSV files
     *
     * @type {string}
   
     */
    get targetPath(): string {
        return this.#script.targetDirectory;
    }


    getConnection(isSource: boolean) {
        return isSource ? this.#script.sourceOrg.getConnection() : this.#script.targetOrg.getConnection();
    }

    getOrgInfo(isSource: boolean): {
        instanceUrl: string;
        accessToken: string;
        apiVersion: string;
        isFile: boolean;
    } {
        return isSource ? Object.assign(this.#script.sourceOrg.connectionData, {
            isFile: this.#script.sourceOrg.media == DATA_MEDIA_TYPE.File
        }) : Object.assign(this.#script.targetOrg.connectionData, {
            isFile: this.#script.targetOrg.media == DATA_MEDIA_TYPE.File
        });
    }

    async queryAsync(isSource: boolean, soql: string, useBulkQueryApi: boolean = false): Promise<any[]> {
        let apiSf = new Sfdx(isSource ? this.#script.sourceOrg : this.#script.targetOrg);
        let ret = await apiSf.queryAsync(soql, useBulkQueryApi);
        return ret.records;
    }

    async queryMultiAsync(isSource: boolean, soqls: string[], useBulkQueryApi: boolean = false): Promise<any[]> {
        let records = [];
        for (let index = 0; index < soqls.length; index++) {
            const soql = soqls[index];
            records = records.concat(await this.queryAsync(isSource, soql, useBulkQueryApi));
        }
        return records;
    }

    /**
     * Constructs array of SOQL-IN queries based on the provided values.
     * Keeps aware of the query length limitation according to the documentation:
     * (https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_soslsoql.htm)
     *
     *
     * @param {string[]} selectFields The fields to include into the SELECT statement in each query
     * @param {string} [fieldName="Id"] The field of the IN clause
     * @param {string} sObjectName The object api name to select 
     * @param {string[]} valuesIN The array of values to use in the IN clause
     * @returns {string[]} The array of SOQLs depend on the given values to include all of them
     */
    createFieldInQueries(selectFields: string[], fieldName: string = "Id", sObjectName: string, valuesIN: string[], whereClause?: string): string[] {
        return Common.createFieldInQueries(selectFields, fieldName, sObjectName, valuesIN, whereClause);
    }

    /**
     * Returns the api engine to for CRUD operation.
     *
     * @param {number} recordsAmount The amout of records to transfer
     * @param {API_ENGINE} preferredEngine The engine to prefer by default
     * @returns {API_ENGINE}
     * @memberof Script
     */
    getApiEngine(recordsAmount: number, preferredEngine: API_ENGINE): API_ENGINE {
        preferredEngine = preferredEngine || API_ENGINE.DEFAULT_ENGINE;
        if (preferredEngine != API_ENGINE.DEFAULT_ENGINE) {
            return preferredEngine;
        }
        if (recordsAmount > this.#script.bulkThreshold) {
            switch (this.#script.bulkApiVersionNumber) {
                case 2:
                    return API_ENGINE.BULK_API_V2;
                default:
                    return API_ENGINE.BULK_API_V1;
            }
        }
        return API_ENGINE.REST_API;
    }


    /**
     * Performs DML operation on the Target org pr writes into the target CSV file.
     * 
     * if the target object exists in the Script - the settings
     * defined in the script for this object will be used, 
     * otherwise it leverages the default settings for other objects. 
     * 
     * If the target is csvfile it will write into the CSV file according to the script settings.    
    *
    * @param {string} sObjectName The sObject name to update.
    * @param {OPERATION} operation The operation
    * @param {any[]} records The records to process
    * @param {API_ENGINE} [engine] You can choose the API engine to use
    * @param {boolean} [updateRecordId] When true it will override the Ids of the source records passed to the method by the Ids returned 
    *                                    from the SF API, otherwise it will remain the source records as is and will return them from the method.
    *
    * @returns {Promise<any[]>} The result records. Typeically it is THE SAME records as passed to the method, but you can override the IDs
    *                           with the target Ids by putting updateRecordId = true   
    */
    async updateTargetRecordsAsync(sObjectName: string,
        operation: OPERATION, records: any[],
        engine: API_ENGINE = API_ENGINE.DEFAULT_ENGINE,
        updateRecordId: boolean = true): Promise<any[]> {

        if (!records || records.length == 0 || this.#script.job.tasks.length == 0) {
            return [];
        }

        // records = operation == OPERATION.Delete ? records.map(x => {
        //     return {
        //         Id: x["Id"]
        //     }
        // }) : records;

        let resultRecords: Array<any>;

        let task = this.#script.job.tasks.find(task => task.sObjectName == sObjectName);

        if (task) {

            // Existing task => existing sObject
            task.createApiEngine(task.targetData.org, operation, records.length, false);
            resultRecords = await task.apiEngine.executeCRUD(records, task.apiProgressCallback);

        } else {

            // Missing task => new sObject
            let apiEngine: IApiEngine;
            engine = this.getApiEngine(records.length, engine);

            switch (engine) {
                case API_ENGINE.BULK_API_V1:
                    apiEngine = new BulkApiV1_0Engine({
                        logger: this.#logger,
                        connectionData: this.#script.targetOrg.connectionData,
                        sObjectName,
                        operation,
                        pollingIntervalMs: this.#script.pollingIntervalMs,
                        concurrencyMode: this.#script.concurrencyMode,
                        updateRecordId,
                        bulkApiV1BatchSize: this.#script.bulkApiV1BatchSize,
                        targetCSVFullFilename: TaskData.getTargetCSVFilename(this.#script.targetDirectory, sObjectName, operation),
                        createTargetCSVFiles: this.#script.createTargetCSVFiles,
                        targetFieldMapping: null
                    });
                    break;

                case API_ENGINE.BULK_API_V2:
                    apiEngine = new BulkApiV1_0Engine({
                        logger: this.#logger,
                        connectionData: this.#script.targetOrg.connectionData,
                        sObjectName,
                        operation,
                        pollingIntervalMs: this.#script.pollingIntervalMs,
                        concurrencyMode: this.#script.concurrencyMode,
                        updateRecordId,
                        bulkApiV1BatchSize: this.#script.bulkApiV1BatchSize,
                        targetCSVFullFilename: TaskData.getTargetCSVFilename(this.#script.targetDirectory, sObjectName, operation),
                        createTargetCSVFiles: this.#script.createTargetCSVFiles,
                        targetFieldMapping: null
                    });
                    break;

                default:
                    apiEngine = new RestApiEngine({
                        logger: this.#logger,
                        connectionData: this.#script.targetOrg.connectionData,
                        sObjectName,
                        operation,
                        pollingIntervalMs: this.#script.pollingIntervalMs,
                        concurrencyMode: this.#script.concurrencyMode,
                        updateRecordId,
                        bulkApiV1BatchSize: this.#script.bulkApiV1BatchSize,
                        targetCSVFullFilename: TaskData.getTargetCSVFilename(this.#script.targetDirectory, sObjectName, operation),
                        createTargetCSVFiles: this.#script.createTargetCSVFiles,
                        targetFieldMapping: null
                    });
                    break;
            }

            task = this.#script.job.createDummyJobTask(sObjectName);
            task.setApiEngine(apiEngine);

            resultRecords = await apiEngine.executeCRUD(records, task.apiProgressCallback);

        }
        return resultRecords;
    }


    /**
     * Downloads the blob data from the given sobject and field
     *
     * @param {boolean} isSource
     * @param {Array<string>} recordIds The list of record ids to download the blob data using the given blob field
     * @param {IBlobField} blobField The field of blob type from where to download the data (for example Attachment.Body)
     * @returns {Promise<Map<string, string>>} Map: [record Id] => [blob data as bas64 string]
    
     */
    async downloadBlobDataAsync(isSource: boolean, recordIds: string[], blobField: IBlobField): Promise<Map<string, string>> {
        let apiSf = new Sfdx(isSource ? this.#script.sourceOrg : this.#script.targetOrg);
        return await apiSf.downloadBlobFieldDataAsync(recordIds, blobField);
    }

    /**
     * Downloads the given ContentVersions from the source org and uploads it to the target org.
     * Supports both binary and url contents.
     * 
     * Creates or updates ContentDocument object if necessary. 
     * If ContentDocument does exist it will add a new ContentVersion to it.
     *
     * @param {ISfdmuContentVersion} sourceVersions The ContentVersion records to process
     * @returns {Promise<ISfdmuContentVersion[]>} The updated input ContentVersion records
     * @memberof ISfdmuRunPluginRuntime
     */
    async transferContentVersions(module: IAddonModuleBase, sourceVersions: SfdmuContentVersion[]): Promise<SfdmuContentVersion[]> {
        let _self = this;

        // All Files of url types to upload ///
        let urlUploadJobs = new Array<SfdmuContentVersion>();

        // All Files of binary type to upload ///
        let totalSize = 0;
        let totalCount = 0;
        let totalUrls = 0;

        let fileUploadJobs = [...(function* () {
            let versions = new Array<SfdmuContentVersion>();
            let size = 0;
            for (let index = 0; index < sourceVersions.length; index++) {
                const version = sourceVersions[index];
                if (version.isUrlContent) {
                    totalUrls++;
                    urlUploadJobs.push(version);
                    continue;
                }

                versions.push(version);
                totalCount++;
                size += version.ContentSize;
                totalSize += version.ContentSize;

                if (version.ContentSize + size > CONSTANTS.MAX_CONTENT_VERSION_PROCESSING_MEMORY_SIZE) {
                    yield versions;
                    size = 0;
                    versions = new Array<SfdmuContentVersion>();
                }
            };
            if (versions.length > 0) {
                yield versions;
            }
        })()];

        // Uploading Binary-type Files -----------------------
        if (fileUploadJobs.length > 0) {
            this.____$writeStandardInfoMessage(module, STANDARD_MESSAGES.TotalDataVolume, String(totalCount + totalUrls), String((totalSize / 1000000).toFixed(2)));
            this.____$writeStandardInfoMessage(module, STANDARD_MESSAGES.DataWillBeProcessedInChunksOfSize,
                String(fileUploadJobs.length),
                String((CONSTANTS.MAX_CONTENT_VERSION_PROCESSING_MEMORY_SIZE / 1000000).toFixed(2)));
        }

        for (let index = 0; index < fileUploadJobs.length; index++) {

            // Create data to download
            const fileJob = fileUploadJobs[index];
            let idToContentVersionMap: Map<string, SfdmuContentVersion> = Common.arrayToMap(fileJob, ['Id']);

            this.____$writeStandardInfoMessage(module, STANDARD_MESSAGES.ProcessingChunk, String(index + 1), String(idToContentVersionMap.size));

            // Download
            let idToContentVersionBlobMap = await this.downloadBlobDataAsync(true, [...idToContentVersionMap.keys()], <IBlobField>{
                fieldName: 'VersionData',
                objectName: 'ContentVersion',
                dataType: "base64"
            });

            // Create array to upload
            let newToSourceVersionMap = new Map<any, SfdmuContentVersion>();

            let versionsToUpload = [...idToContentVersionBlobMap.keys()].map(versionId => {
                let blobData = idToContentVersionBlobMap.get(versionId);
                let sourceContentVersion = idToContentVersionMap.get(versionId);
                let newContentVersion = Common.cloneObjectIncludeProps(sourceContentVersion,
                    'Title', 'Description', 'PathOnClient');
                newContentVersion['VersionData'] = blobData;
                newContentVersion['ReasonForChange'] = sourceContentVersion.reasonForChange;
                newContentVersion['ContentDocumentId'] = sourceContentVersion.targetContentDocumentId;
                newToSourceVersionMap.set(newContentVersion, sourceContentVersion);
                return newContentVersion;
            });

            // Upload Contents
            await ___upload(versionsToUpload, newToSourceVersionMap, false);
        }

        // Uploading Url-type Files ----------------------------------
        {
            // Create array to upload
            let newToSourceVersionMap = new Map<any, SfdmuContentVersion>();

            let versionsToUpload = urlUploadJobs.map(sourceContentVersion => {
                let newContentVersion = Common.cloneObjectIncludeProps(sourceContentVersion,
                    'Title', 'Description', 'ContentUrl');
                newContentVersion['ReasonForChange'] = sourceContentVersion.reasonForChange;
                newContentVersion['ContentDocumentId'] = sourceContentVersion.targetContentDocumentId;
                newToSourceVersionMap.set(newContentVersion, sourceContentVersion);
                return newContentVersion;
            });

            // Upload Urls
            await ___upload(versionsToUpload, newToSourceVersionMap, true);
        }


        // ---------------- Private Helpers --------------------
        async function ___upload(versionsToUpload: any[], newToSourceVersionMap: Map<any, SfdmuContentVersion>, isUrl: boolean) {

            // Create new content versions
            let records = await _self.updateTargetRecordsAsync('ContentVersion',
                OPERATION.Insert,
                versionsToUpload,
                // For the Content have to use only the REST, because it's failed when using Bulk API...
                isUrl ? API_ENGINE.DEFAULT_ENGINE : API_ENGINE.REST_API,
                true);

            if (records) {

                let newRecordIdToSourceVersionMap = new Map<string, SfdmuContentVersion>();

                // Update Ids of the source version records
                records.forEach((newRecord: any) => {
                    let sourceVersion = newToSourceVersionMap.get(newRecord);
                    if (sourceVersion) {
                        sourceVersion.targetId = newRecord["Id"];
                        if (newRecord[CONSTANTS.ERRORS_FIELD_NAME]) {
                            sourceVersion.isError = true;
                        }
                        if (!sourceVersion.targetContentDocumentId) {
                            newRecordIdToSourceVersionMap.set(sourceVersion.targetId, sourceVersion);
                        }
                    }
                });

                // Retrieve new content documents which were created now
                let queries = _self.createFieldInQueries(['Id', 'ContentDocumentId'], 'Id', 'ContentVersion', [...newRecordIdToSourceVersionMap.keys()]);
                records = await _self.queryMultiAsync(false, queries);

                // Update ContentDocumentIds of the source version records
                records.forEach((newRecord: any) => {
                    let sourceVersion = newRecordIdToSourceVersionMap.get(newRecord["Id"]);
                    if (sourceVersion) {
                        sourceVersion.targetContentDocumentId = newRecord['ContentDocumentId'];
                        if (newRecord[CONSTANTS.ERRORS_FIELD_NAME]) {
                            sourceVersion.isError = true;
                        }
                    }
                });
            } else {
                sourceVersions.forEach(sourceVersion => sourceVersion.isError = true);
            }
        };
        // -------------------------------------------------------
        return sourceVersions;
    }

    /**
     * Creates if not exist or returns the path to the temporary folder
     * dedicated to this Addon
     *
     * @returns {string}
     * @memberof ISfdmuRunPluginRuntime
     */
    getOrCreateTempPath(module: IAddonModuleBase): string {
        let tmp = path.normalize(this.basePath
            + '/'
            + Common.formatStringLog(CONSTANTS.ADDON_TEMP_RELATIVE_FOLDER,
                module.displayName.replace(/[^\w\d]/g, '-')) + '/');
        if (!fs.existsSync(tmp)) {
            fs.mkdirSync(tmp);
        }
        return tmp;
    }

    /**
     * Destroys the previously created temporary path
     *
     * @memberof ISfdmuRunPluginRuntime
     */
    destroyTempPath(module: IAddonModuleBase, removeParentFolder?: boolean): void {
        if (typeof removeParentFolder == 'undefined')
            removeParentFolder = false;
        let tmp = this.getOrCreateTempPath(module);
        Common.deleteFolderRecursive(tmp, false, removeParentFolder);
    }

}






