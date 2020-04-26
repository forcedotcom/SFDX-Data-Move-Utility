/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as SfdmModels from "../models/index";
import { List } from 'linq.ts';
import * as path from 'path';
import * as fs from 'fs';
import "reflect-metadata";
import "es6-shim";
import { plainToClass } from "class-transformer";
import {
    parseQuery,
    composeQuery,
    FieldType,
    OrderByClause,
    Field as SOQLField,
    getComposedField
} from 'soql-parser-js';
import { SfdxUtils, ApiCalloutStatus } from "../sfdx";
import { CommonUtils } from "../common";
import SimpleCrypto from "simple-crypto-js";
import { ScriptField, CONSTANTS } from "../models/index";
import { MessageUtils, COMMON_RESOURCES, LOG_MESSAGE_VERBOSITY } from "../messages";

/**
 * Leys form the command resource file
 *
 * @enum {number}
 */
export enum RUN_RESOURCES {
    "pluginVersion" = "pluginVersion",
    "newLine" = "newLine",
    "workingPathDoesNotExist" = "workingPathDoesNotExist",
    "packageFileDoesNotExist" = "packageFileDoesNotExist",
    "loadingPackageFile" = "loadingPackageFile",
    "objectWillBeExcluded" = "objectWillBeExcluded",
    "noObjectsDefinedInPackageFile" = "noObjectsDefinedInPackageFile",
    "sourceOrg" = "sourceOrg",
    "targetOrg" = "targetOrg",
    "scriptFile" = "scriptFile",
    "encryptionKey" = "encryptionKey",
    "invalidEncryptionKey" = "invalidEncryptionKey",
    "tryingToConnectCLI" = "tryingToConnectCLI",
    "successfullyConnected" = "successfullyConnected",
    "tryingToConnectCLIFailed" = "tryingToConnectCLIFailed",
    "sourceTargetCouldNotBeTheSame" = "sourceTargetCouldNotBeTheSame",
    "accessToSourceExpired" = "accessToSourceExpired",
    "accessToTargetExpired" = "accessToTargetExpired",
    "MalformedQuery" = "MalformedQuery",
    "MalformedDeleteQuery" = "MalformedDeleteQuery",
    "executingPackageScript" = "executingPackageScript",
    "preparing" = "preparing",
    "gettingOrgMetadata" = "gettingOrgMetadata",
    "noExternalKey" = "noExternalKey",
    "objectSourceDoesNotExist" = "objectSourceDoesNotExist",
    "objectTargetDoesNotExist" = "objectTargetDoesNotExist",
    "analysingOrgMetadata" = "analysingOrgMetadata",
    "processingSObject" = "processingSObject",
    "fieldSourceDoesNtoExist" = "fieldSourceDoesNtoExist",
    "fieldTargetDoesNtoExist" = "fieldTargetDoesNtoExist",
    "referencedFieldDoesNotExist" = "referencedFieldDoesNotExist",
    "dataMigrationProcessStarted" = "dataMigrationProcessStarted",
    "buildingMigrationStaregy" = "buildingMigrationStaregy",
    "executionOrder" = "executionOrder",
    "readingValuesMappingFile" = "readingValuesMappingFile",
    "validatingAndFixingSourceCSVFiles" = "validatingAndFixingSourceCSVFiles",
    "writingToCSV" = "writingToCSV",
    "noIssuesFoundDuringCSVValidation" = "noIssuesFoundDuringCSVValidation",
    "issuesFoundDuringCSVValidation" = "issuesFoundDuringCSVValidation",
    "continueTheJobPrompt" = "continueTheJobPrompt",
    "AbortedByTheUser" = "AbortedByTheUser",
    "csvFileIsEmpty" = "csvFileIsEmpty",
    "columnsMissingInCSV" = "columnsMissingInCSV",
    "csvFileForParentSObjectIsEmpty" = "csvFileForParentSObjectIsEmpty",
    "missingParentRecordForGivenLookupValue" = "missingParentRecordForGivenLookupValue",
    "invalidColumnFormat" = "invalidColumnFormat",
    "columnWillNotBeProcessed" = "columnWillNotBeProcessed",
    "csvFilesWereUpdated" = "csvFilesWereUpdated",
    "validationAndFixingsourceCSVFilesCompleted" = "validationAndFixingsourceCSVFilesCompleted",
    "deletingOldData" = "deletingOldData",
    "deletingTargetSObject" = "deletingTargetSObject",
    "queryingTargetSObject" = "queryingTargetSObject",
    "queryingTargetSObjectCompleted" = "queryingTargetSObjectCompleted",
    "deletingFromTheTargetNRecordsWillBeDeleted" = "deletingFromTheTargetNRecordsWillBeDeleted",
    "queryError" = "queryError",
    "deletingFromTheTargetCompleted" = "deletingFromTheTargetCompleted",
    "deletingOldDataCompleted" = "deletingOldDataCompleted",
    "deletingOldDataSkipped" = "deletingOldDataSkipped",
    "retrievingData" = "retrievingData",
    "mappingRawCsvValues" = "mappingRawCsvValues",
    "gettingRecordsCount" = "gettingRecordsCount",
    "totalRecordsAmount" = "totalRecordsAmount",
    "queryingAll" = "queryingAll",
    "queryingAllQueryString" = "queryingAllQueryString",
    "queryingIn" = "queryingIn",
    "queryingFinished" = "queryingFinished",
    "executingQuery" = "executingQuery",
    "retrievingDataCompleted" = "retrievingDataCompleted",
    "Step1" = "Step1",
    "Step2" = "Step2",
    "updatingTarget" = "updatingTarget",
    "writingToFile" = "writingToFile",
    "writingToFileCompleted" = "writingToFileCompleted",
    "updatingTargetObject" = "updatingTargetObject",
    "updatingTargetObjectCompleted" = "updatingTargetObjectCompleted",
    "fieldIsMissingInTheSourceRecords" = "fieldIsMissingInTheSourceRecords",
    "seeFileForTheDetails" = "seeFileForTheDetails",
    "missingParentLookupRecord" = "missingParentLookupRecord",
    "updatingTargetCompleted" = "updatingTargetCompleted",
    "finalizing" = "finalizing"
}

/**
 * Class to execute SFDMU:RUN CLI command
 *
 * @export
 * @class RunCommand
 */
export class RunCommand {



    logger: MessageUtils;
    basePath: string;
    password: string;

    script: SfdmModels.Script;
    orgs: Map<string, SfdmModels.SOrg> = new Map<string, SfdmModels.SOrg>();
    job: SfdmModels.Job = new SfdmModels.Job();

    constructor(logger: MessageUtils) {
        this.logger = logger;
    }

    get sourceOrg(): SfdmModels.SOrg {
        return this.orgs.get(this.script.sourceKey);
    }

    get targetOrg(): SfdmModels.SOrg {
        return this.orgs.get(this.script.targetKey);
    }





