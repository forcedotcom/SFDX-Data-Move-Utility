/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as deepClone from 'deep.clone';
import * as SfdmModels from '../models';
import {
    composeQuery,
    getComposedField,
    Query,
    WhereClause
    } from 'soql-parser-js';
import { List } from 'linq.ts';
import { SfdxUtils } from '../sfdx';
import casual = require("casual");





/**
 * Class represents migration job
 *
 * @export
 * @class Job
 */
export class Job {

    constructor() {
        this.tasks = new List<Task>();
    }

    tasks: List<Task>;
}



/**
 * Class represents task as part of the migration job
 *
 * @export
 * @class Task
 */
export class Task {

    constructor(init?: Partial<Task>) {
        Object.assign(this, init);
        this.taskFields = new List<TaskField>();
        this.sourceRecordSet = new Map<SfdmModels.Enums.RECORDS_SET, List<object>>([
            [SfdmModels.Enums.RECORDS_SET.Main, new List<object>()],
            [SfdmModels.Enums.RECORDS_SET.ExtIdMap, new List<object>([{}])]
        ]);
        this.targetRecordSet = new Map<SfdmModels.Enums.RECORDS_SET, List<object>>([
            [SfdmModels.Enums.RECORDS_SET.Main, new List<object>()],
            [SfdmModels.Enums.RECORDS_SET.ExtIdMap, new List<object>([{}])]
        ]);
    }

    job: Job;
    scriptObject: SfdmModels.ScriptObject;
    taskFields: List<TaskField>;

    sourceRecordSet: Map<SfdmModels.Enums.RECORDS_SET, List<object>>;
    targetRecordSet: Map<SfdmModels.Enums.RECORDS_SET, List<object>>;

    sourceTotalRecorsCount: number = -1;
    targetTotalRecorsCount: number = -1;

    useQueryBulkApiForSourceRecords: boolean = false;
    useQueryBulkApiForTargetRecords: boolean = false;

    get sObjectName(): string {
        return this.scriptObject.name;
    }

    get externalIdTaskField(): TaskField {
        return this.taskFields.FirstOrDefault(x => x.name == this.scriptObject.externalId);
    }
   
    createOriginalTaskFields() {
        this.scriptObject.fields.forEach(field => {
            let mp = field.sObject.mockFields.filter(f => f.name == field.name)[0];
            let ef: TaskField = new TaskField({
                name: field.name,
                originalScriptField: field,
                task: this,
                mockPattern: mp ? mp.pattern : ""
            });
            this.taskFields.Add(ef);
        });
    }

    createReferencedTaskFields() {

        this.scriptObject.referencedFieldMap.forEach((value: [SfdmModels.ScriptField, SfdmModels.ScriptField], key: string) => {

            let job = this.job;

            let parentTask = job.tasks.FirstOrDefault(x => x.sObjectName == value[1].sObject.name);
            let childTask = this;

            let parentTaskField = parentTask.taskFields.FirstOrDefault(x => x.name == value[1].name);
            let childRTaskField = childTask.taskFields.FirstOrDefault(x => x.name == value[0].name);

            let indexOfParentTask = job.tasks.IndexOf(parentTask);
            let indexOfChildTask = job.tasks.IndexOf(childTask);

            let externalIdTaskField: TaskField = new TaskField({
                name: key,
                originalScriptField: value[0],
                parentTaskField: parentTaskField,
                isParentTaskBefore: indexOfParentTask < indexOfChildTask,
                task: childTask
            });

            childRTaskField.externalIdTaskField = externalIdTaskField;
            childTask.taskFields.Add(externalIdTaskField);

        });
    }

    createQuery(fields?: Array<string>, removeLimits: boolean = false, parsedQuery?: Query): string {

        parsedQuery = parsedQuery || this.scriptObject.parsedQuery;

        let tempQuery = deepClone.deepCloneSync(parsedQuery, {
            absolute: true,
        });

        if (!fields)
            tempQuery.fields = this.taskFields.Select(x => getComposedField(x.name)).ToArray();
        else
            tempQuery.fields = fields.map(x => getComposedField(x));

        if (removeLimits) {
            tempQuery.limit = undefined;
            tempQuery.offset = undefined;
            tempQuery.orderBy = undefined;
        }

        return composeQuery(tempQuery);
    }

    createDeleteQuery() {
        if (!this.scriptObject.parsedDeleteQuery) {
            return this.createQuery(["Id"], true);
        } else {
            return this.createQuery(["Id"], true, this.scriptObject.parsedDeleteQuery);
        }
    }

