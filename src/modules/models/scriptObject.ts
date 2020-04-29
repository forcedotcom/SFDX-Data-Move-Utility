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
import { ScriptMockField, Script, SObjectDescribe, CommandInitializationError, OrgMetadataError } from ".";


/**
 * Parsed object from the script file 
 *
 * @export
 * @class ScriptObject
 */
export default class ScriptObject {

    @Type(() => ScriptMockField)
    mockFields: ScriptMockField[] = new Array<ScriptMockField>();

    query: string = "";
    deleteQuery: string = "";
    operation: OPERATION = OPERATION.Readonly;
    externalId: string = "Name";
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
    initialExternalId: string = "";
    parsedQuery: Query;
    parsedDeleteQuery: Query;
    isExtraObject: boolean = false;


    get fieldsInQuery(): string[] {
        if (!this.parsedQuery) {
            return new Array<string>();
        }
        return this.parsedQuery.fields.map(x => (<SOQLField>x).field);
    }

    get fieldsToUpdate(): string[] {
        if (!this.parsedQuery
            || !this.sourceSObjectDescribe
            || this.sourceSObjectDescribe.fieldsMap.size == 0
            || this.operation == OPERATION.Readonly) {
            return new Array<string>();
        }
        return this.parsedQuery.fields.map(x => {
            let name = (<SOQLField>x).field;
            let describe = this.sourceSObjectDescribe && this.sourceSObjectDescribe.fieldsMap && this.sourceSObjectDescribe.fieldsMap.get(name)
                || this.targetSObjectDescribe && this.targetSObjectDescribe.fieldsMap && this.targetSObjectDescribe.fieldsMap.get(name);
            if (!describe || describe.isReadonly) {
                return null;
            }
            return (<SOQLField>x).field;
        }).filter(x => !!x);
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
        return this._isComplexField(this.externalId);
    }



    /**
     * Setup this object
     *
     * @param {Script} script
     * @memberof ScriptObject
     */
    setup(script: Script) {

        // Initialize object
        this.script = script;
        this.initialExternalId = this.externalId;

        // Fix operation value
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
                this.parsedQuery.fields.push(getComposedField(this._getComplexExternalId()));
            } else {
                this.parsedQuery.fields.push(getComposedField(this.externalId));
            }
            // Make each /*  */field appear only once in the query
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

        // Describe object in the source org
        if (!this.sourceSObjectDescribe && this.script.sourceOrg.media == DATA_MEDIA_TYPE.Org) {
            let apisf = new ApiSf(this.script.sourceOrg);
            this.script.logger.infoNormal(RESOURCES.gettingMetadataForSObject, this.name, this.script.logger.getResourceString(RESOURCES.source));
            try {
                // Retrieve sobject metadata
                this.sourceSObjectDescribe = await apisf.describeSObjectAsync(this.name);

                // Check fields existance
                this._checkScriptFieldsAgainstObjectMetadata(this.sourceSObjectDescribe, true);

            } catch (ex) {
                if (ex instanceof CommandInitializationError) {
                    throw ex;
                }
                throw new OrgMetadataError(this.script.logger.getResourceString(RESOURCES.objectSourceDoesNotExist, this.name));
            }
        }

        // Describe object in the target org        
        if (!this.targetSObjectDescribe && this.script.targetOrg.media == DATA_MEDIA_TYPE.Org) {
            let apisf = new ApiSf(this.script.targetOrg);
            this.script.logger.infoNormal(RESOURCES.gettingMetadataForSObject, this.name, this.script.logger.getResourceString(RESOURCES.target));
            try {
                // Retrieve sobject metadata
                this.targetSObjectDescribe = await apisf.describeSObjectAsync(this.name);

                // Check fields existance
                this._checkScriptFieldsAgainstObjectMetadata(this.targetSObjectDescribe, false);

            } catch (ex) {
                if (ex instanceof CommandInitializationError) {
                    throw ex;
                }
                throw new OrgMetadataError(this.script.logger.getResourceString(RESOURCES.objectTargetDoesNotExist, this.name));
            }
        }

        
    }






    // ---------------- Private members ---------------------------//
    // ------------------------------------------------------------//
    private _checkScriptFieldsAgainstObjectMetadata(describe: SObjectDescribe, isSource: boolean) {

        if (!this.isReadonlyObject && !this.isSpecialObject) {
            let fieldsInQuery = [].concat(this.fieldsInQuery);
            fieldsInQuery.forEach(x => {
                if (!this._isComplexField(x) && !describe.fieldsMap.has(x)) {

                    // Field in the query is missing in the org metadata
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


    private _getComplexExternalId(): string {
        return CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX
            + this.externalId.replace(
                new RegExp(`${CONSTANTS.COMPLEX_FIELDS_SEPARATOR}`, 'g'),
                CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR
            );
    }

    
    private _isComplexField(fieldName: string): boolean {
        return fieldName.indexOf('.') >= 0
            || fieldName.indexOf(CONSTANTS.COMPLEX_FIELDS_SEPARATOR) >= 0
            || fieldName.startsWith(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX);
    }


}
