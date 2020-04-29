/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import "reflect-metadata";
import "es6-shim";
import { Type } from "class-transformer";
import { Query } from 'soql-parser-js';
import { CommonUtils } from "../components/commonUtils";
import { DATA_MEDIA_TYPE, OPERATION, CONSTANTS } from "../components/statics";
import { MessageUtils, RESOURCES } from "../components/messages";
import { ApiSf } from "../components/apiSf";
var jsforce = require("jsforce");
import {
    parseQuery,
    composeQuery,
    OrderByClause,
    Field as SOQLField,
    getComposedField
} from 'soql-parser-js';
import { ScriptOrg, ScriptObject, CommandInitializationError } from ".";
import { fileURLToPath } from "url";



/**
 * The script object which is parsed from the script file
 *
 * @export
 * @class Script
 */
export default class Script {

    @Type(() => ScriptOrg)
    orgs: ScriptOrg[] = new Array<ScriptOrg>();

    @Type(() => ScriptObject)
    objects: ScriptObject[] = new Array<ScriptObject>();

    pollingIntervalMs: number = CONSTANTS.DEFAULT_POLLING_INTERVAL_MS;
    bulkThreshold: number = CONSTANTS.DEFAULT_BULK_API_THRESHOLD_RECORDS;
    bulkApiVersion: string = CONSTANTS.DEFAULT_BULK_API_VERSION;
    bulkApiV1BatchSize: number = CONSTANTS.DEFAULT_BULK_API_V1_BATCH_SIZE;
    allOrNone: boolean = false;
    promptOnUpdateError: boolean = true;
    promptOnMissingParentObjects: boolean = true;
    validateCSVFilesOnly: boolean = false;
    encryptDataFiles: boolean = false;
    apiVersion: string = CONSTANTS.DEFAULT_API_VERSION;
    createTargetCSVFiles: boolean = true;
    importCSVFilesAsIs = false;


    // -----------------------------------
    logger: MessageUtils;
    sourceOrg: ScriptOrg;
    targetOrg: ScriptOrg;
    basePath: string = "";
    objectsMap: Map<string, ScriptObject> = new Map<string, ScriptObject>();




