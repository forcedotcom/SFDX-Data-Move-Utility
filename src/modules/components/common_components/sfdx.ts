/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import {
    composeQuery,
    Field as SOQLField,
    getComposedField,
    parseQuery,
} from 'soql-parser-js';
import { CONSTANTS } from './statics';
import { DescribeSObjectResult, QueryResult } from 'jsforce';
import { SFieldDescribe, SObjectDescribe, ScriptOrg, CommandExecutionError, ObjectFieldMapping } from '../../models';
import { Common } from './common';
import { IOrgConnectionData, IFieldMapping, IFieldMappingResult, IIdentityInfo } from '../../models/common_models/helper_interfaces';
import { Logger, RESOURCES } from './logger';
import { IBlobField } from '../../models/api_models';

var jsforce = require("jsforce");


export class Sfdx implements IFieldMapping {

    org: ScriptOrg;

    get logger(): Logger {
        return this.org.script.logger;
    }

    constructor(org: ScriptOrg, targetFieldMapping?: IFieldMapping) {
        this.org = org;
        if (targetFieldMapping) {
            Object.assign(this, targetFieldMapping);
        }
    }

    sourceQueryToTarget = (query: string, sourceObjectName: string) => <IFieldMappingResult>{ query, targetSObjectName: sourceObjectName };
    sourceRecordsToTarget = (records: any[], sourceObjectName: string) => <IFieldMappingResult>{ records, targetSObjectName: sourceObjectName };
    targetRecordsToSource = (records: any[], sourceObjectName: string) => <IFieldMappingResult>{ records, targetSObjectName: sourceObjectName };
    transformQuery: (query: string, sourceObjectName: string) => IFieldMappingResult;

    /**
     *  Performs SOQL query and returns records
     *
     * @param {string} soql The SOQL query
     * @param {boolean} useBulkQueryApi true to use Bulk Query Api instead of the Collection Api
     * @returns {Promise<QueryResult<object>>}
     * @memberof ApiSf
     */
    async queryAsync(soql: string, useBulkQueryApi: boolean): Promise<QueryResult<object>> {

        let self = this;

        const makeQueryAsync = async (soql: string) => new Promise((resolve, reject) => {

            let conn = self.org.getConnection();
            conn.bulk.pollTimeout = CONSTANTS.BULK_QUERY_API_POLL_TIMEOUT;

            let records = [];

            if (useBulkQueryApi) {
                conn.bulk.query(soql).on("record", function (record: any) {
                    records.push(record);
                }).on("end", function () {
                    ___fixRecords(records);
                    resolve(<QueryResult<object>>{
                        done: true,
                        records: records,
                        totalSize: records.length
                    });
                }).on("error", function (error: any) {
                    reject(error);
                });
            } else {
                let query = conn.query(soql).on("record", function (record: any) {
                    records.push(record);
                }).on("end", function () {
                    ___fixRecords(records);
                    resolve(<QueryResult<object>>{
                        done: true,
                        records: records,
                        totalSize: query.totalSize
                    });
                }).on("error", function (error: any) {
                    reject(error);
                }).run({
                    autoFetch: true,
                    maxFetch: CONSTANTS.MAX_FETCH_SIZE
                });
            }
        });

        return <QueryResult<object>>(await makeQueryAsync(soql));

        function ___fixRecords(records: Array<any>) {
            if (records.length == 0) return;
            let props = Object.keys(records[0]);
            records.forEach(record => {
                props.forEach(prop => {
                    if (record[prop] === "") {
                        record[prop] = null;
                    }
                });
            });
        }
    }

