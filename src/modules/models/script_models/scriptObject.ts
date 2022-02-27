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
import { CONSTANTS } from "../../components/common_components/statics";
import { RESOURCES } from "../../components/common_components/logger";
import { Sfdx } from "../../components/common_components/sfdx";
import {
  FieldType,
  Query,
  parseQuery,
  composeQuery,
  Field as SOQLField,
  getComposedField
} from 'soql-parser-js';
import { ScriptMockField, Script, SObjectDescribe, MigrationJobTask, ScriptMappingItem, ObjectFieldMapping } from "..";
import SFieldDescribe from "../sf_models/sfieldDescribe";
import { CommandInitializationError, OrgMetadataError } from "../common_models/errors";
import * as deepClone from 'deep.clone';

import { DATA_MEDIA_TYPE, OPERATION } from "../../components/common_components/enumerations";
import ScriptAddonManifestDefinition from "./scriptAddonManifestDefinition";
import ISfdmuRunScriptObject from "../../../addons/components/sfdmu-run/ISfdmuRunScriptObject";



/**
 * Parsed object
 * from the script file
 *
 * @export
 * @class ScriptObject
 */
export default class ScriptObject implements ISfdmuRunScriptObject {


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
  deleteFromSource: boolean = false;
  deleteByHierarchy: boolean = false;
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
  excudedFromUpdateFields: Array<string> = new Array<string>();
  restApiBatchSize: number = CONSTANTS.DEFAULT_REST_API_BATCH_SIZE;
  useQueryAll: boolean;
  queryAllTarget: boolean;

  @Type(() => ScriptAddonManifestDefinition)
  beforeAddons: ScriptAddonManifestDefinition[] = new Array<ScriptAddonManifestDefinition>();

  @Type(() => ScriptAddonManifestDefinition)
  afterAddons: ScriptAddonManifestDefinition[] = new Array<ScriptAddonManifestDefinition>();

  @Type(() => ScriptAddonManifestDefinition)
  beforeUpdateAddons: ScriptAddonManifestDefinition[] = new Array<ScriptAddonManifestDefinition>();

  @Type(() => ScriptAddonManifestDefinition)
  afterUpdateAddons: ScriptAddonManifestDefinition[] = new Array<ScriptAddonManifestDefinition>();

  @Type(() => ScriptAddonManifestDefinition)
  filterRecordsAddons: ScriptAddonManifestDefinition[] = new Array<ScriptAddonManifestDefinition>();



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
  extraFieldsToUpdate: Array<string> = new Array<string>();

  get sourceTargetFieldMapping(): ObjectFieldMapping {
    return this.script.sourceTargetFieldMapping.get(this.name) || new ObjectFieldMapping(this.name, this.name);
  }

  get task(): MigrationJobTask {
    return this.script.job.getTaskBySObjectName(this.name);
  }

  get externalIdSFieldDescribe(): SFieldDescribe {
    return this.isDescribed
      && this.sourceSObjectDescribe.fieldsMap.get(this.externalId)
      || new SFieldDescribe();
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
    return Common.filterMapByArray(this.fieldsInQuery, this.sourceSObjectDescribe.fieldsMap,
      key => new SFieldDescribe().dynamic(key),
      true);
  }

