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
import { Common } from "../../components/common_components/common";
import { DATA_MEDIA_TYPE, OPERATION, CONSTANTS } from "../../components/common_components/statics";
import { RESOURCES } from "../../components/common_components/logger";
import { Sfdx } from "../../components/common_components/sfdx";
import {
    parseQuery,
    composeQuery,
    Field as SOQLField,
    getComposedField
} from 'soql-parser-js';
import { ScriptMockField, Script, SObjectDescribe, MigrationJobTask, ScriptMappingItem, ObjectFieldMapping } from "..";
import SFieldDescribe from "./sfieldDescribe";
import { CommandInitializationError, OrgMetadataError } from "../common_models/errors";
import * as deepClone from 'deep.clone';


/**
 * Parsed object 
 * from the script file 
 *
 * @export
 * @class ScriptObject
 */
export default class ScriptObject {


    constructor(name?: string) {
        if (name) {
            this.query = `SELECT Id FROM ${name}`;
        }
    }

    // ------------- JSON --------------
    @Type(() => ScriptMockField)
    mockFields: ScriptMockField[] = new Array<ScriptMockField>();

    @Type(() => ScriptMappingItem)
    fieldMapping: ScriptMappingItem[] = new Array<ScriptMappingItem>();

    query: string = "";
    deleteQuery: string = "";
    operation: OPERATION = OPERATION.Readonly;
    externalId: string;
    deleteOldData: boolean = false;
    updateWithMockData: boolean = false;
    mockCSVData: boolean = false;
    targetRecordsFilter: string = "";
    excluded: boolean = false;
    useCSVValuesMapping: boolean = false;

    useFieldMapping: boolean = false;
    useValuesMapping: boolean = false;

    /**
     * [Obsolete] Replaced with "master".
     * Preserved for backwards compability
     */
    allRecords: boolean;
    master: boolean = true;

    excludedFields: Array<string> = new Array<string>();




    // -----------------------------------
    script: Script;

    get name(): string {
        if (this.parsedQuery) {
            return this.parsedQuery.sObject;
        } else {
            try {
                return parseQuery(this.query).sObject;
            } catch (ex) {
                return "";
            }
        }
    };
    sourceSObjectDescribe: SObjectDescribe;
    targetSObjectDescribe: SObjectDescribe;
    originalExternalId: string = "";
    parsedQuery: Query;
    parsedDeleteQuery: Query;
    isExtraObject: boolean = false;
    processAllSource: boolean = false;
    processAllTarget: boolean = false;
    multiselectPattern: any;
    referenceFieldToObjectMap: Map<string, string> = new Map<string, string>();
    excludedFieldsFromUpdate: Array<string> = new Array<string>();
    originalExternalIdIsEmpty: boolean = false;

    get sourceTargetFieldMapping(): ObjectFieldMapping {
        return this.script.sourceTargetFieldMapping.get(this.name) || new ObjectFieldMapping(this.name, this.name);
    }

    get task(): MigrationJobTask {
        return this.script.job.getTaskBySObjectName(this.name);
    }

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
        return Common.filterMapByArray(this.fieldsInQuery, this.sourceSObjectDescribe.fieldsMap, key => new SFieldDescribe({
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
            let describe = this.targetSObjectDescribe
                && this.targetSObjectDescribe.fieldsMap
                && this.targetSObjectDescribe.fieldsMap.get(name);
            let enabledRule = this.useFieldMapping
                && this.sourceTargetFieldMapping.hasChange
                && this.sourceTargetFieldMapping.fieldMapping.has(name);
            if (!describe
                || describe.readonly && !enabledRule
                || this.excludedFieldsFromUpdate.indexOf(name) >= 0) {
                return null;
            }
            return (<SOQLField>x).field;
        }).filter(x => !!x);
    }

    get fieldsToUpdateMap(): Map<string, SFieldDescribe> {
        if (!this.sourceSObjectDescribe) {
            return new Map<string, SFieldDescribe>();
        }
        return Common.filterMapByArray(this.fieldsToUpdate, this.sourceSObjectDescribe.fieldsMap);
    }

    get hasRecordTypeIdField(): boolean {
        return this.fieldsInQuery.some(x => x == "RecordTypeId");
    }