    /**
     * Function to initialize the Command
     *
     * @param {string} baseDir
     * @param {string} targetUsername
     * @param {string} sourceUsername
     * @param {string} password
     * @param {string} apiVersion
     * @memberof RunCommand
     */
    async initCommand(baseDir: string,
        targetUsername: string,
        sourceUsername: string,
        password: string,
        apiVersion: string) {


        this.password = password;
        this.basePath = path.isAbsolute(baseDir) ? baseDir : path.join(process.cwd(), baseDir.toString());
        this.basePath = this.basePath.replace(/([^"]+)(.*)/, "$1");

        if (!fs.existsSync(this.basePath)) {
            throw new SfdmModels.CommandInitializationError(this.logger.getResourceString(RUN_RESOURCES.workingPathDoesNotExist));
        }

        // Read export.json script        
        let filePath = path.join(this.basePath, 'export.json');

        if (!fs.existsSync(filePath)) {
            throw new SfdmModels.CommandInitializationError(this.logger.getResourceString(RUN_RESOURCES.packageFileDoesNotExist));
        }

        this.logger.infoMinimal(RUN_RESOURCES.newLine);
        this.logger.headerMinimal(RUN_RESOURCES.loadingPackageFile);

        let json = fs.readFileSync(filePath, 'utf8');
        let jsonObject = JSON.parse(json);
        this.script = plainToClass(SfdmModels.Script, jsonObject);
        if (apiVersion) {
            this.script.apiVersion = apiVersion;
        }

        // Filter out disabled objects
        this.script.objects = this.script.objects.filter(object => {
            let ret = !object.excluded || object.operation == SfdmModels.Enums.OPERATION.Readonly;
            if (!ret) {
                this.logger.infoVerbose(RUN_RESOURCES.objectWillBeExcluded, object.name);
            }
            return ret;
        });

        if (this.script.objects.length == 0) {
            throw new SfdmModels.CommandInitializationError(this.logger.getResourceString(RUN_RESOURCES.noObjectsDefinedInPackageFile));
        }

        this.script.targetOrg = targetUsername;
        this.script.sourceOrg = sourceUsername;

        if (!password) {
            this.logger.objectMinimal({
                "Source": this.logger.getResourceString(RUN_RESOURCES.sourceOrg, this.script.sourceOrg),
                "Target": this.logger.getResourceString(RUN_RESOURCES.targetOrg, this.script.targetOrg),
                "Package script": this.logger.getResourceString(RUN_RESOURCES.scriptFile, filePath)
            });
        } else {
            this.logger.objectMinimal({
                "Source": this.logger.getResourceString(RUN_RESOURCES.sourceOrg, this.script.sourceOrg),
                "Target": this.logger.getResourceString(RUN_RESOURCES.targetOrg, this.script.targetOrg),
                "Package script": this.logger.getResourceString(RUN_RESOURCES.scriptFile, filePath),
                "Encryption key": this.logger.getResourceString(RUN_RESOURCES.encryptionKey, password)
            });
        }

        // Encryption
        let invalidPassword = false;
        if (password) {
            var simpleCrypto = new SimpleCrypto(password);
            this.script.orgs.forEach(org => {
                let name = simpleCrypto.decrypt(org.name).toString();
                if (name) {
                    org.name = name;
                    org.instanceUrl = simpleCrypto.decrypt(org.instanceUrl).toString();
                    org.accessToken = simpleCrypto.decrypt(org.accessToken).toString();
                } else {
                    invalidPassword = true;
                }
            });
        }
        if (invalidPassword) {
            this.logger.warn(RUN_RESOURCES.invalidEncryptionKey);
        }

        if (sourceUsername.toLowerCase() == "csvfile") {
            this.script.sourceOrg = this.script.targetOrg;
            this.script.sourceMedia = SfdmModels.Enums.DATA_MEDIA_TYPE.File;
        }

        // Detect media types
        if (targetUsername.toLowerCase() == "csvfile") {
            this.script.targetOrg = this.script.sourceOrg;
            this.script.targetMedia = SfdmModels.Enums.DATA_MEDIA_TYPE.File;
        }




        // Create connections to the orgs
        let sourceScriptOrg = new List<SfdmModels.ScriptOrg>(this.script.orgs).FirstOrDefault(x => x.name == this.script.sourceOrg);

        if (this.script.sourceMedia == SfdmModels.Enums.DATA_MEDIA_TYPE.Org) {
            if (!sourceScriptOrg || !sourceScriptOrg.accessToken) {
                try {
                    // Connection is not found in the package. Try to retrieve credentials from the SFDX.
                    this.logger.infoNormal(RUN_RESOURCES.tryingToConnectCLI, sourceUsername);
                    let s = SfdxUtils.execSfdx("force:org:display", sourceUsername);
                    let p = SfdxUtils.parseForceOrgDisplayResult(s);
                    if (!p.isConnected) {
                        throw new Error();
                    }
                    this.logger.infoNormal(RUN_RESOURCES.successfullyConnected, p.Username);
                    this.orgs.set(this.script.sourceKey, new SfdmModels.SOrg(p.Username, p.AccessToken, p.InstanceUrl, this.basePath, this.script.sourceMedia, true));
                } catch (e) {
                    throw new SfdmModels.CommandInitializationError(this.logger.getResourceString(RUN_RESOURCES.tryingToConnectCLIFailed, sourceUsername));
                }
            } else {
                this.orgs.set(this.script.sourceKey, new SfdmModels.SOrg(sourceScriptOrg.name, sourceScriptOrg.accessToken, sourceScriptOrg.instanceUrl, this.basePath, this.script.sourceMedia, true));
            }
        }

        let targetScriptOrg = new List<SfdmModels.ScriptOrg>(this.script.orgs).FirstOrDefault(x => x.name == this.script.targetOrg);

        if (this.script.targetMedia == SfdmModels.Enums.DATA_MEDIA_TYPE.Org) {
            if (!targetScriptOrg || !targetScriptOrg.accessToken) {
                try {
                    // Connection is not found int the package. Try to retrieve credentials from the SFDX.
                    this.logger.infoNormal(RUN_RESOURCES.tryingToConnectCLI, targetUsername);
                    let s = SfdxUtils.execSfdx("force:org:display", targetUsername);
                    let p = SfdxUtils.parseForceOrgDisplayResult(s);
                    if (!p.isConnected) {
                        throw new Error();
                    }
                    this.logger.infoNormal(RUN_RESOURCES.successfullyConnected, p.Username);
                    this.orgs.set(this.script.targetKey, new SfdmModels.SOrg(p.Username, p.AccessToken, p.InstanceUrl, this.basePath, this.script.targetMedia, false));
                } catch (e) {
                    throw new SfdmModels.CommandInitializationError(this.logger.getResourceString(RUN_RESOURCES.tryingToConnectCLIFailed, targetUsername));
                }
            } else {
                this.orgs.set(this.script.targetKey, new SfdmModels.SOrg(targetScriptOrg.name, targetScriptOrg.accessToken, targetScriptOrg.instanceUrl, this.basePath, this.script.targetMedia, false));
            }
        }


        if (this.script.sourceMedia == SfdmModels.Enums.DATA_MEDIA_TYPE.File) {
            let targetOrg = this.orgs.get(this.script.targetKey);
            this.orgs.set(this.script.sourceKey, new SfdmModels.SOrg(targetOrg.name, targetOrg.accessToken, targetOrg.instanceUrl, this.basePath, this.script.sourceMedia, true));
        }

        if (this.script.targetMedia == SfdmModels.Enums.DATA_MEDIA_TYPE.File) {
            let sourceOrg = this.orgs.get(this.script.sourceKey);
            this.orgs.set(this.script.targetKey, new SfdmModels.SOrg(sourceOrg.name, sourceOrg.accessToken, sourceOrg.instanceUrl, this.basePath, this.script.targetMedia, false));
        }


        this.orgs.forEach(org => {
            org.pollingIntervalMs = this.script.pollingIntervalMs;
            org.bulkApiVersion = this.script.bulkApiVersion;
            org.bulkThreshold = this.script.bulkThreshold;
            org.bulkApiV1BatchSize = this.script.bulkApiV1BatchSize;
            org.version = this.script.apiVersion;
            org.allOrNone = this.script.allOrNone;
            org.createTargetCSVFiles = this.script.createTargetCSVFiles;
        });

        if (this.sourceOrg.isEquals(this.targetOrg)) {
            throw new SfdmModels.CommandInitializationError(this.logger.getResourceString(RUN_RESOURCES.sourceTargetCouldNotBeTheSame));
        }

        // Validate access token
        try {
            await SfdxUtils.validateAccessTokenAsync(this.sourceOrg);
        } catch (e) {
            throw new SfdmModels.CommandInitializationError(this.logger.getResourceString(RUN_RESOURCES.accessToSourceExpired));
        }

        try {
            await SfdxUtils.validateAccessTokenAsync(this.targetOrg);
        } catch (e) {
            throw new SfdmModels.CommandInitializationError(this.logger.getResourceString(RUN_RESOURCES.accessToTargetExpired));
        }

        // Parse queries
        this.script.objects.forEach(object => {

            object.oldExternalId = object.externalId;

            if ((typeof object.operation == "string") == true) {
                object.operation = <SfdmModels.Enums.OPERATION>SfdmModels.Enums.OPERATION[object.operation.toString()];
            }

            // Always put explicit external id of Id for Insert operation...
            if (object.operation == SfdmModels.Enums.OPERATION.Insert) {
                object.externalId = "Id";
            }

            try {
                object.parsedQuery = parseQuery(object.query);
                if (object.operation == SfdmModels.Enums.OPERATION.Delete) {
                    object.deleteOldData = true;
                    object.parsedQuery.fields = [getComposedField("Id")];
                }
            } catch (e) {
                throw new SfdmModels.CommandInitializationError(this.logger.getResourceString(RUN_RESOURCES.MalformedQuery, object.name, object.query, e));
            }

            if (object.deleteOldData && object.operation == SfdmModels.Enums.OPERATION.Upsert) {
                object.operation = SfdmModels.Enums.OPERATION.Insert;
            }

            object.name = object.parsedQuery.sObject;
            this.script.objectsMap.set(object.name, object);

            if (object.deleteOldData) {
                try {
                    if (object.deleteQuery) {
                        object.parsedDeleteQuery = parseQuery(object.deleteQuery);
                    } else {
                        object.parsedDeleteQuery = parseQuery(object.query);
                    }
                    object.parsedDeleteQuery.fields = [getComposedField("Id")];
                    if (this.sourceOrg.isPersonAccountEnabled && object.name == "Contact") {
                        object.parsedDeleteQuery.where = SfdxUtils.composeWhereClause(object.parsedDeleteQuery.where, "IsPersonAccount", "false", "=", "BOOLEAN", "AND");
                    }
                } catch (e) {
                    throw new SfdmModels.CommandInitializationError(this.logger.getResourceString(RUN_RESOURCES.MalformedDeleteQuery, object.name, object.deleteQuery, e));
                }
            }

        });



        // Add RecordType object if mssing & needed
        if (this.script.objects.some(x => x.parsedQuery.fields.some(x1 => (<SOQLField>x1).field == "RecordTypeId"))
            && !this.script.objects.some(x => x.name == "RecordType")) {
            let rtObject: SfdmModels.ScriptObject = new SfdmModels.ScriptObject({
                name: "RecordType",
                externalId: "DeveloperName",
                isExtraObject: true,
                allRecords: true,
                fieldsMap: new Map<string, ScriptField>(),
                query: "SELECT Id FROM RecordType",
                operation: SfdmModels.Enums.OPERATION.Readonly
            });
            this.script.objects.push(rtObject);
            rtObject.parsedQuery = parseQuery(rtObject.query);
            this.script.objectsMap.set(rtObject.name, rtObject);
        }


        var recordTypeSObjectTypes: List<string> = new List<string>();
        var recordTypeScriptObject: SfdmModels.ScriptObject;
        let scriptObjectsList = new List<SfdmModels.ScriptObject>(this.script.objects);


        // Describe sObjects
        this.logger.infoMinimal(RUN_RESOURCES.gettingOrgMetadata);

        for (let i = 0; i < this.script.objects.length; i++) {

            let object: SfdmModels.ScriptObject = this.script.objects[i];

            this.logger.infoVerbose(RUN_RESOURCES.processingSObject, object.name);

            // Validaiton external id
            if (object.operation != SfdmModels.Enums.OPERATION.Insert
                && object.operation != SfdmModels.Enums.OPERATION.Readonly
                && !object.isComplexExternalId
                && !object.externalId) {
                throw new SfdmModels.OrgMetadataError(this.logger.getResourceString(RUN_RESOURCES.noExternalKey, object.name, object.strOperation));
            }

            // Describe source sObject
            try {
                object.sObjectDescribe = await SfdxUtils.describeSObjectAsync(object.name, this.sourceOrg, this.targetOrg.sObjectsMap);
            } catch (e) {
                throw new SfdmModels.OrgMetadataError(this.logger.getResourceString(RUN_RESOURCES.objectSourceDoesNotExist, object.name));
            }

            // Describe target sObject
            try {
                object.sObjectDescribeTarget = await SfdxUtils.describeSObjectAsync(object.name, this.targetOrg, this.sourceOrg.sObjectsMap);
            } catch (e) {
                throw new SfdmModels.OrgMetadataError(this.logger.getResourceString(RUN_RESOURCES.objectTargetDoesNotExist, object.name));
            }
        }


        // Compose query fields for the "Delete" objects
        // (Needed to build proper task order depend on the relationships between objects)
        this.script.objects.forEach(object => {
            if (object.operation == SfdmModels.Enums.OPERATION.Delete) {
                this.script.objects.forEach(obj => {
                    if (obj != object) {
                        let f = [...object.sObjectDescribe.fieldsMap.values()].filter(field => field.referencedObjectType == obj.name);
                        if (f.length > 0) {
                            object.parsedQuery.fields.push(getComposedField(f[0].name));
                        }
                    }
                });
            }
        });


        // Analysing relationships and building script data
        this.logger.infoMinimal(RUN_RESOURCES.analysingOrgMetadata);

        for (let i = 0; i < this.script.objects.length; i++) {

            let object: SfdmModels.ScriptObject = this.script.objects[i];

            this.logger.infoVerbose(RUN_RESOURCES.processingSObject, object.name);

            // Describe sObject where there this no describtion
            if (!object.sObjectDescribe) {

                // Describe target sObject
                try {
                    object.sObjectDescribe = await SfdxUtils.describeSObjectAsync(object.name, this.sourceOrg, this.targetOrg.sObjectsMap);
                } catch (e) {
                    throw new SfdmModels.OrgMetadataError(this.logger.getResourceString(RUN_RESOURCES.objectSourceDoesNotExist, object.name));
                }

                // Describe target sObject
                try {
                    object.sObjectDescribeTarget = await SfdxUtils.describeSObjectAsync(object.name, this.targetOrg, this.sourceOrg.sObjectsMap);
                } catch (e) {
                    throw new SfdmModels.OrgMetadataError(this.logger.getResourceString(RUN_RESOURCES.objectTargetDoesNotExist, object.name));
                }
            }


            // Remove old external id field if it is readonly field
            if (object.oldExternalId != object.externalId) {
                let oldExternalIdField = object.sObjectDescribe.fieldsMap.get(object.oldExternalId);
                if (oldExternalIdField && oldExternalIdField.isReadonly) {
                    object.parsedQuery.fields = object.parsedQuery.fields.filter((f: SOQLField) => {
                        return f.field != object.oldExternalId;
                    });
                }
            }

            var scriptFieldsList = new List<FieldType>(object.parsedQuery.fields).Cast<SOQLField>();

            // Add Id field to the SOQL if missing
            if (!scriptFieldsList.Any(x => (<SOQLField>x).field == "Id")) {
                var f = getComposedField("Id");
                object.parsedQuery.fields.push(f);
                scriptFieldsList.Add(<SOQLField>f);
            }

            // Add ExternalId field to the SOQL if missing
            if (!scriptFieldsList.Any(x => (<SOQLField>x).field == object.externalId)) {

                if (object.isComplexExternalId) {
                    object.externalId = object.complexExternalIdKey;
                    let fdescribe = new SfdmModels.SFieldDescribe({
                        label: object.externalId,
                        name: object.externalId,
                        updateable: false,
                        creatable: false,
                        cascadeDelete: false,
                        autoNumber: false,
                        custom: true,
                        calculated: true,
                        isReference: false,
                        referencedObjectType: undefined
                    });
                    object.sObjectDescribe.fieldsMap.set(object.externalId, fdescribe);
                    object.sObjectDescribeTarget.fieldsMap.set(object.externalId, fdescribe);
                }

                var f = getComposedField(object.externalId);
                object.parsedQuery.fields.push(f);

                // Supress exporting external id field values
                // if originally this field was not in the query.
                object.readonlyExternalIdFields.push(object.externalId);

            } else if (object.sObjectDescribe.fieldsMap.has(object.externalId) && object.sObjectDescribe.fieldsMap.get(object.externalId).isReadonly
                || !object.sObjectDescribe.fieldsMap.has(object.externalId)) {
                // Supress exporting external id fields of non-updatable types (formula, autonumber, etc)
                object.readonlyExternalIdFields.push(object.externalId);
            }

            if ((object.name == "Account" || object.name == "Contact")
                && (this.sourceOrg.isPersonAccountEnabled
                    || this.targetOrg.isPersonAccountEnabled)
                && !scriptFieldsList.Any(x => (<SOQLField>x).field == "IsPersonAccount")) {
                // Add IsPersonAccount field to process person accounts
                var f = getComposedField("IsPersonAccount");
                object.parsedQuery.fields.push(f);
                scriptFieldsList.Add(<SOQLField>f);
            }

            // Add filter by record type
            if (scriptFieldsList.Any(x => (<SOQLField>x).field == "RecordTypeId")
                || scriptFieldsList.Any(x => (<SOQLField>x).field == "RecordType.Id")) {
                recordTypeSObjectTypes.Add(object.name);
            }

            // Construct RecordType object
            if (object.name == "RecordType") {
                recordTypeScriptObject = object;
                object.isExtraObject = true;
                object.allRecords = true;
                object.operation = SfdmModels.Enums.OPERATION.Readonly;
                if (!scriptFieldsList.Any(x => (<SOQLField>x).field == "SobjectType")) {
                    var f = getComposedField("SobjectType");
                    object.parsedQuery.fields.push(f);
                    scriptFieldsList.Add(<SOQLField>f);
                }
            }
        }

        for (let i = 0; i < this.script.objects.length; i++) {

            let object: SfdmModels.ScriptObject = this.script.objects[i];

            this.logger.infoVerbose(RUN_RESOURCES.processingSObject, object.name);

            var scriptFieldsList = new List<FieldType>(object.parsedQuery.fields).Cast<SOQLField>();

            // Generate Script Fields & build fields map 
            for (let j = 0; j < scriptFieldsList.Count(); j++) {

                const fld = scriptFieldsList.ElementAt(j);

                let field = new SfdmModels.ScriptField({
                    name: fld.field,
                    sObject: object
                });

                object.fields.push(field);

                // Validate object metadata
                field.sFieldDescribe = object.sObjectDescribe.fieldsMap.get(field.name);
                if (field.sFieldDescribe == null /*&& !field.isComplexField*/) {
                    throw new SfdmModels.OrgMetadataError(this.logger.getResourceString(RUN_RESOURCES.fieldSourceDoesNtoExist, object.name, field.name));
                }

                // Validate target object metadata
                field.sFieldDescribeTarget = object.sObjectDescribeTarget.fieldsMap.get(field.name);

                if (field.sFieldDescribeTarget == null /* && !field.isComplexField*/) {
                    throw new SfdmModels.OrgMetadataError(this.logger.getResourceString(RUN_RESOURCES.fieldTargetDoesNtoExist, object.name, field.name));
                }

                // Build references
                if (field.sFieldDescribe.isReference) {

                    let refObj: SfdmModels.ScriptObject = scriptObjectsList.FirstOrDefault(x => x.name == field.referencedSObjectType);

                    if (!refObj) {
                        // Add readonly reference object if missing
                        refObj = new SfdmModels.ScriptObject({
                            name: field.referencedSObjectType,
                            externalId: "Name",
                            isExtraObject: true,
                            allRecords: true,
                            fieldsMap: new Map<string, ScriptField>(),
                            query: `SELECT Id, Name FROM ${field.referencedSObjectType}`,
                            operation: SfdmModels.Enums.OPERATION.Readonly
                        });
                        refObj.parsedQuery = parseQuery(refObj.query);
                        this.script.objectsMap.set(refObj.name, refObj);
                        this.script.objects.push(refObj);

                        if (!refObj.sObjectDescribe) {

                            // Describe target sObject
                            try {
                                refObj.sObjectDescribe = await SfdxUtils.describeSObjectAsync(refObj.name, this.sourceOrg, this.targetOrg.sObjectsMap);
                            } catch (e) {
                                throw new SfdmModels.OrgMetadataError(this.logger.getResourceString(RUN_RESOURCES.objectSourceDoesNotExist, refObj.name));
                            }

                            // Describe target sObject
                            try {
                                refObj.sObjectDescribeTarget = await SfdxUtils.describeSObjectAsync(refObj.name, this.targetOrg, this.sourceOrg.sObjectsMap);
                            } catch (e) {
                                throw new SfdmModels.OrgMetadataError(this.logger.getResourceString(RUN_RESOURCES.objectTargetDoesNotExist, refObj.name));
                            }
                        }
                    }

                    if (!refObj.externalId) {
                        throw new SfdmModels.CommandInitializationError(this.logger.getResourceString(RUN_RESOURCES.referencedFieldDoesNotExist, object.name, field.name, field.sFieldDescribe.name));
                    }

                    object.fieldsMap.set(field.name, field);


                    // Important! For reference fields => replace original external id key 
                    // with the external id key of the referenced script object
                    field.externalId = refObj.externalId;


                } else {
                    object.fieldsMap.set(field.name, field);
                }

            }

            object.fields = [...object.fieldsMap.values()];

        }

        // Referenced fields for all objects
        this.script.objects.forEach(object => {

            object.fields.forEach(field => {
                // Referenced field
                if (field.sFieldDescribe.isReference) {
                    // Add referenced field to the object 
                    let o = this.script.objectsMap.get(field.referencedSObjectType);
                    if (o) {
                        let ff = o.fieldsMap.get(field.externalId);
                        if (ff) {
                            object.referencedFieldMap.set(field.referencedFullFieldName, [field, ff]);
                        }
                    }

                }
            });
        });

        // Construct query for the RecordType object
        if (recordTypeScriptObject != null) {
            let pq = recordTypeScriptObject.parsedQuery;
            if (recordTypeSObjectTypes.Count() > 0) {
                pq.where = SfdxUtils.composeWhereClause(pq.where, "SobjectType", recordTypeSObjectTypes.ToArray());
            }
            pq.orderBy = <OrderByClause>({
                field: "SobjectType",
                order: "ASC"
            });
            recordTypeScriptObject.query = composeQuery(pq);
        }

        // Build map to the parent references
        this.script.objects.forEach(object => {
            let references = object.getReferencedSObjectTypes();
            references.ForEach(reference => {
                object.referencedScriptObjectsMap.set(reference, this.script.objectsMap.get(reference));
            });
        });

    }



    /**
     * Method to create Job and Tasks
     *
     * @memberof RunCommand
     */
    async createMigrationJob() {

        this.logger.infoMinimal(RUN_RESOURCES.newLine);
        this.logger.headerMinimal(RUN_RESOURCES.dataMigrationProcessStarted);

        this.logger.infoVerbose(RUN_RESOURCES.buildingMigrationStaregy);

        // Create Tasks and put them in right order
        this.script.objects.forEach(object => {

            // Create new Task
            let task: SfdmModels.Task = new SfdmModels.Task({
                scriptObject: object,
                job: this.job
            });

            // Add task fields for the original query
            // (without referenced fields)
            task.createOriginalTaskFields();

            if (object.name == "RecordType") {
                // Record type task must be always in the top
                this.job.tasks.Insert(0, task);
            } else if (this.job.tasks.Count() == 0) {
                this.job.tasks.Add(task);
            } else {
                let index: number = this.job.tasks.Count();
                for (var i = this.job.tasks.Count() - 1; i >= 0; i--) {
                    var theTask = this.job.tasks.ElementAt(i);
                    if (theTask.scriptObject.referencedScriptObjectsMap.has(object.name)
                        // ... and check if the parent task has no limits
                        //&& !object.parsedQuery.limit
                    ) {
                        // This task is the parent => push this task before
                        index = i;
                    }
                    // ... or leave it at the current place in the chain
                }
                // Insert the task in the desired
                this.job.tasks.Insert(index, task);
            }

        });

        // Correct master-details => put master-detail parents before
        let updatedTasks: List<SfdmModels.Task> = new List<SfdmModels.Task>();

        updatedTasks.Add(this.job.tasks.Last());

        for (var i = this.job.tasks.Count() - 2; i >= 0; i--) {
            var theTaskPrev = this.job.tasks.ElementAt(i);
            updatedTasks.Add(theTaskPrev);
            for (var j = i + 1; j < this.job.tasks.Count(); j++) {
                var theTaskNext = this.job.tasks.ElementAt(j);
                let masterDetailReferencedScriptObjects = new List<SfdmModels.ScriptObject>([...theTaskPrev.scriptObject.referencedScriptObjectsMap.values()])
                    .Where(preRefObj => {
                        // Detect master-detail parent in theTaskNext
                        let ret = preRefObj.name == theTaskNext.sObjectName &&
                            theTaskPrev.scriptObject.fields.some(f => {
                                let ret = f.sFieldDescribe.referencedObjectType == preRefObj.name && f.sFieldDescribe.isMasterDetail;
                                return ret;
                            });

                        return ret;
                    });


                if (masterDetailReferencedScriptObjects.Count() > 0) {
                    masterDetailReferencedScriptObjects.ForEach(object => {
                        let refTask = this.job.tasks.FirstOrDefault(x => x.sObjectName == object.name);
                        this.job.tasks.Remove(refTask);
                        updatedTasks.Remove(refTask);
                        updatedTasks.Add(refTask);
                    });
                }
            }
        }

        this.job.tasks = updatedTasks.Reverse();

        this.job.tasks.ForEach(task => {
            task.createReferencedTaskFields();
        });

        this.logger.objectMinimal({
            "Execution order": this.logger.getResourceString(RUN_RESOURCES.executionOrder, this.job.tasks.Select(x => x.sObjectName).ToArray().join("; "))
        });

    }



    /**
     * Method to execute the Job.
     *
     * @returns Command execution result 
     * @memberof RunCommand
     */
    async executeMigrationJob(): Promise<any> {

        let _app: RunCommand = this;

        let csvDataCacheMap: Map<string, Map<string, any>> = new Map<string, Map<string, any>>();
        let csvDataFilesToSave: Set<string> = new Set<string>();

        // [Object name + Field name + Raw value] => actual value
        let csvValuesMapping: Map<string, Map<string, string>> = new Map<string, Map<string, string>>();

        async function _saveCachedCsvDataFiles(): Promise<any> {
            let csvPaths = [...csvDataFilesToSave.keys()];
            for (let i = 0; i < csvPaths.length; i++) {
                const csvPath = csvPaths[i];
                let m = csvDataCacheMap.get(csvPath);
                if (m) {
                    _app.logger.infoVerbose(RUN_RESOURCES.writingToCSV, csvPath);
                    let values = [...m.values()];
                    await CommonUtils.writeCsvFileAsync(csvPath, values, true);
                }
            }
        }

        // ---------------------------------
        // ---------------------------------
        // ---------------------------------
        // ---------------------------------
        // 0 step. Prerequisites
        // Validate and prepare raw CSV source files ********************************

        if (this.sourceOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.File && !(this.script.encryptDataFiles && this.password)) {

            this.logger.infoMinimal(RUN_RESOURCES.validatingAndFixingSourceCSVFiles);

            // Load values mapping if exists
            const valueMappingCsvFilename = "ValueMapping.csv";
            let valueMappingFilePath = path.join(this.sourceOrg.basePath, valueMappingCsvFilename);
            let csvRows = await CommonUtils.readCsvFileAsync(valueMappingFilePath);
            if (csvRows.length > 0) {

                this.logger.infoVerbose(RUN_RESOURCES.readingValuesMappingFile, valueMappingCsvFilename);

                csvRows.forEach(row => {
                    if (row["ObjectName"] && row["FieldName"]) {
                        let key = String(row["ObjectName"]).trim() + String(row["FieldName"]).trim();
                        if (!csvValuesMapping.has(key)) {
                            csvValuesMapping.set(key, new Map<string, string>());
                        }
                        csvValuesMapping.get(key).set(String(row["RawValue"]).trim(), (String(row["Value"]) || "").trim());
                    }
                });
            }



            // A. Merge User / Group into UserAndGroup ----------------------//

            let filepath1 = path.join(this.sourceOrg.basePath, "User.csv");
            let filepath2 = path.join(this.sourceOrg.basePath, "Group.csv");
            let filepath3 = path.join(this.sourceOrg.basePath, SfdmModels.CONSTANTS.USER_AND_GROUP_FILE_NAME + ".csv");

            await CommonUtils.mergeCsvFiles(filepath1, filepath2, filepath3, true, "Id", "Name");


            if (!this.script.importCSVFilesAsIs) {

                // B. Add missing referenced lookup fields and process external id columns ----------------------//

                let csvIssues: Array<{
                    "Date": string,
                    "Severity level": "HIGH" | "LOW" | "NORMAL" | "HIGHEST",
                    "Child sObject name": string,
                    "Child field name": string,
                    "Parent record Id": string,
                    "Parent sObject name": string,
                    "Parent sObject external Id field name": string,
                    "Error description": string
                }> = new Array<any>();

                for (let i = 0; i < this.job.tasks.Count(); i++) {

                    let task = this.job.tasks.ElementAt(i);

                    if (task.scriptObject.operation == SfdmModels.Enums.OPERATION.Delete)
                        continue;

                    let filepath = path.join(this.sourceOrg.basePath, task.sObjectName);
                    if (task.sObjectName == "User" || task.sObjectName == "Group") {
                        filepath = path.join(this.sourceOrg.basePath, SfdmModels.CONSTANTS.USER_AND_GROUP_FILE_NAME);
                    }
                    filepath += ".csv";

                    // Check the source CSV file for this task
                    let csvColumnsRow = await CommonUtils.readCsvFileAsync(filepath, 1);
                    if (csvColumnsRow.length == 0) {
                        csvIssues.push({
                            Date: CommonUtils.formatDateTime(new Date()),
                            "Severity level": "HIGHEST",
                            "Child sObject name": task.sObjectName,
                            "Child field name": null,
                            "Parent sObject name": null,
                            "Parent sObject external Id field name": null,
                            "Parent record Id": null,
                            "Error description": this.logger.getResourceString(RUN_RESOURCES.csvFileIsEmpty)
                        });
                        continue;
                    }

                    for (let j = 0; j < task.taskFields.Count(); j++) {

                        const taskField = task.taskFields.ElementAt(j);
                        const columnExists = Object.keys(csvColumnsRow[0]).some(columnName => {
                            let c = columnName.split(SfdmModels.CONSTANTS.CSV_COMPLEX_FIELDS_COLUMN_SEPARATOR);
                            if (c.some(x => x == taskField.name)) {
                                return true;
                            } else {
                                return false
                            }
                        });
                        if (taskField.isOriginalField && !columnExists) {
                            csvIssues.push({
                                Date: CommonUtils.formatDateTime(new Date()),
                                "Severity level": "NORMAL",
                                "Child sObject name": task.sObjectName,
                                "Child field name": taskField.name,
                                "Parent sObject name": null,
                                "Parent sObject external Id field name": null,
                                "Parent record Id": null,
                                "Error description": this.logger.getResourceString(RUN_RESOURCES.columnsMissingInCSV)
                            });
                        }

                        if (taskField.isReference && !taskField.isOriginalField) {


                            // Add missing reference lookup columns *************************

                            // Checking and filling values for the column "Account__r.AccountNumber"
                            // with external id values taken from the parent sObject csv files

                            // *****************************************************************************
                            // Account__c
                            let refSObjectName = taskField.originalScriptField.referencedSObjectType;
                            // AccountNumber
                            let refSObjectExternalIdFieldName = taskField.originalScriptField.externalId;

                            // Account__r.AccountNumber
                            let columnName = taskField.name;
                            // Account__c
                            let lookupFieldName = taskField.originalScriptField.name;

                            let parentTask = this.job.tasks.FirstOrDefault(x => x.sObjectName == refSObjectName)
                            if (!parentTask || parentTask.scriptObject.operation == SfdmModels.Enums.OPERATION.Readonly
                                || parentTask.scriptObject.operation == SfdmModels.Enums.OPERATION.Delete) {
                                continue;
                            }

                            if (!csvColumnsRow[0].hasOwnProperty(columnName)
                                && !taskField.originalScriptField.isComplexExternalId) {

                                // Read child CSV file (current)
                                let m: Map<string, any> = await CommonUtils.readCsvFileOnceAsync(csvDataCacheMap, filepath);

                                let refFilepath = path.join(this.sourceOrg.basePath, refSObjectName);
                                if (refSObjectName == "User" || refSObjectName == "Group") {
                                    refFilepath = path.join(this.sourceOrg.basePath, SfdmModels.CONSTANTS.USER_AND_GROUP_FILE_NAME);
                                }
                                refFilepath += ".csv";

                                // Read parent CSV file
                                m = await CommonUtils.readCsvFileOnceAsync(csvDataCacheMap, refFilepath);
                                if (!m) {
                                    csvIssues.push({
                                        Date: CommonUtils.formatDateTime(new Date()),
                                        "Severity level": "HIGH",
                                        "Child sObject name": task.sObjectName,
                                        "Child field name": lookupFieldName,
                                        "Parent sObject name": refSObjectName,
                                        "Parent sObject external Id field name": refSObjectExternalIdFieldName,
                                        "Parent record Id": null,
                                        "Error description": this.logger.getResourceString(RUN_RESOURCES.csvFileForParentSObjectIsEmpty)
                                    });
                                    continue;
                                }

                                // Mark current CSV file for further update
                                csvDataFilesToSave.add(filepath);

                                let rows: Map<string, any> = csvDataCacheMap.get(filepath);
                                let refRows: Map<string, any> = csvDataCacheMap.get(refFilepath);
                                let values = [...rows.values()];
                                values.forEach(value => {
                                    if (typeof value[columnName] == "undefined") {
                                        // Id from Account csv
                                        let id = value[lookupFieldName];
                                        let extIdValue: any;
                                        if (id && refRows.get(id)) {
                                            // Value from Account.AccountNumber
                                            extIdValue = refRows.get(id)[refSObjectExternalIdFieldName];
                                        }
                                        if (typeof extIdValue != "undefined") {
                                            // Value of "Account.AccountNumber"  putting to  "Account__r.Customer_number__c"
                                            value[columnName] = extIdValue;
                                        } else {
                                            // If no value from parent csv and no original value => output error
                                            csvIssues.push({
                                                Date: CommonUtils.formatDateTime(new Date()),
                                                "Severity level": "NORMAL",
                                                "Child sObject name": task.sObjectName,
                                                "Child field name": lookupFieldName,
                                                "Parent sObject name": refSObjectName,
                                                "Parent sObject external Id field name": refSObjectExternalIdFieldName,
                                                "Parent record Id": id,
                                                "Error description": this.logger.getResourceString(RUN_RESOURCES.missingParentRecordForGivenLookupValue)
                                            });
                                            value[columnName] = null;
                                        }
                                    }
                                });

                            }

                        } else if (!taskField.isReference
                            && taskField.isOriginalField
                            && !taskField.name.startsWith(SfdmModels.CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX)) {

                            // Process external Id columns coming from the external system *************************

                            // Trasnpose column  "Account__c!Customer_number__c" to:
                            // Account__c, Account__r.AccountNumber, Customer__number__c

                            // *****************************************************************************

                            let columnName = Object.keys(csvColumnsRow[0]).filter(key => {
                                return key.toLowerCase().indexOf(`${SfdmModels.CONSTANTS.CSV_COMPLEX_FIELDS_COLUMN_SEPARATOR}${taskField.name.toLowerCase()}`) >= 0;
                            })[0];

                            if (columnName) {

                                // External id column => Add fake lookup column
                                let parts = columnName.split(SfdmModels.CONSTANTS.CSV_COMPLEX_FIELDS_COLUMN_SEPARATOR);
                                if (parts.length < 2) {
                                    csvIssues.push({
                                        Date: CommonUtils.formatDateTime(new Date()),
                                        "Severity level": "HIGH",
                                        "Child sObject name": task.sObjectName,
                                        "Child field name": null,
                                        "Parent sObject name": null,
                                        "Parent sObject external Id field name": null,
                                        "Parent record Id": null,
                                        "Error description": this.logger.getResourceString(RUN_RESOURCES.invalidColumnFormat, columnName)
                                    });
                                    continue;
                                }
                                // Account__c
                                let lookupField = parts[0].toLowerCase();
                                // Customer_number__c
                                let tempExtIdField = parts[1].toLowerCase();

                                let m: Map<string, any> = await CommonUtils.readCsvFileOnceAsync(csvDataCacheMap, filepath);

                                // Task field for Account__c
                                let lookupTaskField = task.taskFields.Where(x => x.name.toLowerCase() == lookupField);
                                // Task field for Customer_number__c
                                let tempExtIdTaskField = task.taskFields.Where(x => x.name.toLowerCase() == tempExtIdField);

                                if (lookupTaskField.Count() == 0) {
                                    csvIssues.push({
                                        Date: CommonUtils.formatDateTime(new Date()),
                                        "Severity level": "HIGH",
                                        "Child sObject name": task.sObjectName,
                                        "Child field name": null,
                                        "Parent sObject name": null,
                                        "Parent sObject external Id field name": null,
                                        "Parent record Id": null,
                                        "Error description": this.logger.getResourceString(RUN_RESOURCES.columnWillNotBeProcessed, columnName, parts[0])
                                    });
                                } else {
                                    lookupField = lookupTaskField.ElementAt(0).name;
                                }

                                if (tempExtIdTaskField.Count() == 0) {
                                    csvIssues.push({
                                        Date: CommonUtils.formatDateTime(new Date()),
                                        "Severity level": "HIGH",
                                        "Child sObject name": task.sObjectName,
                                        "Child field name": null,
                                        "Parent sObject name": null,
                                        "Parent sObject external Id field name": null,
                                        "Parent record Id": null,
                                        "Error description": this.logger.getResourceString(RUN_RESOURCES.columnWillNotBeProcessed, columnName, parts[1])
                                    });
                                } else {
                                    tempExtIdField = tempExtIdTaskField.ElementAt(0).name;
                                }

                                if (lookupTaskField.Count() == 0 || tempExtIdTaskField.Count() == 0) {
                                    continue;
                                }

                                // Account__r.AccountNumber (in case that AccountNumber is external id for Account)
                                let extIdField = lookupTaskField.ElementAt(0).externalIdTaskField.name;
                                let csvRows = [...m.values()];

                                csvRows.forEach(row => {
                                    row[lookupField] = row[lookupField] || '0011p00002Zh1kr'; // Fake id
                                    row[extIdField] = row[columnName];
                                    row[tempExtIdField] = row[columnName];
                                    delete row[columnName];
                                });

                                // Mark current CSV file for further update                            
                                csvDataFilesToSave.add(filepath);

                            }
                        }
                    }
                    // ****************************************************************************************************
                }

                // Write to all changed csv files
                await _saveCachedCsvDataFiles();

                // Write to file with issues of csv format
                let csvIssuesFilepath = path.join(this.sourceOrg.basePath, SfdmModels.CONSTANTS.CSV_LOOKUP_ERRORS_FILE_NAME);
                await CommonUtils.writeCsvFileAsync(csvIssuesFilepath, csvIssues, true);

                if (csvIssues.length == 0) {
                    this.logger.infoVerbose(RUN_RESOURCES.noIssuesFoundDuringCSVValidation);
                } else {
                    this.logger.warn(RUN_RESOURCES.issuesFoundDuringCSVValidation, String(csvIssues.length), SfdmModels.CONSTANTS.CSV_LOOKUP_ERRORS_FILE_NAME);
                    if (this.script.promptOnMissingParentObjects) {
                        if (!await this.logger.yesNoPromptAsync(RUN_RESOURCES.continueTheJobPrompt)) {
                            throw new SfdmModels.CommandAbortedByUserError(this.logger.getResourceString(RUN_RESOURCES.AbortedByTheUser));
                        }
                    }
                }

                // Format report
                if (csvDataFilesToSave.size > 0) {
                    this.logger.infoVerbose(RUN_RESOURCES.csvFilesWereUpdated, String(csvDataFilesToSave.size));
                }

                this.logger.infoVerbose(RUN_RESOURCES.validationAndFixingsourceCSVFilesCompleted);

                // Only csv validation
                if (this.script.validateCSVFilesOnly) {
                    return;
                }

                csvDataFilesToSave.clear();

            }


        }


        // Getting recosds count to process *************************************************         
        for (let i = 0; i < this.job.tasks.Count(); i++) {

            let task = this.job.tasks.ElementAt(i);

            // Calculate integrity : how many records need to process
            this.logger.infoMinimal(RUN_RESOURCES.gettingRecordsCount, task.sObjectName);

            if (!task.scriptObject.isExtraObject) {

                try {

                    let tempQuery = task.createQuery(['COUNT(Id) CNT'], true);

                    if (task.sourceTotalRecorsCount < 0) {
                        if (task.scriptObject.parsedQuery.limit > 0) {
                            task.sourceTotalRecorsCount = task.scriptObject.parsedQuery.limit;
                        } else {
                            let ret = await SfdxUtils.queryAsync(tempQuery, this.sourceOrg);
                            task.sourceTotalRecorsCount = Number.parseInt(ret.ElementAt(0)["CNT"]);
                            task.useQueryBulkApiForSourceRecords = task.sourceTotalRecorsCount > CONSTANTS.QUERY_BULK_API_THRESHOLD;
                        }
                    }
                    this.logger.infoNormal(RUN_RESOURCES.totalRecordsAmount, task.sObjectName, "source", String(task.sourceTotalRecorsCount));

                    if (task.targetTotalRecorsCount < 0) {
                        if (task.scriptObject.parsedQuery.limit > 0) {
                            task.targetTotalRecorsCount = task.scriptObject.parsedQuery.limit;
                        } else {
                            let ret = await SfdxUtils.queryAsync(tempQuery, this.targetOrg);
                            task.targetTotalRecorsCount = Number.parseInt(ret.ElementAt(0)["CNT"]);
                            task.useQueryBulkApiForTargetRecords = task.targetTotalRecorsCount > CONSTANTS.QUERY_BULK_API_THRESHOLD;
                        }
                    }
                    this.logger.infoNormal(RUN_RESOURCES.totalRecordsAmount, task.sObjectName, "target", String(task.targetTotalRecorsCount));

                } catch (e) {
                    throw new SfdmModels.CommandExecutionError(this.logger.getResourceString(RUN_RESOURCES.queryError, e));
                }
            }
        }





        // ---------------------------------
        // ---------------------------------
        // ---------------------------------
        // ---------------------------------
        // 1 step. Delete old target records  

        this.logger.infoMinimal(RUN_RESOURCES.newLine);
        this.logger.headerMinimal(RUN_RESOURCES.deletingOldData);

        if (this.targetOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.Org) {

            for (let i = this.job.tasks.Count() - 1; i >= 0; i--) {

                let task = this.job.tasks.ElementAt(i);

                if (task.scriptObject.operation == SfdmModels.Enums.OPERATION.Readonly) continue;

                // DELETE
                if (task.scriptObject.deleteOldData) {

                    task.scriptObject.deleteOldData = false;

                    this.logger.infoNormal(RUN_RESOURCES.deletingTargetSObject, task.sObjectName);

                    // Query target to delete
                    let tempQuery = task.createDeleteQuery();

                    this.logger.infoVerbose(RUN_RESOURCES.queryingTargetSObject, task.sObjectName, tempQuery);

                    let queriedRecords: List<object>;
                    try {
                        if (task.useQueryBulkApiForTargetRecords) {
                            this.logger.infoVerbose(COMMON_RESOURCES.usingQueryBulkApi);
                        } else {
                            this.logger.infoVerbose(COMMON_RESOURCES.usingCollectionApi);
                        }
                        queriedRecords = await SfdxUtils.queryAsync(tempQuery, this.targetOrg, false, null, task.useQueryBulkApiForTargetRecords);
                    } catch (e) {
                        throw new SfdmModels.CommandExecutionError(this.logger.getResourceString(RUN_RESOURCES.queryError, e));
                    }

                    this.logger.infoVerbose(RUN_RESOURCES.queryingTargetSObjectCompleted, task.sObjectName, String(queriedRecords.Count()));

                    if (queriedRecords.Count()) {

                        // Make delete of target records
                        this.logger.infoVerbose(RUN_RESOURCES.deletingFromTheTargetNRecordsWillBeDeleted, task.sObjectName, String(queriedRecords.Count()));

                        try {
                            await SfdxUtils.deleteAsync(task.sObjectName,
                                queriedRecords,
                                this.targetOrg,
                                (status: ApiCalloutStatus) => {

                                    switch (status.verbosity) {

                                        case LOG_MESSAGE_VERBOSITY.MINIMAL:
                                            _app.logger.infoMinimal(status.message);
                                            break;

                                        case LOG_MESSAGE_VERBOSITY.VERBOSE:
                                            _app.logger.infoVerbose(status.message);
                                            break;

                                        default:
                                            _app.logger.infoNormal(status.message);
                                            break;
                                    }
                                });

                        } catch (e) {
                            await _saveCachedCsvDataFiles();
                            if (!this.script.promptOnUpdateError) {
                                throw new SfdmModels.CommandExecutionError(e.error);
                            }
                            else {
                                this.logger.warn(e.error);
                                if (!await this.logger.yesNoPromptAsync(RUN_RESOURCES.continueTheJobPrompt)) {
                                    throw new SfdmModels.CommandAbortedByUserError(e.error);
                                }
                            }
                        }

                        this.logger.infoVerbose(RUN_RESOURCES.deletingFromTheTargetCompleted, task.sObjectName);

                    } else {
                        this.logger.infoNormal(COMMON_RESOURCES.nothingToDelete, task.sObjectName);
                    }
                }

            }

            this.logger.infoVerbose(RUN_RESOURCES.deletingOldDataCompleted);

        } else {

            this.logger.infoVerbose(RUN_RESOURCES.deletingOldDataSkipped);

        }






        // ---------------------------------
        // ---------------------------------
        // ---------------------------------
        // ---------------------------------
        // 2 step. Retrieve source & target records      
        // Step 2 PASS 1 **************************
        this.logger.infoMinimal(RUN_RESOURCES.newLine);
        this.logger.headerMinimal(RUN_RESOURCES.retrievingData, `(${this.logger.getResourceString(RUN_RESOURCES.Step1)})`);

        for (let i = 0; i < this.job.tasks.Count(); i++) {

            let task = this.job.tasks.ElementAt(i);

            if (task.scriptObject.operation == SfdmModels.Enums.OPERATION.Delete) continue;

            if (task.scriptObject.operation == SfdmModels.Enums.OPERATION.Readonly
                || task.scriptObject.allRecords
                || task.scriptObject.isExtraObject) {

                task.scriptObject.processAllRecords = true;
                task.scriptObject.processAllRecordsTarget = true;

            } else {

                task.scriptObject.processAllRecords = false;
                if (task.scriptObject.isComplexExternalId) {
                    task.scriptObject.processAllRecordsTarget = true;
                } else {
                    task.scriptObject.processAllRecordsTarget = false;
                }
                // if (!task.scriptObject.isExtraObject) {

                //     try {
                //         // Source rules -----------------------------
                //         if (typeof task.scriptObject.processAllRecords == "undefined") {
                //             task.scriptObject.processAllRecords = task.sourceTotalRecorsCount > SfdmModels.CONSTANTS.ALL_RECORDS_FLAG_AMOUNT_FROM
                //                 || task.targetTotalRecorsCount < SfdmModels.CONSTANTS.ALL_RECORDS_FLAG_AMOUNT_TO;
                //         }
                //         let hasRelatedObjectWithConditions = task.taskFields.Any(x => x.parentTaskField
                //             && (
                //                 x.parentTaskField.originalScriptField.sObject.parsedQuery.limit > 0   // Any field is referenced to object with "limit"
                //                 || !!x.parentTaskField.originalScriptField.sObject.parsedQuery.where  // Any field is referenced to object with "where"
                //                 || task.scriptObject.parsedQuery.limit > 0                            // Any field is referenced to another object & this object has "limit" 
                //                 || !!task.scriptObject.parsedQuery.where                              // Any field is referenced to another object & this object has "where"                                 
                //             ));
                //         if (hasRelatedObjectWithConditions) {
                //             task.scriptObject.processAllRecords = false;
                //         }

                //         // Target rules -----------------------------
                //         task.scriptObject.processAllRecordsTarget = task.scriptObject.processAllRecords;
                //         if (task.scriptObject.isComplexExternalId) {
                //             task.scriptObject.processAllRecordsTarget = true;
                //         }

                //     } catch (e) {
                //         throw new SfdmModels.CommandExecutionError(this.logger.getResourceString(RUN_RESOURCES.queryError, e));
                //     }

                // } else {
                //     task.scriptObject.processAllRecordsTarget = task.scriptObject.processAllRecords;
                // }
            }


            // Query source records
            if (task.scriptObject.processAllRecords || this.sourceOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.File) {

                // Get all records as in original query from the script including additional referenced fields
                let tempQuery = task.createQuery();

                // Get the Source records
                if (this.logger.uxLoggerVerbosity != LOG_MESSAGE_VERBOSITY.VERBOSE) {
                    this.logger.infoMinimal(RUN_RESOURCES.queryingAll, task.sObjectName, "source");
                } else {
                    this.logger.infoVerbose(RUN_RESOURCES.queryingAllQueryString, task.sObjectName, "source", tempQuery);
                }

                try {
                    if (task.useQueryBulkApiForSourceRecords) {
                        this.logger.infoVerbose(COMMON_RESOURCES.usingQueryBulkApi);
                    } else {
                        this.logger.infoVerbose(COMMON_RESOURCES.usingCollectionApi);
                    }
                    let recs = await SfdxUtils.queryAsync(tempQuery,
                        this.sourceOrg,
                        true,
                        this.script.encryptDataFiles ? this.password : null,
                        task.useQueryBulkApiForSourceRecords);

                    // Values mapping...
                    if (csvValuesMapping.size > 0 && task.scriptObject.useCSVValuesMapping && recs.Count() > 0) {

                        this.logger.infoNormal(RUN_RESOURCES.mappingRawCsvValues, task.sObjectName);

                        let fields = Object.keys(recs.ElementAt(0));
                        if (fields.indexOf("Id") < 0) {
                            // Add Id values if missing
                            recs.ForEach(r => {
                                r["Id"] = CommonUtils.makeId(18);
                            });
                        }
                        fields.forEach(field => {
                            let key = task.sObjectName + field;
                            let valuesMap = csvValuesMapping.get(key);
                            if (valuesMap && valuesMap.size > 0) {
                                recs.ForEach(r => {
                                    let rawValue = (String(r[field]) || "").trim();
                                    if (valuesMap.has(rawValue)) {
                                        r[field] = valuesMap.get(rawValue);
                                    }
                                });
                            }
                        });
                    }

                    task.sourceRecordSet.set(SfdmModels.Enums.RECORDS_SET.Main, recs);

                    this.logger.infoNormal(RUN_RESOURCES.queryingFinished, task.sObjectName, "source", String(task.sourceRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main).Count()));

                } catch (e) {
                    throw new SfdmModels.CommandExecutionError(this.logger.getResourceString(RUN_RESOURCES.queryError, e));
                }


            } else {

                this.logger.infoNormal(RUN_RESOURCES.queryingIn, task.sObjectName, "source");

                // Get records including additional referenced fields with limiting by the parent object backwards
                // Get the Source records  
                let tempQueryList = task.createListOfLimitedQueries(true);
                let rec: Map<string, Array<object>> = new Map<string, Array<object>>();

                for (let index = 0, count = tempQueryList.Count(); index < count; index++) {
                    const el = tempQueryList.ElementAt(index);
                    const query = el[0];
                    const field = el[1];

                    this.logger.infoVerbose(RUN_RESOURCES.executingQuery, task.sObjectName, query.substr(0, SfdmModels.CONSTANTS.IN_RECORDS_QUERY_DISPLAY_LENGTH) + "...");

                    try {
                        this.logger.infoVerbose(COMMON_RESOURCES.usingCollectionApi);
                        let records = await SfdxUtils.queryAsync(query, this.sourceOrg);
                        if (!rec.has(field))
                            rec.set(field, new Array<object>());

                        rec.set(field, rec.get(field).concat(records.ToArray()));
                    } catch (e) {
                        throw new SfdmModels.CommandExecutionError(this.logger.getResourceString(RUN_RESOURCES.queryError, e));
                    }
                }
                let groupedRecs = SfdxUtils.recordsMapToRecordsArray(rec, "Id");
                task.sourceRecordSet.set(SfdmModels.Enums.RECORDS_SET.Main, new List<object>(groupedRecs));

                this.logger.infoNormal(RUN_RESOURCES.queryingFinished, task.sObjectName, "source", String(task.sourceRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main).Count()));

            }


            // Query target records
            if (task.scriptObject.processAllRecordsTarget || this.sourceOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.File) {

                // Get all records as in original query from the script including additional referenced fields
                let tempQuery = task.createQuery();

                // Get the Target records
                if (task.scriptObject.operation != SfdmModels.Enums.OPERATION.Insert && this.targetOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.Org && !this.script.importCSVFilesAsIs) {

                    if (this.logger.uxLoggerVerbosity != LOG_MESSAGE_VERBOSITY.VERBOSE) {
                        this.logger.infoMinimal(RUN_RESOURCES.queryingAll, task.sObjectName, "target");
                    } else {
                        this.logger.infoVerbose(RUN_RESOURCES.queryingAllQueryString, task.sObjectName, "target", tempQuery);
                    }

                    try {
                        if (task.useQueryBulkApiForTargetRecords) {
                            this.logger.infoVerbose(COMMON_RESOURCES.usingQueryBulkApi);
                        } else {
                            this.logger.infoVerbose(COMMON_RESOURCES.usingCollectionApi);
                        }
                        task.targetRecordSet.set(SfdmModels.Enums.RECORDS_SET.Main,
                            await SfdxUtils.queryAsync(tempQuery,
                                this.targetOrg,
                                false,
                                null,
                                task.useQueryBulkApiForTargetRecords));
                    } catch (e) {
                        throw new SfdmModels.CommandExecutionError(this.logger.getResourceString(RUN_RESOURCES.queryError, e));
                    }

                    this.logger.infoNormal(RUN_RESOURCES.queryingFinished, task.sObjectName, "target", String(task.targetRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main).Count()));

                } else {
                    task.targetRecordSet.set(SfdmModels.Enums.RECORDS_SET.Main, new List<object>());
                }

            } else {

                // Get the Target records
                if (task.scriptObject.operation != SfdmModels.Enums.OPERATION.Insert && !this.script.importCSVFilesAsIs) {

                    this.logger.infoNormal(RUN_RESOURCES.queryingIn, task.sObjectName, "target");

                    let tempQueryList = task.createListOfLimitedQueries(false);
                    let rec: Map<string, Array<object>> = new Map<string, Array<object>>();

                    for (let index = 0, count = tempQueryList.Count(); index < count; index++) {
                        const el = tempQueryList.ElementAt(index);
                        const query = el[0];
                        const field = el[1];

                        this.logger.infoVerbose(RUN_RESOURCES.executingQuery, task.sObjectName, query.substr(0, SfdmModels.CONSTANTS.IN_RECORDS_QUERY_DISPLAY_LENGTH) + "...");

                        try {
                            this.logger.infoVerbose(COMMON_RESOURCES.usingCollectionApi);
                            let records = await SfdxUtils.queryAsync(query, this.targetOrg);
                            if (!rec.has(field))
                                rec.set(field, new Array<object>());

                            rec.set(field, rec.get(field).concat(records.ToArray()));
                        } catch (e) {
                            throw new SfdmModels.CommandExecutionError(this.logger.getResourceString(RUN_RESOURCES.queryError, e));
                        }
                    }
                    let groupedRecs = SfdxUtils.recordsMapToRecordsArray(rec, "Id");
                    task.targetRecordSet.set(SfdmModels.Enums.RECORDS_SET.Main, new List<object>(groupedRecs));

                    this.logger.infoNormal(RUN_RESOURCES.queryingFinished, task.sObjectName, "target", String(task.targetRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main).Count()));

                } else {
                    task.targetRecordSet.set(SfdmModels.Enums.RECORDS_SET.Main, new List<object>());
                }


            }

        }

