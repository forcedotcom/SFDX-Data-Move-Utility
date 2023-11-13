/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import 'reflect-metadata';
import 'es6-shim';

import { Type } from 'class-transformer';

import {
    MigrationJobTask,
    ScriptObject,
    ScriptOrg,
    SFieldDescribe,
} from '../';
import {
    ISfdmuRunCustomAddonProcessedData,
} from '../../../addons/modules/sfdmu-run/custom-addons/package';
import { Common } from '../../components/common_components/common';
import {
    DATA_MEDIA_TYPE,
    OPERATION,
} from '../../components/common_components/enumerations';
import { RESOURCES } from '../../components/common_components/logger';
import { CONSTANTS } from '../../components/common_components/statics';
import { ICsvChunk } from '../api_models';
import ScriptAddonManifestDefinition
    from '../script_models/scriptAddonManifestDefinition';
import {
    IMissingParentLookupRecordCsvRow,
    IOrgConnectionData,
} from './helper_interfaces';

type IProcessedData = ISfdmuRunCustomAddonProcessedData;

export class TaskData {

    constructor(task: MigrationJobTask) {
        this.task = task;
    }

    /**
     * The current Job Task object
     *
     * @type {MigrationJobTask}
     * @memberof TaskData
     */
    task: MigrationJobTask;

    /**
     * [Source Record] => [Target Record]
     *(The full map for all records between the Source record
        and the associated Target record, mapped by the defined ExternalId key)
        Note! This Map will contain ONLY the pairs between existing Source and Target records.
     *
     * @type {Map<any, any>}
     * @memberof TaskData
     */
    sourceToTargetRecordMap: Map<any, any> = new Map<any, any>();

    // ----------------------- //

    /**
     * Field Api Name => Field Description
     * (Only for fields to be updated)
     *
     * @readonly
     * @type {Map<string, SFieldDescribe>}
     * @memberof TaskData
     */
    get fieldsToUpdateMap(): Map<string, SFieldDescribe> {
        return this.task.scriptObject.fieldsToUpdateMap;
    }

    /**
     * Field Api Name => Field Description
     * (Fields for the query)
     *
     * @readonly
     * @type {Map<string, SFieldDescribe>}
     * @memberof TaskData
     */
    get fieldsInQueryMap(): Map<string, SFieldDescribe> {
        return this.task.scriptObject.fieldsInQueryMap;
    }

    /**
     * List of all Field Desciprtions to query
     *
     * @readonly
     * @type {SFieldDescribe[]}
     * @memberof TaskData
     */
    get sFieldsInQuery(): SFieldDescribe[] {
        return [...this.fieldsInQueryMap.values()];
    }

    /**
     *  List of all Field Api Names to update.
     *
     * @readonly
     * @type {string[]}
     * @memberof TaskData
     */
    get fieldsToUpdate(): string[] {
        return this.task.scriptObject.fieldsToUpdate;
    }

    /**
     * List of all Field Descriptions to update.
     *
     * @readonly
     * @type {SFieldDescribe[]}
     * @memberof TaskData
     */
    get sFieldsToUpdate(): SFieldDescribe[] {
        return [...this.fieldsToUpdateMap.values()];
    }

    /**
     *  List of all Field Api Names to qury.
     *
     * @readonly
     * @type {string[]}
     * @memberof TaskData
     */
    get fieldsInQuery(): string[] {
        return this.task.scriptObject.fieldsInQuery;
    }

    /**
     * Returns the full path to the original source filename (Account.csv)
     *
     * @readonly
     * @type {string}
     * @memberof TaskData
     */
    get csvFilename(): string {
        return this.task.getCSVFilename(this.task.script.rawSourceDirectory);
    }

    /**
     * Returns the full path to the source filename (Account_source.csv)
     *
     * @readonly
     * @type {string}
     * @memberof TaskData
     */
    get sourceCsvFilename(): string {
        return this.task.getCSVFilename(this.task.script.sourceDirectory, CONSTANTS.CSV_SOURCE_FILE_SUFFIX);
    }

    /**
     * Returns the full path to the target filename (Case_insert_target.csv)
     *
     *
     * @param {OPERATION} operation The operation (_insert)
     * @param {string} [fileNameSuffix] The filename suffix (_person)
     * @returns {string}
     * @memberof TaskData
     */
    getTargetCSVFilename(operation: OPERATION, fileNameSuffix?: string): string {
        return TaskData.getTargetCSVFilename(this.task.script.targetDirectory, this.task.sObjectName, operation, fileNameSuffix);
    }

    /**
     * The 'csv file' resource text
     *
     * @readonly
     * @type {string}
     * @memberof TaskData
     */
    get resourceString_csvFile(): string {
        return this.task.logger.getResourceString(RESOURCES.csvFile);
    }

    /**
     * The 'Org' resource text
     *
     * @readonly
     * @type {string}
     * @memberof TaskData
     */
    get resourceString_org(): string {
        return this.task.logger.getResourceString(RESOURCES.org);
    }

