/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as SfdmModels from "./models/index";
import { execSync } from 'child_process';
import { List } from 'linq.ts';
import "reflect-metadata";
import "es6-shim";
import { QueryResult, DescribeSObjectResult } from 'jsforce';
import {
    Query,
    parseQuery,
    WhereClause,
    Condition,
    LiteralType,
    LogicalOperator,
    getComposedField,
    composeQuery,
    Field as SOQLField,
    FieldType
} from 'soql-parser-js';
import * as deepClone from "deep.clone";
import { CommonUtils } from "./common";
import { SObjectDescribe } from "./models/index";
import path = require('path');
import fs = require('fs');

import casual = require("casual");

CommonUtils.createMockCustomFunctions(casual);



export class SfdxUtils {

    /**
    * Executes any SFDX command and returns stdout string
    * @param command ex. force:org:display
    * @param targetusername the org instance username (ex. my@mail.com)
    */
    public static execSfdx(command: String, targetusername: String): string {
        if (typeof targetusername != "undefined")
            return execSync(`sfdx ${command} --targetusername ${targetusername}`).toString();
        else
            return execSync(`sfdx ${command}`).toString();
    };

    /**
     * Parses console output of force:org:display command
     */
    public static parseForceOrgDisplayResult(input: String): SfdmModels.OrgInfo {
        if (!input) return null;
        let lines = input.split('\n');
        let output: SfdmModels.OrgInfo = new SfdmModels.OrgInfo();
        lines.forEach(line => {
            if (line.startsWith("Access Token"))
                output.AccessToken = new List<string>(line.split(' ')).Last();
            if (line.startsWith("Client Id"))
                output.ClientId = new List<string>(line.split(' ')).Last();
            if (line.startsWith("Connected Status"))
                output.ConnectedStatus = new List<string>(line.split(' ')).Last();
            if (line.startsWith("Id"))
                output.OrgId = new List<string>(line.split(' ')).Last();
            if (line.startsWith("Instance Url"))
                output.InstanceUrl = new List<string>(line.split(' ')).Last();
            if (line.startsWith("Username"))
                output.Username = new List<string>(line.split(' ')).Last();
        });

        return output;

    };