    get strOperation(): string {
        return ScriptObject.getStrOperation(this.operation);
    }

    get strOperationInsertOrUpdate(): string {
        if (this.operation == OPERATION.Insert) {
            return ScriptObject.getStrOperation(OPERATION.Insert);
        } else {
            return ScriptObject.getStrOperation(OPERATION.Update);
        }
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
        return Common.isComplexOr__rField(this.externalId);
    }

    get hasAutonumberExternalId(): boolean {
        let extIdField = this.externalIdSFieldDescribe;
        return extIdField.autoNumber || extIdField.name == "Id";
    }

    get hasComplexOriginalExternalId(): boolean {
        return Common.isComplexOr__rField(this.originalExternalId);
    }

    get isDescribed(): boolean {
        return !!this.sourceSObjectDescribe;
    }

    get isInitialized(): boolean {
        return !!this.script;
    }

    get parentLookupObjects(): ScriptObject[] {
        return Common.distinctArray([...this.fieldsInQueryMap.values()].map(x => {
            if (x.lookup) {
                return x.parentLookupObject;
            }
        }).filter(x => !!x), 'name');
    }

    get parentMasterDetailObjects(): ScriptObject[] {
        return Common.distinctArray([...this.fieldsInQueryMap.values()].map(x => {
            if (x.isMasterDetail) {
                return x.parentLookupObject;
            }
        }).filter(x => !!x), 'name');
    }

    get complexExternalId(): string {
        return Common.getComplexField(this.externalId);
    }

    get complexOriginalExternalId(): string {
        return Common.getComplexField(this.originalExternalId);
    }

    /**
     * This object has some parent relationships to other sobjects
     *
     * @readonly
     * @type {boolean}
     * @memberof ScriptObject
     */
    get hasParentLookupObjects(): boolean {
        return [...this.fieldsInQueryMap.values()].some(field => {
            return field.isSimpleReference;
        });
    }

    /**
     * This object has some child relationships to other sobjects
     *
     * @readonly
     * @type {boolean}
     * @memberof ScriptObject
     */
    get hasChildLookupObjects(): boolean {
        return [...this.fieldsInQueryMap.values()].some(field => {
            return field.child__rSFields.length > 0;
        });
    }

    get isObjectWithoutRelationships(): boolean {
        return !this.hasParentLookupObjects && !this.hasChildLookupObjects;
    }

    get hasToBeUpdated(): boolean {
        return this.operation != OPERATION.Readonly && this.operation != OPERATION.Delete;
    }

    get hasUseValueMapping(): boolean {
        return this.useCSVValuesMapping || this.useValuesMapping;
    }

    get targetQuery(): string {
        if (!this.parsedQuery || !this.useFieldMapping) {
            return this.query;
        }
        let targetParsedQuery = deepClone.deepCloneSync(this.parsedQuery, {
            absolute: true,
        });
        targetParsedQuery.sObject = this.targetObjectName;
        targetParsedQuery.fields = [];
        [...this.fieldsInQueryMap.values()].forEach(field => {
            targetParsedQuery.fields.push(getComposedField(field.targetName));
        });
        return composeQuery(targetParsedQuery);
    }

    get targetObjectName(): string {
        if (!this.useFieldMapping) {
            return this.name;
        }

        let mapping = this.script.sourceTargetFieldMapping.get(this.name);
        if (mapping) {
            return mapping.targetSObjectName;
        }
        return this.name;
    }

    get isMapped(): boolean {
        return this.script.sourceTargetFieldMapping.size > 0;
    }

    get sourceTargetFieldNameMap(): Map<string, string> {
        let m = new Map<string, string>();
        this.fieldsInQueryMap.forEach(field => {
            m.set(field.name, field.targetName);
        });
        return m;
    }

