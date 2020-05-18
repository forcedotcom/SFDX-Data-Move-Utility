/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import "reflect-metadata";
import "es6-shim";
import { Type } from "class-transformer";
import { Common } from "../../components/common_components/common";
import { DATA_MEDIA_TYPE, OPERATION, CONSTANTS } from "../../components/common_components/statics";
import { Logger, RESOURCES } from "../../components/common_components/logger";
import {
    parseQuery,
    composeQuery,
    OrderByClause,
    getComposedField
} from 'soql-parser-js';
import { ScriptOrg, ScriptObject } from "..";
import { CommandInitializationError } from "../common_models/errors";
import MigrationJob from "../job_models/migrationJob";




/**
 * The script object which is parsed from the script file
 *
 * @export
 * @class Script
 */
export default class Script {

    // ------------- JSON --------------
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
    promptOnIssuesInCSVFiles: boolean = true;
    validateCSVFilesOnly: boolean = false;
    apiVersion: string = CONSTANTS.DEFAULT_API_VERSION;
    createTargetCSVFiles: boolean = true;
    importCSVFilesAsIs = false;
    alwaysUseRestApiToUpdateRecords: false;
    excludeIdsFromCSVFiles: boolean =  false;


    // -----------------------------------
    logger: Logger;
    sourceOrg: ScriptOrg;
    targetOrg: ScriptOrg;
    basePath: string = "";
    objectsMap: Map<string, ScriptObject> = new Map<string, ScriptObject>();
    job: MigrationJob;

    get isPersonAccountEnabled(): boolean {
        return this.sourceOrg.isPersonAccountEnabled || this.targetOrg.isPersonAccountEnabled;
    }

    get bulkApiVersionNumber(): number {
        return +(this.bulkApiVersion || '1.0');
    }


