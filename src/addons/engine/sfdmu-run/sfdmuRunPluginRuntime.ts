/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { Script, TaskData } from "../../../modules/models";
import { Logger } from "../../../modules/components/common_components/logger";
import { API_ENGINE, DATA_MEDIA_TYPE, OPERATION } from "../../package/base/enumerations";
import SfdmuRunPluginJob from "./sfdmuRunPluginJob";
import { IPluginRuntimeSystemBase } from "../../../modules/models/common_models/helper_interfaces";
import { Common } from "../../../modules/components/common_components/common";
import { Sfdx } from "../../../modules/components/common_components/sfdx";

import { IApiEngine } from "../../../modules/models/api_models";
import { BulkApiV1_0Engine } from "../../../modules/components/api_engines/bulkApiV1_0Engine";
import { RestApiEngine } from "../../../modules/components/api_engines/restApiEngine";
import ICommandRunInfo from "../../package/base/ICommandRunInfo";
import IBlobField from "../../package/base/IBlobField";
import { ISfdmuRunPluginJob, ISfdmuRunPluginRuntime } from "../../package/modules/sfdmu-run";
import PluginRuntimeBase from "../PluginRuntimeBase";



export interface ISfdmuRunPluginRuntimeSystem extends IPluginRuntimeSystemBase {
    $$setPluginJob(): void
}


export default class SfdmuRunPluginRuntime extends PluginRuntimeBase implements ISfdmuRunPluginRuntime, ISfdmuRunPluginRuntimeSystem {

    // Hidden properties to not expose them to the Addon code.
    // The Addon can access only the members of IPluginRuntime.
    #script: Script;
    #logger: Logger;

    constructor(script: Script) {
        super(script);
        this.#script = script;
        this.#logger = script.logger;        
    }


    /* -------- System Functions (for direct access) ----------- */
    $$setPluginJob() {
        this.pluginJob = new SfdmuRunPluginJob(this.#script.job);
    }


    /* -------- IPluginRuntime implementation ----------- */
    runInfo: ICommandRunInfo;
    pluginJob: ISfdmuRunPluginJob;

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
    createFieldInQueries(selectFields: string[], fieldName: string = "Id", sObjectName: string, valuesIN: string[]): string[] {
        return Common.createFieldInQueries(selectFields, fieldName, sObjectName, valuesIN);
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
    async updateTargetRecordsAsync(sObjectName: string, operation: OPERATION, records: any[], engine: API_ENGINE = API_ENGINE.DEFAULT_ENGINE, updateRecordId: boolean = true): Promise<any[]> {

        if (!records || records.length == 0 || this.#script.job.tasks.length == 0) {
            return [];
        }

        records = operation == OPERATION.Delete ? records.map(x => {
            return {
                Id: x["Id"]
            }
        }) : records;

        let resultRecords: Array<any>;

        let task = this.#script.job.tasks.find(task => task.sObjectName == sObjectName);

        if (task) {

            // Existing task => existing sObject
            task.createApiEngine(task.targetData.org, operation, records.length, false);
            resultRecords = await task.apiEngine.executeCRUD(records, task.apiProgressCallback);

        } else {

            // Missing task => new sObject
            let apiEngine: IApiEngine;

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

}






