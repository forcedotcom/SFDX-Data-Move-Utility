/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Messages } from '@salesforce/core';
import * as deepClone from 'deep.clone';
import * as SfdmModels from './models/index';
import { CommonUtils, MockGenerator } from './common';
import {
    composeQuery,
    Condition,
    Field as SOQLField,
    FieldType,
    getComposedField,
    LiteralType,
    LogicalOperator,
    parseQuery,
    Query,
    WhereClause,
    Operator
} from 'soql-parser-js';
import { DescribeSObjectResult, QueryResult } from 'jsforce';
import { execSync } from 'child_process';
import { List } from 'linq.ts';
import { SObjectDescribe, CONSTANTS } from './models/index';
import path = require('path');
import fs = require('fs');

import casual = require("casual");
import { COMMON_RESOURCES, MessageUtils, LOG_MESSAGE_VERBOSITY } from './messages';
import { BulkApi2sf, RESULT_STATUSES } from './bulkApi2Sf';
const alasql = require("alasql");

MockGenerator.createCustomGenerators(casual);


Messages.importMessagesDirectory(__dirname);
const commonMessages = Messages.loadMessages('sfdmu', 'common');


interface IBulkApiProcessing {
    createBulkApiJob: Function,
    processBulkApiBatchAsync: Function
}


/**
 * Status of API callouts
 *  as parameter of the API callback function
 *
 * @export
 * @class ApiCalloutStatus
 */
export class ApiCalloutStatus {
    constructor(init: Partial<ApiCalloutStatus>) {
        Object.assign(this, init);
    }
    bulkApiVersion: string = "V1.0";
    jobId: string = "REST";
    sObjectName: string;
    message: string;
    error: string;
    get isError(): boolean {
        return !!this.error;
    }
    numberRecordsProcessed: number = 0;
    numberRecordsFailed: number = 0;
    verbosity: LOG_MESSAGE_VERBOSITY = LOG_MESSAGE_VERBOSITY.NORMAL;
}


/**
 * Utils contains common function related to SFDX or Salesforce envs (ex. Update/Insert, etc)
 * and differentd functions to manipulate with records.
 */
export class SfdxUtils {


    /**
     * Executes SFDX command synchronously
     * 
     * @param  {String} command SFDX command to execute ex. force:org:display without previous sfdx 
     * @param  {String} targetusername --targetusername flag (if applied)
     * @returns string Returns command output
     */
    public static execSfdx(command: String, targetusername: String): string {
        if (typeof targetusername != "undefined")
            return execSync(`sfdx ${command} --targetusername ${targetusername}`).toString();
        else
            return execSync(`sfdx ${command}`).toString();
    };



    /**
     * Parses console output of force:org:display command into object
     * 
     * @param  {String} commandResult The command result string (in plain format, not in json)
     * @returns SfdmModels.OrgInfo
     */
    public static parseForceOrgDisplayResult(commandResult: String): SfdmModels.OrgInfo {
        if (!commandResult) return null;
        let lines = commandResult.split('\n');
        let output: SfdmModels.OrgInfo = new SfdmModels.OrgInfo();
        lines.forEach(line => {
            if (line.startsWith("Access Token"))
                output.AccessToken = line.split(' ').pop();
            if (line.startsWith("Client Id"))
                output.ClientId = line.split(' ').pop();
            if (line.startsWith("Connected Status"))
                output.ConnectedStatus = line.split(' ').pop();
            if (line.startsWith("Status"))
                output.Status = line.split(' ').pop();
            if (line.startsWith("Id"))
                output.OrgId = line.split(' ').pop();
            if (line.startsWith("Instance Url"))
                output.InstanceUrl = line.split(' ').pop();
            if (line.startsWith("Username"))
                output.Username = line.split(' ').pop();
        });

        return output;

    };



    /**
     * Transforms array of object received as result of REST callout (QueryResult) to an array of objects 
     * including nested properties ex. Account__r.Name
     * 
     * @param  {object[]} rawRecords Raw records to parse
     * @param  {string} query The originlan SOQL query used to get the parsed records. Need to retrieve field names.
     * @returns List<object>
     */
    public static parseRecords(rawRecords: object[], query: string): List<object> {

        const getNestedObject = (nestedObj, pathArr) => {
            return pathArr.reduce((obj, key) =>
                (obj && obj[key] !== 'undefined') ? obj[key] : undefined, nestedObj);
        }

        let fieldMapping = {};
        const soqlQuery = parseQuery(query);

        soqlQuery.fields.forEach(element => {
            if (element.type == "FieldFunctionExpression") {
                fieldMapping[element.alias] = [element.alias];
            } else if (element.type == "Field")
                fieldMapping[element.field] = [element.field];
            else if (element.type == "FieldRelationship") {
                var v = element.relationships.concat(element.field);
                fieldMapping[element.rawValue] = v;
            }
        });
        var parsedRecords = new List<object>(rawRecords.map(function (record) {
            var o = {};
            for (var prop in fieldMapping) {
                if (Object.prototype.hasOwnProperty.call(fieldMapping, prop)) {
                    o[prop] = getNestedObject(record, fieldMapping[prop]);
                }
            }
            return o;
        }));

        return parsedRecords;
    }



    /**
     * Function to validate current access token to org by querying to Account object
     * Emits error when there is no access
     * 
     * @param  {SfdmModels.SOrg} sOrg sOrg instance
     */
    public static async validateAccessTokenAsync(sOrg: SfdmModels.SOrg): Promise<void> {
        if (sOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.Org) {
            await SfdxUtils._queryAsync("SELECT Id FROM Account LIMIT 1", sOrg, false);
        }
        try {
            await SfdxUtils._queryAsync("SELECT IsPersonAccount FROM Account LIMIT 1", sOrg, false);
            sOrg.isPersonAccountEnabled = true;
        } catch (ex) {
            sOrg.isPersonAccountEnabled = false;
        }
    }




    /**
      * Describe given org getting list of its SObjects without field detail
      * 
     * @param  {SfdmModels.SOrg} sOrg Org instance
     */
    public static async describeSOrgAsync(sOrg: SfdmModels.SOrg): Promise<void> {
        var cn = sOrg.getConnection();
        const describeAsync = () => new Promise((resolve, reject) =>
            cn.describeGlobal(function (err, meta) {
                if (err)
                    reject(err);
                else
                    resolve(meta);
            })
        );

        let res: any = await describeAsync();
        res.sobjects.forEach(describe => {
            let o = new SObjectDescribe({
                name: describe.name,
                label: describe.label,
                createable: describe.createable,
                updateable: describe.createable && describe.updateable,
                custom: describe.custom
            });
            sOrg.sObjectsMap.set(o.name, o);
        });
    }




    /**
     * Describes given SObject by retrieving field descriptions
     * 
     * @param  {string} objectName Object API name to describe
     * @param  {SfdmModels.SOrg} sOrg sOrg instance
     * @param  {Map<string, SObjectDescribe>} defaultDescibe
     * @returns SfdmModels.SObjectDescribe
     */
    public static async describeSObjectAsync(objectName: string, sOrg: SfdmModels.SOrg,
        defaultDescibe: Map<string, SObjectDescribe>): Promise<SfdmModels.SObjectDescribe> {

        if (sOrg.mediaType != SfdmModels.Enums.DATA_MEDIA_TYPE.Org) {
            sOrg.sObjectsMap = defaultDescibe;
        }

        // from cache
        if (sOrg.sObjectsMap.has(objectName)
            && sOrg.sObjectsMap.get(objectName).initialized
        ) return sOrg.sObjectsMap.get(objectName);

        // ORG****
        var cn = sOrg.getConnection();

        const describeAsync = (name) => new Promise((resolve, reject) =>
            cn.sobject(name).describe(function (err, meta) {
                if (err)
                    reject(err);
                else
                    resolve(meta);
            }));

        let describe: DescribeSObjectResult = <DescribeSObjectResult>(await describeAsync(objectName));
        let o: SfdmModels.SObjectDescribe = new SfdmModels.SObjectDescribe();
        o.name = describe.name;

        o.label = describe.label;
        o.createable = describe.createable;
        o.updateable = describe.createable && describe.updateable;
        o.custom = describe.custom;
        describe.fields.forEach(field => {
            let f = new SfdmModels.SFieldDescribe();
            f.name = field.name;
            f.type = field.type;
            f.label = field.label;
            f.custom = field.custom;
            f.isReference = field.referenceTo != null;
            f.updateable = field.updateable;
            f.autoNumber = field["autoNumber"];
            f.creatable = field.createable;
            f.calculated = field.calculated;
            f.cascadeDelete = field.cascadeDelete;
            f.isReference = field.referenceTo != null && field.referenceTo.length > 0;
            f.referencedObjectType = field.referenceTo[0];
            o.fieldsMap.set(f.name, f);
        });
        sOrg.sObjectsMap.set(o.name, o);
        return o;
    };