    /**
     * The 'step' resource text
     *
     * @param {("forwards" | "backwards" | "target")} mode
     * @returns {string}
     * @memberof TaskData
     */
    getResourceString_Step(mode: "forwards" | "backwards" | "target"): string {
        return mode == "forwards" ? this.task.logger.getResourceString(RESOURCES.step1)
            : this.task.logger.getResourceString(RESOURCES.step2);
    }

    /**
     * The all previous tasks by the job execution order
     *
     * @readonly
     * @type {MigrationJobTask[]}
     * @memberof TaskData
     */
    get prevTasks(): MigrationJobTask[] {
        return this.task.job.tasks.filter(task => this.task.job.tasks.indexOf(task) < this.task.job.tasks.indexOf(this.task));
    }

    /**
     * The all next tasks by the job execution order
     *
     * @readonly
     * @type {MigrationJobTask[]}
     * @memberof TaskData
     */
    get nextTasks(): MigrationJobTask[] {
        return this.task.job.tasks.filter(task => this.task.job.tasks.indexOf(task) > this.task.job.tasks.indexOf(this.task));
    }

    /**
     * If person accounts enabled for this org
     *
     * @readonly
     * @type {boolean}
     * @memberof TaskData
     */
    get isPersonAccountEnabled(): boolean {
        return this.task.script.isPersonAccountEnabled;
    }

    /**
     * If Person contacts or Person accoun are currently processing byt this task
     *
     * @readonly
     * @type {boolean}
     * @memberof TaskData
     */
    get isPersonAccountOrContact(): boolean {
        return this.task.script.isPersonAccountEnabled
            && (this.task.sObjectName == "Account" || this.task.sObjectName == "Contact");
    }

    /**
     *  For some objects returns fields which should be used to compare records
     * do find which records are changed and should be updated.
     * CONSTANTS.FIELDS_TO_COMPARE_SOURCE_WITH_TARGET_RECORDS
     *
     * @readonly
     * @type {Array<string>}
     * @memberof TaskData
     */
    get fieldsToCompareSourceWithTarget(): Array<string> {
        return CONSTANTS.FIELDS_TO_COMPARE_SOURCE_WITH_TARGET_RECORDS.get(this.task.sObjectName) || new Array<string>();
    }

    /**
     * For some objects returns fields which should be excluded from the target query.
     * CONSTANTS.FIELDS_EXCLUDED_FROM_TARGET_QUERY
     *
     * @readonly
     * @type {Array<string>}
     * @memberof TaskData
     */
    get fieldsExcludedFromTargetQuery(): Array<string> {
        return CONSTANTS.FIELDS_EXCLUDED_FROM_TARGET_QUERY.get(this.task.sObjectName) || new Array<string>();
    }

    /**
    * Returns path to the "target" CSV file
    *
    * @static
    * @param {string} rootPath
    * @param {string} sObjectName
    * @param {OPERATION} operation
    * @param {string} [fileNameSuffix]
    * @returns {string}
    * @memberof TaskData
    */
    public static getTargetCSVFilename(rootPath: string, sObjectName: string, operation: OPERATION, fileNameSuffix?: string): string {
        return Common.getCSVFilename(rootPath, sObjectName,
            `_${ScriptObject.getStrOperation(operation).toLowerCase()}${fileNameSuffix || ""}${CONSTANTS.CSV_TARGET_FILE_SUFFIX}`);
    }


}

export class TaskOrgData {

    constructor(task: MigrationJobTask, isSource: boolean) {
        this.task = task;
        this.isSource = isSource;
    }

    task: MigrationJobTask;

    /**
     * true if it is source task data
     *
     * @type {boolean}
     * @memberof TaskOrgData
     */
    isSource: boolean;

    /**
     * Complex ExternalId value => Id
     * (Account.Name => Account.Id)
     *
     * @type {Map<string, string>}
     * @memberof TaskOrgData
     */
    extIdRecordsMap: Map<string, string> = new Map<string, string>();

    /**
     * Id => [Record]
     * (Account.Id => [Account Record])
     *
     * @type {Map<string, any>}
     * @memberof TaskOrgData
     */
    idRecordsMap: Map<string, any> = new Map<string, any>();


    // ----------------------- //


    get org(): ScriptOrg {
        return this.isSource ? this.task.script.sourceOrg : this.task.script.targetOrg;
    }

    /**
     * True if need to use the Bulk API for this task to perform DML.
     * Otherwise false to use REST API
     *
     * @readonly
     * @type {boolean}
     * @memberof TaskOrgData
     */
    get useBulkQueryApi(): boolean {
        const bulkThreshold = this.task.script.queryBulkApiThreshold || CONSTANTS.QUERY_BULK_API_THRESHOLD;
        return this.isSource ? this.task.sourceTotalRecorsCount >= bulkThreshold :
            this.task.targetTotalRecorsCount >= bulkThreshold;
            
    }

