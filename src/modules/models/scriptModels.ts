/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as SfdmModels from "../models";
import "reflect-metadata";
import "es6-shim";
import { Type } from "class-transformer";
import { Query } from 'soql-parser-js';
import { List } from 'linq.ts';
import { CommonUtils } from "../common";

/**
 * Script loaded from the export.json file
 */
export class Script {

    constructor() {
        this.objectsMap = new Map<string, ScriptObject>();
        this.orgs = new Array<ScriptOrg>();
    }

    /**
     * Username of the source org
     */
    sourceOrg: string;

    /**
    * Username of the target org
    */
    targetOrg: string;


    @Type(() => ScriptOrg)
    orgs: ScriptOrg[];


    /**
    * Poll for the batch status by this interval
    */
    pollingIntervalMs: number = 5000;

    /**
     * The threshold in records amount to switch betwenn Collection API and  Bulk API
     */
    bulkThreshold: number = 200;


    /**
     * true if you want to break execution on any error while data updating,
     * false if you want to continue execution or prompt the user what to do 
     * depend on the promptOnUpdateError parameter.
     */
    allOrNone: boolean = false;


    /**
     * true if you want to prompt user on any update error before breaking the execution,
     * false if you want to break execution immediately on any update error.
     */
    promptOnUpdateError: boolean = true;

    /**
     * If some parent records lookup/master-detail records are missing and it's true 
     * user alerted and prompted to stop or to continue the job execution.
     */
    promptOnMissingParentObjects: boolean = true;


    /**
     * When using file as source or target => turns onn/off
     * encryption of data before I/O to the file
     * using the provided password
     */
    encryptDataFiles: boolean = false;

    /**
     * Can use different api version
     */
    apiVersion: string = "46.0";


    /**
     * Array of objects included into the script
     */
    @Type(() => ScriptObject)
    objects: ScriptObject[];


    // ************************************************
    objectsMap: Map<string, ScriptObject>;

    sourceMedia: SfdmModels.Enums.DATA_MEDIA_TYPE = SfdmModels.Enums.DATA_MEDIA_TYPE.Org;

    targetMedia: SfdmModels.Enums.DATA_MEDIA_TYPE = SfdmModels.Enums.DATA_MEDIA_TYPE.Org;


    get sourceKey() {
        return this.sourceOrg + "-" + this.sourceMedia;
    }

    get targetKey() {
        return this.targetOrg + "-" + this.targetMedia;
    }

}

/**
 * Org object defined in the script
 */
export class ScriptOrg {
    constructor(init?: Partial<ScriptOrg>) {
        Object.assign(this, init);
    }
    name: string;
    instanceUrl: string;
    accessToken: string;
}

/**
 * Script object defined in the script
 */
export class ScriptObject {

    constructor(init?: Partial<ScriptObject>) {
        Object.assign(this, init);
        this.fields = new Array<ScriptField>();
        this.mockFields = new Array<ScriptMockField>();
        this.fieldsMap = new Map<string, ScriptField>();
        this.referencedScriptObjectsMap = new Map<string, ScriptObject>();
        this.referencedFieldMap = new Map<string, [ScriptField, ScriptField]>();
    }

    /**
     * Query for this object. Can include WHERE, LIMIT, OFFSET, ORDER and others.
     */
    query: string;


    /**
     * Optional query string for the target delete operation.
     * If undefined => query is used
     */
    deleteQuery: string;

    /**
     * Fields incuded in this script object
     */
    @Type(() => ScriptField)
    fields: ScriptField[];

    /**
     * Fields that need to fill with mock data
     */
    @Type(() => ScriptMockField)
    mockFields: ScriptMockField[];

    /**
     * The operation used for this object
     */
    operation: SfdmModels.Enums.OPERATION = SfdmModels.Enums.OPERATION.Readonly;

    /**
     * ex. Name or MyExternalId__c.
     * Field used to bind related object or to compare source & target rows
     */
    externalId: string = "Name";


    /**
     *  Clear all records by specified query for this SObject before performing update
     */
    deleteOldData: boolean = false;


    /**
     * Turn on/off inserting/updating record fields using mock pattern instead of real source data
     */
    updateWithMockData: boolean = false;





    // ************************************************
    /**
     *  Defines to copy all records of this object 
     *  or limit the child records to those of the parent records, 
     *  that have already queried before.
     *  ex. parent object:  SELECT Id FROM Account LIMIT 1
     *      child  object:  SELECT Id, Account__c FROM Child__c WHERE Account__c IN ( [--Records result of the query above--])
     * ------
     */
    allRecords: boolean = false;