    // ----------------------- Public methods -------------------------------------------    
    /**
     * Setup this object
     *
     * @param {Logger} logger
     * @param {string} sourceUsername
     * @param {string} targetUsername
     * @param {string} basePath
     * @param {string} apiVersion
     * @returns {Promise<void>}
     * @memberof Script
     */
    async setupAsync(logger: Logger, sourceUsername: string, targetUsername: string, basePath: string, apiVersion: string): Promise<void> {

        // Initialize script
        this.logger = logger;
        this.basePath = basePath;
        this.sourceOrg = this.orgs.filter(x => x.name == sourceUsername)[0] || new ScriptOrg();
        this.targetOrg = this.orgs.filter(x => x.name == targetUsername)[0] || new ScriptOrg();
        this.apiVersion = apiVersion || this.apiVersion;

        if (sourceUsername.toLowerCase() == targetUsername.toLowerCase()) {
            throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.sourceTargetCouldNotBeTheSame));
        }

        // Remove excluded objects and unsupported objects
        this.objects = this.objects.filter(object => {
            let included = (!object.excluded || object.operation == OPERATION.Readonly)
                && CONSTANTS.NOT_SUPPORTED_OBJECTS.indexOf(object.name) < 0;
            if (!included) {
                this.logger.infoVerbose(RESOURCES.objectWillBeExcluded, object.name);
            }
            return included;
        });

        // Check objects length
        if (this.objects.length == 0) {
            throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.noObjectsDefinedInPackageFile));
        }

        // Make each object appear only once in the script
        this.objects = Common.distinctArray(this.objects, "name");

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
        this.objects.forEach(object => {
            object.setup(this);
        });
    }

    /**
     * Retrieve and analyse the metadata of all objects in the script
     *
     * @returns {Promise<void>}
     * @memberof Script
     */
    async processObjectsMetadataAsync(): Promise<void> {

        this.logger.infoMinimal(RESOURCES.newLine);
        this.logger.headerMinimal(RESOURCES.gettingOrgMetadata);

        // Describe all objects
        for (let objectIndex = 0; objectIndex < this.objects.length; objectIndex++) {

            const thisObject = this.objects[objectIndex];
            this.logger.infoVerbose(RESOURCES.processingSObject, thisObject.name);

            await thisObject.describeAsync();
        }

        // Add parent related ScriptObjects and link between related objects
        for (let objectIndex = this.objects.length - 1; objectIndex >= 0; objectIndex--) {

            const thisObject = this.objects[objectIndex];
            this.logger.infoVerbose(RESOURCES.processingSObject, thisObject.name);

            for (let fieldIndex = 0; fieldIndex < thisObject.fieldsToUpdate.length; fieldIndex++) {

                const thisField = thisObject.fieldsToUpdateMap.get(thisObject.fieldsToUpdate[fieldIndex]);

                // Group + User => User
                const referencedObjectType = thisField.referencedObjectType == "Group" ? "User" : thisField.referencedObjectType;

                if (thisField.lookup) {

                    // Search for the parent ScriptObject
                    thisField.parentLookupObject = this.objects.filter(x => x.name == referencedObjectType)[0];

                    if (!thisField.parentLookupObject) {

                        // Add parent ScriptObject as READONLY since it is missing in the script
                        thisField.parentLookupObject = new ScriptObject();
                        this.objects.push(thisField.parentLookupObject);
                        let externalId = referencedObjectType != CONSTANTS.RECORD_TYPE_SOBJECT_NAME ? CONSTANTS.DEFAULT_EXTERNAL_ID_FIELD_NAME : CONSTANTS.DEFAULT_RECORD_TYPE_ID_EXTERNAL_ID_FIELD_NAME;
                        let allRecords = CONSTANTS.SPECIAL_OBJECTS.indexOf(referencedObjectType) >= 0;
                        Object.assign(thisField.parentLookupObject, <ScriptObject>{
                            name: referencedObjectType,
                            isExtraObject: true,
                            allRecords,
                            query: `SELECT Id, ${externalId} FROM ${referencedObjectType}`,
                            operation: OPERATION.Readonly,
                            externalId
                        });

                        if (referencedObjectType == CONSTANTS.RECORD_TYPE_SOBJECT_NAME) {
                            let objectsWithRecordTypeFields = this.objects.filter(x => x.hasRecordTypeIdField).map(x => x.name);
                            thisField.parentLookupObject.parsedQuery = parseQuery(thisField.parentLookupObject.query);
                            thisField.parentLookupObject.parsedQuery.fields.push(getComposedField("SobjectType"));
                            thisField.parentLookupObject.parsedQuery.where = Common.composeWhereClause(thisField.parentLookupObject.parsedQuery.where, "SobjectType", objectsWithRecordTypeFields);
                            thisField.parentLookupObject.parsedQuery.orderBy = <OrderByClause>({
                                field: "SobjectType",
                                order: "ASC"
                            });
                            thisField.parentLookupObject.query = composeQuery(thisField.parentLookupObject.parsedQuery);

                        }

                    }

                    // Setup and describe the parent ScriptObject
                    thisField.parentLookupObject.setup(this);
                    await thisField.parentLookupObject.describeAsync();

                    // Add __r fields to the child object query
                    let __rFieldName = thisField.fullName__r;
                    let __rOriginalFieldName = thisField.fullOriginalName__r;
                    thisObject.parsedQuery.fields.push(getComposedField(__rFieldName));
                    thisObject.parsedQuery.fields.push(getComposedField(__rOriginalFieldName));
                    thisObject.query = composeQuery(thisObject.parsedQuery);

                    // Linking between related fields and objects
                    let externalIdFieldName = Common.getComplexField(thisField.parentLookupObject.externalId);
                    let parentExternalIdField = thisField.parentLookupObject.fieldsInQueryMap.get(externalIdFieldName);

                    let __rSField = thisObject.fieldsInQueryMap.get(__rFieldName);
                    __rSField.objectName = thisObject.name;
                    __rSField.scriptObject = thisObject;
                    __rSField.custom = thisField.custom;
                    __rSField.parentLookupObject = thisField.parentLookupObject;
                    __rSField.lookup = true;

                    thisField.__rSField = __rSField;
                    __rSField.idSField = thisField;

                    parentExternalIdField.child__rSFields.push(__rSField);
                }
            }
        }

        // Remove duplicate fields
        this.objects.forEach(object => {
            object.parsedQuery.fields = Common.distinctArray(object.parsedQuery.fields, "field");
            object.query = composeQuery(object.parsedQuery);
        });

    }

    /**
     * Checks orgs consistency
     *
     * @memberof Script
     */
    verifyOrgs() {
        
        // ***** Verifying person accounts
        if (this.objects.filter(obj => obj.name == "Account" || obj.name == "Contact")) {
            // Verify target org
            if (this.sourceOrg.media == DATA_MEDIA_TYPE.Org && this.sourceOrg.isPersonAccountEnabled
                && this.targetOrg.media == DATA_MEDIA_TYPE.Org && !this.sourceOrg.isPersonAccountEnabled) {
                // Missing PA in Target
                throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.needBothOrgsToSupportPersonAccounts, 
                            this.logger.getResourceString(RESOURCES.source)));
            }
            // Verify source org
            if (this.sourceOrg.media == DATA_MEDIA_TYPE.Org && !this.sourceOrg.isPersonAccountEnabled
                && this.targetOrg.media == DATA_MEDIA_TYPE.Org && this.sourceOrg.isPersonAccountEnabled) {
                // Missing PA in Source
                throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.needBothOrgsToSupportPersonAccounts, 
                            this.logger.getResourceString(RESOURCES.target)));
            }
        }

    }
}