    /**
     * Performs SOQL. Returns parsed list of objects.
     * Supports Complex External ID fields, they are automatically treates as "virtual" formula field.
     * 
     * @static
     * @param {string} soql Query to select 
     * @param {SfdmModels.SOrg} sOrg sOrg instance
     * @param {boolean} [allowUsingNonOrgMedias=false] In general the media type (data source type) is taken directly from the given Org instance. 
     *                                                 By default the function uses salesforce org as data source but not csv files.
     *                                                 If you want to allow using csv as data source 
     *                                                 you need to set allowUsingNonOrgMedias=true
     *                                                 and the sOrg.mediaType must set to File.
     * @param {string} [password] Passphrase used to decrypt csv files (if specified)
     * @param {string} [useBulkApi] Force using Bulk Query Api instead of Collection Api
     * @returns {Promise<List<object>>} Returns records
     * @memberof SfdxUtils
     */
    public static async queryAsync(soql: string,
        sOrg: SfdmModels.SOrg,
        allowUsingNonOrgMedias: boolean = false,
        password?: string,
        useBulkApi: boolean = false): Promise<List<object>> {

        let _this = this;
        let parsedQuery: Query = parseQuery(soql);
        let name = parsedQuery.sObject;
        let queryFields = new List<FieldType>(parsedQuery.fields).Cast<SOQLField>();
        let csvColumnsToColumnTypeMap: Map<string, string> = new Map<string, string>();
        let fieldsMap = sOrg.sObjectsMap.get(name).fieldsMap;
        queryFields.ForEach(field => {
            let descr = fieldsMap.get(field.field);
            csvColumnsToColumnTypeMap.set(field.field, descr && descr.type || "unknown");
        });

        async function getRecords(soql: string, sOrg: SfdmModels.SOrg): Promise<List<object>> {
            let ret: List<object> = new List<object>();
            let newSoql = _this._prepareQuery(soql);
            soql = newSoql[0];
            let rcs = (await _this._queryAsync(soql, sOrg, useBulkApi)).records;
            rcs = _this.parseRecords(rcs, soql).ToArray();
            rcs = _this._formatRecords(rcs, newSoql);
            ret.AddRange(rcs);
            if (soql.indexOf("FROM Group") >= 0) {
                soql = soql.replace("FROM Group", "FROM User");
                ret.AddRange(_this.parseRecords((await _this._queryAsync(soql, sOrg, useBulkApi)).records, soql).ToArray());
            }
            return ret;
        }


        if (sOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.File && allowUsingNonOrgMedias) {
            if (name == "Group" || name == "User") {
                name = SfdmModels.CONSTANTS.USER_AND_GROUP_FILE_NAME;
            }
            let filename = `${name}.csv`;
            let filepath = path.join(sOrg.basePath, filename);
            if (!fs.existsSync(filepath)) {
                return new List<object>();
            }
            let data = await CommonUtils.readCsvFileAsync(filepath, 0, csvColumnsToColumnTypeMap);
            if (data.length == 0) {
                return new List<object>(data);
            }
            data = CommonUtils.decryptArray(data, password);
            return new List<object>(data);
        }

        return await getRecords(soql, sOrg);

    }





    /**
    * Performs many queries in a single function call and returns joined set of records 
    * from all soqls mapped by given property name.
    * Each output record is unique thanks to the map)
    * 
    * @static
    * @param {Array<string>} soqls Array of SOQL selects to perform
    * @param {string} mapByProp Property name that need to map records by it
    * @param {SfdmModels.SOrg} sOrg sOrg instance
    * @param {boolean} [allowUsingNonOrgMedias=false] In general the media type (data source type) is taken directly from the given Org instance. 
    *                                                 By default the function uses salesforce org as data source but not csv files.
    *                                                 If you want to allow using csv as data source 
    *                                                 you need to set allowUsingNonOrgMedias=true
    *                                                 and the sOrg.mediaType must set to File.
    * @returns {Promise<Map<string, object>>}  Returns mapped records
    * @memberof SfdxUtils
    */
    public static async queryManyAsync(soqls: Array<string>,
        mapByProp: string, sOrg:
            SfdmModels.SOrg,
        allowUsingNonOrgMedias: boolean = false): Promise<Map<string, object>> {
        let recordsMap: Map<string, object> = new Map<string, object>();
        for (let index = 0; index < soqls.length; index++) {
            const query = soqls[index];
            let records = await this.queryAsync(query, sOrg, allowUsingNonOrgMedias);
            records.ForEach(record => {
                recordsMap.set(record[mapByProp], record);
            });
        }
        return recordsMap;
    }




    /**
     * Writes records for given sObject to csv file
     * 
     * @static
     * @param {string} sObjectName sObject name. File creates with the same name as the sObject.
     * @param {Array<object>} records Records to write to file
     * @param {string} basePath The root folder to put csv in it
     * @param {string} [password] Passphrase used to encrypt output csv file (if specified)
     * @param {string} [subPath] Basically the root path to store csv file taken from Org instance.
     *                           You also optionaly provide subdirectory related to the root path to store csv file there.
     * @memberof SfdxUtils
     */
    public static async writeObjectRecordsToCsvFileAsync(sObjectName: string, records: Array<object>, basePath: string, password?: string, subPath?: string): Promise<void> {
        let filename = `${sObjectName}.csv`;
        let filedir = subPath ? path.join(basePath, subPath) : basePath;
        if (!fs.existsSync(filedir)) {
            fs.mkdirSync(filedir);
        }
        let filepath = path.join(filedir, filename);
        records = CommonUtils.encryptArray(records, password);
        await CommonUtils.writeCsvFileAsync(filepath, records);
    }






    /**
     * Performs update on the data target.
     * Updates the salesforce org or writes data to the csv file if File is the data target type
     *
     * @static
     * @param {string} sObjectName sObject name to update
     * @param {List<object>} records Records to update the data target
     * @param {SfdmModels.SOrg} sOrg Target sOrg instance
     * @param {Function} [apiCalloutStatusCallback=null] Callback function to send information about the job progress.
     * @returns {Promise<List<object>>}  Returns resulting records as them were actually uploaded to the target.
     * @memberof SfdxUtils
     */
    public static async updateAsync(sObjectName: string,
        records: List<object>,
        sOrg: SfdmModels.SOrg,
        apiCalloutStatusCallback: (status: ApiCalloutStatus) => void = null): Promise<List<object>> {

        let _this = this;

        const bulkProcessing: IBulkApiProcessing = sOrg.bulkApiVersion == "2.0" ? this.BulkApiV2_0() : this.BulkApiV1();

        const makeUpdateAsync = (sObjectName: string, records: List<object>, sOrg: SfdmModels.SOrg) => new Promise(async (resolve, reject) => {

            if (records.Count() == 0) {
                resolve(0);
                return;
            }

            let recs = records.ToArray();

            if (records.Count() > sOrg.bulkThreshold) {

                let job: any, cn: any, chunks: any;
                ({ job, cn, chunks } = await bulkProcessing.createBulkApiJob(SfdmModels.Enums.OPERATION.Update, sObjectName, sOrg, recs));

                let totalProcessed = 0;

                for (let index = 0; index < chunks.length; index++) {
                    const chunk = chunks[index];
                    try {
                        totalProcessed = await bulkProcessing.processBulkApiBatchAsync("Update", sObjectName, cn, sOrg, apiCalloutStatusCallback, job, chunk, totalProcessed, index == 0, index == chunks.length - 1, false);
                    } catch (ex) {
                        await this._writeObjectOutputRecordsToCSVFileAsync(sObjectName, sOrg, recs, SfdmModels.Enums.OPERATION.Update);
                        let totalFailed = records.Count() - totalProcessed;
                        let progress = !(ex instanceof ApiCalloutStatus) ? new ApiCalloutStatus({
                            sObjectName,
                            jobId: job.id,
                            numberRecordsProcessed: totalProcessed,
                            numberRecordsFailed: totalFailed,
                            error: MessageUtils.getMessagesString(commonMessages,
                                COMMON_RESOURCES.apiOperationError,
                                job.id || "N/A",
                                "Update",
                                sObjectName,
                                String(totalProcessed),
                                String(totalFailed))
                        }) : ex;
                        reject(progress);
                        return;
                    }
                }

                await this._writeObjectOutputRecordsToCSVFileAsync(sObjectName, sOrg, recs, SfdmModels.Enums.OPERATION.Update);
                resolve(totalProcessed);

            } else {

                if (apiCalloutStatusCallback) {
                    apiCalloutStatusCallback(new ApiCalloutStatus({
                        message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.usingRestApi),
                        verbosity: LOG_MESSAGE_VERBOSITY.MINIMAL
                    }));
                }

                let cn = sOrg.getConnection();
                cn.bulk.pollTimeout = SfdmModels.CONSTANTS.POLL_TIMEOUT;

                cn.sobject(sObjectName).update(recs, {
                    allOrNone: sOrg.allOrNone,
                    allowRecursive: true
                }, async function (error, result) {

                    let progress = new ApiCalloutStatus({
                        sObjectName,
                        numberRecordsProcessed: 0,
                        numberRecordsFailed: 0
                    });

                    if (error) {
                        recs.forEach(rec => {
                            rec["Errors"] = rec["Errors"] || error;
                        });

                        await _this._writeObjectOutputRecordsToCSVFileAsync(sObjectName, sOrg, recs, SfdmModels.Enums.OPERATION.Update);

                        progress.numberRecordsFailed = recs.length;
                        progress.error = MessageUtils.getMessagesString(commonMessages,
                            COMMON_RESOURCES.apiUnexpectedOperationError,
                            progress.jobId,
                            "Update",
                            sObjectName,
                            error);

                        reject(progress);
                        return;
                    }

                    records.ForEach((record, index) => {
                        if (result[index].success) {
                            progress.numberRecordsProcessed++;
                            record["Errors"] = null;
                        } else {
                            progress.numberRecordsFailed++;
                            progress.error = result[index].errors[0].message;
                            record["Errors"] = progress.error;
                        }
                    });

                    await _this._writeObjectOutputRecordsToCSVFileAsync(sObjectName, sOrg, recs, SfdmModels.Enums.OPERATION.Update);

                    if (progress.numberRecordsFailed == 0 || !sOrg.allOrNone && progress.numberRecordsFailed > 0) {
                        if (apiCalloutStatusCallback) {
                            progress.message = MessageUtils.getMessagesString(commonMessages,
                                COMMON_RESOURCES.apiOperationCompleted,
                                progress.jobId,
                                "Update",
                                sObjectName,
                                String(progress.numberRecordsProcessed),
                                String(progress.numberRecordsFailed));
                            progress.verbosity = LOG_MESSAGE_VERBOSITY.MINIMAL;
                            apiCalloutStatusCallback(progress);
                        }
                        resolve(result.length);
                    } else {
                        progress.error = MessageUtils.getMessagesString(commonMessages,
                            COMMON_RESOURCES.apiOperationError,
                            progress.jobId,
                            "Update",
                            sObjectName,
                            String(progress.numberRecordsProcessed),
                            String(progress.numberRecordsFailed));
                        reject(progress);
                    }
                });

            }

        });