    allRecordsTarget: boolean = false;


    /**
     * true for all extra objects that are not exist in the original script
     */
    isExtraObject: boolean = false;

    /**
     * The api name of SObject
     */
    name: string;

    /**
     *  Map of {SField name => SField describe}, for all fields in the script object
     */
    fieldsMap: Map<string, ScriptField>;

    parsedQuery: Query;

    parsedDeleteQuery: Query;

    readonlyExternalIdFields: Array<string> = Array<string>();

    /**
     * SObject descibtion for the source org
     */
    sObjectDescribe: SfdmModels.SObjectDescribe;

    /**
     * SObject descibtion for target org
     */
    sObjectDescribeTarget: SfdmModels.SObjectDescribe;


    /**
     *  ex. parent object:  SELECT Id FROM Account LIMIT 1
     *      child  object:  SELECT Id, Account__c FROM Child__c 
     *      external Id = Account.Name
     *  
     *   => referencedFieldMap = { 'Account__r.Name' => [ 'Account__c' of Child__c, 'Name' of Account ] }
     *   
     */
    referencedFieldMap: Map<string, [ScriptField, ScriptField]>;


    /**
     *  ex. parent object:  SELECT Id FROM Account LIMIT 1
     *      child  object:  SELECT Id, Account__c FROM Child__c 
     *      external Id = Account.Name
     * 
     *  =>  { Account__c => [ Account ] }
     */
    referencedScriptObjectsMap: Map<string, ScriptObject>;


    // ************************************************
    /**
     * All names of the parent SObjects for this child SObject
     * 
     * ex. [Account, MyObject__c, ...]
     */
    getReferencedSObjectTypes(): List<string> {
        return new List<ScriptField>(this.fields)
            .Select(x => x.isReference ? x.referencedSObjectType : null)
            .Where(x => x != null);
    }

    /**
     * String name of the operaiton enum value
     */
    get strOperation(): string {
        return SfdmModels.Enums.OPERATION[this.operation];
    }

    get isLimitedQuery(): boolean {
        return this.parsedQuery
            && (this.parsedQuery.limit > 0 || !!this.parsedQuery.where);
    }

    get isSpecialObject() {
        return [
            "Group",
            "User",
            "RecordType",
            "Profile"
        ].indexOf(this.name) >= 0;
    }

    get isComplexExternalId(): boolean {
        return this.externalId.indexOf('.') >= 0
            || this.externalId.indexOf(SfdmModels.CONSTANTS.COMPLEX_FIELDS_SEPARATOR) >= 0
            || this.externalId.startsWith(SfdmModels.CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX);
    }

    get complexExternalIds(): Array<string> {
        return this.externalId.split(SfdmModels.CONSTANTS.COMPLEX_FIELDS_SEPARATOR);
    }

    get complexExternalIdKey() {
        let tmpl = new RegExp(`${SfdmModels.CONSTANTS.COMPLEX_FIELDS_SEPARATOR}`, 'g');
        return SfdmModels.CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX
            + this.externalId.replace(tmpl, SfdmModels.CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR);
    }


}


export class ScriptMockField {
    name: string;
    pattern: string;
}

export class ScriptField {

    constructor(init?: Partial<ScriptField>) {
        Object.assign(this, init);
    }

    name: string;
    sObject: ScriptObject;


    // ************************************************
    sFieldDescribe: SfdmModels.SFieldDescribe;
    sFieldDescribeTarget: SfdmModels.SFieldDescribe;
    externalId: string;



    // ************************************************
    /**
     * The api name of the parent SObject for lookups or null
     */
    get referencedSObjectType(): string {
        if (this.isReference) {
            return this.sFieldDescribe.referencedObjectType;
        } else {
            return null;
        }
    }

    /**
    * Reference api name of the parent SObject for lookups 
    *
    * ex. Account__r or User 
     */
    get referencedSObjectName(): string {
        if (this.sFieldDescribe.custom) {
            return this.name.replace("__c", "__r");
        } else {
            return CommonUtils.trimEndStr(this.name, "Id");
        }
    }

    /**
    * Full referenced field name to the parent record for the current field 
    * based on the current object's ExternalId field
    *  
    * ex. Account__r.Name
     */
    get referencedFullFieldName(): string {
        return this.referencedSObjectName + "." + this.externalId;
    }



    /**
     * If this field is child reference to any parent SObject
     */
    get isReference(): boolean {
        return this.sFieldDescribe.isReference;
    }

    get isComplexField(): boolean {
        return this.name.startsWith("_");
    }

}