        this.logger.infoVerbose(RUN_RESOURCES.retrievingDataCompleted, `(${this.logger.getResourceString(RUN_RESOURCES.Step1)})`);







        // Step 2 PASS 2 **************************
        this.logger.infoMinimal(RUN_RESOURCES.newLine);
        this.logger.headerMinimal(RUN_RESOURCES.retrievingData, `(${this.logger.getResourceString(RUN_RESOURCES.Step2)})`);
        
        let _this = this;

        async function _retrieveTaskRecords2(task: SfdmModels.Task, addSelfReferencedRecords: boolean) : Promise<void> {

            // Adds source self references ****************
            async function addSelfReferencedRecordsAsync(): Promise<void> {

                let forwardsReferencedTaskFields = task.taskFields
                    .Where(x => x.externalIdTaskField && !x.externalIdTaskField.isParentTaskBefore)
                    .Select(x => x.externalIdTaskField);

                if (forwardsReferencedTaskFields.Count() > 0) {

                    let targetExtIdMap = task.targetRecordSet.get(SfdmModels.Enums.RECORDS_SET.ExtIdMap).ElementAt(0);
                    let queriedRecords = task.sourceRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main);

                    for (let i = 0; i < forwardsReferencedTaskFields.Count(); i++) {
                        let field = forwardsReferencedTaskFields.ElementAt(i);
                        if (field.parentTaskField.task.sObjectName != task.sObjectName) continue;
                        let values: Array<string> = new Array<string>();
                        queriedRecords.ForEach(record => {
                            if (record[field.name])
                                values = values.concat(record[field.name]);
                        });
                        if (values.length > 0) {
                            let queries = SfdxUtils.createFieldInQueries(["Id", field.parentTaskField.name], field.parentTaskField.name, task.sObjectName, values);
                            let recordsMap = await SfdxUtils.queryManyAsync(queries, field.parentTaskField.name, _this.targetOrg, true);
                            [...recordsMap.keys()].forEach(key => {
                                targetExtIdMap[key] = recordsMap.get(key)["Id"];
                            });
                        }
                    }
                }
            }