    /**
     * Setup this object
     *
     * @param {MessageUtils} logger
     * @param {string} sourceUsername
     * @param {string} targetUsername
     * @param {string} basePath
     * @param {string} apiVersion
     * @returns {Promise<void>}
     * @memberof Script
     */
    async setupAsync(logger: MessageUtils, sourceUsername: string, targetUsername: string, basePath: string, apiVersion: string): Promise<void> {

        // Initialize script
        this.logger = logger;
        this.basePath = basePath;
        this.sourceOrg = this.orgs.filter(x => x.name == sourceUsername)[0] || new ScriptOrg();
        this.targetOrg = this.orgs.filter(x => x.name == targetUsername)[0] || new ScriptOrg();
        this.apiVersion = apiVersion || this.apiVersion;


        // Remove excluded objects
        this.objects = this.objects.filter(object => {
            let included = (!object.excluded || object.operation == OPERATION.Readonly);
            if (!included) {
                this.logger.infoVerbose(RESOURCES.objectWillBeExcluded, object.name);
            }
            return included;
        });

        // Check objects length
        if (this.objects.length == 0) {
            throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.noObjectsDefinedInPackageFile));
        }

        // Assign orgs
        Object.assign(this.sourceOrg, {
            script: this,
            name: sourceUsername,
            isSource: true,
            media: sourceUsername.toLowerCase() == "csvfile" ? DATA_MEDIA_TYPE.File : DATA_MEDIA_TYPE.Org
        });
        Object.assign(this.targetOrg, {
            script: this,
            name: targetUsername,
            media: targetUsername.toLowerCase() == "csvfile" ? DATA_MEDIA_TYPE.File : DATA_MEDIA_TYPE.Org
        });

        // Setup orgs
        await this.sourceOrg.setupAsync();
        await this.targetOrg.setupAsync();

        // Setup objects
        for (let index = 0; index < this.objects.length; index++) {
            const object = this.objects[index];
            object.setup(this);
        }

        // Remove unsupported objects
        this.objects = this.objects.filter(x => CONSTANTS.NOT_SUPPORTED_OBJECTS.indexOf(x.name) < 0);

        // Make each object appear only once in the script
        this.objects = CommonUtils.distinctArray(this.objects, "name");

        // Add extra objects
        // -- Add RecordType object  
        let objectsWithRecordTypeFields = this.objects.filter(x => x.hasRecordTypeIdField).map(x => x.name);
        if (objectsWithRecordTypeFields.length > 0) {
            let object = new ScriptObject();
            this.objects.push(object);
            Object.assign(object, <ScriptObject>{
                name: "RecordType",
                externalId: "DeveloperName",
                isExtraObject: true,
                allRecords: true,
                query: "SELECT Id FROM RecordType",
                operation: OPERATION.Readonly
            });

            object.setup(this);
            object.parsedQuery.where = CommonUtils.composeWhereClause(object.parsedQuery.where, "SobjectType", objectsWithRecordTypeFields);
            object.parsedQuery.orderBy = <OrderByClause>({
                field: "SobjectType",
                order: "ASC"
            });
            object.query = composeQuery(object.parsedQuery);
        }
    }



    /**
     * Retrieve description of all objects in the script
     *
     * @returns {Promise<void>}
     * @memberof Script
     */
    async describeSObjectsAsync(): Promise<void> {

        this.logger.infoMinimal(RESOURCES.gettingOrgMetadata);

        // Describe all objects
        for (let index = 0; index < this.objects.length; index++) {
            const object = this.objects[index];
            this.logger.infoVerbose(RESOURCES.processingSObject, object.name);
            await object.describeAsync();
        }

        // Add parent related ScriptObjects and link between related objects
        for (let index = 0; index < this.objects.length; index++) {
            const object = this.objects[index];
            this.logger.infoVerbose(RESOURCES.processingSObject, object.name);

            for (let index2 = 0; index2 < object.fieldsToUpdate.length; index2++) {
                const field = object.fieldsToUpdateDescriptionMap.get(object.fieldsToUpdate[index2]);
                if (field.isReference) {

                    // Search for the parent ScriptObject
                    field.parentScriptObject = this.objects.filter(x => x.name == field.referencedObjectType)[0];

                    if (!field.parentScriptObject) {
                        // Add parent ScriptObject as READONLY since it is missing in the script
                        field.parentScriptObject = new ScriptObject();
                        this.objects.push(field.parentScriptObject);
                        Object.assign(field.parentScriptObject, <ScriptObject>{
                            name: field.referencedObjectType,
                            isExtraObject: true,
                            allRecords: true,
                            query: `SELECT Id, ${CONSTANTS.DEFAULT_EXTERNAL_ID_FIELD_NAME} FROM ${field.referencedObjectType}`,
                            operation: OPERATION.Readonly
                        });
                    }

                    // Add __r fields to the child object query
                    let __rFieldName = field.name__r + '.' + field.parentScriptObject.externalId;
                    object.parsedQuery.fields.push(getComposedField(__rFieldName));
                    object.query = composeQuery(object.parsedQuery);

                    // Setup and describe the parent ScriptObject
                    field.parentScriptObject.setup(this);
                    await field.parentScriptObject.describeAsync();

                    // Linking between related fields and objects
                    let parentExternalIdField = field.parentScriptObject.fieldsInQueryDescriptionMap.get(field.parentScriptObject.externalId);
                    let __rSFieldDescribe = object.fieldsInQueryDescriptionMap.get(__rFieldName);
                    parentExternalIdField.externalIdChild__rFields.push(__rSFieldDescribe);
                    field.__rSFieldDescribe = __rSFieldDescribe;
                    __rSFieldDescribe.idSFieldDescribe = field;

                }
            }
        }

    }
}

