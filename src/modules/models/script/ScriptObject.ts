/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Field as SoqlField, FieldType, Query, WhereClause } from 'soql-parser-js';
import { Common } from '../../common/Common.js';
import { DATA_MEDIA_TYPE, OPERATION } from '../../common/Enumerations.js';
import {
  COMPLEX_FIELDS_QUERY_PREFIX,
  COMPLEX_FIELDS_QUERY_SEPARATOR,
  COMPLEX_FIELDS_SEPARATOR,
  COMPOUND_FIELDS,
  DEFAULT_BULK_API_V1_BATCH_SIZE,
  DEFAULT_EXTERNAL_ID_FIELD_NAME,
  DEFAULT_EXTERNAL_IDS,
  DEFAULT_REST_API_BATCH_SIZE,
  EXCLUDED_OBJECTS,
  EXCLUDED_QUERY_FIELDS,
  FIELDS_NOT_CHECK_FOR_POLYMORPHIC_ISSUES,
  FIELDS_NOT_TO_USE_IN_QUERY_MULTISELECT,
  FIELDS_TO_UPDATE_ALWAYS,
  GROUP_OBJECT_NAME,
  MULTISELECT_SOQL_KEYWORDS,
  OBJECTS_NOT_TO_USE_IN_QUERY_MULTISELECT,
  OBJECTS_TO_FERIFY_IN_QUERY_TRANSFORM,
  REFERENCE_FIELD_OBJECT_SEPARATOR,
  SPECIAL_OBJECT_LOOKUP_MASTER_DETAIL_ORDER,
  SPECIAL_OBJECTS,
  USER_OBJECT_NAME,
  RECORD_TYPE_SOBJECT_NAME,
  DEFAULT_GROUP_WHERE_CLAUSE,
  POLYMORPHIC_FIELD_PARSER_PLACEHOLDER,
} from '../../constants/Constants.js';
import CjsDependencyAdapters from '../../dependencies/CjsDependencyAdapters.js';
import type { LoggerType } from '../../logging/LoggerType.js';
import ObjectMapping from '../../mapping/ObjectMapping.js';
import { CommandInitializationError } from '../common/CommandInitializationError.js';
import { OrgMetadataError } from '../common/OrgMetadataError.js';
import { UnresolvableWarning } from '../common/UnresolvableWarning.js';
import type { IMetadataProvider } from '../job/IMetadataProvider.js';
import SFieldDescribe from '../sf/SFieldDescribe.js';
import SObjectDescribe from '../sf/SObjectDescribe.js';
import ScriptAddonManifestDefinition from './ScriptAddonManifestDefinition.js';
import ScriptMappingItem from './ScriptMappingItem.js';
import ScriptMockField from './ScriptMockField.js';
import type { PolymorphicLookupType } from './PolymorphicLookupType.js';
import type Script from './Script.js';

const soqlParser = CjsDependencyAdapters.getSoqlParser();
const { composeQuery, parseQuery, getComposedField } = soqlParser;

type MultiSelectPatternType = Record<string, boolean | string>;
type ParsedQueryType = Query & { fields: FieldType[] };
type DescribeAttemptResultType = { describe?: SObjectDescribe; missing: boolean };

/**
 * Expands complex field tokens into individual fields.
 *
 * @param fieldName - Field name to expand.
 * @returns Expanded field names.
 */
const expandComplexFieldNames = (fieldName: string): string[] => {
  if (!fieldName) {
    return [];
  }

  if (fieldName.includes(COMPLEX_FIELDS_QUERY_PREFIX)) {
    const parts = fieldName.split(COMPLEX_FIELDS_QUERY_PREFIX);
    const prefix = parts[0] ?? '';
    const remainder = parts[1] ?? '';
    if (!remainder) {
      return [fieldName];
    }
    const normalized = remainder.startsWith('.') ? remainder.slice(1) : remainder;
    const splitParts = normalized
      .split(COMPLEX_FIELDS_QUERY_SEPARATOR)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (splitParts.length === 0) {
      return [fieldName];
    }
    return splitParts.map((part) => {
      if (prefix) {
        return part.includes('.') ? part : `${prefix}${part}`;
      }
      return part;
    });
  }

  if (fieldName.includes(COMPLEX_FIELDS_SEPARATOR)) {
    return fieldName
      .split(COMPLEX_FIELDS_SEPARATOR)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  return [fieldName];
};

/**
 * Composes the SOQL query with expanded complex fields.
 *
 * @param parsedQuery - Parsed query to compose.
 * @returns Composed query string.
 */
const composeQueryWithExpandedComplexFields = (parsedQuery: ParsedQueryType): string => {
  const expandedFields: FieldType[] = [];
  const seen = new Set<string>();

  parsedQuery.fields.forEach((fieldType) => {
    const soqlField = fieldType as SoqlField;
    const rawValue = String((soqlField as { rawValue?: string }).rawValue ?? soqlField.field ?? '');
    if (!rawValue) {
      return;
    }
    const expanded = expandComplexFieldNames(rawValue);
    expanded.forEach((fieldName) => {
      const normalized = fieldName.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        expandedFields.push(getComposedField(fieldName));
      }
    });
  });

  return composeQuery({
    ...parsedQuery,
    fields: expandedFields,
  });
};

/**
 * Script object definition from export.json.
 */
export default class ScriptObject {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Object API name.
   */
  public name = '';

  /**
   * SOQL query string.
   */
  public query = '';

  /**
   * Optional delete query string.
   */
  public deleteQuery = '';

  /**
   * Operation for this object.
   * Can be normalized during setup based on media type and object capabilities.
   */
  public operation: OPERATION = OPERATION.Readonly;

  /**
   * External id field name.
   */
  public externalId = '';

  /**
   * Original external id field name.
   */
  public originalExternalId = '';

  /**
   * True when the original external id was not supplied.
   */
  public originalExternalIdIsEmpty = false;

  /**
   * Indicates the object definition was auto-added.
   */
  public isAutoAdded = false;

  /**
   * Indicates the object existed in the original script.
   */
  public isFromOriginalScript = false;

  /**
   * Enables field and object mapping for this object.
   * Disabled automatically for CSV file targets.
   */
  public useFieldMapping = false;

  /**
   * Legacy CSV values-mapping flag from earlier config versions.
   * Kept for backward compatibility.
   */
  public useCSVValuesMapping = false;

  /**
   * Enables value mapping for this object.
   * Used by runtime mapping logic.
   */
  public useValuesMapping = false;

  /**
   * Indicates the object should be updated with mock data.
   */
  public updateWithMockData = false;

  /**
   * Indicates target records should be deleted before insert.
   * Effective only when delete is supported for the target media/object.
   */
  public deleteOldData = false;

  /**
   * Indicates source records should be deleted after migration.
   */
  public deleteFromSource = false;

  /**
   * Indicates hierarchical delete mode is enabled.
   * Applicable to org targets only.
   */
  public deleteByHierarchy = false;

  /**
   * Indicates hard delete should be used.
   * Applicable to org targets only.
   */
  public hardDelete = false;

  /**
   * Enforces REST delete one-by-one mode to preserve ORDER BY intent.
   * Applies only to delete-like operations.
   */
  public respectOrderByOnDeleteRecords = false;

  /**
   * Forces Bulk API for object DML operations when REST override is not active.
   */
  public alwaysUseBulkApiToUpdateRecords = false;

  /**
   * Forces REST API usage for object queries and object DML operations.
   */
  public alwaysUseRestApi = false;

  /**
   * Forces Bulk API usage for object queries and object DML operations.
   */
  public alwaysUseBulkApi = false;

  /**
   * Source records filter expression applied before DML.
   */
  public sourceRecordsFilter = '';

  /**
   * Target records filter expression applied before DML.
   */
  public targetRecordsFilter = '';

  /**
   * Excludes the object from processing.
   */
  public excluded = false;

  /**
   * Flag to use queryAll for the source org.
   */
  public useQueryAll = false;

  /**
   * Flag to use queryAll for the target org.
   */
  public queryAllTarget = false;

  /**
   * Skips source records that already exist in target.
   */
  public skipExistingRecords = false;

  /**
   * Bulk API v1 batch size override for this object.
   */
  public bulkApiV1BatchSize: number | undefined;

  /**
   * REST API batch size override for this object.
   */
  public restApiBatchSize: number | undefined;

  /**
   * Parallel Bulk API job limit.
   */
  public parallelBulkJobs: number | undefined;

  /**
   * Parallel REST API job limit.
   */
  public parallelRestJobs = 1;

  /**
   * Uses source CSV file instead of querying the source org for this object.
   */
  public useSourceCSVFile = false;

  /**
   * Skips source/target value comparison before update.
   */
  public skipRecordsComparison = false;

  /**
   * Field mapping definitions for this object.
   */
  public fieldMapping: ScriptMappingItem[] = [];

  /**
   * Mock field definitions for this object.
   */
  public mockFields: ScriptMockField[] = [];

  /**
   * Add-on manifests executed before processing this object.
   */
  public beforeAddons: ScriptAddonManifestDefinition[] = [];

  /**
   * Add-on manifests executed after processing this object.
   */
  public afterAddons: ScriptAddonManifestDefinition[] = [];

  /**
   * Add-on manifests executed before updating this object.
   */
  public beforeUpdateAddons: ScriptAddonManifestDefinition[] = [];

  /**
   * Add-on manifests executed after updating this object.
   */
  public afterUpdateAddons: ScriptAddonManifestDefinition[] = [];

  /**
   * Add-on manifests that filter records during updates.
   */
  public filterRecordsAddons: ScriptAddonManifestDefinition[] = [];

  /**
   * Polymorphic lookup field definitions for this object.
   */
  public polymorphicLookups: PolymorphicLookupType[] = [];

  /**
   * Excluded field names for the query.
   */
  public excludedFields: string[] = [];

  /**
   * Excluded fields from update operations.
   */
  public excludedFromUpdateFields: string[] = [];

  /**
   * Runtime excluded fields from update operations.
   */
  public excludedFieldsFromUpdate: string[] = [];

  /**
   * Extra fields to update at runtime.
   */
  public extraFieldsToUpdate: string[] = [];

  /**
   * Controls record scope for this object.
   * `true` means read/process all object records.
   * `false` means process only relationship-required records.
   * Converted to `processAllSource/processAllTarget` during setup.
   */
  public master = true;

  /**
   * True when source processing should fetch all source records.
   */
  public processAllSource = false;

  /**
   * True when target processing should fetch all target records.
   */
  public processAllTarget = false;

  /**
   * Script instance owning this object.
   */
  public script?: Script;

  /**
   * Source object describe metadata.
   */
  public sourceSObjectDescribe?: SObjectDescribe;

  /**
   * Target object describe metadata.
   */
  public targetSObjectDescribe?: SObjectDescribe;

  /**
   * Parsed query definition.
   */
  public parsedQuery?: ParsedQueryType;

  /**
   * Parsed delete query definition.
   */
  public parsedDeleteQuery?: ParsedQueryType;

  /**
   * Indicates this object is a synthetic extra object.
   */
  public isExtraObject = false;

  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Field names captured from the original query.
   */
  private _originalFieldsInQuery: string[] = [];

  /**
   * Multi-select field pattern derived from query keywords.
   */
  private _multiselectPattern?: MultiSelectPatternType;

  /**
   * Explicit polymorphic object mappings from query.
   */
  private _referenceFieldToObjectMap: Map<string, string> = new Map();

  /**
   * Missing fields detected in source describe.
   */
  private _missingSourceFields: Map<string, string> = new Map();

  /**
   * Missing fields detected in target describe.
   */
  private _missingTargetFields: Map<string, string> = new Map();

  /**
   * Cached object mapping for this script object.
   */
  private _objectMapping?: ObjectMapping;

  /**
   * Tracks explicit User polymorphic targets in the original query.
   */
  private _explicitPolymorphicUser = false;

  /**
   * Tracks explicit Group polymorphic targets in the original query.
   */
  private _explicitPolymorphicGroup = false;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new script object.
   *
   * @param name - Optional object API name.
   */
  public constructor(name?: string) {
    if (name) {
      this.name = name;
      this.query = `SELECT Id FROM ${name}`;
    }
  }

  // ------------------------------------------------------//
  // -------------------- GETTERS/SETTERS ---------------- //
  // ------------------------------------------------------//

  /**
   * Returns true when the object has describe metadata.
   *
   * @returns True when described.
   */
  public get isDescribed(): boolean {
    return Boolean(this.sourceSObjectDescribe ?? this.targetSObjectDescribe);
  }

  /**
   * Returns parsed query field names.
   *
   * @returns Field names.
   */
  public get fieldsInQuery(): string[] {
    const fields = this.parsedQuery?.fields ?? [];
    return fields.map((field) => (field as SoqlField).field);
  }

  /**
   * Returns field names from the original query definition.
   *
   * @returns Original query field names.
   */
  public get originalFieldsInQuery(): string[] {
    return [...this._originalFieldsInQuery];
  }

  /**
   * Returns fields in query mapped to field describes.
   *
   * @returns Field map.
   */
  public get fieldsInQueryMap(): Map<string, SFieldDescribe> {
    const describe = this.sourceSObjectDescribe ?? this.targetSObjectDescribe;
    if (!describe) {
      return new Map();
    }
    const normalizedDescribeFieldNames = new Map<string, string>();
    describe.fieldsMap.forEach((_field, fieldName) => {
      normalizedDescribeFieldNames.set(fieldName.toLowerCase(), fieldName);
    });

    return this.fieldsInQuery.reduce((fieldMap, queryFieldName) => {
      const directField = describe.fieldsMap.get(queryFieldName);
      if (directField) {
        fieldMap.set(queryFieldName, directField);
        return fieldMap;
      }

      const normalizedFieldName = normalizedDescribeFieldNames.get(queryFieldName.toLowerCase());
      if (normalizedFieldName) {
        const normalizedField = describe.fieldsMap.get(normalizedFieldName);
        if (normalizedField) {
          fieldMap.set(queryFieldName, normalizedField);
          return fieldMap;
        }
      }

      const dynamicField = new SFieldDescribe().dynamic(queryFieldName);
      fieldMap.set(queryFieldName, dynamicField);
      return fieldMap;
    }, new Map<string, SFieldDescribe>());
  }