    /**
     * Field Api name => Field Describe
     * (The full map of all fields for the current SObject related to the Task)
     *
     * @readonly
     * @type {Map<string, SFieldDescribe>}
     * @memberof TaskOrgData
     */
    get fieldsMap(): Map<string, SFieldDescribe> {
        return this.isSource ? this.task.scriptObject.sourceSObjectDescribe.fieldsMap :
            this.task.scriptObject.targetSObjectDescribe.fieldsMap;
    }

    /**
     * The resource text of the resource for Source/Target according to the task data type.
     * Used for the quick access.
     *
     * @readonly
     * @type {string}
     * @memberof TaskOrgData
     */
    get resourceString_Source_Target(): string {
        return this.isSource ? this.task.logger.getResourceString(RESOURCES.source) :
            this.task.logger.getResourceString(RESOURCES.target);
    }

    /**
     * True if need to process all records.
     * False to process filtered queries.
     *
     * @readonly
     * @type {boolean}
     * @memberof TaskOrgData
     */
    get allRecords(): boolean {
        return this.isSource ? this.task.scriptObject.processAllSource : this.task.scriptObject.processAllTarget;
    }

    /**
     * The type of ORG MEDIA (ORG / CSV File)
     *
     * @readonly
     * @type {DATA_MEDIA_TYPE}
     * @memberof TaskOrgData
     */
    get media(): DATA_MEDIA_TYPE {
        return this.org.media;
    }

    /**
     * Full array of current version of all records, retrieved for the sObject
     * associated with this Task
     *
     * @readonly
     * @type {Array<any>}
     * @memberof TaskOrgData
     */
    get records(): Array<any> {
        return [...this.idRecordsMap.values()];
    }
}

export class ProcessedData implements IProcessedData {

    processPersonAccounts: boolean = false;

    clonedToSourceMap: Map<any, any> = new Map<any, any>();

    fields: Array<SFieldDescribe>;

    recordsToUpdate: Array<any> = new Array<any>();
    recordsToInsert: Array<any> = new Array<any>();

    missingParentLookups: IMissingParentLookupRecordCsvRow[] = new Array<IMissingParentLookupRecordCsvRow>();

    insertedRecordsSourceToTargetMap: Map<any, any> = new Map<any, any>();

    get lookupIdFields(): Array<SFieldDescribe> {
        return this.fields.filter(field => field.isSimpleReference);
    }

    get fieldNames(): Array<string> {
        return this.fields.map(field => field.nameId);
    }

    get nonProcessedRecordsAmount(): number {
        return [...this.clonedToSourceMap.values()].filter(record => record[CONSTANTS.__IS_PROCESSED_FIELD_NAME] == false).length;
    }

}

export class CachedCSVContent {

    constructor() {
        this.clear();
    }

    csvDataCacheMap: Map<string, Map<string, any>>;
    updatedFilenames: Set<string>;
    idCounter: number;


    /**
     * Generates next Id string in format I[DXXXXXXXXXXXXXXXX]
     * where XXXX... - is the next autonumber
     *
     * @readonly
     * @type {string}
     * @memberof CachedCSVContent
     */
    get nextId(): string {
        return "ID" + Common.addLeadnigZeros(this.idCounter++, 16);
    }


    /**
     * Clear all data
     *
     * @memberof CachedCSVContent
     */
    clear() {
        this.csvDataCacheMap = new Map<string, Map<string, any>>();
        this.updatedFilenames = new Set<string>();
        this.idCounter = 1;
    }
}

export class CsvChunks {

    constructor(init?: Partial<CsvChunks>) {
        Object.assign(this, init);
    }

    chunks: Array<ICsvChunk> = [];
    header: Array<string> = new Array<string>();

    fromArrayChunks(arrayChunks: Array<Array<any>>): CsvChunks {
        if (arrayChunks.length == 0) return;
        this.chunks = [].concat(arrayChunks.map(records => <ICsvChunk>{
            csvString: "",
            records
        }));
        this.header = Object.keys(arrayChunks[0][0]);
        return this;
    }

    fromArray(array: Array<any>): CsvChunks {
        return this.fromArrayChunks([array]);
    }
}

export class ObjectFieldMapping {

    constructor(sourceSObjectName: string, targetSObjectName: string) {
        this.sourceSObjectName = sourceSObjectName;
        this.targetSObjectName = targetSObjectName;
    }

    targetSObjectName: string;
    sourceSObjectName: string;
    fieldMapping: Map<string, string> = new Map<string, string>();

    get hasChange(): boolean {
        return this.sourceSObjectName != this.targetSObjectName || this.fieldMapping.size > 0;
    }

}

export class AddonManifest {

    constructor(init?: Partial<AddonManifest>) {
        if (init) {
            Object.assign(this, init);
        }
    }

    @Type(() => ScriptAddonManifestDefinition)
    addons: ScriptAddonManifestDefinition[] = new Array<ScriptAddonManifestDefinition>();
}


export class OrgConnectionData implements IOrgConnectionData {
    instanceUrl: string;
    accessToken: string;
    apiVersion: string;
    proxyUrl: string
    isFile: boolean;
}







