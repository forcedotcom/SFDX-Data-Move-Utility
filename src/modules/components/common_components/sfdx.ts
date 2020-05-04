/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as models from '../../models';
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
import { CONSTANTS, DATA_MEDIA_TYPE } from './statics';
import { DescribeSObjectResult, QueryResult } from 'jsforce';
import { IOrgConnectionData } from '../../models';
var jsforce = require("jsforce");


export class Sfdx {

    org: models.ScriptOrg;

    constructor(org: models.ScriptOrg) {
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
    * Describes given SObject by retrieving field descriptions
    * 
    * @param  {string} objectName Object API name to describe
    * @param  {SfdmModels.SOrg} sOrg sOrg instance
    * @param  {Map<string, SObjectDescribe>} defaultDescibe
    * @returns SfdmModels.SObjectDescribe
    * @memberof ApiSf
    */
    async describeSObjectAsync(objectName: string): Promise<models.SObjectDescribe> {

        var conn = this.org.getConnection();

        const describeAsync = (name: string) => new Promise((resolve, reject) =>
            conn.sobject(name).describe(function (err: any, meta: any) {
                if (err)
                    reject(err);
                else
                    resolve(meta);
            }));
        let describeResult: DescribeSObjectResult = <DescribeSObjectResult>(await describeAsync(objectName));
        let sObjectDescribe: models.SObjectDescribe = new models.SObjectDescribe({
            name: describeResult.name,
            createable: describeResult.createable,
            custom: describeResult.custom,
            label: describeResult.label,
            updateable: describeResult.createable && describeResult.updateable
        });
        describeResult.fields.forEach(field => {
            let f = new models.SFieldDescribe();
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
  
}