            // Query records backwards
            if (!task.scriptObject.processAllRecords && _this.sourceOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.Org) {

                // Get records including additional referenced fields with limiting by the parent object forwards
                // Get the Source records               
                let tempQueryList = task.createListOfLimitedQueries(true, false);


                if (tempQueryList.Count() > 0) {

                    _this.logger.infoNormal(RUN_RESOURCES.queryingIn, task.sObjectName, "source");

                    let rec: Map<string, Array<object>> = new Map<string, Array<object>>();
                    let totalRecords = 0;

                    rec.set('_old', task.sourceRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main).ToArray());

                    for (let index = 0, count = tempQueryList.Count(); index < count; index++) {
                        const el = tempQueryList.ElementAt(index);
                        const query = el[0];
                        const field = el[1];

                        _this.logger.infoVerbose(RUN_RESOURCES.executingQuery, task.sObjectName, query.substr(0, SfdmModels.CONSTANTS.IN_RECORDS_QUERY_DISPLAY_LENGTH) + "...");

                        try {
                            _this.logger.infoVerbose(COMMON_RESOURCES.usingCollectionApi);
                            let records = await SfdxUtils.queryAsync(query, _this.sourceOrg);
                            if (!rec.has(field))
                                rec.set(field, new Array<object>());

                            rec.set(field, rec.get(field).concat(records.ToArray()));
                            totalRecords += records.Count();
                        } catch (e) {
                            throw new SfdmModels.CommandExecutionError(_this.logger.getResourceString(RUN_RESOURCES.queryError, e));
                        }
                    }

                    _this.logger.infoNormal(RUN_RESOURCES.queryingFinished, task.sObjectName, "source", String(totalRecords));

                    if (totalRecords > 0) {
                        let groupedRecs = SfdxUtils.recordsMapToRecordsArray(rec, "Id");
                        task.sourceRecordSet.set(SfdmModels.Enums.RECORDS_SET.Main, new List<object>(groupedRecs));
                    }
                }

