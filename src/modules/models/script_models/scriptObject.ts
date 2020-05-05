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
import { CommonUtils } from "../../components/common_components/commonUtils";
import { DATA_MEDIA_TYPE, OPERATION, CONSTANTS } from "../../components/common_components/statics";
import { MessageUtils, RESOURCES } from "../../components/common_components/messages";
import { Sfdx } from "../../components/common_components/sfdx";
var jsforce = require("jsforce");
import {
    parseQuery,
    composeQuery,
    OrderByClause,
    Field as SOQLField,
    getComposedField
} from 'soql-parser-js';
import { ScriptMockField, Script, SObjectDescribe,  ScriptOrg } from "..";
import SFieldDescribe from "./sfieldDescribe";
import { CommandInitializationError, OrgMetadataError } from "../common_models/errors";


/**
 * Parsed object from the script file 
 *
 * @export
 * @class ScriptObject
 */
export default class ScriptObject {

    // ------------- JSON --------------
    @Type(() => ScriptMockField)
    mockFields: ScriptMockField[] = new Array<ScriptMockField>();

    query: string = "";
    deleteQuery: string = "";
    operation: OPERATION = OPERATION.Readonly;
    externalId: string = CONSTANTS.DEFAULT_EXTERNAL_ID_FIELD_NAME;
    deleteOldData: boolean = false;
    updateWithMockData: boolean = false;
    mockCSVData: boolean = false;
    targetRecordsFilter: string = "";
    excluded: boolean = false;
    useCSVValuesMapping: boolean = false;
    allRecords: boolean = true;


    // -----------------------------------
    script: Script;
    name: string = "";
    sourceSObjectDescribe: SObjectDescribe;
    targetSObjectDescribe: SObjectDescribe;
    originalExternalId: string = "";
    parsedQuery: Query;
    parsedDeleteQuery: Query;
    isExtraObject: boolean = false;

    get externalIdSFieldDescribe(): SFieldDescribe {
        return this.isDescribed
            && this.sourceSObjectDescribe.fieldsMap.get(this.externalId);
    }

    get fieldsInQuery(): string[] {
        if (!this.parsedQuery) {
            return new Array<string>();
        }
        return this.parsedQuery.fields.map(x => (<SOQLField>x).field);
    }

    get fieldsInQueryMap(): Map<string, SFieldDescribe> {
        if (!this.isDescribed) {
            return new Map<string, SFieldDescribe>();
        }
        return CommonUtils.filterMapByArray(this.fieldsInQuery, this.sourceSObjectDescribe.fieldsMap, key => new SFieldDescribe({
            creatable: false,
            name: key,
            label: key,
            updateable: false,
            type: "dynamic"
        }), true);
    }

    get fieldsToUpdate(): string[] {
        if (!this.parsedQuery
            || !this.isDescribed
            || this.sourceSObjectDescribe.fieldsMap.size == 0
            || this.operation == OPERATION.Readonly) {
            return new Array<string>();
        }
        return this.parsedQuery.fields.map(x => {
            let name = (<SOQLField>x).field;
            let describe = this.sourceSObjectDescribe.fieldsMap.get(name)
                || this.targetSObjectDescribe && this.targetSObjectDescribe.fieldsMap && this.targetSObjectDescribe.fieldsMap.get(name);
            if (!describe || describe.isReadonly) {
                return null;
            }
            return (<SOQLField>x).field;
        }).filter(x => !!x);
    }

    get fieldsToUpdateMap(): Map<string, SFieldDescribe> {
        if (!this.sourceSObjectDescribe) {
            return new Map<string, SFieldDescribe>();
        }
        return CommonUtils.filterMapByArray(this.fieldsToUpdate, this.sourceSObjectDescribe.fieldsMap);
    }

    get hasRecordTypeIdField(): boolean {
        return this.fieldsInQuery.some(x => x == "RecordTypeId");
    }

    get strOperation(): string {
        return OPERATION[this.operation];
    }

    get isLimitedQuery(): boolean {
        return this.parsedQuery
            && (this.parsedQuery.limit > 0 || !!this.parsedQuery.where);
    }