    /**
     * Retrieve records from the org or from csv file.
     * Handles composite external id keys.
     *
     * @param {string} soql The soql query to retireve records
     * @param {boolean} useBulkQueryApi true to use the Bulk Query Api instead of the REST Api
     * @param {string} [csvFullFilename]   The full csv filename including full path (Used to query csv file). Leave blank to retrieve records from org.
     * @param {Map<string, SFieldDescribe>} [sFieldsDescribeMap] The field description of the queried sObject (Used to query csv file). Leave blank to retrieve records from org.
     * @returns {Promise<Array<any>>}
     * @memberof Sfdx
     */
    async retrieveRecordsAsync(soql: string,
        useBulkQueryApi: boolean = false,
        csvFullFilename?: string,
        sFieldsDescribeMap?: Map<string, SFieldDescribe>): Promise<Array<any>> {
        let self = this;
        try {
            if (csvFullFilename && sFieldsDescribeMap) {
                return await ___readAndFormatCsvRecordsAsync();
            }
            // Map query /////
            let parsedQuery = parseQuery(soql);
            soql = this.sourceQueryToTarget(soql, parsedQuery.sObject).query;
            // Query records /////
            let records = [].concat(await ___queryAsync(soql));
            if (/FROM Group([\s]+|$)/i.test(soql)) {
                soql = soql.replace("FROM Group", "FROM User");
                records = records.concat(await ___queryAsync(soql));
            } else if (/FROM User([\s]+|$)/i.test(soql)) {
                soql = soql.replace("FROM User", "FROM Group");
                records = records.concat(await ___queryAsync(soql));
            }
            // Map records /////
            records = this.targetRecordsToSource(records, parsedQuery.sObject).records;
            return records;
        } catch (ex) {
            throw new CommandExecutionError(ex.message);
        }

        // ------------------ internal functions ------------------------- //
        async function ___queryAsync(soql: string): Promise<Array<any>> {
            let soqlFormat = ___formatSoql(soql);
            soql = soqlFormat[0];
            let records = (await self.queryAsync(soql, useBulkQueryApi)).records;
            records = ___parseRecords(records, soql);
            records = ___formatRecords(records, soqlFormat);
            records = await ___retrieveBlobFieldData(records, soqlFormat[3]);
            return records;
        }

        function ___formatSoql(soql: string): [string, Map<string, Array<string>>, Array<string>, string] {
            let newParsedQuery = parseQuery(soql);
            // if (newParsedQuery.where && newParsedQuery.where.left && newParsedQuery.where.left.openParen && !newParsedQuery.where.left.closeParen) {
            //     newParsedQuery.where.left.closeParen = newParsedQuery.where.left.openParen;
            // }
            let originalFields: Array<SOQLField> = newParsedQuery.fields.map(x => {
                return <SOQLField>x;
            });
            let originalFieldNamesToKeep = originalFields.map(newFieldTmp => {
                let newSOQLFieldTmp = <SOQLField>newFieldTmp;
                let newRawValueTmp = newSOQLFieldTmp["rawValue"] || newSOQLFieldTmp.field;
                return newRawValueTmp;
            });
            newParsedQuery.fields = [];
            let outputMap: Map<string, Array<string>> = new Map<string, Array<string>>();
            originalFields.forEach(originalField => {
                let rawValueOrig = originalField["rawValue"] || originalField.field;
                if (rawValueOrig.indexOf(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX) < 0) {
                    // Simple field
                    if (!newParsedQuery.fields.some(newFieldTmp => {
                        let newSOQLFieldTmp = <SOQLField>newFieldTmp;
                        let newRawValueTmp = newSOQLFieldTmp["rawValue"] || newSOQLFieldTmp.field;
                        return newRawValueTmp.toLowerCase() == rawValueOrig.toLowerCase();
                    })) {
                        newParsedQuery.fields.push(originalField);
                    }
                } else {
                    // Complex field
                    let complexFields = rawValueOrig.split(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX);
                    complexFields[1] = complexFields[1].startsWith('.') ? complexFields[1].substr(1) : complexFields[1];
                    let containedFields = complexFields[1].split(CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR);
                    containedFields.forEach((field: any) => {
                        let newFieldName = complexFields[0] ? complexFields[0] + field : field;
                        if (!newParsedQuery.fields.some(newFieldTmp => {
                            let newSOQLFieldTmp = <SOQLField>newFieldTmp;
                            let newRawValueTmp = newSOQLFieldTmp["rawValue"] || newSOQLFieldTmp.field;
                            return newRawValueTmp.toLowerCase() == newFieldName.toLowerCase();
                        })) {
                            newParsedQuery.fields.push(getComposedField(newFieldName));
                        }
                        if (!outputMap.has(rawValueOrig))
                            outputMap.set(rawValueOrig, [newFieldName]);
                        else
                            outputMap.get(rawValueOrig).push(newFieldName);
                    });
                }

            });
            let newQuery: string = composeQuery(newParsedQuery);
            if (self.transformQuery) {
                newQuery = self.transformQuery(newQuery, newParsedQuery.sObject).query;
            }
            return [newQuery, outputMap, originalFieldNamesToKeep, newParsedQuery.sObject];
        }

        function ___parseRecords(rawRecords: Array<any>, query: string): Array<any> {
            const getNestedObject = (nestedObj: any, pathArr: any) => {
                return pathArr.reduce((obj: any, key: any) => obj && obj[key] !== 'undefined' ? obj[key] : undefined, nestedObj);
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
            var parsedRecords = rawRecords.map(function (record) {
                var o = {};
                for (var prop in fieldMapping) {
                    if (fieldMapping.hasOwnProperty(prop)) {
                        o[prop] = getNestedObject(record, fieldMapping[prop]);
                    }
                }
                return o;
            });
            return parsedRecords;
        }

        function ___formatRecords(records: Array<any>, soqlFormat: [string, Map<string, Array<string>>, Array<string>, string]): Array<any> {
            // Process complex keys}
            if (soqlFormat[1].size == 0) {
                return records;
            }
            let complexKeys = [...soqlFormat[1].keys()];
            records.forEach(record => {
                complexKeys.forEach(complexKey => {
                    let fields = soqlFormat[1].get(complexKey);
                    let value = [];
                    fields.forEach(field => {
                        if (record[field]) {
                            value.push(record[field]);
                        }
                    });
                    record[complexKey.toString()] = value.join(';') || null;
                });
                complexKeys.forEach(complexKey => {
                    let fields = soqlFormat[1].get(complexKey);
                    fields.forEach(field => {
                        if (soqlFormat[2].indexOf(field) < 0) {
                            delete record[field];
                        }
                    });
                });
            });
            return records;
        }

        async function ___readAndFormatCsvRecordsAsync(): Promise<Array<any>> {
            let fieldTypesMap: Map<string, string> = new Map<string, string>();
            sFieldsDescribeMap.forEach((value, key) => fieldTypesMap.set(key, value.type));
            let records: Array<any> = await Common.readCsvFileAsync(csvFullFilename, 0, fieldTypesMap);
            let parsedQuery = parseQuery(soql);
            let fields = parsedQuery.fields.map(field => (<SOQLField>field)["rawValue"] || (<SOQLField>field).field);
            records.forEach(record => {
                fields.forEach(field => {
                    record[field] = typeof record[field] == "undefined" ? null : record[field];
                });
            });
            return records;
        }

        async function ___retrieveBlobFieldData(records: Array<any>, sObjectName: string): Promise<Array<any>> {


            let blobFields = CONSTANTS.BLOB_FIELDS.filter(field =>
                records.length > 0
                && field.objectName == sObjectName
                && records[0].hasOwnProperty(field.fieldName));
            if (blobFields.length == 0) {
                return records;
            }
            // Message
            self.logger.infoVerbose(RESOURCES.retrievingBinaryData, sObjectName);
            let recordIdToRecordMap = new Map<string, any>();
            records.forEach(record => {
                let recordId = record["Id"];
                if (recordId) {
                    recordIdToRecordMap.set(recordId, record);
                }
            });

            const ids = [...recordIdToRecordMap.keys()];
            for (let blobFieldIndex = 0; blobFieldIndex < blobFields.length; blobFieldIndex++) {
                const blobField = blobFields[blobFieldIndex];
                const blobData = await self.downloadBlobFieldDataAsync(ids, blobField);
                blobData.forEach((blobValue, id) => {
                    let record = recordIdToRecordMap.get(id);
                    if (record) {
                        record[blobField.fieldName] = blobValue;
                    }
                });
            }

            return records;
        }
    }

    /**
     * Get list of all objects in the org
     *
     * @returns {Promise<Array<SObjectDescribe>>}
     * @memberof Sfdx
     */
    public async describeOrgAsync(): Promise<Array<SObjectDescribe>> {
        let query = `SELECT  QualifiedApiName, Label 
                    FROM EntityDefinition 
                    WHERE IsDeprecatedAndHidden = false 
                    ORDER BY QualifiedApiName`;
        let records = await this.queryAsync(query, false);
        return records.records.map((record: any) => {
            return new SObjectDescribe({
                label: String(record["Label"]),
                name: String(record["QualifiedApiName"]),
                createable: true,
                updateable: true,
                custom: Common.isCustomObject(String(record["QualifiedApiName"]))
            });
        });
    }

    /**
     * Performs Connection#identity query
     *
     * @returns {Promise<IIdentityInfo>}
     * @memberof Sfdx
     */
    public async identityAsync(): Promise<IIdentityInfo> {
        var conn = this.org.getConnection();
        return new Promise((resolve, reject) => {
            conn.identity(function (err: any, info: IIdentityInfo) {
                if (err)
                    reject(err);
                else {
                    resolve(info);
                }
            });
        });
    }

    /**
    * Describes given SObject by retrieving field descriptions
    * 
    * @param  {string} objectName Object API name to describe
    * @param  {Map<string, SObjectDescribe>} objectFieldMapping The mapping between the source and target object / field
    * @returns SfdmSObjectDescribe
    * @memberof ApiSf
    */
    async describeSObjectAsync(objectName: string, objectFieldMapping?: ObjectFieldMapping): Promise<SObjectDescribe> {

        var conn = this.org.getConnection();

        const describeAsync = (name: string) => new Promise((resolve, reject) =>
            conn.sobject(name).describe(function (err: any, meta: any) {
                if (err)
                    reject(err);
                else
                    resolve(meta);
            }));

        let targetObjectName = objectFieldMapping ? objectFieldMapping.targetSObjectName : objectName;
        let isTheSameMappedObject = objectFieldMapping && targetObjectName == objectName;

        // Using the target object name...
        let describeResult: DescribeSObjectResult = <DescribeSObjectResult>(await describeAsync(targetObjectName));
        let sObjectDescribe: SObjectDescribe = new SObjectDescribe({
            // Using the source object name...
            name: objectName,
            createable: describeResult.createable,
            custom: describeResult.custom,
            label: describeResult.label,
            updateable: describeResult.createable && describeResult.updateable
        });
        let mapItems: Array<[string, string]> = objectFieldMapping && objectFieldMapping.fieldMapping && [...objectFieldMapping.fieldMapping.entries()] || [];
        describeResult.fields.forEach(field => {
            let f = new SFieldDescribe();
            // ------
            f.objectName = objectName;
            let fn = mapItems.filter(sourceToTargetItem => sourceToTargetItem[1] == field.name)[0];
            if (fn && !isTheSameMappedObject) {
                f.name = fn[0];
            } else {
                f.name = field.name;
            }
            // ------
            f.nameField = field.nameField;
            f.unique = field.unique;
            f.type = field.type;
            f.label = field.label;
            f.custom = field.custom;
            f.updateable = field.updateable;
            f.autoNumber = field["autoNumber"];
            f.creatable = field.createable;
            f.calculated = field.calculated;
            f.cascadeDelete = field.cascadeDelete;
            f.lookup = field.referenceTo != null && field.referenceTo.length > 0;
            f.referencedObjectType = field.referenceTo[0];
            f.length = field.length || 0;

            // ------
            f.isDescribed = true;
            // ------
            sObjectDescribe.fieldsMap.set(f.name, f);
        });
        return sObjectDescribe;
    };


    /**
     * @static Creates jforce connection instance
     *
     * @param {string} instanceUrl
     * @param {string} accessToken
     * @param {string} apiVersion
     * @returns {*}
     * @memberof ApiSf
     */
    public static createOrgConnection(connectionData: IOrgConnectionData): any {
        return new jsforce.Connection({
            instanceUrl: connectionData.instanceUrl,
            accessToken: connectionData.accessToken,
            version: connectionData.apiVersion,
            maxRequest: CONSTANTS.MAX_CONCURRENT_PARALLEL_REQUESTS
        });
    }

    /**
     * The function downloads blob (binary) data of the given field.
     * The function works in parallel mode.
     * 
     * @param {Array<string>} recordIds The record ids to download the data
     * @param {IBlobField} blobField The data about the field
     * @returns {Promise<Map<string, string>>} Returns map between the record Id 
     *                                          and the base64 string representations 
     *                                          of the corresponding binary data
     * @memberof Sfdx
     */
    async downloadBlobFieldDataAsync(recordIds: Array<string>, blobField: IBlobField): Promise<Map<string, string>> {

        let self = this;
        const queue = recordIds.map(recordId => () => ___getBlobData(recordId, blobField));
        const downloadedBlobs: Array<[string, string]> = await Common.parallelTasksAsync(queue, CONSTANTS.MAX_PARALLEL_DOWNLOAD_THREADS);
        return new Map<string, string>(downloadedBlobs);

        // ------------------ internal functions ------------------------- //        
        async function ___getBlobData(recordId: string, blobField: IBlobField): Promise<[string, string]> {
            return new Promise<[string, string]>(resolve => {
                var conn = self.org.getConnection();
                let blob = conn.sobject(blobField.objectName).record(recordId).blob(blobField.fieldName);
                let buffers = new Array<any>();
                blob.on('data', function (data: any) {
                    buffers.push(data);
                });
                blob.on('end', function () {
                    resolve([recordId, Buffer.concat(buffers).toString(blobField.dataType)]);
                });
            });
        }
    }



}