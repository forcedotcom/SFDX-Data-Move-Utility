/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import {
    composeQuery,
    Condition,
    Field as SOQLField,
    FieldType,
    getComposedField,
    LiteralType,
    LogicalOperator,
    Operator,
    parseQuery,
    Query,
    WhereClause
} from 'soql-parser-js';
import { CONSTANTS } from './statics';
import { DescribeSObjectResult, QueryResult } from 'jsforce';
import { IOrgConnectionData, SFieldDescribe, SObjectDescribe, ScriptOrg } from '../../models';

var jsforce = require("jsforce");


export class Sfdx {

    org: ScriptOrg;

    constructor(org: ScriptOrg) {
        this.org = org;
    }

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

        const makeQueryAsync = (soql: string) => new Promise((resolve, reject) => {

            let conn = self.org.getConnection();

            let records = [];

            if (useBulkQueryApi) {
                conn.bulk.query(soql).on("record", function (record: any) {
                    records.push(record);
                }).on("end", function () {
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
    }

    /**
     * Query records from the current org or from csv file.
     * Handles composite external id keys.
     *
     * @param {string} soql The soql query to retireve records
     * @param {boolean} useBulkQueryApi true to use the Bulk Query Api instead of the REST Api
     * @param {string} [csvFilename]   The full csv filename including full path (Used to query csv file). Leave blank to retrieve records from org.
     * @param {Map<string, SFieldDescribe>} [fieldsMap] The field description of the queried sObject (Used to query csv file). Leave blank to retrieve records from org.
     * @returns {Promise<Array<any>>}
     * @memberof Sfdx
     */
    async queryFullAsync(soql: string, useBulkQueryApi: boolean, csvFilename?: string, fieldsMap?: Map<string, SFieldDescribe>): Promise<Array<any>> {
        let self = this;
        let records = [].concat(await ___query(soql));
        if (soql.indexOf("FROM Group") >= 0) {
            soql = soql.replace("FROM Group", "FROM User");
            records = records.concat(await ___query(soql));
        }
        return records;

        // ------------------ internal functions ------------------------- //
        async function ___query(soql: string): Promise<Array<any>> {
            let soqlFormat = ___formatSoql(soql);
            soql = soqlFormat[0];
            let records = (await self.queryAsync(soql, useBulkQueryApi)).records;
            records = ___parseRecords(records, soql);
            records = ___formatRecords(records, soqlFormat);
            return records;
        }

        function ___formatSoql(soql: string): [string, Map<string, Array<string>>, Array<string>] {
            let newParsedQuery = parseQuery(soql);
            if (newParsedQuery.where && newParsedQuery.where.left && newParsedQuery.where.left.openParen && !newParsedQuery.where.left.closeParen) {
                newParsedQuery.where.left.closeParen = newParsedQuery.where.left.openParen;
            }
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
                        return newRawValueTmp == rawValueOrig;
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
                            return newRawValueTmp == newFieldName;
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
            return [newQuery, outputMap, originalFieldNamesToKeep];
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

        function ___formatRecords(records: Array<any>, soqlFormat: [string, Map<string, Array<string>>, Array<string>]): Array<any> {
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


    }

    /**
    * Describes given SObject by retrieving field descriptions
    * 
    * @param  {string} objectName Object API name to describe
    * @param  {SfdmSOrg} sOrg sOrg instance
    * @param  {Map<string, SObjectDescribe>} defaultDescibe
    * @returns SfdmSObjectDescribe
    * @memberof ApiSf
    */
    async describeSObjectAsync(objectName: string): Promise<SObjectDescribe> {

        var conn = this.org.getConnection();

        const describeAsync = (name: string) => new Promise((resolve, reject) =>
            conn.sobject(name).describe(function (err: any, meta: any) {
                if (err)
                    reject(err);
                else
                    resolve(meta);
            }));
        let describeResult: DescribeSObjectResult = <DescribeSObjectResult>(await describeAsync(objectName));
        let sObjectDescribe: SObjectDescribe = new SObjectDescribe({
            name: describeResult.name,
            createable: describeResult.createable,
            custom: describeResult.custom,
            label: describeResult.label,
            updateable: describeResult.createable && describeResult.updateable
        });
        describeResult.fields.forEach(field => {
            let f = new SFieldDescribe();
            f.objectName = describeResult.name;
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

            sObjectDescribe.fieldsMap.set(f.name, f);
        });
        return sObjectDescribe;
    };


    /**
     * Creates jforce connection instance
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



    // ------------------------------------- Private members ------------------------------------------------



}