    get isSpecialObject(): boolean {
        return CONSTANTS.SPECIAL_OBJECTS.indexOf(this.name) >= 0;
    }

    get isReadonlyObject(): boolean {
        return this.operation == OPERATION.Readonly || this.operation == OPERATION.Delete;
    }

    get hasComplexExternalId(): boolean {
        return CommonUtils.isComplexField(this.externalId);
    }

    get hasComplexrogiinalExternalId(): boolean {
        return CommonUtils.isComplexField(this.originalExternalId);
    }

    get isDescribed(): boolean {
        return !!this.sourceSObjectDescribe;
    }

    get isInitialized(): boolean {
        return !!this.script;
    }

    get parentLookupObjects(): ScriptObject[] {
        return CommonUtils.distinctArray([...this.fieldsInQueryMap.values()].map(x => {
            if (x.isReference) {
                return x.parentLookupObject;
            }
        }).filter(x => !!x), 'name');
    }

    get parentMasterDetailObjects(): ScriptObject[] {
        return CommonUtils.distinctArray([...this.fieldsInQueryMap.values()].map(x => {
            if (x.isMasterDetail) {
                return x.parentLookupObject;
            }
        }).filter(x => !!x), 'name');
    }

    get complexExternalId(): string {
        return CommonUtils.getComplexField(this.externalId);
    }

    get complexOriginalExternalId(): string {
        return CommonUtils.getComplexField(this.originalExternalId);
    }



    // ----------------------- Public methods -------------------------------------------    
    /**
     * Setup this object
     *
     * @param {Script} script
     * @memberof ScriptObject
     */
    setup(script: Script) {

        if (this.isInitialized) return;

        // Initialize object
        this.script = script;
        this.originalExternalId = this.externalId;

        // Fixes operation value
        if ((typeof this.operation == "string") == true) {
            this.operation = OPERATION[this.operation.toString()];
        }

        // Always set explicit externalId to 'Id' on Insert operation
        if (this.operation == OPERATION.Insert) {
            this.externalId = "Id";
        }

        // Parse query string
        try {
            this.parsedQuery = parseQuery(this.query);
            if (this.operation == OPERATION.Delete) {
                this.deleteOldData = true;
                this.parsedQuery.fields = [getComposedField("Id")];
            }
            // Add record Id field to the query
            if (!this.fieldsInQuery.some(x => x == "Id")) {
                this.parsedQuery.fields.push(getComposedField("Id"));
            }
            // Add external Id field to the query
            if (this.hasComplexExternalId) {
                this.parsedQuery.fields.push(getComposedField(this.complexExternalId));
            } else {
                this.parsedQuery.fields.push(getComposedField(this.externalId));
            }
            // Add original external id field to the query
            this.parsedQuery.fields.push(getComposedField(this.complexOriginalExternalId));
            // Make each field appear only once in the query
            this.parsedQuery.fields = CommonUtils.distinctArray(this.parsedQuery.fields, "field");
        } catch (ex) {
            throw new CommandInitializationError(this.script.logger.getResourceString(RESOURCES.MalformedQuery, this.name, this.query, ex));
        }

        // Update object
        this.query = composeQuery(this.parsedQuery);
        this.name = this.parsedQuery.sObject;
        this.script.objectsMap.set(this.name, this);

        // Parse delete query string
        if (this.deleteOldData) {
            try {
                if (this.deleteQuery) {
                    this.parsedDeleteQuery = parseQuery(this.deleteQuery);
                } else {
                    this.parsedDeleteQuery = parseQuery(this.query);
                }
                this.parsedDeleteQuery.fields = [getComposedField("Id")];
                if (this.script.sourceOrg.isPersonAccountEnabled && this.name == "Contact") {
                    this.parsedDeleteQuery.where = CommonUtils.composeWhereClause(this.parsedDeleteQuery.where, "IsPersonAccount", "false", "=", "BOOLEAN", "AND");
                }
                this.deleteQuery = composeQuery(this.parsedDeleteQuery);
            } catch (ex) {
                throw new CommandInitializationError(this.script.logger.getResourceString(RESOURCES.MalformedDeleteQuery, this.name, this.deleteQuery, ex));
            }
        }
    }