    get defaultExternalId(): string {
        if (this.name == CONSTANTS.RECORD_TYPE_SOBJECT_NAME) {
            return CONSTANTS.DEFAULT_RECORD_TYPE_ID_EXTERNAL_ID_FIELD_NAME;
        }
        if (!this.isDescribed) {
            return "Id";
        }
        return ([].concat(
            [...this.sourceSObjectDescribe.fieldsMap.values()].filter(field => field.nameField),
            [...this.sourceSObjectDescribe.fieldsMap.values()].filter(field => field.autoNumber),
            [...this.sourceSObjectDescribe.fieldsMap.values()].filter(field => field.unique))[0]
            || { name: "Id" })["name"];
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
        this.originalExternalIdIsEmpty = !this.externalId;
        this.externalId = this.externalId || CONSTANTS.DEFAULT_EXTERNAL_ID_FIELD_NAME;
        this.originalExternalId = this.externalId;
        this.allRecords = typeof this.allRecords == "undefined" ? this.master : this.allRecords;

        // Fixes operation value
        this.operation = ScriptObject.getOperation(this.operation);

        // Always set explicit externalId to 'Id' on Insert operation
        if (this.operation == OPERATION.Insert) {
            this.externalId = "Id";
        }

        try {
            // Parse query string    
            this.parsedQuery = this._parseQuery(this.query);
        } catch (ex) {
            throw new CommandInitializationError(this.script.logger.getResourceString(RESOURCES.MalformedQuery, this.name, this.query, ex));
        }
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

        // Additional fields for Person Accounts & Contacts
        if (this.script.isPersonAccountEnabled && (this.name == "Account" || this.name == "Contact")) {
            // Add IsPersonAccount field            
            this.parsedQuery.fields.push(getComposedField("IsPersonAccount"));
            // Person Contacts >
            if (this.name == "Contact") {
                if (!this.fieldsInQuery.some(fieldName => fieldName == "AccountId")) {
                    // Add AccountId field to the query
                    this.parsedQuery.fields.push(getComposedField("AccountId"));
                    // This field should be excluded from the update...
                    this.excludedFieldsFromUpdate.push("AccountId");
                }
            }
        }

        // Make each field appear only once in the query
        this.parsedQuery.fields = Common.distinctArray(this.parsedQuery.fields, "field");

        // Update object
        this.query = composeQuery(this.parsedQuery);
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
                if (this.script.isPersonAccountEnabled && this.name == "Contact") {
                    this.parsedDeleteQuery.where = Common.composeWhereClause(this.parsedDeleteQuery.where, "IsPersonAccount", "false", "=", "BOOLEAN", "AND");
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

        if (!this.isDescribed) {

            // Fix object name in case of incorrect writing in the SOQL
            this._fixObjectName();

            if (this.script.sourceOrg.media == DATA_MEDIA_TYPE.Org) {
                // Describe object in the source org
                try {

                    // Retrieve sobject metadata
                    let apisf = new Sfdx(this.script.sourceOrg);
                    this.script.logger.infoNormal(RESOURCES.gettingMetadataForSObject, this.name, this.script.logger.getResourceString(RESOURCES.source));

                    this.sourceSObjectDescribe = await apisf.describeSObjectAsync(this.name);
                    this._updateSObjectDescribe(this.sourceSObjectDescribe);

                    if (this.script.targetOrg.media == DATA_MEDIA_TYPE.File) {
                        this.targetSObjectDescribe = this.sourceSObjectDescribe;
                    }

                    // Add fields by the multiselect keywords + filter query
                    this._addOrRemoveFields(this.sourceSObjectDescribe);

                    // Fix object fields in case of incorrect writing in the SOQL
                    this._fixFieldNames(this.sourceSObjectDescribe);

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
                try {

                    // Retrieve sobject metadata
                    let apisf = new Sfdx(this.script.targetOrg);
                    this.script.logger.infoNormal(RESOURCES.gettingMetadataForSObject, this.name, this.script.logger.getResourceString(RESOURCES.target));

                    this.targetSObjectDescribe = await apisf.describeSObjectAsync(this.name, this.sourceTargetFieldMapping);
                    this._updateSObjectDescribe(this.targetSObjectDescribe);

                    if (this.script.sourceOrg.media == DATA_MEDIA_TYPE.File) {
                        this.sourceSObjectDescribe = this.targetSObjectDescribe;

                        // Add fields by the multiselect keywords + filter query
                        this._addOrRemoveFields(this.targetSObjectDescribe);

                        // Fix object fields
                        this._fixFieldNames(this.targetSObjectDescribe);
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

    getMandatoryQueryFields(): Array<string> {
        let prop = `MANDATORY_QUERY_FIELDS_FOR_${this.strOperationInsertOrUpdate.toUpperCase()}`;
        return CONSTANTS[prop] && CONSTANTS[prop].get(this.name) || new Array<string>();
    }



    // ----------------------- Static members -------------------------------------------    
    /**
     * Converts numeric enum value into string
     *
     * @static
     * @param {OPERATION} operation
     * @returns
     * @memberof ScriptObject
     */
    public static getStrOperation(operation: OPERATION | string): string {
        operation = typeof operation == 'undefined' || operation == null ? '' : operation;
        if ((typeof operation != "string") == true) {
            if (typeof OPERATION[operation] == 'undefined') {
                return OPERATION.Unknown.toString();
            }
            return OPERATION[operation].toString();
        }
        return operation.toString();
    }

    /**
     * Converts string enum value into numeric
     *
     * @static
     * @param {OPERATION} operation
     * @returns
     * @memberof ScriptObject
     */
    public static getOperation(operation: OPERATION | string): OPERATION {
        operation = typeof operation == 'undefined' || operation == null ? '' : operation;
        if ((typeof operation == "string") == true) {
            if (typeof OPERATION[operation.toString()] == 'undefined') {
                return OPERATION.Unknown;
            }
            return OPERATION[operation.toString()];
        }
        return <OPERATION>operation;
    }



    // ----------------------- Private members -------------------------------------------
    private _addOrRemoveFields(describe: SObjectDescribe) {

        // Add multiselect fields
        if (this.multiselectPattern) {
            let pattern = this.multiselectPattern;
            [...describe.fieldsMap.values()].forEach(fieldDescribe => {
                if ((___compare(pattern.all != "undefined", pattern.all == true)
                    || !Object.keys(pattern).some(prop => ___compare(fieldDescribe[prop], pattern[prop], true)))) {
                    if (!(fieldDescribe.lookup && CONSTANTS.OBJECTS_NOT_TO_USE_IN_QUERY_MULTISELECT.indexOf(fieldDescribe.referencedObjectType) >= 0)) {
                        this.parsedQuery.fields.push(getComposedField(fieldDescribe.name));
                        this.excludedFieldsFromUpdate = this.excludedFieldsFromUpdate.filter(fieldName => fieldName != fieldDescribe.name);
                    }
                }
            });
        }

        // Add compound fields
        let fieldsInOriginalQuery: string[] = [].concat(this.fieldsInQuery);
        this.parsedQuery.fields = [];

        fieldsInOriginalQuery.forEach(fieldName => {
            let fields = CONSTANTS.COMPOUND_FIELDS.get(fieldName);
            if (fields) {
                fields.forEach(f => {
                    this.parsedQuery.fields.push(getComposedField(f));
                });
            } else {
                this.parsedQuery.fields.push(getComposedField(fieldName));
            }
        });

        // Filter excluded fields
        this.parsedQuery.fields = this.parsedQuery.fields.filter((field: SOQLField) =>
            this.excludedFields.indexOf(field.field) < 0
        );

        // Add mandatory fields
        this.getMandatoryQueryFields().forEach((fieldName: string) => {
            if (this.fieldsInQuery.indexOf(fieldName) < 0) {
                this.parsedQuery.fields.push(getComposedField(fieldName));
            }
        });

        // Make each field appear only once
        this.parsedQuery.fields = Common.distinctArray(this.parsedQuery.fields, "field");

        // Create new query string
        this.query = composeQuery(this.parsedQuery);

        // ---------------------- Internal functions --------------------------- //        
        function ___compare(fieldDescribeProperty: any, patternProperty: any, negative: boolean = false): boolean {
            if (!negative)
                return fieldDescribeProperty == patternProperty || typeof patternProperty == "undefined";
            else
                return fieldDescribeProperty != patternProperty && typeof fieldDescribeProperty != "undefined";
        }
    }

    private _fixObjectName() {
        if (this.script.sourceOrg.media == DATA_MEDIA_TYPE.Org && this.script.sourceOrg.isDescribed) {
            this.parsedQuery.sObject = Common.searchClosest(this.parsedQuery.sObject, this.script.sourceOrg.objectNamesList);
        } else if (this.script.targetOrg.media == DATA_MEDIA_TYPE.Org && this.script.targetOrg.isDescribed) {
            this.parsedQuery.sObject = Common.searchClosest(this.parsedQuery.sObject, this.script.targetOrg.objectNamesList);
        }
    }

    private _fixFieldNames(describe: SObjectDescribe) {
        let fieldsInOriginalQuery: string[] = [].concat(this.fieldsInQuery);
        let availableFields = [...describe.fieldsMap.keys()];
        this.parsedQuery.fields = new Array<SOQLField>();
        fieldsInOriginalQuery.forEach(fieldName => {
            if (!Common.isComplexOr__rField(fieldName)) {
                fieldName = Common.searchClosest(fieldName, availableFields);
            }
            this.parsedQuery.fields.push(getComposedField(fieldName));
        });
        // Create new query string
        this.query = composeQuery(this.parsedQuery);
    }

    private _updateSObjectDescribe(describe: SObjectDescribe) {
        [...describe.fieldsMap.values()].forEach(x => {
            // General setups ////////
            x.scriptObject = this;

            // Setup the polymorphic field /////           
            if (x.lookup && this.referenceFieldToObjectMap.has(x.name)) {
                x.referencedObjectType = this.referenceFieldToObjectMap.get(x.name);
                x.isPolymorphicField = true;
                x.polymorphicReferenceObjectType = x.referencedObjectType;
            }
        });
    }

    private _validateFields(describe: SObjectDescribe, isSource: boolean) {

        if (this.fieldsInQuery.length == 0) {
            throw new CommandInitializationError(this.script.logger.getResourceString(RESOURCES.missingFieldsToProcess, this.name));
        }

        if (!this.isExtraObject && !this.isSpecialObject) {

            let fieldsInQuery = [].concat(this.fieldsInQuery);

            fieldsInQuery.forEach(x => {
                if (!Common.isComplexOr__rField(x) && !describe.fieldsMap.has(x)) {

                    if (x.name == this.externalId) {
                        // Missing externalId field. 
                        throw new OrgMetadataError(this.script.logger.getResourceString(RESOURCES.noExternalKey, this.name, this.strOperation));
                    }

                    // Field in the query is missing in the org metadata. Warn user.
                    if (isSource)
                        this.script.logger.warn(RESOURCES.fieldSourceDoesNtoExist, this.name, x);
                    else
                        this.script.logger.warn(RESOURCES.fieldTargetDoesNtoExist, this.name, x);

                    // Remove missing field from the query                    
                    Common.removeBy(this.parsedQuery.fields, "field", x);
                }
            });

            this.query = composeQuery(this.parsedQuery);
        }
    }

    private _parseQuery(query: string): Query {
        let self = this;
        let parsedQuery = parseQuery(query);
        let fields = [].concat(parsedQuery.fields);
        parsedQuery.fields = [getComposedField("Id")];
        fields.forEach(field => {
            let fieldName = ((<SOQLField>field).field).toLowerCase();
            if (fieldName == "all") {
                ___set("all_true");
            } else if (CONSTANTS.MULTISELECT_SOQL_KEYWORDS.indexOf(fieldName) >= 0) {
                ___set(fieldName);
            } else if (fieldName != "id") {
                fieldName = (<SOQLField>field).field;
                let parts = fieldName.split(CONSTANTS.REFERENCE_FIELD_OBJECT_SEPARATOR);
                if (parts.length > 1) {
                    self.referenceFieldToObjectMap.set(parts[0], parts[1]);
                    fieldName = parts[0];
                }
                parsedQuery.fields.push(getComposedField(fieldName));
            }
        });
        this.query = composeQuery(parsedQuery);
        return parsedQuery;

        // ---------------------- Internal functions --------------------------- //
        function ___set(fieldName: string) {
            self.multiselectPattern = self.multiselectPattern || {};
            let parts = fieldName.split('_');
            self.multiselectPattern[parts[0]] = parts[1] == "true";
        }
    }


}
