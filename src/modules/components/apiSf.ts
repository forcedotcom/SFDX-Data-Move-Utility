/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as models from '../models';
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
import { QueryResult } from 'jsforce';


export class ApiSf {

    org: models.ScriptOrg;


    constructor(org: models.ScriptOrg) {
        this.org = org;
    }



    /**
     *  Performs SOQL query and returns records
     *
     * @param {string} soql The SOQL query
     * @param {boolean} useBulkApi true to use Bulk Query Api instead of the Collection Api
     * @returns {Promise<QueryResult<object>>}
     * @memberof ApiSf
     */
    async queryAsync(soql: string, useBulkApi: boolean): Promise<QueryResult<object>> {

        let self = this;

        const makeQueryAsync = (soql: string) => new Promise((resolve, reject) => {

            let conn = self.org.getConnection();

            let records = [];

            if (useBulkApi) {
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



}