        await makeUpdateAsync(sObjectName, records, sOrg);

        return records;

    }




    /**
     * Performs insert to the data target.
     * Inserts to the salesforce org or writes data to the csv file if File is the data target type
     *
     * @static
     * @param {string} sObjectName sObject name to insert
     * @param {List<object>} records Records to insert to the data target
     * @param {SfdmModels.SOrg} sOrg Target sOrg instance
     * @param {Function} [progressInfoCallback=null] Callback function to send information about the job progress.
     * @returns {Promise<List<object>>}  Returns resulting records as them were actually uploaded to the target.
     * @memberof SfdxUtils
     */
    public static async insertAsync(sObjectName: string,
        records: List<object>,
        sOrg: SfdmModels.SOrg,
        apiCalloutStatusCallback: (status: ApiCalloutStatus) => void = null): Promise<List<object>> {

        let _this = this;

        const bulkProcessing: IBulkApiProcessing = sOrg.bulkApiVersion == "2.0" ? this.BulkApiV2_0() : this.BulkApiV1();

        const makeInsertAsync = (sObjectName: string, records: List<object>, sOrg: SfdmModels.SOrg) => new Promise(async (resolve, reject) => {

            if (records.Count() == 0) {
                resolve(0);
                return;
            }

            let recs = records.ToArray();

            if (records.Count() > sOrg.bulkThreshold) {

                let job: any, cn: any, chunks: any;
                ({ job, cn, chunks } = await bulkProcessing.createBulkApiJob(SfdmModels.Enums.OPERATION.Insert, sObjectName, sOrg, recs));

                let totalProcessed = 0;

                for (let index = 0; index < chunks.length; index++) {
                    const chunk = chunks[index];
                    try {
                        totalProcessed = await bulkProcessing.processBulkApiBatchAsync("Insert", sObjectName, cn, sOrg, apiCalloutStatusCallback, job, chunk, totalProcessed, index == 0, index == chunks.length - 1, true);
                    } catch (ex) {
                        await this._writeObjectOutputRecordsToCSVFileAsync(sObjectName, sOrg, recs, SfdmModels.Enums.OPERATION.Insert);
                        let totalFailed = records.Count() - totalProcessed;
                        let progress = !(ex instanceof ApiCalloutStatus) ? new ApiCalloutStatus({
                            sObjectName,
                            jobId: job.id,
                            numberRecordsProcessed: totalProcessed,
                            numberRecordsFailed: totalFailed,
                            error: MessageUtils.getMessagesString(commonMessages,
                                COMMON_RESOURCES.apiOperationError,
                                job.id || "N/A",
                                "Insert",
                                sObjectName,
                                String(totalProcessed),
                                String(totalFailed))
                        }) : ex;
                        reject(progress);
                        return;
                    }
                }

                await this._writeObjectOutputRecordsToCSVFileAsync(sObjectName, sOrg, recs, SfdmModels.Enums.OPERATION.Insert);
                resolve(totalProcessed);

            } else {

                if (apiCalloutStatusCallback) {
                    apiCalloutStatusCallback(new ApiCalloutStatus({
                        message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.usingRestApi),
                        verbosity: LOG_MESSAGE_VERBOSITY.MINIMAL
                    }));
                }

                let cn = sOrg.getConnection();
                cn.bulk.pollTimeout = SfdmModels.CONSTANTS.POLL_TIMEOUT;

                cn.sobject(sObjectName).create(recs, {
                    allOrNone: sOrg.allOrNone,
                    allowRecursive: true
                }, async function (error, result) {

                    let progress = new ApiCalloutStatus({
                        sObjectName,
                        numberRecordsProcessed: 0,
                        numberRecordsFailed: 0
                    });

                    if (error) {
                        recs.forEach(rec => {
                            rec["Errors"] = rec["Errors"] || error;
                        });

                        await _this._writeObjectOutputRecordsToCSVFileAsync(sObjectName, sOrg, recs, SfdmModels.Enums.OPERATION.Insert);

                        progress.numberRecordsFailed = recs.length;
                        progress.error = MessageUtils.getMessagesString(commonMessages,
                            COMMON_RESOURCES.apiUnexpectedOperationError,
                            progress.jobId,
                            "Insert",
                            sObjectName,
                            error);

                        reject(progress);
                        return;
                    }

                    records.ForEach((record, index) => {
                        if (result[index].success) {
                            progress.numberRecordsProcessed++;
                            record["Id"] = result[index].id;
                            record["Errors"] = null;
                        } else {
                            progress.numberRecordsFailed++;
                            progress.error = result[index].errors[0].message;
                            record["Errors"] = progress.error;
                        }
                    });

                    await _this._writeObjectOutputRecordsToCSVFileAsync(sObjectName, sOrg, recs, SfdmModels.Enums.OPERATION.Insert);

                    if (progress.numberRecordsFailed == 0 || !sOrg.allOrNone && progress.numberRecordsFailed > 0) {
                        if (apiCalloutStatusCallback) {
                            progress.message = MessageUtils.getMessagesString(commonMessages,
                                COMMON_RESOURCES.apiOperationCompleted,
                                progress.jobId,
                                "Insert",
                                sObjectName,
                                String(progress.numberRecordsProcessed),
                                String(progress.numberRecordsFailed));
                            progress.verbosity = LOG_MESSAGE_VERBOSITY.MINIMAL;
                            apiCalloutStatusCallback(progress);
                        }
                        resolve(result.length);
                    } else {
                        progress.error = MessageUtils.getMessagesString(commonMessages,
                            COMMON_RESOURCES.apiOperationError,
                            progress.jobId,
                            "Insert",
                            sObjectName,
                            String(progress.numberRecordsProcessed),
                            String(progress.numberRecordsFailed));
                        reject(progress);
                    }
                });
            }

        });

        await makeInsertAsync(sObjectName, records, sOrg);

        return records.Where(x => x["Id"]);

    }




    /**
      * Performs delete from the data target.
      * Deletes given records by id from the salesforce org
      *
      * @static
      * @param {string} sObjectName sObject name to delete
      * @param {List<object>} records Records to delete from to the data target
      * @param {SfdmModels.SOrg} sOrg Target sOrg instance
      * @param {Function} [apiCalloutStatusCallback=null] Callback function to send information about the job progress.
      * @memberof SfdxUtils
      */
    public static async deleteAsync(sObjectName: string,
        records: List<object>,
        sOrg: SfdmModels.SOrg,
        apiCalloutStatusCallback: (status: ApiCalloutStatus) => void = null): Promise<void> {

        let _this = this;

        const bulkProcessing: IBulkApiProcessing = sOrg.bulkApiVersion == "2.0" ? this.BulkApiV2_0() : this.BulkApiV1();

        const makeDeleteAsync = (sObjectName: string, records: List<object>, sOrg: SfdmModels.SOrg) => new Promise(async (resolve, reject) => {

            if (records.Count() == 0) {
                resolve(0);
                return;
            }

            if (records.Count() > sOrg.bulkThreshold) {

                records = records.Select(x => {
                    return {
                        Id: x["Id"]
                    }
                });
                let recs = records.ToArray();

                let job: any, cn: any, chunks: any;
                ({ job, cn, chunks } = await bulkProcessing.createBulkApiJob(SfdmModels.Enums.OPERATION.Delete, sObjectName, sOrg, recs));

                let totalProcessed = 0;

                for (let index = 0; index < chunks.length; index++) {
                    const chunk = chunks[index];
                    try {
                        totalProcessed = await bulkProcessing.processBulkApiBatchAsync("Delete", sObjectName, cn, sOrg, apiCalloutStatusCallback, job, chunk, totalProcessed, index == 0, index == chunks.length - 1, false);
                    } catch (ex) {
                        await this._writeObjectOutputRecordsToCSVFileAsync(sObjectName, sOrg, recs, SfdmModels.Enums.OPERATION.Delete);
                        let totalFailed = records.Count() - totalProcessed;
                        let progress = !(ex instanceof ApiCalloutStatus) ? new ApiCalloutStatus({
                            sObjectName,
                            jobId: job.id,
                            numberRecordsProcessed: totalProcessed,
                            numberRecordsFailed: totalFailed,
                            error: MessageUtils.getMessagesString(commonMessages,
                                COMMON_RESOURCES.apiOperationError,
                                job.id || "N/A",
                                "Delete",
                                sObjectName,
                                String(totalProcessed),
                                String(totalFailed))
                        }) : ex;
                        reject(progress);
                        return;
                    }
                }

                await this._writeObjectOutputRecordsToCSVFileAsync(sObjectName, sOrg, recs, SfdmModels.Enums.OPERATION.Delete);
                resolve(totalProcessed);

            } else {

                if (apiCalloutStatusCallback) {
                    apiCalloutStatusCallback(new ApiCalloutStatus({
                        message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.usingRestApi),
                        verbosity: LOG_MESSAGE_VERBOSITY.MINIMAL
                    }));
                }

                let ids = records.Select(x => x["Id"]).ToArray();
                let recs = records.ToArray();

                let cn = sOrg.getConnection();
                cn.bulk.pollTimeout = SfdmModels.CONSTANTS.POLL_TIMEOUT;

                cn.sobject(sObjectName).del(ids, {
                    allOrNone: sOrg.allOrNone,
                    allowRecursive: true
                }, async function (error, result) {

                    let progress = new ApiCalloutStatus({
                        sObjectName,
                        numberRecordsProcessed: 0,
                        numberRecordsFailed: 0
                    });

                    if (error) {

                        recs.forEach(rec => {
                            rec["Errors"] = rec["Errors"] || error;
                        });

                        await _this._writeObjectOutputRecordsToCSVFileAsync(sObjectName, sOrg, recs, SfdmModels.Enums.OPERATION.Delete);


                        progress.numberRecordsFailed = recs.length;
                        progress.error = MessageUtils.getMessagesString(commonMessages,
                            COMMON_RESOURCES.apiUnexpectedOperationError,
                            progress.jobId,
                            "Delete",
                            sObjectName,
                            error);

                        reject(progress);
                        return;
                    }

                    records.ForEach((record, index) => {
                        if (result[index].success) {
                            progress.numberRecordsProcessed++;
                            record["Errors"] = null;
                        } else {
                            progress.numberRecordsFailed++;
                            progress.error = result[index].errors[0].message;
                            record["Errors"] = progress.error;
                        }
                    });

                    await _this._writeObjectOutputRecordsToCSVFileAsync(sObjectName, sOrg, recs, SfdmModels.Enums.OPERATION.Delete);

                    if (progress.numberRecordsFailed == 0 || !sOrg.allOrNone && progress.numberRecordsFailed > 0) {
                        if (apiCalloutStatusCallback) {
                            progress.message = MessageUtils.getMessagesString(commonMessages,
                                COMMON_RESOURCES.apiOperationCompleted,
                                progress.jobId,
                                "Delete",
                                sObjectName,
                                String(progress.numberRecordsProcessed),
                                String(progress.numberRecordsFailed));
                            progress.verbosity = LOG_MESSAGE_VERBOSITY.MINIMAL;
                            apiCalloutStatusCallback(progress);
                        }
                        resolve(result.length);
                    } else {
                        progress.error = MessageUtils.getMessagesString(commonMessages,
                            COMMON_RESOURCES.apiOperationError,
                            progress.jobId,
                            "Delete",
                            sObjectName,
                            String(progress.numberRecordsProcessed),
                            String(progress.numberRecordsFailed));
                        reject(progress);
                    }
                });

            }
        });

        await makeDeleteAsync(sObjectName, records, sOrg);

    }




    /**
     * Performs all kinds of CRUD operations (Insert / Update / Merge / Upsert/ Add) with set of records 
     * related to the given task. 
     * If File is defined as data target the function writes to the csv file instead of updating salesforce org.
     *
     * @static
     * @param {SfdmModels.Task} task The task which records are currently processed
     * @param {List<object>} sourceRecords Source records, from data source (Org or file)
     * @param {List<object>} targetRecords Target records, the similar set of records as the Source records 
     *                                      but coming from the Target. 
     *                                      The source records are compared with the target before processed on the Target.
     * @param {SfdmModels.SOrg} sOrg Target sOrg instance
     * @param {SfdmModels.Enums.OPERATION} operation Operation to perform with the sourceRecords, can be different from defined 
     *                                              in the given task
     * @param {Array<string>} [omitFields=new Array<string>()] List of field (properties) in the sourceRecords to exclude (omit) 
     *                                                          from the CRUD processing
     * @param {Function} [apiCalloutStatusCallback=null] Callback function to send information about the job progress.
     * @returns {Promise<List<object>>}
     * @memberof SfdxUtils
     */
    public static async processTaskDataAsync(task: SfdmModels.Task,
        sourceRecords: List<object>,
        targetRecords: List<object>,
        sOrg: SfdmModels.SOrg,
        operation: SfdmModels.Enums.OPERATION,
        omitFields: Array<string> = new Array<string>(),
        apiCalloutStatusCallback: (status: ApiCalloutStatus) => void = null): Promise<List<object>> {

        let _this = this;

        let sObjectName: string = task.sObjectName;
        let externalId: string = task.scriptObject.externalId;
        let scriptObject: SfdmModels.ScriptObject = task.scriptObject;
        let readonlyExternalIdFields = task.scriptObject.readonlyExternalIdFields;
        var strOper = SfdmModels.Enums.OPERATION[operation];

        if (!sourceRecords || sourceRecords.Count() == 0 || operation == SfdmModels.Enums.OPERATION.Readonly) {
            return sourceRecords;
        }

        let notUpdateableFields = Object.keys(sourceRecords.ElementAt(0)).filter(field =>
            field.endsWith("_source") || field.indexOf('.') >= 0 // Invalid fields
        ).concat([
            "Errors" // Special fields
        ]).concat(
            readonlyExternalIdFields.filter(x => x != "Id") // Readonly fields
        );

        // Omit fields below during Update and Insert
        omitFields = new List<string>([...omitFields, ...notUpdateableFields]).Distinct().ToArray();


        let hasChildTasks = task.job.tasks.Any(x => x.scriptObject.referencedScriptObjectsMap.has(task.sObjectName));

        async function insertRecordsAsync(sourceRecords: List<object>) {

            // Omit fields below during Insert only
            let omitFieldsDuringInsert = new List<string>([...omitFields, "Id"]).Distinct().ToArray();

            if (task.scriptObject.targetRecordsFilter) {
                sourceRecords = new List<object>(await _this._filterRecords(task.scriptObject.targetRecordsFilter, sourceRecords.ToArray()));
            }

            let recordsToInsert = CommonUtils.cloneList(sourceRecords.Select(x => deepClone.deepCloneSync(x)), omitFieldsDuringInsert);
            let map = _this.mockRecords(scriptObject, task, recordsToInsert);
            let inputRecs = [...map.keys()];
            let recs = await _this.insertAsync(sObjectName, new List<object>(inputRecs), sOrg, apiCalloutStatusCallback);
            let insertedRecords = new List<object>();
            recs.ForEach(record => {
                let oldRecord = map.get(record);
                oldRecord["Id"] = record["Id"];
                insertedRecords.Add(oldRecord);
            });

            if (readonlyExternalIdFields.length > 0 && hasChildTasks) {

                // Code block to build mapping between Source and Target
                // ---------------------------------------
                // For all inserted records into the TARGET, we select all "readonly external id field" from the TARGET org
                //   and then we construct new properties to each object in the array of inserted records as following:
                //      for each "readonly external id field" (for example 'FormulaField__c') :
                //      --a we are updating own property 'FormulaField__c' or adding it if not exist 
                //      --b we adding new 'FormulaField__c__source' property contains the same value of FormulaField__c
                //         but from the SOURCE Org
                //  This allow to map external ids directly between Source and the Target on each record.
                //  Field__c__source contains the SOURCE value and Field__c contains the TARGET value.

                let inQueryFieldList = new List<string>(["Id", ...readonlyExternalIdFields]).Distinct().ToArray();
                let ids = insertedRecords.Select(x => x["Id"]).ToArray();
                let recordsMap = new Map<string, object>();
                if (inQueryFieldList.length == 1 && inQueryFieldList[0] == "Id") {
                    ids.forEach(id => recordsMap.set(id, { Id: id }));
                } else {
                    let queries = _this._createIdInQueries(inQueryFieldList, sObjectName, ids);
                    recordsMap = await _this.queryManyAsync(queries, "Id", sOrg);
                }
                insertedRecords.ForEach((record, index) => {
                    let rec = recordsMap.get(record["Id"]);
                    let sourceRec = sourceRecords.ElementAt(index);
                    if (rec) {
                        readonlyExternalIdFields.forEach(field => {
                            record[field] = rec[field];
                            record[field + '_source'] = sourceRec[field];
                        })
                    }
                });

            }

            return insertedRecords;
        }

        async function updateRecordsAsync(sourceRecords: List<object>, targetRecords: List<object>): Promise<List<object>> {

            let recordsToUpdate: List<object> = new List<object>();
            let recordsToInsert: List<object> = new List<object>();

            // -------------  INSERT ONLY ---------------------        
            if (operation == SfdmModels.Enums.OPERATION.Insert) {
                recordsToInsert = await insertRecordsAsync(sourceRecords);
                return recordsToInsert;
            }

            if (!externalId) {
                throw new Error(`Error while trying to ${strOper} SObject  ${sObjectName}: missing extenalID field`);
            }

            let first: object;
            try {
                first = sourceRecords.First();
            } catch (ex) {
                throw new Error(`Error while trying to ${strOper} SObject  ${sObjectName}: Missing source records`);
            }

            if (!first.hasOwnProperty(externalId)) {
                throw new Error(`Error while trying to ${strOper} SObject  ${sObjectName}: the source records are missing external Id field ${externalId}`);
            }

            if (targetRecords.Count() == 0) {
                targetRecords = new List<object>();
            } else {
                first = targetRecords.First();
                if (!first.hasOwnProperty(externalId)) {
                    throw new Error(`Error while trying to ${strOper} SObject  ${sObjectName}: the target records are missing external Id field ${externalId}`);
                }
            }


            let fieldSourceOfTarget = targetRecords.Count() == 0 ? new Array<string>() : Object.keys(targetRecords.ElementAt(0)).filter(field => field.endsWith("_source"));
            let sourceExtId = externalId;
            let targetExtId = fieldSourceOfTarget.length > 0 ? externalId + "_source" : externalId;

            var mappedRecords = _this._compareRecords(sourceRecords, targetRecords, sourceExtId, targetExtId);
            var targetMappedRecords = new Map();

            let idsMap = new Map<object, String>();



            // -------------  ANALYSING RECORDS FOR UPSERT --------------------- 
            // Determine which records should be updated and which inserted       
            mappedRecords.ForEach(pair => {
                if (pair[0] && !pair[1] && (operation == SfdmModels.Enums.OPERATION.Upsert || operation == SfdmModels.Enums.OPERATION.Add)) {
                    // ADD / INSERT
                    recordsToInsert.Add(pair[0]);
                } else if (pair[0] && pair[1] && operation != SfdmModels.Enums.OPERATION.Add) {
                    var obj: object;
                    if (operation == SfdmModels.Enums.OPERATION.Update || operation == SfdmModels.Enums.OPERATION.Upsert) {
                        // UPDATE / UPSERT
                        obj = { ...pair[1], ...pair[0] };
                    } else {
                        //MERGE
                        obj = CommonUtils.mergeObjectsEmptyProps(pair[0], pair[1]);
                    }
                    obj["Id"] = pair[1]["Id"];
                    recordsToUpdate.Add(obj);
                    targetMappedRecords.set(obj["Id"], pair[1]);
                    idsMap.set(obj, pair[0]["Id"]);
                }
            });



            // -------------  INSERTING OF UPSERT ---------------------
            if (recordsToInsert.Count() > 0) {
                // INSERTING
                if (apiCalloutStatusCallback) {
                    apiCalloutStatusCallback(new ApiCalloutStatus({
                        message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.readyToInsert, sObjectName, String(recordsToInsert.Count())),
                        verbosity: LOG_MESSAGE_VERBOSITY.VERBOSE
                    }));
                }
                recordsToInsert = await insertRecordsAsync(recordsToInsert);
            } else {
                if (apiCalloutStatusCallback) {
                    apiCalloutStatusCallback(new ApiCalloutStatus({
                        message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.nothingToInsert, sObjectName),
                        verbosity: LOG_MESSAGE_VERBOSITY.VERBOSE
                    }));
                }
            }



            // -------------  UPDATING OF UPSERT ---------------------
            if (recordsToUpdate.Count() > 0) {
                // UPDATING
                let records = recordsToUpdate.DistinctBy(x => x["Id"]);
                let ids = new List<String>();
                records.ForEach(record => {
                    ids.Add(idsMap.get(record));
                });
                omitFields = omitFields.concat(fieldSourceOfTarget);

                let notUpdateableFields = task.taskFields.Where(field => {
                    return !field.originalScriptField.sFieldDescribe.updateable && field.isOriginalField && field.name != "Id";
                }).Select(x => x.name);
                notUpdateableFields.AddRange(omitFields);
                notUpdateableFields = notUpdateableFields.Distinct();

                if (notUpdateableFields.Count() > 0) {
                    records = CommonUtils.cloneList(records.Select(x => deepClone.deepCloneSync(x)), notUpdateableFields.ToArray());
                }
                let recordToUpdate3 = new List<object>();
                records.ForEach(record => {
                    let old = targetMappedRecords.get(record["Id"]);
                    if (scriptObject.updateWithMockData || !CommonUtils.areEqual(record, old)) {
                        recordToUpdate3.Add(record);
                    }
                });
                if (recordToUpdate3.Count() > 0) {
                    if (apiCalloutStatusCallback) {
                        apiCalloutStatusCallback(new ApiCalloutStatus({
                            message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.readyToUpdate, sObjectName, String(recordToUpdate3.Count())),
                            verbosity: LOG_MESSAGE_VERBOSITY.VERBOSE
                        }));
                    }
                    let m = _this.mockRecords(scriptObject, task, recordToUpdate3, ids);
                    let recs = [...m.keys()];
                    if (task.scriptObject.targetRecordsFilter) {
                        recs = await _this._filterRecords(task.scriptObject.targetRecordsFilter, recs);
                    }
                    await _this.updateAsync(sObjectName, new List<object>(recs), sOrg, apiCalloutStatusCallback);
                } else {
                    if (apiCalloutStatusCallback) {
                        apiCalloutStatusCallback(new ApiCalloutStatus({
                            message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.nothingToUpdate, sObjectName),
                            verbosity: LOG_MESSAGE_VERBOSITY.VERBOSE
                        }));
                    }
                }
            }


            recordsToInsert.AddRange(recordsToUpdate.ToArray());
            return recordsToInsert;
        }

        let outputRecords: List<object> = new List<object>();



        if (sObjectName != "Account" && sObjectName != "Contact"
            || !sOrg.isPersonAccountEnabled || sourceRecords.Count() == 0) {
            return await updateRecordsAsync(sourceRecords, targetRecords);
        }

        let fields = Object.keys(sourceRecords.First());

        // Process business accounts/contacts only *************
        let fieldsToExclude = sObjectName == "Account" ? fields.filter(field => {
            return field.startsWith('Person') && field.indexOf('__c') < 0
                || field.endsWith('__pc')
                || ["FirstName",
                    "LastName",
                    "IsPersonAccount",
                    "Salutation"].indexOf(field) >= 0;
        }) : fields.filter(field => {
            return ["IsPersonAccount", "Name"].indexOf(field) >= 0;
        });

        let omitFields3 = [].concat(omitFields);

        let sRec = sourceRecords.Where(record => !record["IsPersonAccount"]);
        let tRec = targetRecords.Where(record => !record["IsPersonAccount"]);

        if (sRec.Count() > 0) {
            omitFields = omitFields3.concat(fieldsToExclude);
            outputRecords.AddRange((await updateRecordsAsync(sRec, tRec)).ToArray());
        }

        if (sObjectName == "Account") {
            // Process person accounts only *************             
            fieldsToExclude = fields.filter(field => {
                return ["Name", "IsPersonAccount"].indexOf(field) >= 0;
            });

            sRec = sourceRecords.Where(record => !!record["IsPersonAccount"]);
            tRec = targetRecords.Where(record => !!record["IsPersonAccount"]);

            if (sRec.Count() > 0) {
                omitFields = omitFields3.concat(fieldsToExclude);
                outputRecords.AddRange((await updateRecordsAsync(sRec, tRec)).ToArray());
            }
        }

        outputRecords.ForEach(record => {
            fields.forEach(field => {
                if (!record.hasOwnProperty(field)) {
                    if (field == "Name") {
                        record[field] = `${record["FirstName"]} ${record["LastName"]}`;
                    } else {
                        record[field] = null;
                    }
                }
            });
        });

        return outputRecords;
    }


    /**
     * Converts map of records into array of records, using grouping by the given property.
     * The output array is always unique by the given property.
     * @static
     * @param {Map<string, Array<object>>} records The input records map to convert: key => Records by the key
     * @param {string} [groupByPropName="Id"]   (Default="Id") Group all records by this property
     * @param {LogicalOperator} [operator="OR"] (Default="OR") Logical operator to apply to the input records (OR/AND). 
     *                                            -- If operator="OR": all record sets from all keys are joined together into the resulting array
     *                                            -- If operator="AND": only records do exist in ALL record sets are accepted and joined into the resulting array
     * 
     
     * @returns {Array<object>}
     * @memberof SfdxUtils
     */
    public static recordsMapToRecordsArray(
        records: Map<string, Array<object>>,
        groupByPropName: string = "Id",
        operator: LogicalOperator = "OR"): Array<object> {

        let map: Map<string, object> = new Map<string, object>();
        let tempMap: Map<string, object>;
        let keys = [...records.keys()];

        if (operator == "AND") {
            // AND => exclude
            for (let index = 0; index < keys.length; index++) {
                let key = keys[index];
                let recordsByKey = records.get(key)
                tempMap = new Map<string, object>();
                recordsByKey.forEach(record => {
                    tempMap.set(record[groupByPropName], record);
                });
                if (map.size > 0) {
                    let keys = [...map.keys()];
                    for (let index2 = keys.length - 1; index2 >= 0; index2--) {
                        let key = keys[index2];
                        if (!tempMap.has(key)) {
                            map.delete(key);
                        }
                    }
                } else {
                    map = tempMap;
                }
            }
        } else {
            // OR => concatence
            for (let index = 0; index < keys.length; index++) {
                let key = keys[index];
                let recordsByKey = records.get(key)
                recordsByKey.forEach(record => {
                    map.set(record[groupByPropName], record);
                });
            }
        }
        return [...map.values()];
    }




    /**
     * Modifies existing WHERE clause by adding extra WHERE ... IN (values) rule.
     * Ex.  source query:            WHERE Account.Name = 'Account',   Source__c = ['Source1', 'Source2']
     *      return composite query:  WHERE (Account.Name = 'Account') OR/AND (Source__c IN ('Source1', 'Source2'))
     * 
     * Also can add any other extra rule like WHERE .... AND (x = ...)
     * 
     * @static
     * @param {WhereClause} where Source query to modify
     * @param {string} fieldName Field name 
     * @param {Array<string> | string} values Values to compare
     * @param {operator} [Operator="IN"] (Default="IN") The operator for the extra WHERE
     * @param {LogicalOperator} [logicalOperator="OR"] (Default="OR") Logical operator to apply between the original WHERE and the new WHERE..IN
     * @returns {WhereClause} Returns modified WHERE clause
     * @memberof SfdxUtils
     */
    public static composeWhereClause(
        where: WhereClause,
        fieldName: string,
        values: Array<string> | string,
        operator: Operator = "IN",
        literalType: LiteralType = "STRING",
        logicalOperator: LogicalOperator = "OR"): WhereClause {

        let valuesIsArray = Array.isArray(values);
        let values2 = [].concat(values).filter(x => !!x).map(x => x.replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
        if (!valuesIsArray) {
            values2 = values2[0];
        }
        let c: Condition = { field: fieldName, operator: operator, value: values2, literalType: literalType };
        if (!where || !where.left) {
            let ret = { left: c };
            ret.left.openParen = 1;
            ret.left.closeParen = 1;
            return ret;
        } else {
            //if (operator == "IN"){
            //  where.left.openParen = 0;
            //let ret = { left: c, right: where, operator: logicalOperator };
            //ret.left.openParen = 1;
            //return ret;
            //} else {
            where.left.openParen = (where.left.openParen || 0) + 1;
            where.left.closeParen = (where.left.closeParen || 0) + 1;
            c.openParen = 1;
            c.closeParen = 1;
            let ret = { left: c, right: where, operator: logicalOperator };
            return ret;
            //}
        }
    }



    /**
     * Creates array of SOQLs that each of them contains "WHERE Field__c IN (values)"  clauses
     * for given input values.
     * 
     * The function automatically will split the input array into multiple chunks
     * according to the projected length of each query in respect to the SF max SOQL length limitations.
     *
     * @static
     * @param {Array<string>} selectFields Field names to select
     * @param {string} [fieldName="Id"] The field name to use in the  WHERE Field IN (Values) clause 
     * @param {Array<string>} valuesIN Values to use in in the WHERE Field IN (Values) clause 
     * @returns {Array<string>} Returns an array of SOQLs
     * @memberof SfdxUtils
     */
    public static createFieldInQueries(
        selectFields: Array<string>,
        fieldName: string = "Id",
        sObjectName: string,
        valuesIN: Array<string>): Array<string> {

        let maxQueryLength = 3900;
        let tempQuery = <Query>{
            fields: selectFields.map(field => getComposedField(field)),
            where: <WhereClause>{},
            sObject: sObjectName
        };
        let counter: number = 0;
        let whereValues = new Array<string>();

        function* queryGen() {
            while (true) {
                for (let i = 0; i < maxQueryLength;) {
                    let value = String(valuesIN[counter] || "");
                    whereValues.push(value);
                    i += value.length + 4;
                    counter++;
                    if (counter == valuesIN.length)
                        break;
                }

                let c: Condition = {
                    field: fieldName,
                    operator: "IN",
                    value: whereValues,
                    literalType: "STRING"
                };
                tempQuery.where.left = c;
                yield composeQuery(tempQuery);
                whereValues = new Array<string>();

                if (counter == valuesIN.length)
                    break;
            }
        }

        return [...queryGen()];
    }


    /**
     * Replaces original record values with anonimous / masked values
     * Returns map between the masked record to the original record
     *
     * @static
     * @param {SfdmModels.ScriptObject} scriptObject Script object that the records belong to it
     * @param {SfdmModels.Task} task Task object that the records belong to it
     * @param {List<object>} records Records to mask
     * @param {List<String>} [ids] (Optional) The array of the record ids for the records 
     *                                (in case that the source records are mssing ids)
     * @returns {Map<object, object>} Map between the masked record to the original record
     * @memberof SfdxUtils 
     */
    static mockRecords(scriptObject: SfdmModels.ScriptObject,
        task: SfdmModels.Task,
        records: List<object>,
        ids?: List<String>): Map<object, object> {

        let mockToOriginalRecordMap: Map<object, object> = new Map<object, object>();        
        
        if (records.Count() == 0) return mockToOriginalRecordMap;
        
        ids = ids || records.Select(x => x["Id"]);

        if (scriptObject.updateWithMockData) {
            let mockFields: Map<string, {
                fn: string,
                regIncl: string,
                regExcl: string,
                disallowMockAllRecord: boolean,
                allowMockAllRecord: boolean
            }> = new Map<string, {
                fn: string,
                regIncl: string,
                regExcl: string,
                disallowMockAllRecord: boolean,
                allowMockAllRecord: boolean
            }>();
            let keys = Object.keys(records.ElementAt(0));
            task.taskFields.ForEach(field => {
                if (keys.indexOf(field.name) >= 0 && field.mockPattern) {
                    let fn = field.mockPattern;
                    if (SfdmModels.CONSTANTS.SPECIAL_MOCK_COMMANDS.some(x => fn.startsWith(x + "("))) {
                        fn = fn.replace(/\(/, `('${field.name}',`);
                    }
                    field.mockExcludedRegex = field.mockExcludedRegex || '';
                    field.mockIncludedRegex = field.mockIncludedRegex || '';
                    mockFields.set(field.name, {
                        fn,
                        regExcl: field.mockExcludedRegex.split(CONSTANTS.MOCK_PATTERN_ENTIRE_ROW_FLAG)[0].trim(),
                        regIncl: field.mockIncludedRegex.split(CONSTANTS.MOCK_PATTERN_ENTIRE_ROW_FLAG)[0].trim(),
                        disallowMockAllRecord: field.mockExcludedRegex.indexOf(CONSTANTS.MOCK_PATTERN_ENTIRE_ROW_FLAG) >= 0,
                        allowMockAllRecord: field.mockIncludedRegex.indexOf(CONSTANTS.MOCK_PATTERN_ENTIRE_ROW_FLAG) >= 0,
                    });
                }
            });
            MockGenerator.resetCounter();
            records.ForEach((record, index) => {
                let obj2 = Object.assign({}, record);
                let doNotMock = false;
                let mockAllRecord = false;
                let m: Map<string, boolean> = new Map<string, boolean>();
                [...mockFields.keys()].forEach(name => {
                    if (!doNotMock) {
                        let mockField = mockFields.get(name);
                        let value = String(obj2[name]);
                        let excluded = mockField.regExcl && (new RegExp(mockField.regExcl, 'ig').test(value));
                        let included = mockField.regIncl && (new RegExp(mockField.regIncl, 'ig').test(value));
                        if (included && mockField.allowMockAllRecord) {
                            mockAllRecord = true;
                        }
                        if (excluded && mockField.disallowMockAllRecord) {
                            doNotMock = true;
                        } else {
                            if (mockAllRecord || (!mockField.regExcl || !excluded) && (!mockField.regIncl || included)) {
                                m.set(name, true);
                            }
                        }
                    }
                });
                if (!doNotMock) {
                    [...mockFields.keys()].forEach(name => {
                        if (mockAllRecord || m.has(name)) {
                            let mockField = mockFields.get(name);
                            if (mockField.fn == "ids") {
                                obj2[name] = ids.ElementAt(index);
                            } else {
                                obj2[name] = eval(`casual.${mockField.fn}`);
                            }
                        }
                    });
                }

                mockToOriginalRecordMap.set(obj2, record);
            });
        } else {
            records.ForEach(record => {
                mockToOriginalRecordMap.set(record, record);
            });
        }
        return mockToOriginalRecordMap;
    }




    // Private members --------------------------------------  
    private static _compareRecords(sourceRecords: List<object>, targetRecords: List<object>,
        sourceExternalId: string,
        targetExternalId: string): List<[object, object]> {

        var records: List<[object, object]> = new List<[object, object]>();
        var targetMap: Map<string, object> = new Map<string, object>();

        targetRecords.ForEach((target, index) => {
            let key = target[targetExternalId];
            targetMap.set(key, target);
        });

        sourceRecords.ForEach((source, index) => {
            let key = source[sourceExternalId];
            records.Add([source, targetMap.get(key)]);
        });

        return records;

    }


    private static async _filterRecords(sql: string, data: Array<object>): Promise<Array<object>> {
        return new Promise<Array<object>>((resolve) => {
            if (!sql || data.length == 0) {
                resolve(data);
                return;
            }
            try {
                return alasql(`SELECT * FROM ? WHERE ${sql}`, [data], function (res) {
                    resolve(res);
                    return;
                });
            } catch (ex) {
                resolve(data);
                return;
            }
        });
    }


    private static _formatRecords(records: Array<object>, format: [string, Map<String, List<String>>, Array<String>]): Array<object> {
        if (format[1].size == 0) {
            return records;
        }
        let keys = [...format[1].keys()];
        records.forEach(record => {
            keys.forEach(complexKey => {
                let fields = format[1].get(complexKey);
                let value = "";
                fields.ForEach(field => {
                    let f = field.toString();
                    value += ";" + record[f];
                });
                record[complexKey.toString()] = value
            });
            keys.forEach(complexKey => {
                let fields = format[1].get(complexKey);
                fields.ForEach(field => {
                    let f = field.toString();
                    if (format[2].indexOf(f) < 0) {
                        delete record[f];
                    }
                });
            });
        });
        return records;
    }


    private static _prepareQuery(soql: string): [string, Map<String, List<String>>, Array<String>] {
        let newParsedQuery = parseQuery(soql);
        if (newParsedQuery.where && newParsedQuery.where.left && newParsedQuery.where.left.openParen && !newParsedQuery.where.left.closeParen) {
            newParsedQuery.where.left.closeParen = newParsedQuery.where.left.openParen;
        }
        let originalFields: Array<SOQLField> = newParsedQuery.fields.map(x => {
            return <SOQLField>x;
        });
        let originalFieldNamesToKeep: Array<String> = new List<String>(originalFields.map(newFieldTmp => {
            let newSOQLFieldTmp = <SOQLField>newFieldTmp;
            let newRawValueTmp = newSOQLFieldTmp["rawValue"] || newSOQLFieldTmp.field;
            return newRawValueTmp;
        })).ToArray();
        newParsedQuery.fields = [];
        let outputMap: Map<String, List<String>> = new Map<String, List<String>>();
        originalFields.forEach(originalField => {
            let rawValueOrig = originalField["rawValue"] || originalField.field;
            if (rawValueOrig.indexOf(SfdmModels.CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX) < 0) {
                // Simple field
                if (!newParsedQuery.fields.some(newFieldTmp => {
                    let newSOQLFieldTmp = <SOQLField>newFieldTmp;
                    let newRawValueTmp = newSOQLFieldTmp["rawValue"] || newSOQLFieldTmp.field;
                    return newRawValueTmp == rawValueOrig;
                })) {
                    newParsedQuery.fields.push(originalField);
                }
            } else {
                // Complex field
                let complexFields = rawValueOrig.split(SfdmModels.CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX);
                complexFields[1] = complexFields[1].startsWith('.') ? complexFields[1].substr(1) : complexFields[1];
                let containedFields = complexFields[1].split(SfdmModels.CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR);
                containedFields.forEach(field => {
                    let newFieldName = complexFields[0] ? complexFields[0] + field : field;
                    if (!newParsedQuery.fields.some(newFieldTmp => {
                        let newSOQLFieldTmp = <SOQLField>newFieldTmp;
                        let newRawValueTmp = newSOQLFieldTmp["rawValue"] || newSOQLFieldTmp.field;
                        return newRawValueTmp == newFieldName;
                    })) {
                        newParsedQuery.fields.push(getComposedField(newFieldName));
                    }
                    if (!outputMap.has(rawValueOrig))
                        outputMap.set(rawValueOrig, new List<String>([newFieldName]));
                    else
                        outputMap.get(rawValueOrig).Add(newFieldName);
                });
            }

        });
        let newQuery: string = composeQuery(newParsedQuery);
        return [newQuery, outputMap, originalFieldNamesToKeep];
    }


    private static async _queryAsync(soql: string, sOrg: SfdmModels.SOrg, useBulkApi: boolean): Promise<QueryResult<object>> {

        const makeQueryAsync = (soql) => new Promise((resolve, reject) => {

            var cn = sOrg.getConnection();

            var records = [];

            if (useBulkApi) {
                cn.bulk.query(soql).on("record", function (record) {
                    records.push(record);
                }).on("end", function () {
                    resolve(<QueryResult<object>>{
                        done: true,
                        records: records,
                        totalSize: records.length
                    });
                }).on("error", function (error) {
                    reject(error);
                });
            } else {
                var query = cn.query(soql).on("record", function (record) {
                    records.push(record);
                }).on("end", function () {
                    resolve(<QueryResult<object>>{
                        done: true,
                        records: records,
                        totalSize: query.totalSize
                    });
                }).on("error", function (error) {
                    reject(error);
                }).run({
                    autoFetch: true,
                    maxFetch: CONSTANTS.MAX_FETCH_SIZE
                });
            }
        });

        return <QueryResult<object>>(await makeQueryAsync(soql));
    }


    private static _createIdInQueries(
        selectFields: Array<string>,
        sObjectName: string,
        valuesIN: Array<string>): Array<string> {

        let maxInsInQuery = 178;
        let tempQuery = <Query>{
            fields: selectFields.map(field => getComposedField(field)),
            where: <WhereClause>{},
            sObject: sObjectName
        };
        let counter: number = 0;
        let whereValues = new Array<string>();

        function* queryGen() {
            while (true) {
                for (let i = 0; i < maxInsInQuery; i++) {
                    whereValues.push(valuesIN[counter]);
                    counter++;
                    if (counter == valuesIN.length)
                        break;
                }

                let c: Condition = {
                    field: "Id",
                    operator: "IN",
                    value: whereValues,
                    literalType: "STRING"
                };
                tempQuery.where.left = c;
                yield composeQuery(tempQuery);
                whereValues = new Array<string>();

                if (counter == valuesIN.length)
                    break;
            }
        }

        return [...queryGen()];
    }


    private static async _writeObjectOutputRecordsToCSVFileAsync(sObjectName: string, sOrg: SfdmModels.SOrg, records: Array<any>, operation: SfdmModels.Enums.OPERATION): Promise<any> {
        if (sOrg.createTargetCSVFiles) {
            await this.writeObjectRecordsToCsvFileAsync(`${sObjectName + "_" + SfdmModels.Enums.OPERATION[operation] + SfdmModels.CONSTANTS.TARGET_CSV_FILE_POSTFIX}`,
                records,
                sOrg.basePath,
                undefined,
                SfdmModels.CONSTANTS.TARGET_CSV_FILE_SUBDIR);
        }
    }





    // LEGACY BULK API V1  PROCESSING ----------------------------------------------------
    //  --------------------------------------------------------------------------
    public static BulkApiV1(): IBulkApiProcessing {

        const bulkApiVersion = "1.0";

        return {

            createBulkApiJob: async function (
                operation: SfdmModels.Enums.OPERATION,
                sObjectName: string,
                sOrg: SfdmModels.SOrg,
                records: Array<any>): Promise<{
                    job: any,
                    cn: any,
                    chunks: any
                }> {

                let cn = sOrg.getConnection();

                cn.bulk.pollTimeout = SfdmModels.CONSTANTS.POLL_TIMEOUT;

                let strOperation = SfdmModels.Enums.OPERATION[operation].toString().toLowerCase();

                let job = cn.bulk.createJob(sObjectName, strOperation);

                let chunks = CommonUtils.chunkArray(records, sOrg.bulkApiV1BatchSize);

                return {
                    job,
                    cn,
                    chunks
                };
            },

            processBulkApiBatchAsync: async function (
                operation: string,
                sObjectName: string,
                cn: any,
                sOrg: SfdmModels.SOrg,
                apiCalloutStatusCallback: (status: ApiCalloutStatus) => void = null,
                job: any,
                records: Array<any>,
                numberJobRecordsSucceeded: number,
                showStartMessage: boolean,
                showStopMessage: boolean,
                updateRecordId: boolean): Promise<any> {


                return new Promise((resolve, reject) => {

                    var batch = job.createBatch();
                    var pollTimer;
                    var numberBatchRecordsProcessed = 0;

                    batch.execute(records);


                    batch.on("error", function (batchInfo) {
                        if (pollTimer) {
                            clearInterval(pollTimer);
                        }
                        reject(batchInfo);
                        return;
                    });

                    batch.on("queue", function (batchInfo) {

                        batch.poll(sOrg.pollingIntervalMs, SfdmModels.CONSTANTS.POLL_TIMEOUT);

                        if (apiCalloutStatusCallback) {
                            if (showStartMessage) {
                                apiCalloutStatusCallback(new ApiCalloutStatus({
                                    message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.usingBulkApi, bulkApiVersion),
                                    verbosity: LOG_MESSAGE_VERBOSITY.MINIMAL
                                }));
                                apiCalloutStatusCallback(new ApiCalloutStatus({
                                    message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.jobStarted, job.id, operation, sObjectName),
                                    verbosity: LOG_MESSAGE_VERBOSITY.MINIMAL
                                }));
                            }
                            apiCalloutStatusCallback(new ApiCalloutStatus({
                                message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.batchStarted, batch.id, operation, sObjectName),
                                verbosity: LOG_MESSAGE_VERBOSITY.MINIMAL
                            }));
                        }

                        pollTimer = setInterval(function () {
                            cn.bulk.job(job.id).batch(batch.id).check((err, results) => {
                                if (apiCalloutStatusCallback) {
                                    let progress: ApiCalloutStatus = new ApiCalloutStatus({
                                        numberRecordsProcessed: +results.numberRecordsProcessed,
                                        jobId: job.id,
                                        sObjectName: sObjectName
                                    });
                                    if (numberBatchRecordsProcessed != progress.numberRecordsProcessed) {
                                        numberBatchRecordsProcessed = progress.numberRecordsProcessed;
                                        progress.numberRecordsProcessed = numberJobRecordsSucceeded + progress.numberRecordsProcessed;
                                        progress.message = MessageUtils.getMessagesString(commonMessages,
                                            COMMON_RESOURCES.apiOperationProgress,
                                            job.id,
                                            operation,
                                            sObjectName,
                                            String(progress.numberRecordsProcessed),
                                            String(progress.numberRecordsFailed));
                                        progress.verbosity = LOG_MESSAGE_VERBOSITY.VERBOSE;
                                        apiCalloutStatusCallback(progress);

                                    }
                                }
                            });
                        }, sOrg.pollingIntervalMs);

                    });

                    batch.on("response", function (rets) {

                        let numberBatchRecordsFailed = 0;

                        if (pollTimer) {
                            clearInterval(pollTimer);
                        }

                        records.forEach((record, index) => {
                            if (rets[index].success) {
                                if (updateRecordId) {
                                    record["Id"] = rets[index].id;
                                    record["Errors"] = null;
                                }
                                numberJobRecordsSucceeded++;
                            } else {
                                if (rets[index].errors) {
                                    record["Errors"] = rets[index].errors.join('; ');
                                }
                                numberBatchRecordsFailed++;
                            }
                        });

                        if (showStopMessage) {
                            apiCalloutStatusCallback(new ApiCalloutStatus({
                                message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.jobStopped, job.id, operation, sObjectName),
                                verbosity: LOG_MESSAGE_VERBOSITY.MINIMAL
                            }));
                        }

                        let progress = new ApiCalloutStatus({
                            sObjectName,
                            jobId: job.id,
                            numberRecordsProcessed: numberJobRecordsSucceeded,
                            numberRecordsFailed: numberBatchRecordsFailed
                        });

                        if (numberBatchRecordsFailed > 0) {

                            if (apiCalloutStatusCallback) {
                                progress.error = MessageUtils.getMessagesString(commonMessages,
                                    COMMON_RESOURCES.apiOperationError2,
                                    job.id,
                                    operation,
                                    sObjectName,
                                    batch.id,
                                    String(progress.numberRecordsFailed));
                                progress.message = progress.error;
                                progress.verbosity = LOG_MESSAGE_VERBOSITY.MINIMAL;
                                apiCalloutStatusCallback(progress);
                            }

                            if (sOrg.allOrNone) {
                                reject(progress);
                                return;
                            }

                        } else {
                            if (apiCalloutStatusCallback) {
                                progress.message = MessageUtils.getMessagesString(commonMessages,
                                    COMMON_RESOURCES.apiOperationCompleted,
                                    job.id,
                                    operation,
                                    sObjectName,
                                    String(progress.numberRecordsProcessed),
                                    String(progress.numberRecordsFailed));
                                progress.verbosity = LOG_MESSAGE_VERBOSITY.MINIMAL;
                                apiCalloutStatusCallback(progress);
                            }
                        }

                        resolve(numberJobRecordsSucceeded);

                    });
                });

            }

        };
    }
    //  --------------------------------------------------------------------------
    //  --------------------------------------------------------------------------





    // BULK API V2 PROCESSING ----------------------------------------------------
    //  --------------------------------------------------------------------------
    public static BulkApiV2_0(): IBulkApiProcessing {

        const bulkApiUnexpectedErrorMessage = MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.jobError);
        const bulkApiVersion = "2.0";

        return {

            createBulkApiJob: async function (
                operation: SfdmModels.Enums.OPERATION,
                sObjectName: string,
                sOrg: SfdmModels.SOrg,
                records: Array<any>): Promise<{
                    job: any,
                    cn: any,
                    chunks: any
                }> {

                let cn = sOrg.getConnection();
                let job = new BulkApi2sf(String(cn.version), cn.accessToken, cn.instanceUrl);

                let csvChunks = CommonUtils.createCsvStringsFromArray(records,
                    CONSTANTS.BULK_API_V2_MAX_CSV_SIZE_IN_BYTES,
                    CONSTANTS.BULK_API_V2_BLOCK_SIZE);
                return {
                    job,
                    cn,
                    chunks: csvChunks.chunks
                };
            },

            processBulkApiBatchAsync: async function (
                operation: any,
                sObjectName: string,
                cn: any,
                sOrg: SfdmModels.SOrg,
                apiCalloutStatusCallback: (status: ApiCalloutStatus) => void = null,
                job: any,
                records: any,
                numberJobRecordsSucceeded: number,
                showStartMessage: boolean,
                showStopMessage: boolean,
                updateRecordId: boolean): Promise<any> {

                return new Promise(async (resolve, reject) => {

                    let bulkApiService = <BulkApi2sf>job;
                    let csvString = records.csvString;
                    records = records.records;

                    if (showStartMessage) {
                        apiCalloutStatusCallback(new ApiCalloutStatus({
                            message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.usingBulkApi, bulkApiVersion),
                            verbosity: LOG_MESSAGE_VERBOSITY.MINIMAL
                        }));
                    }

                    // Create job
                    let jobResult = await bulkApiService.createBulkJobAsync(sObjectName, operation.toLowerCase());
                    // .... error
                    if (jobResult.resultStatus != RESULT_STATUSES.JobCreated) {
                        reject(new ApiCalloutStatus({
                            message: jobResult.errorMessage || bulkApiUnexpectedErrorMessage,
                            numberRecordsProcessed: 0,
                            numberRecordsFailed: records.length
                        }));
                        return;
                    }
                    // ... message
                    apiCalloutStatusCallback(new ApiCalloutStatus({
                        message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.jobStarted, jobResult.jobId, operation, sObjectName),
                        verbosity: LOG_MESSAGE_VERBOSITY.MINIMAL
                    }));



                    // Create batch and start data uploading
                    // ... message
                    apiCalloutStatusCallback(new ApiCalloutStatus({
                        message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.batchDataUploading, jobResult.jobId, operation, sObjectName),
                        verbosity: LOG_MESSAGE_VERBOSITY.MINIMAL
                    }));

                    let batchResult = await bulkApiService.createBulkBatchAsync(jobResult.contentUrl, csvString, records);
                    // .... error
                    if (batchResult.resultStatus != RESULT_STATUSES.BatchCreated) {
                        reject(new ApiCalloutStatus({
                            message: batchResult.errorMessage || bulkApiUnexpectedErrorMessage,
                            numberRecordsProcessed: 0,
                            numberRecordsFailed: records.length
                        }));
                        return;
                    }

                    // Upload complete, close batch
                    batchResult = await bulkApiService.closeBulkJobAsync(jobResult.contentUrl);
                    // .... error
                    if (batchResult.resultStatus != RESULT_STATUSES.DataUploaded) {
                        reject(new ApiCalloutStatus({
                            message: batchResult.errorMessage || bulkApiUnexpectedErrorMessage,
                            numberRecordsProcessed: 0,
                            numberRecordsFailed: records.length
                        }));
                        return;
                    }
                    // ... message
                    apiCalloutStatusCallback(new ApiCalloutStatus({
                        message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.batchDataProcessing, jobResult.jobId, operation, sObjectName),
                        verbosity: LOG_MESSAGE_VERBOSITY.MINIMAL
                    }));

                    let numberBatchRecordsProcessed = 0;
                    let numberBatchRecordsFailed = 0;

                    // Poll job
                    batchResult = await bulkApiService.waitForBulkJobCompleteAsync(jobResult.contentUrl, sOrg.pollingIntervalMs, function (results) {
                        if (apiCalloutStatusCallback) {
                            let progress: ApiCalloutStatus = new ApiCalloutStatus({
                                numberRecordsProcessed: +results.numberRecordsProcessed,
                                jobId: jobResult.jobId,
                                sObjectName: sObjectName
                            });
                            if (numberBatchRecordsProcessed != progress.numberRecordsProcessed) {
                                numberBatchRecordsProcessed = progress.numberRecordsProcessed;
                                progress.numberRecordsProcessed = numberJobRecordsSucceeded + progress.numberRecordsProcessed;
                                progress.message = MessageUtils.getMessagesString(commonMessages,
                                    COMMON_RESOURCES.apiOperationProgress,
                                    jobResult.jobId,
                                    operation,
                                    sObjectName,
                                    String(progress.numberRecordsProcessed),
                                    String(progress.numberRecordsFailed));
                                progress.verbosity = LOG_MESSAGE_VERBOSITY.VERBOSE;
                                apiCalloutStatusCallback(progress);
                            }
                        }
                    });


                    // Result
                    // ... message
                    apiCalloutStatusCallback(new ApiCalloutStatus({
                        message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.jobResultsRetrieving,
                            jobResult.jobId, operation, sObjectName),
                        verbosity: LOG_MESSAGE_VERBOSITY.MINIMAL
                    }));

                    batchResult = await bulkApiService.getBulkJobResultAsync(jobResult.contentUrl);
                    let rets = batchResult.resultRecords;

                    records.forEach((record, index) => {
                        if (rets[index].isSuccess) {
                            if (updateRecordId) {
                                record["Id"] = rets[index].id;
                                record["Errors"] = null;
                            }
                            numberJobRecordsSucceeded++;
                        } else {
                            if (rets[index].errorMessage) {
                                record["Errors"] = rets[index].errorMessage;
                            }
                            numberBatchRecordsFailed++;
                        }
                    });

                    if (showStopMessage) {
                        apiCalloutStatusCallback(new ApiCalloutStatus({
                            message: MessageUtils.getMessagesString(commonMessages, COMMON_RESOURCES.jobStopped, jobResult.jobId, operation, sObjectName),
                            verbosity: LOG_MESSAGE_VERBOSITY.MINIMAL
                        }));
                    }

                    let progress = new ApiCalloutStatus({
                        sObjectName,
                        jobId: jobResult.jobId,
                        numberRecordsProcessed: numberJobRecordsSucceeded,
                        numberRecordsFailed: numberBatchRecordsFailed
                    });

                    if (numberBatchRecordsFailed > 0) {

                        if (apiCalloutStatusCallback) {
                            progress.error = MessageUtils.getMessagesString(commonMessages,
                                COMMON_RESOURCES.apiOperationError3,
                                jobResult.jobId,
                                operation,
                                sObjectName,
                                jobResult.jobId,
                                String(numberBatchRecordsFailed));
                            progress.message = progress.error;
                            progress.verbosity = LOG_MESSAGE_VERBOSITY.MINIMAL;
                            apiCalloutStatusCallback(progress);
                        }

                        if (sOrg.allOrNone) {
                            reject(progress);
                            return;
                        }

                    } else {
                        if (apiCalloutStatusCallback) {
                            progress.message = MessageUtils.getMessagesString(commonMessages,
                                COMMON_RESOURCES.apiOperationCompleted,
                                jobResult.jobId,
                                operation,
                                sObjectName,
                                String(numberJobRecordsSucceeded),
                                String(numberBatchRecordsFailed));
                            progress.verbosity = LOG_MESSAGE_VERBOSITY.MINIMAL;
                            apiCalloutStatusCallback(progress);
                        }
                    }

                    resolve(numberJobRecordsSucceeded);
                });
            }
        };
    }


    //  --------------------------------------------------------------------------
    //  --------------------------------------------------------------------------






}