    /**
     * Retrieves the object descriptions from the source and from the target org
     *
     * @returns {Promise<void>}
     * @memberof ScriptObject
     */
    async describeAsync(): Promise<void> {

        if (this.isDescribed) return;

        // Describe object in the source org
        if (!this.isDescribed) {

            if (this.script.sourceOrg.media == DATA_MEDIA_TYPE.Org) {

                let apisf = new Sfdx(this.script.sourceOrg);
                this.script.logger.infoNormal(RESOURCES.gettingMetadataForSObject, this.name, this.script.logger.getResourceString(RESOURCES.source));
                try {
                    // Retrieve sobject metadata
                    this.sourceSObjectDescribe = await apisf.describeSObjectAsync(this.name);
                    [...this.sourceSObjectDescribe.fieldsMap.values()].forEach(x => x.scriptObject = this);

                    if (this.script.targetOrg.media == DATA_MEDIA_TYPE.File) {
                        this.targetSObjectDescribe = this.sourceSObjectDescribe;
                    }

                    // Check fields existance
                    this._validateFields(this.sourceSObjectDescribe, true);

                } catch (ex) {
                    if (ex instanceof CommandInitializationError) {
                        throw ex;
                    }
                    throw new OrgMetadataError(this.script.logger.getResourceString(RESOURCES.objectSourceDoesNotExist, this.name));
                }

            }

            if (this.script.targetOrg.media == DATA_MEDIA_TYPE.Org) {

                // Describe object in the target org        
                let apisf = new Sfdx(this.script.targetOrg);
                this.script.logger.infoNormal(RESOURCES.gettingMetadataForSObject, this.name, this.script.logger.getResourceString(RESOURCES.target));
                try {
                    // Retrieve sobject metadata
                    this.targetSObjectDescribe = await apisf.describeSObjectAsync(this.name);
                    [...this.targetSObjectDescribe.fieldsMap.values()].forEach(x => x.scriptObject = this);

                    if (this.script.sourceOrg.media == DATA_MEDIA_TYPE.File) {
                        this.sourceSObjectDescribe = this.targetSObjectDescribe;
                    }

                    // Check fields existance
                    this._validateFields(this.targetSObjectDescribe, false);

                } catch (ex) {
                    if (ex instanceof CommandInitializationError) {
                        throw ex;
                    }
                    throw new OrgMetadataError(this.script.logger.getResourceString(RESOURCES.objectTargetDoesNotExist, this.name));
                }
            }
        }
    }



    // ----------------------- Private members -------------------------------------------
    private _validateFields(describe: SObjectDescribe, isSource: boolean) {

        if (!this.isReadonlyObject && !this.isSpecialObject) {
            let fieldsInQuery = [].concat(this.fieldsInQuery);
            fieldsInQuery.forEach(x => {
                if (!CommonUtils.isComplexField(x) && !describe.fieldsMap.has(x)) {


                    if (x.name == this.externalId) {
                        // Missing externalId field. Exception.
                        throw new OrgMetadataError(this.script.logger.getResourceString(RESOURCES.noExternalKey, this.name, this.strOperation));
                    }

                    // Field in the query is missing in the org metadata. Warn user.
                    if (isSource)
                        this.script.logger.warn(RESOURCES.fieldSourceDoesNtoExist, this.name, x);
                    else
                        this.script.logger.warn(RESOURCES.fieldTargetDoesNtoExist, this.name, x);

                    // Remove missing field from the query                    
                    CommonUtils.removeBy(this.parsedQuery.fields, "field", x);
                }
            });

            if (this.fieldsToUpdate.length == 0) {
                throw new CommandInitializationError(this.script.logger.getResourceString(RESOURCES.missingFieldsToProcess, this.name));
            }

        } else {
            if (this.fieldsInQuery.length == 0) {
                throw new CommandInitializationError(this.script.logger.getResourceString(RESOURCES.missingFieldsToProcess, this.name));
            }
        }
    }


}