  /**
   * Returns original query fields expanded with compound and multiselect rules.
   *
   * @returns Expanded original query fields.
   */
  public get expandedOriginalQueryFields(): string[] {
    const baseFields = [...this._originalFieldsInQuery];
    const expanded = this._expandCompoundFieldNames(baseFields);
    const describe = this.sourceSObjectDescribe ?? this.targetSObjectDescribe;
    const multiselectFields = describe ? this._resolveMultiselectFieldNames(describe) : [];
    return Common.distinctStringArray([...expanded, ...multiselectFields]);
  }

  /**
   * Returns described external id field.
   *
   * @returns External id field metadata.
   */
  public get externalIdSFieldDescribe(): SFieldDescribe {
    if (!this.sourceSObjectDescribe) {
      return new SFieldDescribe();
    }
    return this.sourceSObjectDescribe.fieldsMap.get(this.externalId) ?? new SFieldDescribe();
  }

  /**
   * Returns true when external id is complex.
   *
   * @returns True when complex external id.
   */
  public get hasComplexExternalId(): boolean {
    return Common.isComplexOr__rField(this.externalId);
  }

  /**
   * Returns true when external id is autonumber or Id.
   *
   * @returns True when autonumber external id.
   */
  public get hasAutonumberExternalId(): boolean {
    const extIdField = this.externalIdSFieldDescribe;
    return extIdField.autoNumber || extIdField.nameId === 'Id';
  }

  /**
   * Returns true when object is not participating in write-upsert/update flow.
   * Includes `Readonly` and `Delete` operations.
   *
   * @returns True for readonly-like operations.
   */
  public get isReadonlyObject(): boolean {
    return this.operation === OPERATION.Readonly || this.operation === OPERATION.Delete;
  }

  /**
   * Returns true when object is special.
   *
   * @returns True when special object.
   */
  public get isSpecialObject(): boolean {
    const normalized = this.name.toLowerCase();
    return SPECIAL_OBJECTS.some((objectName) => objectName.toLowerCase() === normalized);
  }

  /**
   * Returns true when query contains filters or limits.
   *
   * @returns True when limited.
   */
  public get isLimitedQuery(): boolean {
    return Boolean(this.parsedQuery?.limit) || Boolean(this.parsedQuery?.where);
  }

  /**
   * Returns parent lookup objects referenced by this object.
   *
   * @returns Parent lookup objects.
   */
  public get parentLookupObjects(): ScriptObject[] {
    const parents = [...this.fieldsInQueryMap.values()]
      .map((field) => (field.lookup ? field.parentLookupObject : undefined))
      .filter((parent): parent is ScriptObject => Boolean(parent));
    const parentMap = new Map<string, ScriptObject>();
    parents.forEach((parent) => {
      parentMap.set(parent.name.toLowerCase(), parent);
    });
    return [...parentMap.values()];
  }

  /**
   * Returns parent master-detail objects referenced by this object.
   *
   * @returns Parent master-detail objects.
   */
  public get parentMasterDetailObjects(): ScriptObject[] {
    const parents = [...this.fieldsInQueryMap.values()]
      .map((field) => {
        if (field.isMasterDetail && field.parentLookupObject) {
          return field.parentLookupObject;
        }
        if (
          field.lookup &&
          field.parentLookupObject &&
          SPECIAL_OBJECT_LOOKUP_MASTER_DETAIL_ORDER.get(field.parentLookupObject.name)?.includes(this.name)
        ) {
          return field.parentLookupObject;
        }
        return undefined;
      })
      .filter((parent): parent is ScriptObject => Boolean(parent));
    const parentMap = new Map<string, ScriptObject>();
    parents.forEach((parent) => {
      parentMap.set(parent.name.toLowerCase(), parent);
    });
    return [...parentMap.values()];
  }

  /**
   * Returns true when object has parent lookups.
   *
   * @returns True when parent lookups exist.
   */
  public get hasParentLookupObjects(): boolean {
    return this.parentLookupObjects.length > 0;
  }

  /**
   * Returns true when object has child lookups.
   *
   * @returns True when child lookups exist.
   */
  public get hasChildLookupObjects(): boolean {
    return [...this.fieldsInQueryMap.values()].some((field) => field.child__rSFields.length > 0);
  }

  /**
   * Returns true when object has no relationships.
   *
   * @returns True when no relationships.
   */
  public get isObjectWithoutRelationships(): boolean {
    return !this.hasParentLookupObjects && !this.hasChildLookupObjects;
  }

  /**
   * Returns the complex external id representation.
   *
   * @returns Complex external id.
   */
  public get complexExternalId(): string {
    return Common.getComplexField(this.externalId);
  }

  /**
   * Returns the complex original external id representation.
   *
   * @returns Complex original external id.
   */
  public get complexOriginalExternalId(): string {
    return Common.getComplexField(this.originalExternalId);
  }

  /**
   * Returns default external id based on metadata.
   *
   * @returns Default external id.
   */
  public get defaultExternalId(): string {
    const describe = this.sourceSObjectDescribe ?? this.targetSObjectDescribe;
    if (!describe) {
      return DEFAULT_EXTERNAL_ID_FIELD_NAME;
    }
    return this._getDefaultExternalId(describe);
  }

  /**
   * Returns effective batch sizes for REST and Bulk v1 APIs.
   *
   * @returns Batch size settings.
   */
  public get batchSizes(): { restBatchSize: number | undefined; bulkV1BatchSize: number } {
    const restBatchSize = this.restApiBatchSize ?? this.script?.restApiBatchSize ?? DEFAULT_REST_API_BATCH_SIZE;
    const bulkV1BatchSize =
      this.bulkApiV1BatchSize ?? this.script?.bulkApiV1BatchSize ?? DEFAULT_BULK_API_V1_BATCH_SIZE;
    return {
      restBatchSize,
      bulkV1BatchSize,
    };
  }

  /**
   * Returns the target object name after mapping.
   *
   * @returns Target object name.
   */
  public get targetObjectName(): string {
    if (!this.useFieldMapping) {
      return this.name;
    }
    return this._getObjectMapping().targetObjectName;
  }

  /**
   * Returns the target query string after field mapping.
   *
   * @returns Target query.
   */
  public get targetQuery(): string {
    if (!this.parsedQuery) {
      return this.query;
    }

    const targetParsedQuery = JSON.parse(JSON.stringify(this.parsedQuery)) as ParsedQueryType;
    targetParsedQuery.sObject = this.useFieldMapping ? this.targetObjectName : this.name;
    const excludedTargetFields = this._getExcludedTargetQueryFields();
    const targetFields = this.fieldsInQuery.filter((fieldName) => !excludedTargetFields.has(fieldName.toLowerCase()));
    targetParsedQuery.fields = targetFields.map((fieldName) =>
      getComposedField(this._mapQueryFieldNameToTarget(fieldName, this))
    );
    this._mapWhereClauseFields(targetParsedQuery.where, this);
    this._mapOrderByFields(targetParsedQuery.orderBy as unknown, this);
    this._normalizeMappedRelationshipFields(targetParsedQuery);
    this._ensureIdFieldInTargetQuery(targetParsedQuery);
    const composed = composeQueryWithExpandedComplexFields(targetParsedQuery);
    return this._transformPolymorphicQuery(composed);
  }

  /**
   * Returns fields that should be updated in the target.
   *
   * @returns Update field names.
   */
  public get fieldsToUpdate(): string[] {
    if (!this.parsedQuery || !this.isDescribed) {
      return [];
    }

    const targetDescribe = this.targetSObjectDescribe ?? this.sourceSObjectDescribe;
    if (!targetDescribe) {
      return [];
    }

    const objectMapping = this._getObjectMapping();
    const isMappingEnabled = this.useFieldMapping && objectMapping.hasChanges();
    const excludedTargetFields = this._getNormalizedFieldList(this.excludedFieldsFromUpdate);
    const excludedSourceFields = this._getNormalizedFieldList(this.excludedFromUpdateFields);
    const fields = this.parsedQuery.fields
      .map((fieldType) => {
        const field = fieldType as SoqlField;
        const sourceFieldName = field.field;
        if (!sourceFieldName) {
          return null;
        }

        const targetFieldName = isMappingEnabled
          ? objectMapping.fieldMapping.getTargetField(sourceFieldName)
          : sourceFieldName;
        const targetFieldDescribe = targetDescribe.fieldsMap.get(targetFieldName);
        const isFieldMapped = isMappingEnabled && objectMapping.fieldMapping.sourceToTarget.has(sourceFieldName);

        if (!targetFieldDescribe) {
          this._logVerboseField(sourceFieldName, 'Skipped for update (missing field describe).');
          return null;
        }
        if (!this._isFieldWritableForOperation(targetFieldDescribe) && !isFieldMapped) {
          this._logVerboseField(sourceFieldName, 'Skipped for update (readonly).');
          return null;
        }
        if (excludedTargetFields.includes(targetFieldName)) {
          this._logVerboseField(sourceFieldName, `Skipped for update (excluded target field ${targetFieldName}).`);
          return null;
        }
        if (excludedSourceFields.includes(sourceFieldName)) {
          this._logVerboseField(sourceFieldName, 'Skipped for update (excluded source field).');
          return null;
        }

        return sourceFieldName;
      })
      .filter((fieldName): fieldName is string => Boolean(fieldName));

    const fieldsWithExtras = fields.concat(this._getExtraFieldsToUpdate());
    return Common.distinctStringArray(fieldsWithExtras);
  }

  /**
   * Returns fields to update mapped to field describes.
   *
   * @returns Field describe map.
   */
  public get fieldsToUpdateMap(): Map<string, SFieldDescribe> {
    const describe = this.sourceSObjectDescribe ?? this.targetSObjectDescribe;
    if (!describe) {
      return new Map();
    }
    return Common.filterMapByArray(this.fieldsToUpdate, describe.fieldsMap);
  }

  /**
   * Returns the operation name string.
   *
   * @returns Operation name.
   */
  public get strOperation(): string {
    return ScriptObject.getStrOperation(this.operation);
  }

  /**
   * Returns Insert or Update string based on operation.
   *
   * @returns Insert/Update operation string.
   */
  public get strOperationInsertOrUpdate(): string {
    if (this.operation === OPERATION.Insert || this.operation === OPERATION.Upsert) {
      return ScriptObject.getStrOperation(OPERATION.Insert);
    }
    return ScriptObject.getStrOperation(OPERATION.Update);
  }

  /**
   * Returns true when Id is mapped to another field.
   *
   * @returns True when Id is mapped.
   */
  public get idFieldIsMapped(): boolean {
    if (!this.useFieldMapping) {
      return false;
    }
    return this._getObjectMapping().fieldMapping.getTargetField('Id') !== 'Id';
  }

  /**
   * Returns true when delete-from-source is active for org source media.
   *
   * @returns True when deleting from source.
   */
  public get isDeletedFromSourceOperation(): boolean {
    return (
      this.operation === OPERATION.Delete &&
      this.deleteFromSource &&
      this.script?.sourceOrg?.media === DATA_MEDIA_TYPE.Org
    );
  }