    /**
     * Transforms standard QueryResult records to array of objects
     * (including nested properties ex. Account__r.Name)
     */
    public static parseRecords(records: object[], query: string): List<object> {

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

        var parsedRecords = new List<object>(records.map(function (record) {
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

    public static async validateAccessToken(sOrg: SfdmModels.SOrg): Promise<void> {
        if (sOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.Org)
            await SfdxUtils.queryAsync("SELECT Id FROM Account LIMIT 1", sOrg);
    }

    /**
     * Describe given org getting list of its SObjects without fields
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
     * Describes given SObject
     */
    public static async describeSObjectAsync(objectName: string, sOrg: SfdmModels.SOrg, defaultDescibe: Map<string, SObjectDescribe>): Promise<SfdmModels.SObjectDescribe> {

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
     * Performs SOQL. 
     * Returns QueryResult<object>
     */
    public static async queryAsync(soql: string, sOrg: SfdmModels.SOrg): Promise<QueryResult<object>> {

        const makeQueryAsync = (soql) => new Promise((resolve, reject) => {

            var cn = sOrg.getConnection();

            var records = [];

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
                maxFetch: SfdmModels.CONSTANTS.MAX_FETCH_SIZE
            });
        });

        return <QueryResult<object>>(await makeQueryAsync(soql));
    }

    public static formatRecords(records: Array<object>, format: [string, Map<String, List<String>>, Array<String>]): Array<object> {
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

    public static prepareQuery(soql: string): [string, Map<String, List<String>>, Array<String>] {
        let newParsedQuery = parseQuery(soql);
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
                if (newParsedQuery.fields.filter(newFieldTmp => {
                    let newSOQLFieldTmp = <SOQLField>newFieldTmp;
                    let newRawValueTmp = newSOQLFieldTmp["rawValue"] || newSOQLFieldTmp.field;
                    return newRawValueTmp == rawValueOrig;
                }).length == 0) {
                    newParsedQuery.fields.push(originalField);
                }
            } else {
                // Complex field
                let complexFields = rawValueOrig.split(SfdmModels.CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX);
                complexFields[1] = complexFields[1].startsWith('.') ? complexFields[1].substr(1) : complexFields[1];
                let containedFields = complexFields[1].split(SfdmModels.CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR);
                containedFields.forEach(field => {
                    let newFieldName = complexFields[0] ? complexFields[0] + field : field;
                    if (newParsedQuery.fields.filter(newFieldTmp => {
                        let newSOQLFieldTmp = <SOQLField>newFieldTmp;
                        let newRawValueTmp = newSOQLFieldTmp["rawValue"] || newSOQLFieldTmp.field;
                        return newRawValueTmp == newFieldName;
                    }).length == 0) {
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

    /**
     * Performs multiple queries and returns records map by given field.
     */
    public static async queryMultipleAsync(soqls: Array<string>, key: string, sOrg: SfdmModels.SOrg, useNonOrgMedia: boolean = false): Promise<Map<string, object>> {
        let recordsMap: Map<string, object> = new Map<string, object>();
        for (let index = 0; index < soqls.length; index++) {
            const query = soqls[index];
            let records = await this.queryAndParseAsync(query, sOrg, useNonOrgMedia);
            records.ForEach(record => {
                recordsMap.set(record[key], record);
            });
        }
        return recordsMap;
    }

    /**
     * Performs SOQL. Returns parsed list of objects.
     * Complex external ids fields it automatically treates as formula field
     */
    public static async queryAndParseAsync(soql: string, sOrg: SfdmModels.SOrg, useNonOrgMedia: boolean = false, password?: string): Promise<List<object>> {

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
            let newSoql = _this.prepareQuery(soql);
            soql = newSoql[0];
            let rcs = (await _this.queryAsync(soql, sOrg)).records;
            rcs = _this.parseRecords(rcs, soql).ToArray();
            rcs = _this.formatRecords(rcs, newSoql);
            ret.AddRange(rcs);
            if (soql.indexOf("FROM Group") >= 0) {
                soql = soql.replace("FROM Group", "FROM User");
                ret.AddRange(_this.parseRecords((await _this.queryAsync(soql, sOrg)).records, soql).ToArray());
            }
            return ret;
        }


        if (sOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.File && useNonOrgMedia) {
            if (name == "Group" || name == "User") {
                name = SfdmModels.CONSTANTS.USER_AND_GROUP_FILE_NAME;
            }
            let filename = `${name}.csv`;
            let filepath = path.join(sOrg.basePath, filename);
            if (!fs.existsSync(filepath)) {
                return new List<object>();
            }
            let data = await CommonUtils.readCsvFile(filepath, 0, csvColumnsToColumnTypeMap);
            if (data.length == 0) {
                return new List<object>(data);
            }
            data = CommonUtils.decryptRecords(data, password);
            return new List<object>(data);
        }

        return await getRecords(soql, sOrg);

    }


    public static async writeCsvFileAsync(name: string, records: Array<object>, sOrg: SfdmModels.SOrg, password?: string): Promise<void> {
        let filename = `${name}.csv`;
        let filepath = path.join(sOrg.basePath, filename);
        records = CommonUtils.encryptRecords(records, password);
        await CommonUtils.writeCsvFile(filepath, records);
    }

    /**
     * Performs SOQL. Returns QueryResult<object>.
     */
    public static async updateAsync(sObjectName: string,
        records: List<object>,
        sOrg: SfdmModels.SOrg,
        pollCallback: Function = null): Promise<List<object>> {


        const makeUpdateAsync = (sObjectName: string, records: List<object>, sOrg: SfdmModels.SOrg) => new Promise(async (resolve, reject) => {

            let cn = sOrg.getConnection();
            cn.bulk.pollTimeout = SfdmModels.CONSTANTS.POLL_TIMEOUT;

            if (records.Count() > sOrg.bulkThreshold) {

                let job = cn.bulk.createJob(sObjectName, "update");

                let chunks = CommonUtils.chunkArray(records.ToArray(), SfdmModels.CONSTANTS.MAX_BATCH_SIZE);
                let totalProcessed = 0;

                for (let index = 0; index < chunks.length; index++) {
                    const chunk = chunks[index];
                    totalProcessed = await SfdxUtils._processBatch(cn, sOrg, pollCallback, job, chunk, totalProcessed, index == 0, index == chunks.length - 1,  false);
                }

                resolve(totalProcessed);

            } else {
                cn.sobject(sObjectName).update(records.ToArray(), {
                    allOrNone: sOrg.allOrNone,
                    allowRecursive: true
                },
                    function (error, result) {
                        if (error) {
                            reject(error);
                            return;
                        }
                        let res = {
                            jobId: "REST",
                            numberRecordsProcessed: 0,
                            numberRecordsFailed: 0,
                            error: "No"
                        };
                        records.ForEach((record, index) => {
                            if (result[index].success) {
                                res.numberRecordsProcessed++;
                            } else {
                                res.numberRecordsFailed++;
                                res.error = result[index].errors[0].message;
                            }
                        });
                        if (pollCallback) {
                            pollCallback(error, res);
                        }

                        resolve(result.length);
                    });
            }

        });

        await makeUpdateAsync(sObjectName, records, sOrg);

        return records;

    }

    /**
     * Inserts new records from list of object
     */
    public static async insertAsync(sObjectName: string,
        records: List<object>,
        sOrg: SfdmModels.SOrg,
        pollCallback: Function = null): Promise<List<object>> {

        const makeInsertAsync = (sObjectName: string, records: List<object>, sOrg: SfdmModels.SOrg) => new Promise(async (resolve, reject) => {

            let cn = sOrg.getConnection();
            cn.bulk.pollTimeout = SfdmModels.CONSTANTS.POLL_TIMEOUT;

            if (records.Count() > sOrg.bulkThreshold) {

                let job = cn.bulk.createJob(sObjectName, "insert");
                let chunks = CommonUtils.chunkArray(records.ToArray(), SfdmModels.CONSTANTS.MAX_BATCH_SIZE);
                let totalProcessed = 0;

                for (let index = 0; index < chunks.length; index++) {
                    const chunk = chunks[index];
                    totalProcessed = await SfdxUtils._processBatch(cn, sOrg, pollCallback, job, chunk, totalProcessed, index == 0, index == chunks.length - 1,  true);
                }

                resolve(totalProcessed);

            } else {
                cn.sobject(sObjectName).create(records.ToArray(), {
                    allOrNone: sOrg.allOrNone,
                    allowRecursive: true
                }, function (error, result) {
                    if (error) {
                        reject(error);
                        return;
                    }
                    let res = {
                        jobId: "REST",
                        numberRecordsProcessed: 0,
                        numberRecordsFailed: 0,
                        error: "No"
                    };

                    records.ForEach((record, index) => {
                        if (result[index].success) {
                            res.numberRecordsProcessed++;
                            record["Id"] = result[index].id;
                        } else {
                            res.numberRecordsFailed++;
                            res.error = result[index].errors[0].message;
                        }
                    });
                    if (pollCallback) {
                        pollCallback(error, res);
                    }
                    resolve(result.length);
                });
            }

        });

        await makeInsertAsync(sObjectName, records, sOrg);

        return records.Where(x => x["Id"]);

    }

    /**
     * Remove records
     */
    public static async deleteAsync(sObjectName: string,
        records: List<object>,
        sOrg: SfdmModels.SOrg,
        pollCallback: Function = null): Promise<void> {


        const makeDeleteAsync = (sObjectName: string, records: List<object>, sOrg: SfdmModels.SOrg) => new Promise(async (resolve, reject) => {

            if (records.Count() == 0) {
                resolve(0);
                return;
            }

            let cn = sOrg.getConnection();
            cn.bulk.pollTimeout = SfdmModels.CONSTANTS.POLL_TIMEOUT;

            if (records.Count() > sOrg.bulkThreshold) {

                records = records.Select(x => {
                    return {
                        Id: x["Id"]
                    }
                });

                let job = cn.bulk.createJob(sObjectName, "delete");
                let chunks = CommonUtils.chunkArray(records.ToArray(), SfdmModels.CONSTANTS.MAX_BATCH_SIZE);
                let totalProcessed = 0;

                for (let index = 0; index < chunks.length; index++) {
                    const chunk = chunks[index];
                    totalProcessed = await SfdxUtils._processBatch(cn, sOrg, pollCallback, job, chunk, totalProcessed, index == 0, index == chunks.length - 1,  false);
                }

                resolve(totalProcessed);

            } else {

                let ids = records.Select(x => x["Id"]).ToArray();

                if (ids.length == 0) { resolve(0); return; }

                cn.sobject(sObjectName).del(ids, {
                    allOrNone: sOrg.allOrNone,
                    allowRecursive: true
                },
                    function (error, result) {
                        if (error) {
                            reject(error);
                            return;
                        }

                        let res = {
                            jobId: "REST",
                            numberRecordsProcessed: 0,
                            numberRecordsFailed: 0,
                            error: "No"
                        };

                        records.ForEach((record, index) => {
                            if (result[index].success) {
                                res.numberRecordsProcessed++;
                            } else {
                                res.numberRecordsFailed++;
                                res.error = result[index].errors[0].message;
                            }
                        });
                        if (pollCallback) {
                            pollCallback(error, res);
                        }
                        resolve(result.length);
                    });

            }
        });

        await makeDeleteAsync(sObjectName, records, sOrg);

    }

    /**
     * Performs all kinds of update operations with records (Insert / Update / Merge / Upsert/ Add).
     */
    public static async processTaskRecordAsync(task: SfdmModels.Task,
        sourceRecords: List<object>,
        targetRecords: List<object>,
        targetSOrg: SfdmModels.SOrg,
        operation: SfdmModels.Enums.OPERATION,
        isChildTask: boolean,
        omitFields: Array<string> = new Array<string>(),
        readonlyExternalIdFields: Array<string> = new Array<string>(),
        jobMonitorCallback: Function = null): Promise<List<object>> {

        let sObjectName: string = task.sObjectName;
        let externalId: string = task.scriptObject.externalId;
        let scriptObject: SfdmModels.ScriptObject = task.scriptObject;

        if (!sourceRecords || sourceRecords.Count() == 0 || operation == SfdmModels.Enums.OPERATION.Readonly) {
            return sourceRecords;
        }

        var strOper = SfdmModels.Enums.OPERATION[operation];

        let fieldsSource = Object.keys(sourceRecords.ElementAt(0)).filter(field => field.endsWith("_source"));
        readonlyExternalIdFields = readonlyExternalIdFields || [];
        omitFields = new List<string>([...omitFields, ...(readonlyExternalIdFields.filter(x => x != "Id")), ...fieldsSource]).Distinct().ToArray();
        let omitFields2 = new List<string>(["Id", ...omitFields]).Distinct().ToArray();

        let _this = this;

        async function insertRecordsAsync(sourceRecords: List<object>) {


            //let extids = [];
            let recordsToInsert = CommonUtils.cloneListOmitProps(sourceRecords.Select(x => deepClone.deepCloneSync(x)), omitFields2);

            let ids = sourceRecords.Select(x => x["Id"]);
            let map = mockRecordsData(recordsToInsert, ids);
            let recs = await _this.insertAsync(sObjectName, new List<object>([...map.keys()]), targetSOrg, jobMonitorCallback);
            let insertedRecords = new List<object>();
            recs.ForEach((record, index) => {
                let oldRecord = map.get(record);
                oldRecord["Id"] = record["Id"];
                insertedRecords.Add(oldRecord);
            });

            if (readonlyExternalIdFields.length > 0 && isChildTask) {
                try {
                    let inQueryFieldList = new List<string>(["Id", ...readonlyExternalIdFields]).Distinct().ToArray();
                    let ids = insertedRecords.Select(x => x["Id"]).ToArray();
                    let recordsMap = new Map<string, object>();
                    if (inQueryFieldList.length == 1 && inQueryFieldList[0] == "Id") {
                        ids.forEach(id => recordsMap.set(id, { Id: id }));
                    } else {
                        let queries = _this.createIdInQueries(inQueryFieldList, "Id", sObjectName, ids);
                        recordsMap = await _this.queryMultipleAsync(queries, "Id", targetSOrg);
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
                } catch (ex) {
                    throw new SfdmModels.JobError(`Object ${sObjectName}: no records were inserted. Execution aborted.`);
                }
            }

            return insertedRecords;
        }

        function mockRecordsData(sourceRecords: List<object>, ids: List<String>): Map<object, object> {
            let m: Map<object, object> = new Map<object, object>();
            if (scriptObject.updateWithMockData) {
                let mockFields: Map<string, string> = new Map<string, string>();
                task.taskFields.ForEach(field => {
                    if (field.mockPattern) {
                        let fn = field.mockPattern;
                        if (SfdmModels.CONSTANTS.SPECIAL_MOCK_COMMANDS.filter(x => fn.startsWith(x + "(")).length > 0) {
                            fn = fn.replace(/\(/, `('${field.name}',`);
                        }
                        mockFields.set(field.name, fn);
                    }
                });
                CommonUtils.resetCasualCounter();
                sourceRecords.ForEach((record, index) => {
                    let obj2 = Object.assign({}, record);
                    [...mockFields.keys()].forEach(name => {
                        let casualFn = mockFields.get(name);
                        if (casualFn == "ids") {
                            obj2[name] = ids.ElementAt(index);
                        } else {
                            obj2[name] = eval(`casual.${casualFn}`);
                        }

                    });
                    m.set(obj2, record);
                });
            } else {
                sourceRecords.ForEach(record => {
                    m.set(record, record);
                });
            }
            return m;
        }

        if (operation == SfdmModels.Enums.OPERATION.Insert) {
            let insertedRecords = await insertRecordsAsync(sourceRecords);
            return insertedRecords;
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

        var recordsToUpdate: List<object> = new List<object>();
        var recordsToInsert: List<object> = new List<object>();

        let fieldSourceOfTarget = targetRecords.Count() == 0 ? new Array<string>() : Object.keys(targetRecords.ElementAt(0)).filter(field => field.endsWith("_source"));
        let sourceExtId = externalId;
        let targetExtId = fieldSourceOfTarget.length > 0 ? externalId + "_source" : externalId;

        var mappedRecords = this.compareRecords(sourceRecords, targetRecords, sourceExtId, targetExtId);
        var targetMappedRecords = new Map();

        let idsMap = new Map<object, String>();
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



        if (recordsToInsert.Count() > 0) {
            // INSERTING
            if (jobMonitorCallback) {
                jobMonitorCallback(
                    null,
                    {
                        message: `Ready to insert ${recordsToInsert.Count()} records.`
                    }
                );
            }
            recordsToInsert = await insertRecordsAsync(recordsToInsert);
        } else {
            if (jobMonitorCallback) {
                jobMonitorCallback(
                    null,
                    {
                        message: `Nothing to insert.`
                    }
                );
            }
        }




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
                records = CommonUtils.cloneListOmitProps(records.Select(x => deepClone.deepCloneSync(x)), notUpdateableFields.ToArray());
            }
            let recordToUpdate3 = new List<object>();
            records.ForEach(record => {
                let old = targetMappedRecords.get(record["Id"]);
                if (scriptObject.updateWithMockData || !CommonUtils.areEqual(record, old)) {
                    recordToUpdate3.Add(record);
                }
            });
            if (recordToUpdate3.Count() > 0) {
                if (jobMonitorCallback) {
                    jobMonitorCallback(
                        null,
                        {
                            message: `Ready to update  ${recordToUpdate3.Count()} records.`
                        }
                    );
                }
                let m = mockRecordsData(recordToUpdate3, ids);
                await this.updateAsync(sObjectName, new List<object>([...m.keys()]), targetSOrg, jobMonitorCallback);
            } else {
                if (jobMonitorCallback) {
                    jobMonitorCallback(
                        null,
                        {
                            message: `Nothing to update.`
                        }
                    );
                }
            }
        }

        recordsToInsert.AddRange(recordsToUpdate.ToArray());

        return recordsToInsert;

    }

    /**
     * Compare two sets of records by external id field to find differences on each row.
     */
    public static compareRecords(sourceRecords: List<object>, targetRecords: List<object>,
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


    public static groupRecords(records: Map<string, Array<object>>,
        groupByField: string = "Id",
        operator: LogicalOperator = "AND"): Array<object> {

        let map: Map<string, object> = new Map<string, object>();
        let tempMap: Map<string, object>;
        let allFields = [...records.keys()];

        if (operator == "AND") {
            // OR => exclude
            for (let index = 0; index < allFields.length; index++) {
                let field = allFields[index];
                let recrds = records.get(field)
                tempMap = new Map<string, object>();
                recrds.forEach(record => {
                    tempMap.set(record[groupByField], record);
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
            for (let index = 0; index < allFields.length; index++) {
                let field = allFields[index];
                let recrds = records.get(field)
                recrds.forEach(record => {
                    map.set(record[groupByField], record);
                });
            }
        }
        return [...map.values()];
    }

    /**
     * Adds additional rule to the existing where clause.
     * Ex.  source:  WHERE Account.Name = 'Account',   Source__c = ['Source1', 'Source2']
     *      return:  WHERE (Account.Name = 'Account') OR (Source__c IN ('Source1', 'Source2'))
     */
    public static composeWhereInClause(accumulatedWhere: WhereClause, fieldName: string, values: Array<string>,
        literalType: LiteralType = "STRING",
        logicalOperator: LogicalOperator = "OR"): WhereClause {

        let values2 = values.map(x => x.replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
        let c: Condition = { field: fieldName, operator: "IN", value: values2, literalType: literalType };
        if (!accumulatedWhere || !accumulatedWhere.left) {
            let ret: WhereClause = { left: c };
            ret.left.openParen = 1;
            ret.left.closeParen = 1;
            return ret;
        } else {
            accumulatedWhere.left.openParen = 0;
            let ret = { left: c, right: accumulatedWhere, operator: logicalOperator };
            ret.left.openParen = 1;
            return ret;
        }
    }

    /**
     * Creates WHERE Id IN ('....', '....')  clause
     */
    public static createIdInQueries(fieldsToQuery: Array<string>, fieldName: string = "Id", sObjectName: string, valuesIN: Array<string>): Array<string> {

        let maxInsInQuery = 178;
        let tempQuery = <Query>{
            fields: fieldsToQuery.map(field => getComposedField(field)),
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
     * Creates WHERE Field__c IN ('....', '....')  clause
     */
    public static createFieldInQueries(fieldsToQuery: Array<string>, fieldName: string = "Id", sObjectName: string, valuesIN: Array<string>): Array<string> {

        let maxQueryLength = 3900;
        let tempQuery = <Query>{
            fields: fieldsToQuery.map(field => getComposedField(field)),
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

    private static async _processBatch(
        cn: any,
        sOrg: SfdmModels.SOrg,
        pollCallback: Function,
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
                    clearTimeout(pollTimer);
                }
                reject(batchInfo);
                return;
            });

            batch.on("queue", function (batchInfo) {

                batch.poll(sOrg.pollingIntervalMs, SfdmModels.CONSTANTS.POLL_TIMEOUT);

                if (pollCallback) {
                    if (showStartMessage) {
                        pollCallback("", {
                            message: `Job# [${job.id}] started.`
                        });
                    }
                    pollCallback("", {
                        message: `Batch# [${batch.id}] started.`
                    });
                }

                pollTimer = setInterval(function () {
                    cn.bulk.job(job.id).batch(batch.id).check((err, results) => {
                        if (pollCallback) {
                            results.error = "No";
                            results.numberRecordsProcessed = +results.numberRecordsProcessed;
                            if (numberBatchRecordsProcessed != results.numberRecordsProcessed) {
                                numberBatchRecordsProcessed = results.numberRecordsProcessed;
                                results.numberRecordsProcessed = numberJobRecordsSucceeded + results.numberRecordsProcessed;
                                pollCallback(err, results);
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
                        }
                        numberJobRecordsSucceeded++;
                    } else {
                        numberBatchRecordsFailed++;
                    }
                });

                if (showStopMessage) {
                    pollCallback("", {
                        message: `Job# [${job.id}] finished with ${numberJobRecordsSucceeded} succeded records.`
                    });
                }


                if (numberBatchRecordsFailed > 0) {
                    if (sOrg.allOrNone) {
                        reject(`Job# [${job.id}] has incomplete batch ${batch.id} having ${numberBatchRecordsFailed} failed records. Execution was stopped.`);
                    } else if (pollCallback) {
                        pollCallback(undefined, {
                            message: `WARNING! Job# [${job.id}] has incomplete batch ${batch.id} having ${numberBatchRecordsFailed} failed records.`
                        });
                    }
                }

                resolve(numberJobRecordsSucceeded);

            });
        });

    }

}