    createListOfLimitedQueries(isSource: boolean, isParentSObjectBefore: boolean = true): List<[string, string]> {

        let _this = this;

        let tempQuery = deepClone.deepCloneSync(this.scriptObject.parsedQuery, {
            absolute: true,
        });

        if (tempQuery.where && tempQuery.where.left) {
            tempQuery.where.left.openParen = 1;
            tempQuery.where.left.closeParen = 1;
            tempQuery.where.operator = "AND";
        }

        let tempWhere2: WhereClause = <WhereClause>{};
        let fieldName: string;
        let whereSizeCounter: number = 0;
        let whereMaxSize = 3900;

        tempQuery.fields = this.taskFields.Select(x => getComposedField(x.name)).ToArray();

        function* queryGen(): IterableIterator<[string, string]> {

            let skipLastQuery = false;
            let hasQueries = false;
            let values: Array<any> = new Array<any>();

            let fields = isParentSObjectBefore ? (isSource ? _this.taskFields.Where(x => x.isParentTaskBefore)
                : _this.taskFields.Where(x => x.name == _this.scriptObject.externalId))
                : _this.taskFields.Where(x => x.name == "Id");

            if (fields.Count() == 0) return;

            for (let i = 0, icount = fields.Count(); i < icount; i++) {

                skipLastQuery = false;

                let taskField = fields.ElementAt(i);


                fieldName = isParentSObjectBefore ? (isSource ? taskField.originalScriptField.name : taskField.name) : taskField.name;

                if (!taskField.parentTaskField || !taskField.parentTaskField.task.scriptObject.isSpecialObject) {

                    if (isParentSObjectBefore) {
                        if (isSource) {

                            if (taskField.parentTaskField.originalScriptField.sObject.allRecords) {
                                skipLastQuery = true;
                                continue;
                            }

                            values = taskField.parentTaskField.task.sourceRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main)
                                .Select(record => record["Id"]).ToArray();
                        } else {
                            values = _this.sourceRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main)
                                .Select(record => record[taskField.name]).ToArray();
                        }
                    } else {
                        values = new Array<any>();
                        _this.job.tasks.ForEach(t => {
                            let fs = t.taskFields.Where(x => x.originalScriptField.sFieldDescribe.referencedObjectType == _this.sObjectName
                                && x.isOriginalField);
                            if (fs.Count() > 0) {
                                let rs = isSource ? t.sourceRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main) : t.targetRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main);
                                rs.ForEach(r => {
                                    fs.ForEach(f => {
                                        let v = r[f.originalScriptField.name];
                                        if (v && values.indexOf(v) < 0)
                                            values.push(v);
                                    })
                                });
                            }
                        });
                    }

                    if (values.length == 0) {
                        hasQueries = true;
                        skipLastQuery = true;
                        continue;
                    }

                    let whereChunk: Array<any> = new Array<any>();
                    let flag = false;

                    for (let ichunk = 0, vlenght = values.length; ichunk < vlenght; ichunk++) {

                        if (whereSizeCounter < whereMaxSize) {
                            let length = (values[ichunk] || "").toString().length;
                            whereSizeCounter += length + 4;
                            whereChunk.push(values[ichunk]);
                            flag = true;
                            continue;
                        }

                        tempWhere2 = SfdxUtils.composeWhereInClause(tempWhere2, fieldName, whereChunk);

                        if (!tempQuery.where) {
                            tempQuery.where = tempWhere2;
                            let query = composeQuery(tempQuery);
                            yield [query, fieldName];
                            tempQuery.where = undefined;
                        }
                        else {
                            tempQuery.where.right = tempWhere2;
                            let query = composeQuery(tempQuery);
                            yield [query, fieldName];
                        }

                        tempWhere2 = <WhereClause>{};
                        whereSizeCounter = 0;
                        whereChunk = new Array<any>();
                        hasQueries = true;
                        skipLastQuery = true;
                        flag = false;
                        ichunk--;
                    }

                    if (flag) {
                        tempWhere2 = SfdxUtils.composeWhereInClause(tempWhere2, fieldName, whereChunk);
                        if (!tempQuery.where) {
                            tempQuery.where = tempWhere2;
                            let query = composeQuery(tempQuery);
                            yield [query, fieldName];
                            tempQuery.where = undefined;
                        }
                        else {
                            tempQuery.where.right = tempWhere2;
                            let query = composeQuery(tempQuery);
                            yield [query, fieldName];
                        }

                        tempWhere2 = <WhereClause>{};
                        whereSizeCounter = 0;
                        whereChunk = new Array<any>();
                        hasQueries = true;
                        skipLastQuery = true;
                        flag = false;
                    }

                }
            }

            if (!skipLastQuery || skipLastQuery && !hasQueries) {

                if (tempWhere2.left) {

                    if (!tempQuery.where)
                        tempQuery.where = tempWhere2;
                    else {
                        tempQuery.where.right = tempWhere2;
                    }
                }

                let query = composeQuery(tempQuery);

                yield [query, fieldName];

            }
        }
        return new List<[string, string]>([...queryGen()]);
    }
}



/**
 * Class represents field as part of the task
 *
 * @export
 * @class TaskField
 */
export class TaskField {

    constructor(init?: Partial<TaskField>) {
        Object.assign(this, init);
    }

    task: Task;
    name: string;
    originalScriptField: SfdmModels.ScriptField;
    externalIdTaskField: TaskField;
    parentTaskField: TaskField;
    isParentTaskBefore: boolean = false;
    mockPattern: string;



    /*------------------------------*/
    mockPatternCounterNumber: number;
    mockPatternCounterDate: Date;


    get isReference(): boolean {
        return this.originalScriptField.isReference;
    }

    get isOriginalField() {
        return this.name == this.originalScriptField.name;
    }

    generateNextMockValue() {
        if (this.mockPattern) {
            return casual[this.mockPattern];
        }
    }
}