  /**
   * Returns true when hierarchical delete is active for org target media.
   *
   * @returns True when hierarchical delete.
   */
  public get isHierarchicalDeleteOperation(): boolean {
    return this.deleteByHierarchy && this.script?.targetOrg?.media === DATA_MEDIA_TYPE.Org;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Converts an operation value into its string representation.
   *
   * @param operation - Operation enum or string.
   * @returns Operation string.
   */
  public static getStrOperation(operation: OPERATION | string): string {
    if (typeof operation === 'string') {
      return operation;
    }
    return typeof OPERATION[operation] === 'string' ? OPERATION[operation] : OPERATION.Unknown.toString();
  }

  /**
   * Converts a string operation into enum value.
   *
   * @param operation - Operation enum or string.
   * @returns Operation enum.
   */
  public static getOperation(operation: OPERATION | string): OPERATION {
    if (typeof operation === 'string') {
      const match = OPERATION[operation as keyof typeof OPERATION];
      return typeof match === 'number' ? match : OPERATION.Unknown;
    }
    return operation;
  }

  /**
   * Returns true when the object is User.
   *
   * @returns True when User.
   */
  public isUser(): boolean {
    this._ensureNameFromQuery();
    return this.name.toLowerCase() === USER_OBJECT_NAME.toLowerCase();
  }

  /**
   * Returns true when the object is Group.
   *
   * @returns True when Group.
   */
  public isGroup(): boolean {
    this._ensureNameFromQuery();
    return this.name.toLowerCase() === GROUP_OBJECT_NAME.toLowerCase();
  }

  /**
   * Returns the mapped external id field name when mapping is enabled.
   *
   * @returns External id field name for target side.
   */
  public getMappedExternalIdFieldName(): string {
    return this._mapQueryFieldNameToTarget(this.externalId, this);
  }

  /**
   * Maps a field name to its target representation.
   *
   * @param fieldName - Source field name.
   * @returns Target field name.
   */
  public mapFieldNameToTarget(fieldName: string): string {
    return this._mapQueryFieldNameToTarget(fieldName, this);
  }

  /**
   * Initializes the script object for job execution.
   *
   * @param script - Parent script definition.
   */
  public setup(script: Script): void {
    if (this.script) {
      return;
    }

    this._logVerboseObject(
      `Setup start. operation=${ScriptObject.getStrOperation(this.operation)} externalId=${this.externalId} query=${
        this.query
      }`
    );
    this._initializeFromScript(script);
    this._normalizeOperationFlags();
    this._parseQueryOrThrow();
    this._applyDeleteModeSettings();
    this._applyDefaultQueryFields();
    this._applyPersonAccountFields();
    this._finalizeQueryState();

    script.objectsMap.set(this.name, this);
    this.createDeleteQuery();
    this._logVerboseObject(
      `Setup complete. operation=${ScriptObject.getStrOperation(this.operation)} deleteOldData=${
        this.deleteOldData
      } query=${this.query}`
    );
  }

  /**
   * Applies metadata describes and validates query fields.
   *
   * @param sourceDescribe - Source org describe metadata.
   * @param targetDescribe - Target org describe metadata.
   */
  public applyDescribe(sourceDescribe?: SObjectDescribe, targetDescribe?: SObjectDescribe): void {
    if (sourceDescribe) {
      this.sourceSObjectDescribe = sourceDescribe;
      this._fixFieldNames(sourceDescribe);
      this._updateSObjectDescribe(sourceDescribe);
      this._addOrRemoveFields(sourceDescribe, true);
      this._validateFields(sourceDescribe, true);
    }
    if (targetDescribe) {
      this.targetSObjectDescribe = targetDescribe;
      if (!sourceDescribe) {
        this._fixFieldNames(targetDescribe);
      }
      this._updateSObjectDescribe(targetDescribe);
      if (!sourceDescribe) {
        this._addOrRemoveFields(targetDescribe, false);
      }
      this._validateFields(targetDescribe, false);
    }
  }

  /**
   * Describes the object metadata using the provided provider.
   *
   * @param metadataProvider - Metadata provider instance.
   */
  public async describeAsync(metadataProvider?: IMetadataProvider): Promise<void> {
    if (this.isDescribed || !metadataProvider) {
      return;
    }

    const sourceIsOrg = this.script?.sourceOrg?.isOrgMedia ?? true;
    const targetIsOrg = this.script?.targetOrg?.isOrgMedia ?? true;
    const logger = this.script?.logger ?? Common.logger;
    this._missingSourceFields.clear();
    this._missingTargetFields.clear();
    const originalFields = this._getOriginalFieldsForMissingDetection();
    const emptyAttempt: DescribeAttemptResultType = { missing: false };
    const sourceAttempt: DescribeAttemptResultType = sourceIsOrg
      ? await this._tryDescribeAsync(metadataProvider, this.name, true)
      : emptyAttempt;
    const targetAttempt: DescribeAttemptResultType = targetIsOrg
      ? await this._tryDescribeAsync(metadataProvider, this.targetObjectName, false)
      : emptyAttempt;

    if (sourceAttempt.missing || targetAttempt.missing) {
      if (sourceAttempt.missing) {
        logger.warn('missingObjectInSource', this.name);
      }
      if (targetAttempt.missing) {
        logger.warn('missingObjectInTarget', this.name);
      }
      logger.warn('objectIsExcluded', this.name);
      this._logVerboseObject('Excluded because object is missing in Source or Target.');
      this.excluded = true;
      return;
    }

    if (sourceAttempt.describe) {
      this._collectMissingFieldsFromDescribe(sourceAttempt.describe, true, originalFields);
    }
    if (targetAttempt.describe) {
      this._collectMissingFieldsFromDescribe(targetAttempt.describe, false, originalFields);
    }

    this.applyDescribe(sourceAttempt.describe, targetAttempt.describe);
    this._logAndExcludeMissingFields();

    if (!sourceIsOrg && targetAttempt.describe) {
      this.sourceSObjectDescribe = targetAttempt.describe;
    }
    if (!targetIsOrg && sourceAttempt.describe) {
      this.targetSObjectDescribe = sourceAttempt.describe;
    }

    let polymorphicFields: string[] | undefined;
    if (metadataProvider.getPolymorphicObjectFieldsAsync) {
      try {
        polymorphicFields = await metadataProvider.getPolymorphicObjectFieldsAsync(this.name);
      } catch {
        polymorphicFields = undefined;
      }
    }

    this._fixPolymorphicFields(polymorphicFields);
    this._refreshPolymorphicLookups();
  }

  /**
   * Creates or normalizes the delete query.
   */
  public createDeleteQuery(): void {
    if (!this.deleteOldData) {
      return;
    }

    const sourceQuery = this.deleteQuery || this.query;
    try {
      this.parsedDeleteQuery = parseQuery(this._sanitizeQueryForParser(sourceQuery)) as ParsedQueryType;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CommandInitializationError(
        Common.logger.getResourceString('malformedDeleteQuery', this.name, this.deleteQuery, message)
      );
    }

    if (!this.parsedDeleteQuery) {
      return;
    }

    this.parsedDeleteQuery.fields = [getComposedField('Id')];
    if (this.script?.isPersonAccountEnabled && this.name === 'Contact') {
      this.parsedDeleteQuery.where = Common.composeWhereClause(
        this.parsedDeleteQuery.where,
        'IsPersonAccount',
        'false',
        '=',
        'BOOLEAN',
        'AND'
      );
    }
    this.deleteQuery = composeQuery(this.parsedDeleteQuery);
  }

  /**
   * Ensures lookup __r fields are present in the query.
   */
  public ensureLookupFieldsInQuery(): void {
    const parsedQuery = this.parsedQuery;
    if (!parsedQuery) {
      return;
    }
    const existing = new Set(this.fieldsInQuery.map((field) => field.toLowerCase()));
    this.fieldsInQueryMap.forEach((field) => {
      if (!field.lookup || !field.parentLookupObject) {
        return;
      }
      const relationshipField = field.fullName__r;
      if (relationshipField && !existing.has(relationshipField.toLowerCase())) {
        parsedQuery.fields.push(getComposedField(relationshipField));
      }
    });
    this._dedupeQueryFields();
    this._setQueryFromParsed(parsedQuery);
  }

  /**
   * Removes lookup fields that reference excluded objects.
   *
   * @param excludedObjectNames - Lower-cased excluded object names.
   * @param logger - Logger instance.
   * @returns True when any fields were removed.
   */
  public removeLookupFieldsToExcludedObjects(
    excludedObjectNames: Set<string>,
    logger: LoggerType = this.script?.logger ?? Common.logger
  ): boolean {
    if (!this.parsedQuery || !this.isDescribed || excludedObjectNames.size === 0) {
      return false;
    }

    const fieldsToRemove = new Set<string>();
    const lookupReports = new Map<string, string>();
    const relationshipReports = new Map<string, string>();
    const relationshipPrefixes = new Set<string>();

    this.fieldsInQueryMap.forEach((field) => {
      if (!field.lookup) {
        return;
      }
      if (this._isPolymorphicUserGroupLookup(field)) {
        return;
      }
      const parentObjectName = field.parentLookupObject?.name ?? field.referencedObjectType;
      if (!parentObjectName) {
        return;
      }
      if (!excludedObjectNames.has(parentObjectName.toLowerCase())) {
        return;
      }

      lookupReports.set(field.nameId, parentObjectName);
      fieldsToRemove.add(field.name);
      const relationshipName = Common.getFieldName__r(field);
      if (field.name__r) {
        fieldsToRemove.add(field.name__r);
        relationshipPrefixes.add(field.name__r.toLowerCase());
        relationshipReports.set(field.name__r, parentObjectName);
      }
      if (relationshipName) {
        fieldsToRemove.add(relationshipName);
        relationshipPrefixes.add(relationshipName.toLowerCase());
        relationshipReports.set(relationshipName, parentObjectName);
      }
      if (field.fullName__r) {
        fieldsToRemove.add(field.fullName__r);
        relationshipReports.set(field.fullName__r, parentObjectName);
      }
      if (field.fullOriginalName__r) {
        fieldsToRemove.add(field.fullOriginalName__r);
        relationshipReports.set(field.fullOriginalName__r, parentObjectName);
      }
      if (field.fullIdName__r) {
        fieldsToRemove.add(field.fullIdName__r);
        relationshipReports.set(field.fullIdName__r, parentObjectName);
      }
    });

    this.parsedQuery.fields.forEach((fieldType) => {
      const field = fieldType as SoqlField;
      const fieldName = field.field ?? '';
      if (!fieldName || !Common.isComplexOr__rField(fieldName)) {
        return;
      }
      const plain = Common.getFieldFromComplexField(fieldName);
      const parts = plain
        .split(COMPLEX_FIELDS_SEPARATOR)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      parts.forEach((part) => {
        const relationshipName = part.split('.')[0]?.trim();
        if (!relationshipName) {
          return;
        }
        const lookupField = this._resolveLookupFieldForRelationship(relationshipName, this);
        if (!lookupField) {
          return;
        }
        if (this._isPolymorphicUserGroupLookup(lookupField)) {
          return;
        }
        const parentObjectName = lookupField.parentLookupObject?.name ?? lookupField.referencedObjectType;
        if (!parentObjectName || !excludedObjectNames.has(parentObjectName.toLowerCase())) {
          return;
        }
        fieldsToRemove.add(relationshipName);
        fieldsToRemove.add(fieldName);
        relationshipPrefixes.add(relationshipName.toLowerCase());
        relationshipReports.set(fieldName, parentObjectName);
      });
    });

    if (fieldsToRemove.size === 0) {
      return false;
    }

    const removeNames = [...fieldsToRemove].map((fieldName) => fieldName.toLowerCase());
    const beforeFields = [...this.fieldsInQuery];
    this.parsedQuery.fields = this.parsedQuery.fields.filter((fieldType) => {
      const field = fieldType as SoqlField;
      const fieldName = field.field ?? '';
      if (!fieldName) {
        return false;
      }
      const normalized = fieldName.toLowerCase();
      const plain = Common.getFieldFromComplexField(fieldName).toLowerCase();
      const plainParts = plain
        .split(COMPLEX_FIELDS_SEPARATOR)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      const shouldRemove = removeNames.some((removeName) => {
        if (normalized === removeName || normalized.startsWith(`${removeName}.`)) {
          return true;
        }
        if (plain === removeName || plain.startsWith(`${removeName}.`)) {
          return true;
        }
        return plainParts.some((part) => part === removeName || part.startsWith(`${removeName}.`));
      });
      if (shouldRemove) {
        return false;
      }
      if (relationshipPrefixes.size === 0) {
        return true;
      }
      const normalizedPlain = plain.toLowerCase();
      return ![...relationshipPrefixes].some((prefix) => {
        if (normalizedPlain === prefix || normalizedPlain.startsWith(`${prefix}.`)) {
          return true;
        }
        return plainParts.some((part) => part === prefix || part.startsWith(`${prefix}.`));
      });
    });

    this._dedupeQueryFields();
    this._setQueryFromParsed(this.parsedQuery);

    const beforeFieldsSet = new Set(beforeFields.map((fieldName) => fieldName.toLowerCase()));

    lookupReports.forEach((parentObjectName, fieldName) => {
      if (!beforeFieldsSet.has(fieldName.toLowerCase())) {
        return;
      }
      logger.warn('lookupFieldExcludedBecauseParentExcluded', this.name, fieldName, parentObjectName);
    });
    relationshipReports.forEach((parentObjectName, fieldName) => {
      if (lookupReports.has(fieldName)) {
        return;
      }
      if (!beforeFieldsSet.has(fieldName.toLowerCase())) {
        return;
      }
      logger.warn('lookupFieldExcludedBecauseParentExcluded', this.name, fieldName, parentObjectName);
    });

    const afterFields = new Set(this.fieldsInQuery.map((fieldName) => fieldName.toLowerCase()));
    const loggedWarnings = new Set<string>();
    [...lookupReports.keys(), ...relationshipReports.keys()].forEach((fieldName) => {
      loggedWarnings.add(fieldName.toLowerCase());
    });

    beforeFields.forEach((fieldName) => {
      const normalizedFieldName = fieldName.toLowerCase();
      if (!afterFields.has(normalizedFieldName)) {
        this._logVerboseField(fieldName, 'Removed due to excluded parent object.');
      }
    });

    beforeFields.forEach((fieldName) => {
      const normalizedFieldName = fieldName.toLowerCase();
      if (loggedWarnings.has(normalizedFieldName)) {
        return;
      }
      if (afterFields.has(normalizedFieldName)) {
        return;
      }
      if (!Common.isComplexOr__rField(fieldName)) {
        return;
      }
      const plain = Common.getFieldFromComplexField(fieldName);
      const parts = plain
        .split(COMPLEX_FIELDS_SEPARATOR)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      for (const part of parts) {
        const relationshipName = part.split('.')[0]?.trim() ?? '';
        if (!relationshipName) {
          continue;
        }
        const lookupField = this._resolveLookupFieldForRelationship(relationshipName, this);
        if (!lookupField) {
          continue;
        }
        const parentObjectName = lookupField.parentLookupObject?.name ?? lookupField.referencedObjectType;
        if (!parentObjectName || !excludedObjectNames.has(parentObjectName.toLowerCase())) {
          continue;
        }
        logger.warn('lookupFieldExcludedBecauseParentExcluded', this.name, fieldName, parentObjectName);
        loggedWarnings.add(normalizedFieldName);
        break;
      }
    });

    this._refreshPolymorphicLookups();
    return true;
  }

  /**
   * Ensures a field is present in the query and updates the SOQL string.
   *
   * @param fieldName - Field name to add.
   */
  public ensureFieldInQuery(fieldName: string): void {
    if (!fieldName) {
      return;
    }

    this._ensureFieldInQuery(fieldName);
    if (this.parsedQuery) {
      this._dedupeQueryFields();
      this._setQueryFromParsed(this.parsedQuery);
    }
  }

  /**
   * Refreshes the query string from the parsed query state.
   */
  public refreshQueryState(): void {
    this._setQueryFromParsed(this.parsedQuery);
  }

  /**
   * Returns explicit polymorphic targets declared in the query.
   *
   * @returns Explicit User/Group requirements.
   */
  public getExplicitPolymorphicTargets(): {
    requiresUser: boolean;
    requiresGroup: boolean;
    hasExplicit: boolean;
  } {
    if (this._explicitPolymorphicUser || this._explicitPolymorphicGroup) {
      return {
        requiresUser: this._explicitPolymorphicUser,
        requiresGroup: this._explicitPolymorphicGroup,
        hasExplicit: true,
      };
    }
    const scanned = this._scanQueryForExplicitPolymorphicTargets(this.query);
    return {
      ...scanned,
      hasExplicit: scanned.requiresUser || scanned.requiresGroup,
    };
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Initializes script-bound defaults.
   *
   * @param script - Parent script definition.
   */
  private _initializeFromScript(script: Script): void {
    const originalExternalId = this.externalId;
    this.script = script;
    this._ensureNameFromQuery();
    if (this.isAutoAdded) {
      this.externalId = '';
    }
    const externalIdWasEmpty = !this.externalId;
    this.originalExternalIdIsEmpty = externalIdWasEmpty;
    if (externalIdWasEmpty && this._isRecordTypeObject()) {
      const recordTypeExternalId = DEFAULT_EXTERNAL_IDS[RECORD_TYPE_SOBJECT_NAME];
      if (recordTypeExternalId) {
        this.externalId = recordTypeExternalId;
      }
    }
    this.externalId = this.externalId || DEFAULT_EXTERNAL_ID_FIELD_NAME;
    this.originalExternalId = this.externalId;
    this._logVerboseObject(
      `Initialized. externalId=${this.externalId} originalExternalId=${originalExternalId || ''} useFieldMapping=${
        this.useFieldMapping
      }`
    );
    if (this.mockFields.length > 0) {
      this.mockFields.forEach((mockField) => {
        const locale = mockField.locale ? ` locale=${mockField.locale}` : '';
        const excluded = mockField.excludedRegex ? ` excludedRegex=${mockField.excludedRegex}` : '';
        const included = mockField.includedRegex ? ` includedRegex=${mockField.includedRegex}` : '';
        const excludeNames =
          mockField.excludeNames.length > 0 ? ` excludeNames=${mockField.excludeNames.join(',')}` : '';
        this._logVerboseField(
          mockField.name,
          `Mock configured. pattern=${mockField.pattern}${locale}${excluded}${included}${excludeNames}`
        );
      });
    }
  }

  /**
   * Ensures the object name is derived from the query when missing.
   */
  private _ensureNameFromQuery(): void {
    if (this.name || !this.query) {
      return;
    }

    try {
      const sanitized = this._sanitizeQueryForParser(this.query);
      const inferredName = this._extractSObjectNameFromQuery(sanitized);
      if (inferredName) {
        this.name = inferredName;
        return;
      }

      const parsed = parseQuery(sanitized) as ParsedQueryType;
      if (parsed?.sObject) {
        this.name = parsed.sObject;
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Common.logger.warn('soqlParseFailed', this.query, message);
    }
  }

  /**
   * Returns true when the object is RecordType.
   *
   * @returns True when RecordType.
   */
  private _isRecordTypeObject(): boolean {
    this._ensureNameFromQuery();
    return this.name.toLowerCase() === RECORD_TYPE_SOBJECT_NAME.toLowerCase();
  }

  /**
   * Writes a verbose object-level log message to the file log.
   *
   * @param message - Message without object prefix.
   */
  private _logVerboseObject(message: string): void {
    const logger = this.script?.logger ?? Common.logger;
    logger.verboseFile(`{${this.name}} ${message}`);
  }

  /**
   * Writes a verbose field-level log message to the file log.
   *
   * @param fieldName - Field name to log.
   * @param message - Message without field prefix.
   */
  private _logVerboseField(fieldName: string, message: string): void {
    if (!fieldName) {
      return;
    }
    const logger = this.script?.logger ?? Common.logger;
    logger.verboseFile(`{${this.name}.${fieldName}} ${message}`);
  }

  /**
   * Attempts to describe the object, returning missing status for non-fatal errors.
   *
   * @param metadataProvider - Metadata provider instance.
   * @param objectName - Object API name.
   * @param isSource - True when describing source.
   * @returns Describe attempt result.
   */
  private async _tryDescribeAsync(
    metadataProvider: IMetadataProvider,
    objectName: string,
    isSource: boolean
  ): Promise<DescribeAttemptResultType> {
    void this;
    try {
      const describe = await metadataProvider.describeSObjectAsync(objectName, isSource);
      return { describe, missing: false };
    } catch (error) {
      if (error instanceof CommandInitializationError || error instanceof OrgMetadataError) {
        throw error;
      }
      return { missing: true };
    }
  }

  /**
   * Records missing fields for source or target.
   *
   * @param fieldNames - Missing field names.
   * @param isSource - True when source describe.
   */
  private _collectMissingFields(fieldNames: string[], isSource: boolean): void {
    const target = isSource ? this._missingSourceFields : this._missingTargetFields;
    fieldNames.forEach((fieldName) => {
      const normalized = fieldName.toLowerCase();
      if (!normalized) {
        return;
      }
      if (!target.has(normalized)) {
        target.set(normalized, fieldName);
      }
    });
  }

  /**
   * Collects missing fields against a describe using the original query fields.
   *
   * @param describe - Object describe metadata.
   * @param isSource - True when source describe.
   * @param originalFields - Original query fields.
   */
  private _collectMissingFieldsFromDescribe(
    describe: SObjectDescribe,
    isSource: boolean,
    originalFields: string[]
  ): void {
    const objectMapping = this._getObjectMapping();
    const useMapping = !isSource && this.useFieldMapping && objectMapping.hasChanges();
    const describedFieldNames = new Set([...describe.fieldsMap.keys()].map((fieldName) => fieldName.toLowerCase()));
    const missingFields = originalFields.filter((fieldName) => {
      if (Common.isComplexOr__rField(fieldName)) {
        return false;
      }
      const fieldNameToCheck = useMapping ? objectMapping.fieldMapping.getTargetField(fieldName) : fieldName;
      return !describedFieldNames.has(fieldNameToCheck.toLowerCase());
    });
    this._collectMissingFields(missingFields, isSource);
  }

  /**
   * Returns source query fields used to detect missing fields across describes.
   * Prefers user-defined query fields to avoid false-positive warnings from auto-added fields.
   *
   * @returns Field names for missing detection.
   */
  private _getOriginalFieldsForMissingDetection(): string[] {
    if (this.originalFieldsInQuery.length > 0) {
      return [...this.originalFieldsInQuery];
    }
    return [...this.fieldsInQuery];
  }

  /**
   * Returns true when a missing target field should be logged as warning.
   * Suppresses warning for SELECT all macro because expanded fields are metadata-driven and org-specific.
   *
   * @param _fieldName - Field name being evaluated.
   * @returns True when warning should be emitted.
   */
  private _shouldWarnMissingFieldInTarget(_fieldName: string): boolean {
    void _fieldName;
    return this._multiselectPattern?.all !== true;
  }

  /**
   * Logs missing fields for source/target/both and removes them from the query.
   */
  private _logAndExcludeMissingFields(): void {
    const parsedQuery = this.parsedQuery;
    if (!parsedQuery) {
      return;
    }

    const logger = this.script?.logger ?? Common.logger;
    const allMissing = new Set<string>([...this._missingSourceFields.keys(), ...this._missingTargetFields.keys()]);
    if (allMissing.size === 0) {
      return;
    }

    allMissing.forEach((normalized) => {
      const sourceField = this._missingSourceFields.get(normalized);
      const targetField = this._missingTargetFields.get(normalized);
      const fieldName = sourceField ?? targetField ?? normalized;
      const inSource = Boolean(sourceField);
      const inTarget = Boolean(targetField);

      if (inSource && inTarget) {
        logger.warn('missingFieldInBothExcluded', this.name, fieldName);
        this._logVerboseField(fieldName, 'Excluded from query because missing in Source and Target.');
        return;
      }
      if (inSource) {
        logger.warn('missingFieldInSourceExcluded', this.name, fieldName);
        this._logVerboseField(fieldName, 'Excluded from query because missing in Source.');
        return;
      }
      const targetFieldName = this._mapMissingTargetFieldName(fieldName);
      const targetObjectName = this._mapMissingTargetObjectName();
      const mappingSuffix = this._buildMissingTargetMappingSuffix(fieldName, targetFieldName, targetObjectName);
      if (this._shouldWarnMissingFieldInTarget(fieldName)) {
        logger.warn('missingFieldInTargetExcluded', this.name, fieldName, mappingSuffix);
      } else {
        logger.log('missingFieldInTarget', this.name, fieldName);
      }
      this._logVerboseField(fieldName, 'Excluded from query because missing in Target.');
    });

    parsedQuery.fields = parsedQuery.fields.filter((fieldType) => {
      const field = fieldType as SoqlField;
      const fieldName = field.field;
      if (!fieldName) {
        return false;
      }
      if (Common.isComplexOr__rField(fieldName)) {
        return true;
      }
      return !allMissing.has(fieldName.toLowerCase());
    });

    this._dedupeQueryFields();
    this._setQueryFromParsed(parsedQuery);

    const remainingFields = this.fieldsInQuery.map((field) => field.toLowerCase());
    const onlyIdRemaining = remainingFields.length === 1 && remainingFields[0] === 'id';
    if (onlyIdRemaining && this.operation !== OPERATION.Delete) {
      this.excluded = true;
      logger.warn('objectExcludedOnlyId', this.name);
      this._logVerboseObject('Excluded because only Id remains in query fields.');
    }
  }

  /**
   * Determines whether a field is writable for the current operation.
   *
   * @param field - Field describe metadata.
   * @returns True when the field can be written.
   */
  private _isFieldWritableForOperation(field: SFieldDescribe): boolean {
    void this;
    const baseWritable = !field.isFormula && !field.autoNumber && !field.is__r;
    if (!baseWritable) {
      return false;
    }
    return Boolean(field.creatable || field.updateable);
  }

  /**
   * Maps a missing target field to its mapped target field name when field mapping is enabled.
   *
   * @param fieldName - Source field name.
   * @returns Target field name to display.
   */
  private _mapMissingTargetFieldName(fieldName: string): string {
    if (!this.useFieldMapping || !fieldName) {
      return fieldName;
    }
    const objectMapping = this._getObjectMapping();
    if (!objectMapping.hasChanges()) {
      return fieldName;
    }
    return objectMapping.fieldMapping.getTargetField(fieldName);
  }

  /**
   * Resolves the mapped target object name when field mapping is enabled.
   *
   * @returns Target object name for missing field messages.
   */
  private _mapMissingTargetObjectName(): string {
    if (!this.useFieldMapping) {
      return this.name;
    }
    const objectMapping = this._getObjectMapping();
    if (!objectMapping.hasChanges()) {
      return this.name;
    }
    return objectMapping.targetObjectName || this.name;
  }

  /**
   * Builds a suffix for missing target field messages when field mapping is used.
   *
   * @param sourceFieldName - Source field name.
   * @param targetFieldName - Target field name.
   * @param targetObjectName - Target object name.
   * @returns Mapping suffix or empty string.
   */
  private _buildMissingTargetMappingSuffix(
    sourceFieldName: string,
    targetFieldName: string,
    targetObjectName: string
  ): string {
    if (!this.useFieldMapping) {
      return '';
    }
    if (!targetFieldName || !targetObjectName) {
      return '';
    }
    if (targetObjectName === this.name && targetFieldName === sourceFieldName) {
      return '';
    }
    return ` (${targetObjectName}.${targetFieldName})`;
  }

  /**
   * Applies default operation flags for auto-added objects.
   *
   * @param targetIsFile - True when target is CSV file media.
   */
  private _applyAutoAddedOperationDefaults(targetIsFile: boolean): void {
    if (!this.isAutoAdded) {
      return;
    }
    this.operation = targetIsFile ? OPERATION.Insert : OPERATION.Readonly;
    this.deleteFromSource = false;
    this.deleteOldData = false;
    this.deleteByHierarchy = false;
    this.hardDelete = false;
  }

  /**
   * Applies default operation flags for special objects.
   */
  private _applySpecialObjectOperationDefaults(): void {
    if (!this.isSpecialObject) {
      return;
    }
    this.operation = OPERATION.Readonly;
    this.deleteFromSource = false;
    this.deleteOldData = false;
    this.deleteByHierarchy = false;
    this.hardDelete = false;
  }

  /**
   * Normalizes delete operation flags into consistent settings.
   */
  private _applyDeleteOperationFlags(): void {
    if (this.operation === OPERATION.DeleteSource) {
      this.deleteFromSource = true;
      this.operation = OPERATION.Delete;
    }
    if (this.operation === OPERATION.DeleteHierarchy) {
      this.deleteByHierarchy = true;
      this.operation = OPERATION.Delete;
    }
    if (this.operation === OPERATION.HardDelete) {
      this.hardDelete = true;
      this.operation = OPERATION.Delete;
    }
  }

  /**
   * Applies target-file overrides for operation handling.
   * Delete-like target operations are excluded or normalized because file target supports insert-only output.
   */
  private _applyTargetCsvOperationOverrides(): void {
    const logger = this.script?.logger ?? Common.logger;
    const hasTargetDeleteOperation = this.operation === OPERATION.Delete && !this.deleteFromSource;
    if (hasTargetDeleteOperation) {
      this.excluded = true;
      logger.warn('objectIsExcluded', this.name);
      this._logVerboseObject('Excluded because target is CSV and delete operations are not supported.');
      return;
    }
    if (this.deleteFromSource) {
      this._logVerboseObject('Target is CSV: preserving delete-from-source operation.');
      this.deleteOldData = false;
      this.deleteByHierarchy = false;
      this.hardDelete = false;
      return;
    }
    if (this.deleteOldData) {
      this._logVerboseObject('Target is CSV: target delete flags ignored.');
    }
    this.deleteOldData = false;
    this.deleteByHierarchy = false;
    this.hardDelete = false;
    this.operation = OPERATION.Insert;
  }

  /**
   * Determines whether the external id should be reset to Id.
   *
   * @param isUserOrGroup - True when the object is User or Group.
   * @param isSpecialObject - True when object is special.
   * @returns True when external id should be reset.
   */
  private _shouldResetExternalId(isUserOrGroup: boolean, isSpecialObject: boolean): boolean {
    if (isUserOrGroup || isSpecialObject) {
      return false;
    }
    return this.operation === OPERATION.Insert || this.deleteFromSource;
  }

  /**
   * Normalizes operation flags and applies media-specific overrides.
   */
  private _normalizeOperationFlags(): void {
    const beforeOperation = this.operation;
    const beforeDeleteOldData = this.deleteOldData;
    const beforeDeleteFromSource = this.deleteFromSource;
    const beforeDeleteByHierarchy = this.deleteByHierarchy;
    const beforeHardDelete = this.hardDelete;
    const isUserOrGroup = this.isUser() || this.isGroup();
    const isSpecialObject = this.isSpecialObject;

    const targetIsFile = this.script?.targetOrg?.media === DATA_MEDIA_TYPE.File;
    this._applyAutoAddedOperationDefaults(targetIsFile);
    this._applySpecialObjectOperationDefaults();
    this._applyDeleteOperationFlags();
    if (targetIsFile) {
      if (this.useFieldMapping) {
        this.useFieldMapping = false;
        this._logVerboseObject('Target is CSV: field mapping disabled.');
      }
      this._applyTargetCsvOperationOverrides();
    }

    if (this._shouldResetExternalId(isUserOrGroup, isSpecialObject)) {
      this.externalId = 'Id';
    }

    if (
      beforeOperation !== this.operation ||
      beforeDeleteOldData !== this.deleteOldData ||
      beforeDeleteFromSource !== this.deleteFromSource ||
      beforeDeleteByHierarchy !== this.deleteByHierarchy ||
      beforeHardDelete !== this.hardDelete
    ) {
      this._logVerboseObject(
        `Operation normalized. operation=${ScriptObject.getStrOperation(this.operation)} deleteOldData=${
          this.deleteOldData
        } deleteFromSource=${this.deleteFromSource} deleteByHierarchy=${this.deleteByHierarchy} hardDelete=${
          this.hardDelete
        }`
      );
    }
  }

  /**
   * Parses the query and throws a normalized error on failure.
   */
  private _parseQueryOrThrow(): void {
    try {
      this.parsedQuery = this._parseQuery(this.query);
      this._logVerboseObject(`Parsed query fields: ${this.fieldsInQuery.join(', ')}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CommandInitializationError(
        Common.logger.getResourceString('malformedQuery', this.name, this.query, message)
      );
    }
  }

  /**
   * Applies delete-mode defaults after query parsing.
   */
  private _applyDeleteModeSettings(): void {
    if (this.operation === OPERATION.Delete && !this.deleteFromSource && !this.deleteByHierarchy) {
      this.deleteOldData = true;
      if (this.parsedQuery) {
        this.parsedQuery.fields = [getComposedField('Id')];
      }
      this._logVerboseObject('Delete mode applied. deleteOldData=true and query forced to Id.');
      return;
    }

    if (!this.deleteByHierarchy) {
      return;
    }

    if (this.operation !== OPERATION.Delete) {
      this.deleteByHierarchy = false;
      this._logVerboseObject('Delete-by-hierarchy disabled because operation is not Delete.');
      return;
    }
  }

  /**
   * Ensures core query fields are present.
   */
  private _applyDefaultQueryFields(): void {
    this._ensureFieldInQuery('Id');
    this._ensureFieldInQuery(this.hasComplexExternalId ? this.complexExternalId : this.externalId);
    this._ensureFieldInQuery(this.complexOriginalExternalId);
    this._logVerboseObject(
      `Default query fields ensured. externalId=${this.externalId} complexExternalId=${this.complexExternalId || ''}`
    );
  }

  /**
   * Adds Person Account fields and exclusions when enabled.
   */
  private _applyPersonAccountFields(): void {
    if (!this.script?.isPersonAccountEnabled) {
      return;
    }
    if (this.name !== 'Account' && this.name !== 'Contact') {
      return;
    }

    this._ensureFieldInQuery('IsPersonAccount');
    this._logVerboseObject('Person Account support: added IsPersonAccount field.');
    if (this.name !== 'Contact') {
      return;
    }

    this._ensureFieldInQuery('AccountId');
    this._logVerboseObject('Person Account support: added AccountId field for Contact.');
  }

  /**
   * Finalizes query fields and string representation.
   */
  private _finalizeQueryState(): void {
    this._dedupeQueryFields();
    this._setQueryFromParsed(this.parsedQuery);
    this._logVerboseObject(`Final query set to: ${this.query}`);
  }

  /**
   * Updates the query string from a parsed query.
   *
   * @param parsedQuery - Parsed query to compose.
   */
  private _setQueryFromParsed(parsedQuery?: ParsedQueryType): void {
    if (!parsedQuery) {
      return;
    }
    const composed = composeQueryWithExpandedComplexFields(parsedQuery);
    this.query = this._transformPolymorphicQuery(composed);
  }

  /**
   * Transforms polymorphic relationship fields into TYPEOF clauses.
   *
   * @param query - Query to transform.
   * @returns Transformed query.
   */
  private _transformPolymorphicQuery(query: string): string {
    if (!query) {
      return query;
    }

    let parsedQuery: ParsedQueryType;
    try {
      parsedQuery = this._parseQueryForParser(query);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const logger = this.script?.logger ?? Common.logger;
      logger.warn('soqlParseFailed', query, message);
      return query;
    }

    const extraDescribe = this.script?.extraSObjectDescriptions.get(this.name);
    const fields: FieldType[] = [];
    (parsedQuery.fields ?? []).forEach((fieldType) => {
      const field = fieldType as SoqlField & { rawValue?: string };
      const rawValue = this._restoreQueryFieldName(String(field.rawValue ?? field.field ?? ''));
      let fieldToAdd = rawValue;

      const describe =
        this.fieldsInQueryMap.get(rawValue) ??
        [...this.fieldsInQueryMap.values()].find((item) => item.__rNames.includes(rawValue));
      if (describe && describe.isPolymorphicField && describe.is__r && describe.polymorphicReferenceObjectType) {
        const parts = rawValue.split('.');
        if (parts.length > 1) {
          const relationshipName = parts[0] ?? '';
          const fieldName = parts.slice(1).join('.');
          fieldToAdd = describe.getPolymorphicQueryField(relationshipName, fieldName);
        }
      }

      if (
        extraDescribe &&
        OBJECTS_TO_FERIFY_IN_QUERY_TRANSFORM.includes(this.name) &&
        !extraDescribe.fieldsMap.has(rawValue)
      ) {
        fieldToAdd = '';
      }

      if (fieldToAdd) {
        fields.push(getComposedField(fieldToAdd));
      }
    });

    parsedQuery.fields = fields;
    return composeQuery(parsedQuery);
  }

  /**
   * Returns true when the field path references a related object.
   *
   * @param fieldName - Field name to inspect.
   * @returns True when the field is a relationship path.
   */
  private _isReferencedFieldPath(fieldName: string): boolean {
    void this;
    if (!fieldName) {
      return false;
    }
    const parts = fieldName
      .split(COMPLEX_FIELDS_SEPARATOR)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    return parts.some((part) => part.includes('.'));
  }

  /**
   * Logs removal of a referenced field from the script query.
   *
   * @param rawFieldName - Raw field name from the query.
   * @param plainFieldName - Normalized field name.
   */
  private _logReferencedFieldExclusion(rawFieldName: string, plainFieldName: string): void {
    const logger = this.script?.logger ?? Common.logger;
    const fieldName = plainFieldName || rawFieldName;
    logger.warn('referencedFieldExcludedFromQuery', this.name, fieldName);
    this._logVerboseField(
      fieldName,
      'Removed referenced field from the script query; it will be added automatically if required.'
    );
  }

  /**
   * Returns true when a lookup is a polymorphic User/Group reference.
   *
   * @param field - Field describe to inspect.
   * @returns True when the lookup should be preserved.
   */
  private _isPolymorphicUserGroupLookup(field: SFieldDescribe): boolean {
    void this;
    const referenced = field.referencedObjectType?.toLowerCase() ?? '';
    const isUserOrGroup =
      referenced === USER_OBJECT_NAME.toLowerCase() || referenced === GROUP_OBJECT_NAME.toLowerCase();
    if (!isUserOrGroup) {
      return false;
    }
    if (field.isPolymorphicField || field.isPolymorphicFieldDefinition) {
      return true;
    }
    return field.referenceTo.length > 1;
  }

  /**
   * Parses the query and applies multiselect field rules.
   *
   * @param query - Query string to parse.
   * @returns Parsed query.
   */
  private _parseQuery(query: string): ParsedQueryType {
    const parsedQuery = this._parseQueryForParser(query);
    parsedQuery.fields = parsedQuery.fields ?? [];
    const fields = [...parsedQuery.fields];
    parsedQuery.fields = [getComposedField('Id')];
    this._multiselectPattern = undefined;
    this._originalFieldsInQuery = [];
    this._referenceFieldToObjectMap = new Map();
    this._explicitPolymorphicUser = false;
    this._explicitPolymorphicGroup = false;

    for (const field of fields) {
      const soqlField = field as SoqlField;
      let fieldName = String(soqlField.field ?? '');
      const rawValue = (field as { rawValue?: string }).rawValue;
      const rawFieldName = this._restoreQueryFieldName(String(rawValue ?? fieldName));
      const normalized = rawFieldName.toLowerCase();
      const parts = normalized.split('_');
      const multiselectAllPatternFieldName = parts.length === 2 ? `${parts[0]}_*` : null;

      if (normalized === 'all') {
        this._setMultiselectPattern('all_true');
        continue;
      }

      if (MULTISELECT_SOQL_KEYWORDS.includes(normalized)) {
        this._setMultiselectPattern(normalized);
        continue;
      }

      if (multiselectAllPatternFieldName && MULTISELECT_SOQL_KEYWORDS.includes(multiselectAllPatternFieldName)) {
        this._setMultiselectPattern(normalized);
        continue;
      }

      if (normalized === 'id') {
        this._originalFieldsInQuery.push('Id');
        continue;
      }

      const plainFieldName = Common.getFieldFromComplexField(rawFieldName);
      if (this._isReferencedFieldPath(plainFieldName)) {
        this._logReferencedFieldExclusion(rawFieldName, plainFieldName);
        continue;
      }

      const referenceParts = rawFieldName.split(REFERENCE_FIELD_OBJECT_SEPARATOR);
      if (referenceParts.length > 1 && !rawFieldName.includes('.')) {
        const explicitTarget = (referenceParts[1] ?? '').toLowerCase();
        if (explicitTarget === USER_OBJECT_NAME.toLowerCase()) {
          this._explicitPolymorphicUser = true;
        } else if (explicitTarget === GROUP_OBJECT_NAME.toLowerCase()) {
          this._explicitPolymorphicGroup = true;
        }
        this._referenceFieldToObjectMap.set(referenceParts[0], referenceParts[1]);
        fieldName = referenceParts[0];
      } else {
        fieldName = rawFieldName;
      }

      this._originalFieldsInQuery.push(fieldName);
      parsedQuery.fields.push(getComposedField(fieldName));
    }

    this._setQueryFromParsed(parsedQuery);
    if (parsedQuery.sObject) {
      this.name = parsedQuery.sObject;
    }

    return parsedQuery;
  }

  /**
   * Scans a query string for explicit User/Group polymorphic targets.
   *
   * @param query - Query to scan.
   * @returns Explicit target requirements.
   */
  private _scanQueryForExplicitPolymorphicTargets(query: string): {
    requiresUser: boolean;
    requiresGroup: boolean;
  } {
    void this;
    let requiresUser = false;
    let requiresGroup = false;
    if (!query || !query.includes(REFERENCE_FIELD_OBJECT_SEPARATOR)) {
      return { requiresUser, requiresGroup };
    }

    const pattern = new RegExp(`\\${REFERENCE_FIELD_OBJECT_SEPARATOR}([A-Za-z0-9_]+)`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(query)) !== null) {
      const index = match.index ?? 0;
      if (index > 0 && query[index - 1] === REFERENCE_FIELD_OBJECT_SEPARATOR) {
        continue;
      }
      const token = String(match[1] ?? '').toLowerCase();
      if (token === USER_OBJECT_NAME.toLowerCase()) {
        requiresUser = true;
      } else if (token === GROUP_OBJECT_NAME.toLowerCase()) {
        requiresGroup = true;
      }
      if (requiresUser && requiresGroup) {
        break;
      }
    }

    return { requiresUser, requiresGroup };
  }

  /**
   * Sanitizes a query to keep the SOQL parser compatible with polymorphic markers.
   *
   * @param query - Raw query.
   * @returns Sanitized query.
   */
  private _sanitizeQueryForParser(query: string): string {
    void this;
    if (!query || !query.includes(REFERENCE_FIELD_OBJECT_SEPARATOR)) {
      return query;
    }
    return query.replaceAll(REFERENCE_FIELD_OBJECT_SEPARATOR, POLYMORPHIC_FIELD_PARSER_PLACEHOLDER);
  }

  /**
   * Parses a query with extra sanitization to tolerate invalid tokens.
   *
   * @param query - Query string.
   * @returns Parsed query.
   */
  private _parseQueryForParser(query: string): ParsedQueryType {
    const sanitized = this._sanitizeQueryForParser(query);
    try {
      return parseQuery(sanitized) as ParsedQueryType;
    } catch (error) {
      const stripped = this._stripInvalidFromClauseTokens(sanitized);
      if (stripped !== sanitized) {
        if (this.name) {
          this._logVerboseObject('Sanitized query for parser by removing invalid tokens after FROM.');
        }
        return parseQuery(stripped) as ParsedQueryType;
      }
      throw error;
    }
  }

  /**
   * Extracts the sObject name from a query without full parsing.
   *
   * @param query - Query string.
   * @returns Object name or undefined.
   */
  private _extractSObjectNameFromQuery(query: string): string | undefined {
    if (!query) {
      return undefined;
    }
    const normalized = query.toLowerCase();
    const token = ' from ';
    const fromIndex = normalized.indexOf(token);
    if (fromIndex < 0) {
      return undefined;
    }

    let index = fromIndex + token.length;
    while (index < query.length && this._isWhitespaceChar(query[index] ?? '')) {
      index += 1;
    }

    const start = index;
    while (index < query.length && this._isQueryIdentifierChar(query[index] ?? '')) {
      index += 1;
    }

    const name = query.slice(start, index).trim();
    return name.length > 0 ? name : undefined;
  }

  /**
   * Removes invalid tokens after the FROM clause to keep parsing stable.
   *
   * @param query - Query string.
   * @returns Sanitized query.
   */
  private _stripInvalidFromClauseTokens(query: string): string {
    if (!query) {
      return query;
    }
    const normalized = query.toLowerCase();
    const token = ' from ';
    const fromIndex = normalized.indexOf(token);
    if (fromIndex < 0) {
      return query;
    }

    let index = fromIndex + token.length;
    while (index < query.length && this._isWhitespaceChar(query[index] ?? '')) {
      index += 1;
    }

    const objectStart = index;
    while (index < query.length && this._isQueryIdentifierChar(query[index] ?? '')) {
      index += 1;
    }
    if (index === objectStart) {
      return query;
    }

    const remainder = query.slice(index);
    const remainderLower = remainder.toLowerCase();
    const clauseTokens = [' where ', ' order ', ' limit ', ' offset ', ' with ', ' for ', ' group ', ' having '];
    let nextIndex = -1;
    for (const clause of clauseTokens) {
      const candidateIndex = remainderLower.indexOf(clause);
      if (candidateIndex >= 0 && (nextIndex < 0 || candidateIndex < nextIndex)) {
        nextIndex = candidateIndex;
      }
    }

    if (nextIndex < 0) {
      return query.slice(0, index).trim();
    }
    return query.slice(0, index) + remainder.slice(nextIndex);
  }

  /**
   * Returns true when a character is whitespace.
   *
   * @param value - Character to inspect.
   * @returns True when whitespace.
   */
  private _isWhitespaceChar(value: string): boolean {
    void this;
    return value === ' ' || value === '\t' || value === '\n' || value === '\r';
  }

  /**
   * Returns true when a character is valid for object identifiers.
   *
   * @param value - Character to inspect.
   * @returns True when the character is allowed.
   */
  private _isQueryIdentifierChar(value: string): boolean {
    void this;
    if (!value) {
      return false;
    }
    const code = value.charCodeAt(0);
    return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || value === '_';
  }

  /**
   * Restores the original polymorphic marker in a parsed field name.
   *
   * @param fieldName - Field name from parser.
   * @returns Restored field name.
   */
  private _restoreQueryFieldName(fieldName: string): string {
    void this;
    if (!fieldName || !fieldName.includes(POLYMORPHIC_FIELD_PARSER_PLACEHOLDER)) {
      return fieldName;
    }
    return fieldName.replaceAll(POLYMORPHIC_FIELD_PARSER_PLACEHOLDER, REFERENCE_FIELD_OBJECT_SEPARATOR);
  }

  /**
   * Resolves multiselect-expanded field names.
   *
   * @param describe - Object describe metadata.
   * @returns Expanded field names.
   */
  private _resolveMultiselectFieldNames(describe: SObjectDescribe): string[] {
    if (!this._multiselectPattern) {
      return [];
    }
    const pattern = this._multiselectPattern;
    const fieldDescribes = [...describe.fieldsMap.values()];
    const expanded: string[] = [];

    fieldDescribes.forEach((fieldDescribe) => {
      const candidate = fieldDescribe as unknown as Record<string, unknown>;
      const hasMismatch = Object.keys(pattern).some((prop) =>
        Common.isDescriptionPropertyMatching(candidate[prop], pattern[prop], true)
      );
      const matchAll = pattern.all === true;
      if (!matchAll && hasMismatch) {
        return;
      }

      const isLookup = fieldDescribe.lookup;
      const isRestrictedLookup =
        isLookup &&
        (OBJECTS_NOT_TO_USE_IN_QUERY_MULTISELECT.includes(fieldDescribe.referencedObjectType) ||
          (FIELDS_NOT_TO_USE_IN_QUERY_MULTISELECT['*']?.includes(fieldDescribe.name) ?? false) ||
          (FIELDS_NOT_TO_USE_IN_QUERY_MULTISELECT[this.name]?.includes(fieldDescribe.name) ?? false));
      const isComplex = !fieldDescribe.isSimple;

      if (isRestrictedLookup || isComplex) {
        return;
      }

      expanded.push(fieldDescribe.name);
    });

    return expanded;
  }

  /**
   * Expands compound field names to their concrete fields.
   *
   * @param fieldNames - Field names to expand.
   * @returns Expanded field names.
   */
  private _expandCompoundFieldNames(fieldNames: string[]): string[] {
    void this;
    const expanded: string[] = [];
    fieldNames.forEach((fieldName) => {
      const compoundFields = COMPOUND_FIELDS.get(fieldName);
      if (compoundFields) {
        expanded.push(...compoundFields);
        return;
      }
      expanded.push(fieldName);
    });
    return expanded;
  }

  /**
   * Resolves excluded query fields for the current object.
   *
   * @param isSource - True when resolving for source queries.
   * @returns Excluded field name set (lowercase).
   */
  private _getExcludedQueryFields(isSource: boolean): Set<string> {
    const excluded = new Set<string>();
    this._getNormalizedFieldList(this.excludedFields).forEach((field) => {
      if (field) {
        excluded.add(field.toLowerCase());
      }
    });
    if (isSource) {
      const globalExcluded = EXCLUDED_QUERY_FIELDS.get(this.name) ?? [];
      globalExcluded.forEach((field) => {
        if (field) {
          excluded.add(field.toLowerCase());
        }
      });
    }
    return excluded;
  }

  /**
   * Resolves fields excluded from target queries.
   *
   * @returns Excluded field name set (lowercase).
   */
  private _getExcludedTargetQueryFields(): Set<string> {
    void this;
    return new Set<string>();
  }

  /**
   * Normalizes a raw field-list script value to an array of field names.
   *
   * @param value - Raw list value from script object.
   * @returns Normalized field name list.
   */
  private _getNormalizedFieldList(value: unknown): string[] {
    void this;
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    if (typeof value === 'string') {
      return value
        .split(COMPLEX_FIELDS_SEPARATOR)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    return [];
  }

  /**
   * Applies multiselect and mandatory field rules.
   *
   * @param describe - Object describe metadata.
   * @param isSource - True when source describe.
   */
  private _addOrRemoveFields(describe: SObjectDescribe, isSource: boolean): void {
    const parsedQuery = this.parsedQuery;
    if (!parsedQuery) {
      return;
    }
    const fieldsBeforeMap = new Map<string, string>();
    this.fieldsInQuery.forEach((fieldName) => {
      fieldsBeforeMap.set(fieldName.toLowerCase(), fieldName);
    });

    const previousExternalId = this.externalId;
    let normalizedExcludedFromUpdateFields = this._getNormalizedFieldList(this.excludedFromUpdateFields);

    const fieldDescribes = [...describe.fieldsMap.values()];
    if (this._multiselectPattern) {
      this._resolveMultiselectFieldNames(describe).forEach((fieldName) => {
        parsedQuery.fields.push(getComposedField(fieldName));
        normalizedExcludedFromUpdateFields = normalizedExcludedFromUpdateFields.filter((field) => field !== fieldName);
      });
    }
    this.excludedFromUpdateFields = normalizedExcludedFromUpdateFields;

    const fieldsInOriginalQuery = [...this.fieldsInQuery];
    parsedQuery.fields = [];
    this._expandCompoundFieldNames(fieldsInOriginalQuery).forEach((fieldName) => {
      parsedQuery.fields.push(getComposedField(fieldName));
    });

    const excludedFields = this._getExcludedQueryFields(isSource);
    parsedQuery.fields = parsedQuery.fields.filter((fieldType: FieldType) => {
      const field = fieldType as SoqlField;
      const rawValue = String((field as { rawValue?: string }).rawValue ?? field.field ?? '');
      return !excludedFields.has(rawValue.toLowerCase());
    });

    this._getMandatoryQueryFields().forEach((fieldName) => {
      if (!this.fieldsInQuery.includes(fieldName)) {
        parsedQuery.fields.push(getComposedField(fieldName));
      }
    });

    if (this.originalExternalIdIsEmpty && !(this.operation === OPERATION.Insert || this.deleteFromSource)) {
      const defaultExternalId = this._getDefaultExternalId(describe);
      if (this.externalId !== defaultExternalId) {
        const existingExternalId = this.hasComplexExternalId ? this.complexExternalId : this.externalId;
        parsedQuery.fields = parsedQuery.fields.filter((fieldType: FieldType) => {
          const field = fieldType as SoqlField;
          return field.field !== this.externalId && field.field !== existingExternalId;
        });
        this.externalId = defaultExternalId;
        parsedQuery.fields.push(getComposedField(this.hasComplexExternalId ? this.complexExternalId : this.externalId));
      }
    }

    if (previousExternalId && previousExternalId !== this.externalId) {
      this._refreshMappingAfterExternalIdChange(previousExternalId);
    }

    const describedFieldNames = new Set([...describe.fieldsMap.keys()].map((fieldName) => fieldName.toLowerCase()));
    parsedQuery.fields = parsedQuery.fields.filter((fieldType: FieldType) => {
      const field = fieldType as SoqlField;
      const fieldName = field.field;
      if (Common.isComplexOr__rField(fieldName)) {
        return true;
      }
      return describedFieldNames.has(fieldName.toLowerCase());
    });

    const excludedObjects = new Set([...(this.script?.excludedObjects ?? []), ...EXCLUDED_OBJECTS]);
    parsedQuery.fields = parsedQuery.fields.filter((fieldType: FieldType) => {
      const field = fieldType as SoqlField;
      const fieldDescribe = fieldDescribes.find(
        (describeField) => describeField.name.toLowerCase() === field.field.toLowerCase() && describeField.lookup
      );
      if (!fieldDescribe) {
        return true;
      }
      if (this._isPolymorphicUserGroupLookup(fieldDescribe)) {
        return true;
      }
      return !excludedObjects.has(fieldDescribe.referencedObjectType);
    });

    this._dedupeQueryFields();
    this._setQueryFromParsed(parsedQuery);
    const fieldsAfterMap = new Map<string, string>();
    this.fieldsInQuery.forEach((fieldName) => {
      fieldsAfterMap.set(fieldName.toLowerCase(), fieldName);
    });
    fieldsBeforeMap.forEach((fieldName, normalized) => {
      if (!fieldsAfterMap.has(normalized)) {
        this._logVerboseField(fieldName, 'Removed from query fields.');
      }
    });
    fieldsAfterMap.forEach((fieldName, normalized) => {
      if (!fieldsBeforeMap.has(normalized)) {
        this._logVerboseField(fieldName, 'Added to query fields by describe rules.');
      }
    });
  }

  /**
   * Refreshes mapping state when external id changes after describe.
   *
   * @param previousExternalId - External id value before update.
   */
  private _refreshMappingAfterExternalIdChange(previousExternalId: string): void {
    if (!this.useFieldMapping || !this.parsedQuery) {
      return;
    }
    const objectMapping = this._getObjectMapping();
    if (!objectMapping.hasChanges()) {
      return;
    }

    const previousMapped = this._mapQueryFieldNameToTarget(previousExternalId, this);
    const currentMapped = this._mapQueryFieldNameToTarget(this.externalId, this);
    if (previousMapped === currentMapped && currentMapped === this.externalId) {
      return;
    }

    this._objectMapping = undefined;
    void this.targetQuery;
  }

  /**
   * Fixes query field casing using described metadata.
   *
   * @param describe - Object describe metadata.
   */
  private _fixFieldNames(describe: SObjectDescribe): void {
    const parsedQuery = this.parsedQuery;
    if (!parsedQuery) {
      return;
    }
    const fieldsInOriginalQuery = [...this.fieldsInQuery];
    const availableFields = [...describe.fieldsMap.keys()];
    const normalizedReferenceMap = new Map<string, string>();
    this._referenceFieldToObjectMap.forEach((value, key) => {
      normalizedReferenceMap.set(key.toLowerCase(), value);
    });
    const updatedReferenceMap = new Map<string, string>();
    const caseMap = new Map<string, string>();
    availableFields.forEach((field) => {
      caseMap.set(field.toLowerCase(), field);
    });

    parsedQuery.fields = [];
    fieldsInOriginalQuery.forEach((fieldName) => {
      const normalized = fieldName.toLowerCase();
      if (!Common.isComplexOr__rField(fieldName)) {
        const correctedFieldName = caseMap.get(normalized) ?? fieldName;
        if (correctedFieldName !== fieldName) {
          this._logVerboseField(fieldName, `Corrected field casing to ${correctedFieldName}.`);
        }
        const referenceValue = normalizedReferenceMap.get(normalized);
        if (referenceValue) {
          updatedReferenceMap.set(correctedFieldName, referenceValue);
        }
        parsedQuery.fields.push(getComposedField(correctedFieldName));
        return;
      }
      const referenceValue = normalizedReferenceMap.get(normalized);
      if (referenceValue) {
        updatedReferenceMap.set(fieldName, referenceValue);
      }
      parsedQuery.fields.push(getComposedField(fieldName));
    });

    if (updatedReferenceMap.size > 0) {
      this._referenceFieldToObjectMap = updatedReferenceMap;
    }

    this._setQueryFromParsed(parsedQuery);
  }

  /**
   * Validates query fields against describe metadata.
   *
   * @param describe - Object describe metadata.
   */
  private _validateFields(describe: SObjectDescribe, isSource: boolean): void {
    const parsedQuery = this.parsedQuery;
    if (!parsedQuery) {
      return;
    }
    if (this.fieldsInQuery.length === 0) {
      throw new CommandInitializationError(Common.logger.getResourceString('missingFieldsToProcess', this.name));
    }
    if (this.isExtraObject) {
      return;
    }

    const objectMapping = this._getObjectMapping();
    const useMapping = !isSource && this.useFieldMapping && objectMapping.hasChanges();
    const externalIdFieldsToCheck = this._resolveExternalIdFieldsForValidation(useMapping);
    if (externalIdFieldsToCheck.length > 0) {
      this._logVerboseObject(`Validating externalId fields: ${externalIdFieldsToCheck.join(', ')}`);
    }
    externalIdFieldsToCheck.forEach((fieldName) => {
      if (!fieldName) {
        return;
      }
      if (!describe.fieldsMap.has(fieldName)) {
        throw new UnresolvableWarning(Common.logger.getResourceString('noExternalKey', this.name));
      }
    });
    const fieldsInQuery = [...this.fieldsInQuery];

    fieldsInQuery.forEach((sourceFieldName) => {
      const targetFieldName = useMapping ? objectMapping.fieldMapping.getTargetField(sourceFieldName) : sourceFieldName;
      if (!Common.isComplexOr__rField(sourceFieldName) && !describe.fieldsMap.has(targetFieldName)) {
        if (sourceFieldName === this.externalId) {
          throw new UnresolvableWarning(Common.logger.getResourceString('noExternalKey', this.name));
        }
        this._collectMissingFields([sourceFieldName], isSource);
      }
    });

    this._setQueryFromParsed(parsedQuery);
  }

  /**
   * Updates field metadata with script-specific settings.
   *
   * @param describe - Object describe metadata.
   */
  private _updateSObjectDescribe(describe: SObjectDescribe): void {
    describe.fieldsMap.forEach((_field, fieldName) => {
      const field = describe.fieldsMap.get(fieldName);
      if (!field) {
        return;
      }
      field.scriptObject = this;
      if (field.lookup && this._referenceFieldToObjectMap.has(field.name)) {
        field.referencedObjectType = this._referenceFieldToObjectMap.get(field.name) ?? field.referencedObjectType;
        field.isPolymorphicField = true;
        field.polymorphicReferenceObjectType = field.referencedObjectType;
      }
    });

    if (this.hasComplexExternalId && !describe.fieldsMap.has(this.complexExternalId)) {
      const complexDescribe = new SFieldDescribe().complex(this.externalId);
      describe.fieldsMap.set(this.complexExternalId, complexDescribe);
      describe.fieldsMap.set(this.externalId, complexDescribe);
      this._logVerboseField(this.complexExternalId, 'Added complex externalId field to describe metadata.');
    }
  }

  /**
   * Fixes incorrect polymorphic field declarations.
   *
   * @param polymorphicFieldNames - Optional list of polymorphic field names.
   */
  private _fixPolymorphicFields(polymorphicFieldNames?: string[]): void {
    const describes = [this.sourceSObjectDescribe, this.targetSObjectDescribe].filter(
      (describe): describe is SObjectDescribe => Boolean(describe)
    );
    if (describes.length === 0) {
      return;
    }

    let polymorphicFields = polymorphicFieldNames;
    if (!polymorphicFields || polymorphicFields.length === 0) {
      const fromDescribe = new Set<string>();
      describes.forEach((describe) => {
        describe.fieldsMap.forEach((field) => {
          if (field.isPolymorphicFieldDefinition) {
            fromDescribe.add(field.name);
          }
        });
      });
      polymorphicFields = fromDescribe.size > 0 ? [...fromDescribe] : undefined;
    }

    if (!polymorphicFields || polymorphicFields.length === 0) {
      return;
    }

    const polymorphicFieldSet = new Set(polymorphicFields);
    const nonPolymorphicDeclared: string[] = [];
    const missingDeclarations: string[] = [];

    describes.forEach((describe) => {
      for (const field of describe.fieldsMap.values()) {
        if (FIELDS_NOT_CHECK_FOR_POLYMORPHIC_ISSUES.includes(field.name)) {
          continue;
        }

        const isDefinition = polymorphicFieldSet.has(field.name);
        field.isPolymorphicFieldDefinition = isDefinition;

        if (field.isPolymorphicField && !isDefinition) {
          field.isPolymorphicField = false;
          field.polymorphicReferenceObjectType = '';
          field.referencedObjectType = field.originalReferencedObjectType || field.referencedObjectType;
          this._referenceFieldToObjectMap.delete(field.name);
          if (!nonPolymorphicDeclared.includes(field.name)) {
            nonPolymorphicDeclared.push(field.name);
          }
        } else if (!field.isPolymorphicField && isDefinition) {
          if (!missingDeclarations.includes(field.name)) {
            missingDeclarations.push(field.name);
          }
        }
      }
    });

    const logger = this.script?.logger ?? Common.logger;
    nonPolymorphicDeclared.forEach((fieldName) => {
      logger.log('fieldIsNotOfPolymorphicType', this.name, fieldName);
    });

    if (missingDeclarations.length > 0 && this.parsedQuery) {
      const fieldsInOriginalQuery = [...this.fieldsInQuery];
      this.parsedQuery.fields = [];
      fieldsInOriginalQuery.forEach((fieldName) => {
        if (Common.isComplexOr__rField(fieldName)) {
          this.parsedQuery?.fields.push(getComposedField(fieldName));
          return;
        }
        const baseFieldName = fieldName.split(REFERENCE_FIELD_OBJECT_SEPARATOR)[0];
        this.parsedQuery?.fields.push(getComposedField(baseFieldName));
        if (missingDeclarations.includes(baseFieldName)) {
          logger.log('fieldMissingPolymorphicDeclaration', this.name, baseFieldName, baseFieldName);
        }
      });
      this._dedupeQueryFields();
      this._setQueryFromParsed(this.parsedQuery);
    }
  }

  /**
   * Refreshes polymorphic lookup definitions from current query fields.
   */
  private _refreshPolymorphicLookups(): void {
    const lookups: PolymorphicLookupType[] = [];
    const seen = new Set<string>();

    this.fieldsInQueryMap.forEach((field) => {
      if (!field.lookup || field.is__r) {
        return;
      }
      if (!field.isPolymorphicFieldDefinition && !field.isPolymorphicField) {
        return;
      }

      if (field.isPolymorphicField && field.polymorphicReferenceObjectType) {
        const reference = field.polymorphicReferenceObjectType;
        const key = `${field.name}:${reference.toLowerCase()}`;
        if (!seen.has(key)) {
          lookups.push({ fieldName: field.name, referencedObjectType: reference });
          seen.add(key);
        }
        return;
      }

      const referenceTargets =
        field.referenceTo.length > 0
          ? field.referenceTo
          : field.referencedObjectType
          ? [field.referencedObjectType]
          : [];
      referenceTargets.forEach((reference) => {
        if (!reference) {
          return;
        }
        const key = `${field.name}:${reference.toLowerCase()}`;
        if (!seen.has(key)) {
          lookups.push({ fieldName: field.name, referencedObjectType: reference });
          seen.add(key);
        }
      });
    });

    this.polymorphicLookups = lookups;
  }

  /**
   * Returns the object mapping for this script object.
   *
   * @returns Object mapping.
   */
  private _getObjectMapping(): ObjectMapping {
    const scriptMapping = this.script?.sourceTargetFieldMapping?.get(this.name);
    if (scriptMapping) {
      return scriptMapping;
    }
    if (!this._objectMapping) {
      const objectMapping = new ObjectMapping(this.name);
      this.fieldMapping.forEach((mapping) => {
        if (mapping.targetObject) {
          objectMapping.targetObjectName = mapping.targetObject;
        }
        if (mapping.sourceField && mapping.targetField) {
          objectMapping.fieldMapping.addMapping(mapping.sourceField, mapping.targetField);
          if (!mapping.sourceField.includes(REFERENCE_FIELD_OBJECT_SEPARATOR)) {
            const sourceRelation = Common.getFieldName__r(undefined, mapping.sourceField);
            const targetRelation = Common.getFieldName__r(undefined, mapping.targetField);
            if (sourceRelation && targetRelation && sourceRelation !== mapping.sourceField) {
              objectMapping.fieldMapping.addMapping(sourceRelation, targetRelation);
            }
          }
        }
      });
      this._objectMapping = objectMapping;
      if (objectMapping.hasChanges()) {
        this._logVerboseObject(`Field mapping target object: ${objectMapping.targetObjectName || this.name}`);
        objectMapping.fieldMapping.sourceToTarget.forEach((targetField, sourceField) => {
          this._logVerboseField(sourceField, `Mapped to target field ${targetField}.`);
        });
      }
    }
    return this._objectMapping ?? new ObjectMapping(this.name);
  }

  /**
   * Maps a field name to its target representation.
   *
   * @param fieldName - Source field name.
   * @returns Target field name.
   */
  private _mapFieldNameToTarget(fieldName: string): string {
    if (!fieldName || !this.useFieldMapping) {
      return fieldName;
    }
    if (fieldName.includes(COMPLEX_FIELDS_QUERY_PREFIX)) {
      return fieldName;
    }

    const objectMapping = this._getObjectMapping();
    const separatorIndex = fieldName.indexOf(REFERENCE_FIELD_OBJECT_SEPARATOR);
    if (separatorIndex > 0 && separatorIndex < fieldName.length - 1) {
      const baseFieldName = fieldName.slice(0, separatorIndex);
      const referencedObjectName = fieldName.slice(separatorIndex + 1);
      const mappedBaseField = objectMapping.fieldMapping.getTargetField(baseFieldName);
      const mappedObjectName =
        this.script?.sourceTargetFieldMapping?.get(referencedObjectName)?.targetObjectName ?? referencedObjectName;
      return `${mappedBaseField}${REFERENCE_FIELD_OBJECT_SEPARATOR}${mappedObjectName}`;
    }

    return objectMapping.fieldMapping.getTargetField(fieldName);
  }

  /**
   * Maps a field name for target queries including WHERE/ORDER BY.
   *
   * @param fieldName - Source field name.
   * @param contextObject - Script object context for mapping.
   * @returns Mapped field name.
   */
  private _mapQueryFieldNameToTarget(fieldName: string, contextObject: ScriptObject): string {
    if (!fieldName || !contextObject.useFieldMapping) {
      return fieldName;
    }

    if (fieldName.includes(COMPLEX_FIELDS_SEPARATOR) || fieldName.includes(COMPLEX_FIELDS_QUERY_PREFIX)) {
      return this._mapComplexFieldNameToTarget(fieldName, contextObject);
    }

    if (fieldName.includes('.')) {
      return this._mapRelationshipFieldNameToTarget(fieldName, contextObject);
    }

    return contextObject._mapFieldNameToTarget(fieldName);
  }

  /**
   * Maps complex field names to target equivalents.
   *
   * @param fieldName - Complex field name.
   * @param contextObject - Script object context for mapping.
   * @returns Mapped complex field name.
   */
  private _mapComplexFieldNameToTarget(fieldName: string, contextObject: ScriptObject): string {
    const plain = fieldName.includes(COMPLEX_FIELDS_SEPARATOR) ? fieldName : Common.getFieldFromComplexField(fieldName);
    const parts = plain
      .split(COMPLEX_FIELDS_SEPARATOR)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length === 0) {
      return fieldName;
    }

    const relationshipPrefix = this._resolveComplexRelationshipPrefix(parts);
    const mappedParts = parts.map((part, index) => {
      const normalizedPart =
        relationshipPrefix && index > 0 && !part.includes('.') ? `${relationshipPrefix}.${part}` : part;
      return this._mapQueryFieldNameToTarget(normalizedPart, contextObject);
    });
    return this._composeComplexQueryField(mappedParts);
  }

  /**
   * Resolves shared relationship prefix for complex field parts.
   *
   * @param parts - Complex field parts.
   * @returns Shared relationship prefix or empty string.
   */
  private _resolveComplexRelationshipPrefix(parts: string[]): string {
    void this;
    if (parts.length < 2) {
      return '';
    }
    const firstPart = parts[0];
    const lastDotIndex = firstPart.lastIndexOf('.');
    if (lastDotIndex <= 0) {
      return '';
    }
    const prefix = firstPart.slice(0, lastDotIndex);
    if (!prefix) {
      return '';
    }
    const canApplyToAllRemaining = parts.slice(1).every((part) => part.length > 0 && !part.includes('.'));
    return canApplyToAllRemaining ? prefix : '';
  }

  /**
   * Composes complex query field from mapped parts preserving relationship prefixes.
   *
   * @param mappedParts - Mapped complex field parts.
   * @returns Composed field token for query parser.
   */
  private _composeComplexQueryField(mappedParts: string[]): string {
    void this;
    if (mappedParts.length === 0) {
      return '';
    }
    if (mappedParts.length === 1) {
      return mappedParts[0];
    }

    const firstPart = mappedParts[0];
    const firstDotIndex = firstPart.lastIndexOf('.');
    if (firstDotIndex <= 0) {
      return Common.getComplexField(mappedParts.join(COMPLEX_FIELDS_SEPARATOR));
    }

    const prefix = firstPart.slice(0, firstDotIndex);
    const suffixes: string[] = [];

    for (const part of mappedParts) {
      if (!part.startsWith(`${prefix}.`)) {
        return Common.getComplexField(mappedParts.join(COMPLEX_FIELDS_SEPARATOR));
      }
      const suffix = part.slice(prefix.length + 1);
      if (!suffix || suffix.includes('.')) {
        return Common.getComplexField(mappedParts.join(COMPLEX_FIELDS_SEPARATOR));
      }
      suffixes.push(suffix);
    }

    return `${prefix}.${COMPLEX_FIELDS_QUERY_PREFIX}${suffixes.join(COMPLEX_FIELDS_QUERY_SEPARATOR)}`;
  }

  /**
   * Maps relationship field paths to target equivalents.
   *
   * @param fieldName - Relationship field path.
   * @param contextObject - Script object context for mapping.
   * @returns Mapped relationship field path.
   */
  private _mapRelationshipFieldNameToTarget(fieldName: string, contextObject: ScriptObject): string {
    const parts = fieldName
      .split('.')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts.length === 0) {
      return fieldName;
    }

    let currentObject: ScriptObject | undefined = contextObject;
    const mappedParts: string[] = [];

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1;
      const activeObject = currentObject ?? contextObject;
      if (isLast) {
        mappedParts.push(activeObject._mapFieldNameToTarget(part));
        return;
      }

      const mappedRelationship = this._mapRelationshipSegmentToTarget(part, activeObject);
      mappedParts.push(mappedRelationship);
      currentObject = this._resolveReferencedObjectForRelationship(part, activeObject);
    });

    return mappedParts.join('.');
  }

  /**
   * Maps a relationship segment (Account__r) to its target name.
   *
   * @param relationshipName - Relationship segment name.
   * @param contextObject - Script object context for mapping.
   * @returns Mapped relationship segment.
   */
  private _mapRelationshipSegmentToTarget(relationshipName: string, contextObject: ScriptObject): string {
    void this;
    if (!contextObject.useFieldMapping) {
      return relationshipName;
    }
    let idFieldName = Common.getFieldNameId(undefined, relationshipName);
    if (idFieldName === relationshipName && (relationshipName.endsWith('__r') || relationshipName.endsWith('__pr'))) {
      idFieldName = Common.replaceLast(relationshipName, '__pr', '__pc');
      idFieldName = Common.replaceLast(idFieldName, '__r', '__c');
    }
    const mappedIdFieldName = contextObject._mapFieldNameToTarget(idFieldName);
    return Common.getFieldName__r(undefined, mappedIdFieldName);
  }

  /**
   * Resolves the referenced object for a relationship segment.
   *
   * @param relationshipName - Relationship segment name.
   * @param contextObject - Script object context for mapping.
   * @returns Referenced script object or undefined.
   */
  private _resolveReferencedObjectForRelationship(
    relationshipName: string,
    contextObject: ScriptObject
  ): ScriptObject | undefined {
    const lookupField = this._resolveLookupFieldForRelationship(relationshipName, contextObject);
    if (!lookupField) {
      return undefined;
    }
    if (lookupField.parentLookupObject) {
      return lookupField.parentLookupObject;
    }
    const referenced = lookupField.referencedObjectType;
    if (!referenced || !this.script) {
      return undefined;
    }
    return this.script.objectsMap.get(referenced);
  }

  /**
   * Finds the lookup field for the given relationship segment.
   *
   * @param relationshipName - Relationship segment name.
   * @param contextObject - Script object context for mapping.
   * @returns Lookup field or undefined.
   */
  private _resolveLookupFieldForRelationship(
    relationshipName: string,
    contextObject: ScriptObject
  ): SFieldDescribe | undefined {
    void this;
    const describe = contextObject.sourceSObjectDescribe ?? contextObject.targetSObjectDescribe;
    if (!describe) {
      return undefined;
    }
    const normalizedRelationship = relationshipName.toLowerCase();
    const idFieldName = Common.getFieldNameId(undefined, relationshipName).toLowerCase();
    for (const field of describe.fieldsMap.values()) {
      if (!field.lookup) {
        continue;
      }
      if (field.nameId.toLowerCase() === idFieldName || field.name__r.toLowerCase() === normalizedRelationship) {
        return field;
      }
    }
    return undefined;
  }

  /**
   * Maps WHERE clause fields to target equivalents.
   *
   * @param where - WHERE clause to update.
   * @param contextObject - Script object context for mapping.
   */
  private _mapWhereClauseFields(where: WhereClause | undefined, contextObject: ScriptObject): void {
    if (!where) {
      return;
    }
    const safeWhere = where as unknown as { left?: { field?: unknown }; right?: WhereClause };
    if (safeWhere.left && typeof safeWhere.left.field === 'string') {
      safeWhere.left.field = this._mapQueryFieldNameToTarget(safeWhere.left.field, contextObject);
    }
    if (safeWhere.right) {
      this._mapWhereClauseFields(safeWhere.right, contextObject);
    }
  }

  /**
   * Maps ORDER BY fields to target equivalents.
   *
   * @param orderBy - Order by definition.
   * @param contextObject - Script object context for mapping.
   */
  private _mapOrderByFields(orderBy: unknown, contextObject: ScriptObject): void {
    if (!Array.isArray(orderBy)) {
      return;
    }
    orderBy.forEach((entry) => {
      const item = entry as { field?: unknown };
      if (!item || typeof item !== 'object') {
        return;
      }
      if (typeof item.field === 'string') {
        item.field = this._mapQueryFieldNameToTarget(item.field, contextObject);
        return;
      }
      if (item.field && typeof item.field === 'object') {
        const fieldItem = item.field as { field?: unknown; rawValue?: unknown };
        if (typeof fieldItem.field === 'string') {
          fieldItem.field = this._mapQueryFieldNameToTarget(fieldItem.field, contextObject);
        } else if (typeof fieldItem.rawValue === 'string') {
          fieldItem.rawValue = this._mapQueryFieldNameToTarget(fieldItem.rawValue, contextObject);
        }
      }
    });
  }

  /**
   * Ensures the Id field is present in the mapped target query.
   *
   * @param parsedQuery - Target query to update.
   */
  private _ensureIdFieldInTargetQuery(parsedQuery: ParsedQueryType): void {
    if (!parsedQuery) {
      return;
    }
    const hasId = parsedQuery.fields.some((fieldType) => {
      const soqlField = fieldType as SoqlField;
      const rawValue = String((soqlField as { rawValue?: string }).rawValue ?? soqlField.field ?? '');
      return rawValue.toLowerCase() === 'id';
    });
    if (hasId) {
      return;
    }
    parsedQuery.fields.push(getComposedField('Id'));
    this._logVerboseField('Id', 'Added to target query to preserve record identity.');
  }

  /**
   * Normalizes mapped relationship fields in target query.
   * When mapping points a lookup source field to a non-lookup target field, relationship selectors (x__r.Name)
   * are replaced with their id field counterpart (x__c) to keep SOQL valid.
   *
   * @param parsedQuery - Target query to normalize.
   */
  private _normalizeMappedRelationshipFields(parsedQuery: ParsedQueryType): void {
    if (!this.useFieldMapping || !parsedQuery) {
      return;
    }

    const targetDescribe = this.targetSObjectDescribe ?? this.sourceSObjectDescribe;
    if (!targetDescribe) {
      return;
    }

    const normalizedFieldNames: string[] = [];
    const seen = new Set<string>();

    parsedQuery.fields.forEach((fieldType) => {
      const soqlField = fieldType as SoqlField;
      const rawValue = String((soqlField as { rawValue?: string }).rawValue ?? soqlField.field ?? '');
      if (!rawValue) {
        return;
      }

      const normalizedFieldName = this._normalizeMappedRelationshipFieldName(rawValue, targetDescribe);
      const normalizedKey = normalizedFieldName.toLowerCase();
      if (!seen.has(normalizedKey)) {
        seen.add(normalizedKey);
        normalizedFieldNames.push(normalizedFieldName);
      }
    });

    const normalizedParsedQuery = parsedQuery;
    normalizedParsedQuery.fields = normalizedFieldNames.map((fieldName) => getComposedField(fieldName));
  }

  /**
   * Normalizes a mapped relationship field name to a valid target field when needed.
   *
   * @param fieldName - Field name to normalize.
   * @param targetDescribe - Target object describe.
   * @returns Normalized field name.
   */
  private _normalizeMappedRelationshipFieldName(fieldName: string, targetDescribe: SObjectDescribe): string {
    if (fieldName.includes(COMPLEX_FIELDS_SEPARATOR) || fieldName.includes(COMPLEX_FIELDS_QUERY_PREFIX)) {
      const plainFieldName = Common.getFieldFromComplexField(fieldName);
      const parts = plainFieldName
        .split(COMPLEX_FIELDS_SEPARATOR)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      if (parts.length === 0) {
        return fieldName;
      }
      const relationshipPrefix = this._resolveComplexRelationshipPrefix(parts);
      const normalizedParts = parts.map((part, index) => {
        const normalizedPart =
          relationshipPrefix && index > 0 && !part.includes('.') ? `${relationshipPrefix}.${part}` : part;
        return this._normalizeMappedRelationshipFieldName(normalizedPart, targetDescribe);
      });
      if (Common.isComplexField(fieldName) || fieldName.includes(COMPLEX_FIELDS_QUERY_PREFIX)) {
        return this._composeComplexQueryField(normalizedParts);
      }
      return normalizedParts.join(COMPLEX_FIELDS_SEPARATOR);
    }

    if (!fieldName.includes('.')) {
      return fieldName;
    }

    const relationshipName = fieldName.split('.')[0]?.trim();
    if (!relationshipName) {
      return fieldName;
    }

    const lookupField = this._resolveLookupFieldByDescribe(relationshipName, targetDescribe);
    if (lookupField) {
      return fieldName;
    }

    let idFieldName = Common.getFieldNameId(undefined, relationshipName);
    if (idFieldName === relationshipName && (relationshipName.endsWith('__r') || relationshipName.endsWith('__pr'))) {
      idFieldName = Common.replaceLast(relationshipName, '__pr', '__pc');
      idFieldName = Common.replaceLast(idFieldName, '__r', '__c');
    }
    if (idFieldName !== relationshipName && targetDescribe.fieldsMap.has(idFieldName)) {
      this._logVerboseField(fieldName, `Normalized mapped relationship field to ${idFieldName}.`);
      return idFieldName;
    }

    return fieldName;
  }

  /**
   * Resolves lookup field by relationship segment within a specific describe payload.
   *
   * @param relationshipName - Relationship segment name.
   * @param describe - Describe payload to inspect.
   * @returns Lookup field or undefined.
   */
  private _resolveLookupFieldByDescribe(
    relationshipName: string,
    describe: SObjectDescribe
  ): SFieldDescribe | undefined {
    void this;
    const normalizedRelationship = relationshipName.toLowerCase();
    const idFieldName = Common.getFieldNameId(undefined, relationshipName).toLowerCase();
    for (const field of describe.fieldsMap.values()) {
      if (!field.lookup) {
        continue;
      }
      if (field.nameId.toLowerCase() === idFieldName || field.name__r.toLowerCase() === normalizedRelationship) {
        return field;
      }
    }
    return undefined;
  }

  /**
   * Resolves external id fields for metadata validation.
   *
   * @param useMapping - Whether to apply mapping.
   * @returns List of external id fields to validate.
   */
  private _resolveExternalIdFieldsForValidation(useMapping: boolean): string[] {
    if (!this.externalId) {
      return [];
    }
    const externalIdName = useMapping ? this._mapQueryFieldNameToTarget(this.externalId, this) : this.externalId;
    const plainExternalId = externalIdName.includes(COMPLEX_FIELDS_SEPARATOR)
      ? externalIdName
      : Common.getFieldFromComplexField(externalIdName);
    const parts = plainExternalId
      .split(COMPLEX_FIELDS_SEPARATOR)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    return parts.map((part) => this._normalizeExternalIdFieldForDescribe(part));
  }

  /**
   * Normalizes external id fields for describe checks.
   *
   * @param fieldName - External id field name.
   * @returns Field name to check in describe metadata.
   */
  private _normalizeExternalIdFieldForDescribe(fieldName: string): string {
    void this;
    if (fieldName.includes('.')) {
      const relationshipName = fieldName.split('.')[0] ?? fieldName;
      let idFieldName = Common.getFieldNameId(undefined, relationshipName);
      if (idFieldName === relationshipName && (relationshipName.endsWith('__r') || relationshipName.endsWith('__pr'))) {
        idFieldName = Common.replaceLast(relationshipName, '__pr', '__pc');
        idFieldName = Common.replaceLast(idFieldName, '__r', '__c');
      }
      return idFieldName;
    }
    return fieldName;
  }

  /**
   * Returns extra fields to update.
   *
   * @returns Extra fields list.
   */
  private _getExtraFieldsToUpdate(): string[] {
    const always = FIELDS_TO_UPDATE_ALWAYS.get(this.name) ?? [];
    return always.concat(this.extraFieldsToUpdate);
  }

  /**
   * Ensures a field is present in the parsed query.
   *
   * @param fieldName - Field name to add.
   */
  private _ensureFieldInQuery(fieldName: string): void {
    const parsedQuery = this.parsedQuery;
    if (!parsedQuery || !fieldName) {
      return;
    }
    const existing = new Set(this.fieldsInQuery.map((field) => field.toLowerCase()));
    if (!existing.has(fieldName.toLowerCase())) {
      parsedQuery.fields.push(getComposedField(fieldName));
      this._logVerboseField(fieldName, 'Added to query fields.');
    }
  }

  /**
   * Deduplicates query field entries.
   */
  private _dedupeQueryFields(): void {
    const parsedQuery = this.parsedQuery;
    if (!parsedQuery) {
      return;
    }
    const seen = new Map<string, FieldType>();
    parsedQuery.fields.forEach((fieldType) => {
      const fieldName = (fieldType as SoqlField).field;
      if (fieldName && !seen.has(fieldName)) {
        seen.set(fieldName, fieldType);
      }
    });
    parsedQuery.fields = [...seen.values()];
  }

  /**
   * Resolves the default external id from metadata.
   *
   * @param describe - Object describe metadata.
   * @returns Default external id field.
   */
  private _getDefaultExternalId(describe: SObjectDescribe): string {
    if (DEFAULT_EXTERNAL_IDS[this.name]) {
      return DEFAULT_EXTERNAL_IDS[this.name];
    }
    const fields = [...describe.fieldsMap.values()];
    const candidates =
      fields.find((field) => field.nameField) ??
      fields.find((field) => field.autoNumber) ??
      fields.find((field) => field.unique);
    return candidates?.name ?? 'Id';
  }

  /**
   * Stores a multiselect pattern token.
   *
   * @param token - Pattern token.
   */
  private _setMultiselectPattern(token: string): void {
    this._multiselectPattern = this._multiselectPattern ?? {};
    const parts = token.split('_');
    if (parts[1] === 'true' || parts[1] === 'false') {
      this._multiselectPattern[parts[0]] = parts[1] === 'true';
    } else {
      this._multiselectPattern[parts[0]] = parts[1];
    }
  }

  /**
   * Returns mandatory fields for the current operation.
   *
   * @returns Mandatory field list.
   */
  private _getMandatoryQueryFields(): string[] {
    void this;
    return [];
  }
}

/**
 * Creates an auto-added User object definition.
 *
 * @returns Script object for User.
 */
export const createAutoUserScriptObject = (): ScriptObject => {
  const obj = new ScriptObject(USER_OBJECT_NAME);
  obj.isAutoAdded = true;
  return obj;
};

/**
 * Creates an auto-added Group object definition.
 *
 * @returns Script object for Group.
 */
export const createAutoGroupScriptObject = (): ScriptObject => {
  const obj = new ScriptObject(GROUP_OBJECT_NAME);
  obj.query = `SELECT Id FROM ${GROUP_OBJECT_NAME} WHERE ${DEFAULT_GROUP_WHERE_CLAUSE}`;
  obj.isAutoAdded = true;
  return obj;
};
