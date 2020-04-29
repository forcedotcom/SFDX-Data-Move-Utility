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
import { ScriptMockField, Script, SObjectDescribe, CommandInitializationError } from ".";


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
            let describe = this.sourceSObjectDescribe.fieldsMap.get(name) && this.targetSObjectDescribe.fieldsMap.get(name);
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

    get isComplexExternalId(): boolean {
        return this.externalId.indexOf('.') >= 0
            || this.externalId.indexOf(CONSTANTS.COMPLEX_FIELDS_SEPARATOR) >= 0
            || this.externalId.startsWith(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX);
    }

    getComplexExternalId(): string {
        return CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX
            + this.externalId.replace(
                new RegExp(`${CONSTANTS.COMPLEX_FIELDS_SEPARATOR}`, 'g'),
                CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR
            );
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
            if (this.isComplexExternalId) {
                this.parsedQuery.fields.push(getComposedField(this.getComplexExternalId()));
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
            this.sourceSObjectDescribe = await apisf.describeSObjectAsync(this.name);
        }

        // Describe object in the target org        
        if (!this.targetSObjectDescribe && this.script.targetOrg.media == DATA_MEDIA_TYPE.Org) {
            let apisf = new ApiSf(this.script.targetOrg);
            this.script.logger.infoNormal(RESOURCES.gettingMetadataForSObject, this.name, this.script.logger.getResourceString(RESOURCES.target));
            this.targetSObjectDescribe = await apisf.describeSObjectAsync(this.name);
        }
    }

}