                // Get the Target records
                if (task.scriptObject.operation != SfdmModels.Enums.OPERATION.Insert) {

                    tempQueryList = task.createListOfLimitedQueries(false, false);

                    if (tempQueryList.Count() > 0) {

                        _this.logger.infoNormal(RUN_RESOURCES.queryingIn, task.sObjectName, "target");

                        let rec: Map<string, Array<object>> = new Map<string, Array<object>>();
                        let totalRecords = 0;

                        rec.set('_old', task.targetRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main).ToArray());

                        for (let index = 0, count = tempQueryList.Count(); index < count; index++) {
                            const el = tempQueryList.ElementAt(index);
                            const query = el[0];
                            const field = el[1];

                            _this.logger.infoVerbose(RUN_RESOURCES.executingQuery, task.sObjectName, query.substr(0, SfdmModels.CONSTANTS.IN_RECORDS_QUERY_DISPLAY_LENGTH) + "...");

                            try {
                                _this.logger.infoVerbose(COMMON_RESOURCES.usingCollectionApi);
                                let records = await SfdxUtils.queryAsync(query, _this.targetOrg);
                                if (!rec.has(field))
                                    rec.set(field, new Array<object>());

                                rec.set(field, rec.get(field).concat(records.ToArray()));
                                totalRecords += records.Count();
                            } catch (e) {
                                throw new SfdmModels.CommandExecutionError("Query error: " + e + ".");
                            }
                        }

                        _this.logger.infoNormal(RUN_RESOURCES.queryingFinished, task.sObjectName, "target", String(totalRecords));

                        if (totalRecords > 0) {
                            let groupedRecs = SfdxUtils.recordsMapToRecordsArray(rec, "Id");
                            task.targetRecordSet.set(SfdmModels.Enums.RECORDS_SET.Main, new List<object>(groupedRecs));
                        }
                    }
                }
            }

            // Build target map
            let queriedRecords = task.targetRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main);
            let targetExtIdMap = task.targetRecordSet.get(SfdmModels.Enums.RECORDS_SET.ExtIdMap).ElementAt(0);

            // Add additional mapping values for self-reference field
            if (_this.targetOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.Org && addSelfReferencedRecords) {
                await addSelfReferencedRecordsAsync();
            }

            queriedRecords.ForEach(record => {
                if (task.sObjectName == "RecordType")
                    targetExtIdMap[record["SobjectType"] + ";" + record[task.scriptObject.externalId]] = record["Id"];
                else
                    targetExtIdMap[record[task.scriptObject.externalId]] = record["Id"];
            });
        }


        for (let i = this.job.tasks.Count() - 1; i >= 0; i--) {

            let task = this.job.tasks.ElementAt(i);
            

            if (task.scriptObject.operation == SfdmModels.Enums.OPERATION.Delete) continue;
            
            await _retrieveTaskRecords2(task, true);

        }


        for (let i = 0; i < this.job.tasks.Count(); i++) {

            let task = this.job.tasks.ElementAt(i);
            
            if (task.scriptObject.operation == SfdmModels.Enums.OPERATION.Delete) continue;
            
            await _retrieveTaskRecords2(task, false);

        }

        this.logger.infoVerbose(RUN_RESOURCES.retrievingDataCompleted, `(${this.logger.getResourceString(RUN_RESOURCES.Step2)})`);






        // ---------------------------------
        // ---------------------------------
        // ---------------------------------
        // ---------------------------------
        // 4 step. Update target records - forward order
        this.logger.infoMinimal(RUN_RESOURCES.newLine);
        this.logger.headerMinimal(RUN_RESOURCES.updatingTarget, `(${this.logger.getResourceString(RUN_RESOURCES.Step1)})`);


        // Init missing parent records error file **************
        let missingParentRecordsErrorsFilePath = path.join(this.sourceOrg.basePath, SfdmModels.CONSTANTS.MISSING_PARENT_RECORDS_ERRORS_FILE_NAME);
        csvDataFilesToSave.add(missingParentRecordsErrorsFilePath);
        interface IMissingParentRecordsErrorRow {
            "Child record Id": string,
            "Child sObject": string,
            "Child external Id field": string,
            "Parent sObject": string,
            "Parent external Id field": string,
            "Missing external Id value": string
        };
        csvDataCacheMap.set(missingParentRecordsErrorsFilePath, new Map<string, IMissingParentRecordsErrorRow>());


        for (let i = 0; i < this.job.tasks.Count(); i++) {

            let task = this.job.tasks.ElementAt(i);

            if ((task.scriptObject.operation == SfdmModels.Enums.OPERATION.Readonly
                || task.scriptObject.operation == SfdmModels.Enums.OPERATION.Delete)
                && this.targetOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.Org) continue;

            let strOper = task.scriptObject.strOperation;


            let sourceRecords = task.sourceRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main).DistinctBy(x => x["Id"]);
            task.sourceRecordSet.set(SfdmModels.Enums.RECORDS_SET.Main, sourceRecords);

            let targetRecords = task.targetRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main).DistinctBy(x => x["Id"]);
            task.targetRecordSet.set(SfdmModels.Enums.RECORDS_SET.Main, targetRecords);

            let targetExtIdMap = task.targetRecordSet.get(SfdmModels.Enums.RECORDS_SET.ExtIdMap).ElementAt(0);

            let referencedFields = task.taskFields.Where(x => x.isReference).Select(x => x.name);

            if (this.targetOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.File) {
                // WRITE to FILE
                let objectNameToWrite = task.sObjectName;
                if (objectNameToWrite == "Group") {
                    objectNameToWrite = SfdmModels.CONSTANTS.USER_AND_GROUP_FILE_NAME;
                } else if (objectNameToWrite == "User") {
                    if (this.job.tasks.Any(x => x.sObjectName == "Group")) {
                        continue;
                    } else {
                        objectNameToWrite = SfdmModels.CONSTANTS.USER_AND_GROUP_FILE_NAME;
                    }
                }
                this.logger.infoMinimal(RUN_RESOURCES.writingToFile, task.sObjectName, objectNameToWrite);

                // Data mocking
                let sourceRecordsArray = sourceRecords.ToArray();
                if (task.scriptObject.mockCSVData) {
                    sourceRecordsArray = [...SfdxUtils.mockRecords(task.scriptObject, task, sourceRecords).keys()];
                }

                await SfdxUtils.writeObjectRecordsToCsvFileAsync(objectNameToWrite,
                    sourceRecordsArray,
                    this.targetOrg.basePath,
                    this.script.encryptDataFiles ? this.password : null);

                this.logger.infoVerbose(RUN_RESOURCES.writingToFileCompleted, task.sObjectName, objectNameToWrite);
                continue;
            }



            this.logger.infoMinimal(RUN_RESOURCES.updatingTargetObject, task.sObjectName, strOper);

            if (referencedFields.Count() == 0 || this.script.importCSVFilesAsIs) {

                // Fields without reference or csv file as is
                let updatedRecords: List<Object>;
                try {
                    // Update target records                    
                    updatedRecords = await SfdxUtils.processTaskDataAsync(task,
                        sourceRecords,
                        targetRecords,
                        this.targetOrg,
                        task.scriptObject.operation,
                        undefined, (status: ApiCalloutStatus) => {

                            switch (status.verbosity) {

                                case LOG_MESSAGE_VERBOSITY.MINIMAL:
                                    _app.logger.infoMinimal(status.message);
                                    break;

                                case LOG_MESSAGE_VERBOSITY.VERBOSE:
                                    _app.logger.infoVerbose(status.message);
                                    break;

                                default:
                                    _app.logger.infoNormal(status.message);
                                    break;
                            }
                        });
                } catch (e) {
                    await _saveCachedCsvDataFiles();
                    if (!this.script.promptOnUpdateError) {
                        throw new SfdmModels.CommandExecutionError(e.error);
                    }
                    else {
                        this.logger.warn(e.error);
                        if (!await this.logger.yesNoPromptAsync(RUN_RESOURCES.continueTheJobPrompt)) {
                            throw new SfdmModels.CommandAbortedByUserError(e.error);
                        }
                    }

                }

                // Build records External id map for the target
                let targetRecIds: List<string> = new List<string>();

                updatedRecords.ForEach(record => {
                    targetExtIdMap[record[task.scriptObject.externalId + "_source"] || record[task.scriptObject.externalId]] = record["Id"];
                    targetRecIds.Add(record["Id"]);
                });


                targetRecords = targetRecords.RemoveAll(x => targetRecIds.IndexOf(x["Id"]) >= 0);
                targetRecords.AddRange(updatedRecords.ToArray());
                task.targetRecordSet.set(SfdmModels.Enums.RECORDS_SET.Main, targetRecords);

                this.logger.infoVerbose(RUN_RESOURCES.updatingTargetObjectCompleted, task.sObjectName, strOper, String(updatedRecords.Count()));

                continue;

            } else {
                // Referenced fields

                let backwardsReferencedTaskFields = task.taskFields.Where(x => x.isParentTaskBefore);
                let fieldNamesToOmit = task.taskFields.Where(x =>
                    !(!x.isReference || x.externalIdTaskField && x.externalIdTaskField.isParentTaskBefore)
                ).Select(x => x.name);

                let missingParentValueOnTagetErrors = new Map<string, number>();

                for (let i = 0, count = backwardsReferencedTaskFields.Count(); i < count; i++) {
                    let taskField = backwardsReferencedTaskFields.ElementAt(i);
                    let fieldToUpdate = taskField.originalScriptField.name;
                    let targetExtIdMap = taskField.parentTaskField.task.targetRecordSet.get(SfdmModels.Enums.RECORDS_SET.ExtIdMap).ElementAt(0);
                    let isRecordTypeField = taskField.parentTaskField.task.sObjectName == "RecordType";
                    let nullValue = null;
                    if (isRecordTypeField) {
                        nullValue = targetExtIdMap[Object.keys(targetExtIdMap).filter(key => key.startsWith(task.sObjectName))[0]];
                    }
                    sourceRecords.ForEach(record => {
                        if (record.hasOwnProperty(taskField.name) && !record[taskField.name]) {
                            record[fieldToUpdate] = nullValue;
                        } else {
                            var value = !isRecordTypeField ? targetExtIdMap[record[taskField.name]] : targetExtIdMap[task.sObjectName + ";" + record[taskField.name]];
                            if (!value) {
                                if (task.sObjectName != "Contact" || !this.sourceOrg.isPersonAccountEnabled || !record["IsPersonAccount"]) {
                                    let m: Map<string, IMissingParentRecordsErrorRow> = csvDataCacheMap.get(missingParentRecordsErrorsFilePath);
                                    m.set(record["Id"], {
                                        "Child record Id": record["Id"],
                                        "Child sObject": task.sObjectName,
                                        "Child external Id field": taskField.name,
                                        "Parent external Id field": taskField.originalScriptField.externalId,
                                        "Parent sObject": taskField.parentTaskField.task.sObjectName,
                                        "Missing external Id value": record.hasOwnProperty(taskField.name)
                                            ? record[taskField.name]
                                            : this.logger.getResourceString(RUN_RESOURCES.fieldIsMissingInTheSourceRecords, taskField.name)
                                    });
                                    missingParentValueOnTagetErrors.set(taskField.name, (missingParentValueOnTagetErrors.get(taskField.name) || 0) + 1);
                                }
                                delete record[fieldToUpdate];
                            }
                            else {
                                record[fieldToUpdate] = value;
                            }
                        }
                    });
                }

                // Prompt to stop the entire job
                if (missingParentValueOnTagetErrors.size > 0) {

                    [...missingParentValueOnTagetErrors.keys()].forEach(key => {
                        _app.logger.warn(RUN_RESOURCES.missingParentLookupRecord, task.sObjectName, key, String(missingParentValueOnTagetErrors.get(key)), String(sourceRecords.Count()));
                    });
                    this.logger.warn(RUN_RESOURCES.seeFileForTheDetails, SfdmModels.CONSTANTS.MISSING_PARENT_RECORDS_ERRORS_FILE_NAME);

                    if (this.script.promptOnMissingParentObjects) {
                        if (!await this.logger.yesNoPromptAsync(RUN_RESOURCES.continueTheJobPrompt)) {
                            await _saveCachedCsvDataFiles();
                            throw new SfdmModels.CommandAbortedByUserError(this.logger.getResourceString(RUN_RESOURCES.missingParentLookupRecord));
                        }
                    }

                }

                let updatedRecords: List<Object>;
                try {
                    // Update target records                      
                    updatedRecords = await SfdxUtils.processTaskDataAsync(task,
                        sourceRecords,
                        targetRecords,
                        this.targetOrg,
                        task.scriptObject.operation,
                        fieldNamesToOmit.ToArray(), (status: ApiCalloutStatus) => {

                            switch (status.verbosity) {

                                case LOG_MESSAGE_VERBOSITY.MINIMAL:
                                    _app.logger.infoMinimal(status.message);
                                    break;

                                case LOG_MESSAGE_VERBOSITY.VERBOSE:
                                    _app.logger.infoVerbose(status.message);
                                    break;

                                default:
                                    _app.logger.infoNormal(status.message);
                                    break;
                            }
                        });
                } catch (e) {
                    await _saveCachedCsvDataFiles();
                    if (!this.script.promptOnUpdateError) {
                        throw new SfdmModels.CommandExecutionError(e.error);
                    }
                    else {
                        this.logger.warn(e.error);
                        if (!await this.logger.yesNoPromptAsync(RUN_RESOURCES.continueTheJobPrompt)) {
                            throw new SfdmModels.CommandAbortedByUserError(e.error);
                        }
                    }

                }

                // Build records External id map for the target
                let targetRecIds: List<string> = new List<string>();
                let updatedRecordsMap: Map<string, object> = new Map<string, object>();

                updatedRecords.ForEach(record => {
                    targetExtIdMap[record[task.scriptObject.externalId + "_source"] || record[task.scriptObject.externalId]] = record["Id"];
                    targetRecIds.Add(record["Id"]);
                    updatedRecordsMap.set(record["Id"], record);
                });

                targetRecords.Where(x => targetRecIds.IndexOf(x["Id"]) >= 0).ForEach(record => {
                    var updatedRecord = updatedRecordsMap.get(record["Id"]);
                    updatedRecords.Remove(updatedRecord);
                    Object.keys(record).forEach(key => {
                        let val = updatedRecord[key];
                        if (!fieldNamesToOmit.Contains(key)) {
                            record[key] = val;
                        }
                    });
                });

                targetRecords.AddRange(updatedRecords.ToArray());

                this.logger.infoVerbose(RUN_RESOURCES.updatingTargetObjectCompleted, task.sObjectName, strOper, String(updatedRecords.Count()));

            }
        }
        this.logger.infoVerbose(RUN_RESOURCES.updatingTargetCompleted, `(${this.logger.getResourceString(RUN_RESOURCES.Step1)})`);







        // ---------------------------------
        // ---------------------------------
        // ---------------------------------
        // ---------------------------------
        // 5 step. Update target records - backward order
        this.logger.infoMinimal(RUN_RESOURCES.newLine);
        this.logger.headerMinimal(RUN_RESOURCES.updatingTarget, `(${this.logger.getResourceString(RUN_RESOURCES.Step2)})`);

        if (this.targetOrg.mediaType == SfdmModels.Enums.DATA_MEDIA_TYPE.Org) {
            for (let i = 0; i < this.job.tasks.Count(); i++) {

                let task = this.job.tasks.ElementAt(i);

                if (task.scriptObject.operation == SfdmModels.Enums.OPERATION.Readonly
                    || task.scriptObject.operation == SfdmModels.Enums.OPERATION.Delete) continue;


                let forwardsReferencedTaskFields = task.taskFields
                    .Where(x => x.externalIdTaskField && !x.externalIdTaskField.isParentTaskBefore)
                    .Select(x => x.externalIdTaskField);

                if (forwardsReferencedTaskFields.Count() > 0) {

                    let fieldNamesToOmit = task.taskFields.Where(x =>
                        !(x.externalIdTaskField && !x.externalIdTaskField.isParentTaskBefore) && x.name != "Id"
                    ).Select(x => x.name);

                    this.logger.infoMinimal(RUN_RESOURCES.updatingTargetObject, task.sObjectName, "Update");

                    let sourceRecords = task.sourceRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main);
                    let targetRecords = task.targetRecordSet.get(SfdmModels.Enums.RECORDS_SET.Main);

                    let missingParentValueOnTagetErrors = new Map<string, number>();

                    for (let i = 0, count = forwardsReferencedTaskFields.Count(); i < count; i++) {
                        let taskField = forwardsReferencedTaskFields.ElementAt(i);
                        let fieldToUpdate = taskField.originalScriptField.name;
                        let targetExtIdMap = taskField.parentTaskField.task.targetRecordSet.get(SfdmModels.Enums.RECORDS_SET.ExtIdMap).ElementAt(0);
                        let nullValue = null;
                        sourceRecords.ForEach(record => {
                            if (record.hasOwnProperty(taskField.name) && !record[taskField.name]) {
                                record[fieldToUpdate] = nullValue;
                            } else {
                                var value = targetExtIdMap[record[taskField.name]];
                                if (!value) {
                                    if (task.sObjectName != "Contact" || !this.sourceOrg.isPersonAccountEnabled || !record["IsPersonAccount"]) {
                                        let m: Map<string, IMissingParentRecordsErrorRow> = csvDataCacheMap.get(missingParentRecordsErrorsFilePath);
                                        m.set(record["Id"], {
                                            "Child record Id": record["Id"],
                                            "Child sObject": task.sObjectName,
                                            "Child external Id field": taskField.name,
                                            "Parent external Id field": taskField.originalScriptField.externalId,
                                            "Parent sObject": taskField.parentTaskField.task.sObjectName,
                                            "Missing external Id value": record.hasOwnProperty(taskField.name)
                                                ? record[taskField.name]
                                                : this.logger.getResourceString(RUN_RESOURCES.fieldIsMissingInTheSourceRecords, taskField.name)
                                        });
                                        missingParentValueOnTagetErrors.set(taskField.name, (missingParentValueOnTagetErrors.get(taskField.name) || 0) + 1);
                                    }
                                    delete record[fieldToUpdate];
                                }
                                else {
                                    record[fieldToUpdate] = value;
                                }
                            }
                        });
                    }

                    // Prompt to stop the entire job
                    if (missingParentValueOnTagetErrors.size > 0) {
                        [...missingParentValueOnTagetErrors.keys()].forEach(key => {
                            _app.logger.warn(RUN_RESOURCES.missingParentLookupRecord, task.sObjectName, key, String(missingParentValueOnTagetErrors.get(key)), String(sourceRecords.Count()));
                        });
                        this.logger.warn(RUN_RESOURCES.seeFileForTheDetails, SfdmModels.CONSTANTS.MISSING_PARENT_RECORDS_ERRORS_FILE_NAME);

                        if (this.script.promptOnMissingParentObjects) {
                            if (!await this.logger.yesNoPromptAsync(RUN_RESOURCES.continueTheJobPrompt)) {
                                await _saveCachedCsvDataFiles();
                                throw new SfdmModels.CommandAbortedByUserError(this.logger.getResourceString(RUN_RESOURCES.missingParentLookupRecord));
                            }
                        }
                    }

                    let updatedRecords: List<Object>;
                    try {
                        // Update target records                      
                        updatedRecords = await SfdxUtils.processTaskDataAsync(task,
                            sourceRecords,
                            targetRecords,
                            this.targetOrg,
                            SfdmModels.Enums.OPERATION.Update,
                            fieldNamesToOmit.ToArray(), (status: ApiCalloutStatus) => {

                                switch (status.verbosity) {

                                    case LOG_MESSAGE_VERBOSITY.MINIMAL:
                                        _app.logger.infoMinimal(status.message);
                                        break;

                                    case LOG_MESSAGE_VERBOSITY.VERBOSE:
                                        _app.logger.infoVerbose(status.message);
                                        break;

                                    default:
                                        _app.logger.infoNormal(status.message);
                                        break;
                                }
                            });
                    } catch (e) {
                        await _saveCachedCsvDataFiles();
                        if (!this.script.promptOnUpdateError) {
                            throw new SfdmModels.CommandExecutionError(e.error);
                        }
                        else {
                            this.logger.warn(e.error);
                            if (!await this.logger.yesNoPromptAsync(RUN_RESOURCES.continueTheJobPrompt)) {
                                throw new SfdmModels.CommandAbortedByUserError(e.error);
                            }
                        }

                    }

                    this.logger.infoVerbose(RUN_RESOURCES.updatingTargetObjectCompleted, task.sObjectName, "Update", String(updatedRecords.Count()));
                }

            }
        }

        this.logger.infoVerbose(RUN_RESOURCES.updatingTargetCompleted, `(${this.logger.getResourceString(RUN_RESOURCES.Step2)})`);



        this.logger.infoMinimal(RUN_RESOURCES.newLine);
        this.logger.headerMinimal(RUN_RESOURCES.finalizing);
        await _saveCachedCsvDataFiles();
    }
}