  get fieldsToUpdate(): string[] {

    if (!this.parsedQuery
      || !this.isDescribed
      || this.sourceSObjectDescribe.fieldsMap.size == 0
      || this.operation == OPERATION.Readonly) {
      return new Array<string>();
    }

    let fields = this.parsedQuery.fields.map(x => {
      let name = (<SOQLField>x).field;
      let targetName = name;
      let isFieldMapped = this.useFieldMapping
        && this.sourceTargetFieldMapping.hasChange
        && this.sourceTargetFieldMapping.fieldMapping.has(name);
      if (isFieldMapped) {
        targetName = this.sourceTargetFieldMapping.fieldMapping.get(name);
      }
      let describe = this.targetSObjectDescribe
        && this.targetSObjectDescribe.fieldsMap
        && this.targetSObjectDescribe.fieldsMap.get(targetName);
      if (!describe
        || describe.readonly && !isFieldMapped
        || this.excludedFieldsFromUpdate.indexOf(targetName) >= 0
        || this.excudedFromUpdateFields.indexOf(name) >= 0) {
        return null;
      }
      return (<SOQLField>x).field;
    }).filter(x => !!x);

    fields = fields.concat(this.extraFieldsToUpdate);

    return Common.distinctStringArray(fields);
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
    if (this.operation == OPERATION.Insert || this.operation == OPERATION.Upsert) {
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
      return null;
    }).filter(x => !!x), 'name');
  }

  get parentMasterDetailObjects(): ScriptObject[] {
    return Common.distinctArray([...this.fieldsInQueryMap.values()].map(x => {
      // Master-detail
      if (x.isMasterDetail) {
        return x.parentLookupObject;
      }
      // Special order
      if (x.lookup
        && CONSTANTS.SPECIAL_OBJECT_LOOKUP_MASTER_DETAIL_ORDER.get(x.parentLookupObject.name)
        && CONSTANTS.SPECIAL_OBJECT_LOOKUP_MASTER_DETAIL_ORDER.get(x.parentLookupObject.name).indexOf(this.name) >= 0) {
        return x.parentLookupObject;
      }
      return null;
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

  get sourceToTargetFieldNameMap(): Map<string, string> {
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
    if (CONSTANTS.DEFAULT_EXTERNAL_IDS[this.name]) {
      return CONSTANTS.DEFAULT_EXTERNAL_IDS[this.name];
    }
    return ([].concat(
      [...this.sourceSObjectDescribe.fieldsMap.values()].filter(field => field.nameField),
      [...this.sourceSObjectDescribe.fieldsMap.values()].filter(field => field.autoNumber),
      [...this.sourceSObjectDescribe.fieldsMap.values()].filter(field => field.unique))[0]
      || { name: "Id" })["name"];
  }

  get idFieldIsMapped(): boolean {
    return this.isMapped && this.sourceToTargetFieldNameMap.get("Id") != "Id";
  }

  get isDeletedFromSourceOperation(): boolean {
    return this.operation == OPERATION.Delete
      && this.deleteFromSource
      && this.script.sourceOrg.media == DATA_MEDIA_TYPE.Org;
  }

  get isHierarchicalDeleteOperation(): boolean {
    return this.deleteByHierarchy
      && this.script.targetOrg.media == DATA_MEDIA_TYPE.Org;
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

    // Fix / Setup operation value ???
    //this.operation = ScriptObject.getOperation(this.operation);

    if (this.operation == OPERATION.DeleteSource) {
      this.deleteFromSource = true;
      this.operation = OPERATION.Delete;
    }
    if (this.operation == OPERATION.DeleteHierarchy) {
      this.deleteByHierarchy = true;
      this.operation = OPERATION.Delete;
    }

    // Fix script object parameters
    // Always set explicit externalId to 'Id' on Insert operation
    if (this.operation == OPERATION.Insert || this.isDeletedFromSourceOperation) {
      this.externalId = "Id";
    }

    try {
      // Parse query string
      this.parsedQuery = this._parseQuery(this.query);
    } catch (ex: any) {
      throw new CommandInitializationError(this.script.logger.getResourceString(RESOURCES.MalformedQuery, this.name, this.query, ex));
    }

    if (this.operation == OPERATION.Delete && !this.isDeletedFromSourceOperation && !this.deleteByHierarchy) {
      this.deleteOldData = true;
      this.parsedQuery.fields = [getComposedField("Id")];
    } else if (this.deleteByHierarchy) {
      if (this.operation == OPERATION.Delete) {
        this.operation = OPERATION.Readonly;
        this.deleteOldData = false;
      } else {
        this.deleteByHierarchy = false;
      }
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
    this.parsedQuery.fields = Common.distinctArray(this.parsedQuery.fields, "field").filter(field => !!(<SOQLField>field).field);

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
      } catch (ex: any) {
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

      // Fix the incorrect polymorphic field definitions
      await this._fixPolymorphicFields();
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
          if (!(
            fieldDescribe.lookup &&
            (
              // By fields
              CONSTANTS.OBJECTS_NOT_TO_USE_IN_QUERY_MULTISELECT.indexOf(fieldDescribe.referencedObjectType) >= 0
              // By object (all objects)
              || CONSTANTS.FIELDS_NOT_TO_USE_IN_QUERY_MULTISELECT['*'].indexOf(fieldDescribe.name) >= 0
              // By object (speciic object)
              || CONSTANTS.FIELDS_NOT_TO_USE_IN_QUERY_MULTISELECT[this.name]
                    && CONSTANTS.FIELDS_NOT_TO_USE_IN_QUERY_MULTISELECT[this.name].indexOf(fieldDescribe.name) >= 0
            )
            || !fieldDescribe.isSimple
          )
          ) {
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
    this.parsedQuery.fields = this.parsedQuery.fields.filter((f: FieldType) => {
      let field = f as SOQLField;
      return this.excludedFields.indexOf(field.field) < 0
    });

    // Add mandatory fields
    this.getMandatoryQueryFields().forEach((fieldName: string) => {
      if (this.fieldsInQuery.indexOf(fieldName) < 0) {
        this.parsedQuery.fields.push(getComposedField(fieldName));
      }
    });

    // Verify external id value when the original one was not supplied with the script
    if (this.originalExternalIdIsEmpty
      && !describe.fieldsMap.get(this.externalId)) {
      this.parsedQuery.fields = this.parsedQuery.fields.filter((f: FieldType) => {
        let field = f as SOQLField;
        return field.field != this.externalId
      });
      this.externalId = this.defaultExternalId;
      this.parsedQuery.fields.push(getComposedField(this.externalId));
    }

    // Filter fields which is not described
    let describedFields = [...describe.fieldsMap.keys()].map(field => field.toLowerCase());
    this.parsedQuery.fields = this.parsedQuery.fields.filter((f: FieldType) => {
      let field = f as SOQLField;
      let isComplexField = Common.isComplexField(field.field) || field.field.indexOf('.') >= 0;
      return isComplexField || !isComplexField && describedFields.indexOf(field.field.toLowerCase()) >= 0;
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
      this.parsedQuery.sObject = Common.searchClosest(this.parsedQuery.sObject, this.script.sourceOrg.objectNamesList, true) || this.parsedQuery.sObject;
    } else if (this.script.targetOrg.media == DATA_MEDIA_TYPE.Org && this.script.targetOrg.isDescribed) {
      this.parsedQuery.sObject = Common.searchClosest(this.parsedQuery.sObject, this.script.targetOrg.objectNamesList, true) || this.parsedQuery.sObject;
    }
  }

  private _fixFieldNames(describe: SObjectDescribe) {
    let fieldsInOriginalQuery: string[] = [].concat(this.fieldsInQuery);
    let availableFields = [...describe.fieldsMap.keys()];
    this.parsedQuery.fields = new Array<SOQLField>();
    fieldsInOriginalQuery.forEach(fieldName => {
      if (!Common.isComplexOr__rField(fieldName)) {
        fieldName = Common.searchClosest(fieldName, availableFields, true) || fieldName;
      }
      this.parsedQuery.fields.push(getComposedField(fieldName));
    });
    // Create new query string
    this.query = composeQuery(this.parsedQuery);
  }

  private _updateSObjectDescribe(describe: SObjectDescribe) {

    // General setups ////////
    [...describe.fieldsMap.values()].forEach(field => {
      // General setups ////////
      field.scriptObject = this;

      // Setup the polymorphic field /////
      if (field.lookup && this.referenceFieldToObjectMap.has(field.name)) {
        field.referencedObjectType = this.referenceFieldToObjectMap.get(field.name);
        field.isPolymorphicField = true;
        field.polymorphicReferenceObjectType = field.referencedObjectType;
      }
    });

    // Add complex external id fields ///////
    if (this.hasComplexExternalId) {
      if (!describe.fieldsMap.has(this.complexExternalId)) {
        let complexExtIdDescribe = new SFieldDescribe().complex(this.externalId);
        describe.fieldsMap.set(this.complexExternalId, complexExtIdDescribe);
        describe.fieldsMap.set(this.externalId, complexExtIdDescribe);
      }
    }

  }

  private async _fixPolymorphicFields(): Promise<void> {

    let self = this;

    // Get all polymorphic fields for the current object
    let apiSf = new Sfdx(this.script.sFOrg);
    let polymorphicFields = await apiSf.getPolymorphicObjectFields(this.name);

    // => NON-polymorphic fields explicitely declared with object reference (ParentId$Account)
    let nonPolymorphicFieldsButDeclared = new Array<string>();

    // Polymorphic fields which are MISSING object reference declarations
    // => Can be caused by the human error (incorrect query string) or then using multiselect keywords (e.g. "all")
    let missingDeclarations = ___getIncorrectPolymorphicFields(this.targetSObjectDescribe, nonPolymorphicFieldsButDeclared);
    missingDeclarations = ___getIncorrectPolymorphicFields(this.sourceSObjectDescribe, nonPolymorphicFieldsButDeclared);

    nonPolymorphicFieldsButDeclared.forEach(fieldName => {
      this.script.logger.infoNormal(RESOURCES.fieldIsNotOfPolymorphicType, this.name, fieldName);
    });

    if (missingDeclarations.length > 0) {

      //***** Found incorrect fields =>
      ///      remove them from the query string
      let fieldsInOriginalQuery: string[] = [].concat(this.fieldsInQuery);
      this.parsedQuery.fields = new Array<SOQLField>();
      fieldsInOriginalQuery.forEach(fieldName => {
        fieldName = fieldName.split(CONSTANTS.REFERENCE_FIELD_OBJECT_SEPARATOR)[0];
        if (missingDeclarations.indexOf(fieldName) < 0) {
          this.parsedQuery.fields.push(getComposedField(fieldName));
        } else {
          this.script.logger.infoNormal(RESOURCES.fieldMissingPolymorphicDeclaration, this.name, fieldName, fieldName);
        }
      });

      // Create new query string
      this.query = composeQuery(this.parsedQuery);
    }


    // -----------------  Private functions ----------------- //
    function ___getIncorrectPolymorphicFields(describe: SObjectDescribe, incorrectDeclarations: Array<string>): Array<string> {

      let incorrectFields = new Array<string>();

      [...describe.fieldsMap.values()].forEach(field => {

        if (CONSTANTS.FIELDS_NOT_CHECK_FOR_POLYMORPHIC_ISSUES.indexOf(field.name) < 0) {

          field.isPolymorphicFieldDefinition = polymorphicFields.indexOf(field.name) >= 0;

          if (field.isPolymorphicField && !field.isPolymorphicFieldDefinition) {

            //***** Incorect polymorphic definition, regular lookup marked as polymorphic =>
            // this field should be changed to regular field type,
            //   we should restore original lookup settings
            field.isPolymorphicField = false;
            field.polymorphicReferenceObjectType = '';
            field.referencedObjectType = field.originalReferencedObjectType;

            // Remove from polymorphic mappings
            self.referenceFieldToObjectMap.delete(field.name);

            if (incorrectDeclarations.indexOf(field.name) < 0) {
              incorrectDeclarations.push(field.name);
            }

          } else if (!field.isPolymorphicField && field.isPolymorphicFieldDefinition) {

            //***** Incorect polymorphic definition, polymorphic NOT marked =>
            // Add it to incorrect list since we do'nt know to which object it should be linked
            incorrectFields.push(field.name);
          }
        }
      });

      return Common.distinctStringArray(incorrectFields);
    }

  }

  private _validateFields(describe: SObjectDescribe, isSource: boolean) {

    if (this.fieldsInQuery.length == 0) {
      throw new CommandInitializationError(this.script.logger.getResourceString(RESOURCES.missingFieldsToProcess, this.name));
    }

    if (!this.isExtraObject && !this.isSpecialObject) {

      let fieldsInQuery = [].concat(this.fieldsInQuery);

      fieldsInQuery.forEach(sourceFieldName => {

        let targetFieldName = !isSource && this.sourceTargetFieldMapping.fieldMapping.get(sourceFieldName) || sourceFieldName;

        if (!Common.isComplexOr__rField(sourceFieldName) && !describe.fieldsMap.has(targetFieldName)) {

          if (sourceFieldName == this.externalId) {
            // Missing externalId field.
            throw new OrgMetadataError(this.script.logger.getResourceString(RESOURCES.noExternalKey, this.name, this.strOperation));
          }

          // Field in the query is missing in the org metadata. Warn user.
          if (isSource)
            this.script.logger.warn(RESOURCES.fieldSourceDoesNtoExist, this.name, sourceFieldName);
          else
            this.script.logger.warn(RESOURCES.fieldTargetDoesNtoExist, this.name, sourceFieldName);

          // Remove missing field from the query
          Common.removeBy(this.parsedQuery.fields, "field", sourceFieldName);
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
        fieldName = field["rawValue"] || (<SOQLField>field).field;
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
