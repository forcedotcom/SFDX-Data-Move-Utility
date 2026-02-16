/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import SfdmuRunAddonManager from '../../addons/SfdmuRunAddonManager.js';
import CsvReportService from '../../csv/CsvReportService.js';
import CsvValidationService from '../../csv/CsvValidationService.js';
import type { CsvIssueRowType } from '../../csv/models/CsvIssueRowType.js';
import type { CsvLookupFieldPairType } from '../../csv/models/CsvLookupFieldPairType.js';
import { Common } from '../../common/Common.js';
import { ADDON_EVENTS, OPERATION } from '../../common/Enumerations.js';
import CjsDependencyAdapters from '../../dependencies/CjsDependencyAdapters.js';
import {
  CSV_ISSUES_ERRORS_FILENAME,
  CSV_SOURCE_FILE_SUFFIX,
  COMPLEX_FIELDS_SEPARATOR,
  FIELD_MAPPING_FILENAME,
  JOB_PIPELINE_STAGES,
  MISSING_PARENT_LOOKUP_RECORDS_ERRORS_FILENAME,
  OLD_DEFAULT_RECORD_TYPE_ID_FIELD_R_NAME,
  NOT_SUPPORTED_OBJECTS,
  POLYMORPHIC_FIELD_PARSER_PLACEHOLDER,
  RECORD_TYPE_SOBJECT_NAME,
  REFERENCE_FIELD_OBJECT_SEPARATOR,
  SPECIAL_OBJECTS,
  SPECIAL_OBJECT_DELETE_ORDER,
  SPECIAL_OBJECT_QUERY_ORDER,
  SPECIAL_OBJECT_UPDATE_ORDER,
  SUPPORTED_OBJECTS_FOR_OPERATION,
  USER_OBJECT_NAME,
  GROUP_OBJECT_NAME,
  VALUE_MAPPING_CSV_FILENAME,
  USER_AND_GROUP_FILENAME,
} from '../../constants/Constants.js';
import type { LoggerType } from '../../logging/LoggerType.js';
import MappingResolver from '../../mapping/MappingResolver.js';
import CachedCsvContent from '../common/CachedCsvContent.js';
import { CommandInitializationNoStackError } from '../common/CommandInitializationNoStackError.js';
import { OrgMetadataError } from '../common/OrgMetadataError.js';
import { SuccessExit } from '../common/SuccessExit.js';
import OrgDataService from '../../org/OrgDataService.js';
import ScriptObject, { createAutoGroupScriptObject, createAutoUserScriptObject } from '../script/ScriptObject.js';
import ScriptMappingItem from '../script/ScriptMappingItem.js';
import type Script from '../script/Script.js';
import ScriptObjectSet from '../script/ScriptObjectSet.js';
import SFieldDescribe from '../sf/SFieldDescribe.js';
import type SObjectDescribe from '../sf/SObjectDescribe.js';
import type { ISFdmuRunCustomAddonJob } from '../../../../custom-addon-sdk/interfaces/index.js';
import MigrationJobTask, { type CrudSummaryType } from './MigrationJobTask.js';
import ProcessedData from './ProcessedData.js';
import type { IMetadataProvider } from './IMetadataProvider.js';

type JobStageNameType = (typeof JOB_PIPELINE_STAGES)[number];
type RetrieveQueryModeType = 'forwards' | 'backwards' | 'target';
type AddonManagerType = {
  initializeAsync?: () => Promise<void>;
  runAddonEventAsync?: (event: ADDON_EVENTS) => Promise<void>;
  triggerAddonModuleMethodAsync?: (
    event: ADDON_EVENTS,
    objectName?: string,
    contextOverrides?: {
      passNumber?: number;
      isFirstPass?: boolean;
      objectSetIndex?: number;
    }
  ) => Promise<boolean | void>;
};

const { parseQuery, getComposedField, composeQuery } = CjsDependencyAdapters.getSoqlParser();

/**
 * Construction options for a migration job.
 */
export type MigrationJobOptionsType = {
  /**
   * Script definition for the job.
   */
  script: Script;

  /**
   * Optional metadata provider for describing objects.
   */
  metadataProvider?: IMetadataProvider;
};

/**
 * Applies special order overrides for tasks.
 *
 * @param tasks - Task list to reorder.
 * @param specialOrder - Map of object to prioritized children.
 */
const applySpecialTaskOrder = (tasks: MigrationJobTask[], specialOrder: Map<string, string[]>): void => {
  for (let leftIndex = 0; leftIndex < tasks.length - 1; leftIndex += 1) {
    const leftTask = tasks[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < tasks.length; rightIndex += 1) {
      const rightTask = tasks[rightIndex];
      const childObjects = specialOrder.get(rightTask.sObjectName);
      if (childObjects && childObjects.includes(leftTask.sObjectName)) {
        tasks.splice(rightIndex, 1);
        tasks.splice(leftIndex, 0, rightTask);
      }
    }
  }
};

/**
 * Determines whether an object should always be forced to Readonly.
 *
 * @param object - Script object under evaluation.
 * @param normalizedOperation - Normalized operation string.
 * @returns Reason string or undefined when no restriction applies.
 */
const resolveForcedReadonlyReason = (object: ScriptObject, normalizedOperation: string): string | undefined => {
  const supportedOperations = SUPPORTED_OBJECTS_FOR_OPERATION.get(object.name);
  const isUserOrGroup = object.isUser() || object.isGroup();
  const isRestrictedObject =
    (SPECIAL_OBJECTS.includes(object.name) || NOT_SUPPORTED_OBJECTS.includes(object.name)) && !isUserOrGroup;
  const candidates: Array<{ condition: boolean; reason: string }> = [
    { condition: isRestrictedObject, reason: 'the object is restricted and can only be processed as Readonly' },
    {
      condition: Boolean(supportedOperations) && !supportedOperations?.includes(normalizedOperation),
      reason: `the ${normalizedOperation} operation is not supported for this object`,
    },
  ];

  for (const candidate of candidates) {
    if (candidate.condition) {
      return candidate.reason;
    }
  }

  return undefined;
};

/**
 * Result of operation normalization against metadata.
 */
type OperationNormalizationResultType = {
  /**
   * Next operation to apply.
   */
  operation: OPERATION;

  /**
   * Human-readable reason for the change.
   */
  reason: string;
};

/**
 * Resolves operation changes based on CRUD metadata.
 *
 * @param operation - Current operation.
 * @param describe - Object metadata describe.
 * @returns Operation normalization result or undefined when no change is required.
 */
const resolveOperationByCrudMetadata = (
  operation: OPERATION,
  describe: SObjectDescribe
): OperationNormalizationResultType | undefined => {
  switch (operation) {
    case OPERATION.Insert:
      if (!describe.createable) {
        return {
          operation: OPERATION.Readonly,
          reason: 'the object is not createable in the org metadata',
        };
      }
      return undefined;
    case OPERATION.Update:
      if (!describe.updateable) {
        return {
          operation: OPERATION.Readonly,
          reason: 'the object is not updateable in the org metadata',
        };
      }
      return undefined;
    case OPERATION.Upsert:
      if (describe.createable && describe.updateable) {
        return undefined;
      }
      if (describe.updateable && !describe.createable) {
        return {
          operation: OPERATION.Update,
          reason: 'the object is updateable but not createable in the org metadata',
        };
      }
      if (describe.createable && !describe.updateable) {
        return {
          operation: OPERATION.Insert,
          reason: 'the object is createable but not updateable in the org metadata',
        };
      }
      return {
        operation: OPERATION.Readonly,
        reason: 'the object is neither createable nor updateable in the org metadata',
      };
    case OPERATION.Delete:
      if (!describe.deletable) {
        return {
          operation: OPERATION.Readonly,
          reason: 'the object is not deletable in the org metadata',
        };
      }
      return undefined;
    default:
      return undefined;
  }
};

/**
 * Creates a default parent lookup object.
 *
 * @param objectName - Object API name.
 * @returns Script object.
 */
const createAutoParentObject = (objectName: string): ScriptObject => {
  if (objectName.toLowerCase() === 'user') {
    return createAutoUserScriptObject();
  }
  if (objectName.toLowerCase() === 'group') {
    return createAutoGroupScriptObject();
  }
  const obj = new ScriptObject(objectName);
  obj.isAutoAdded = true;
  return obj;
};

/**
 * Migration job pipeline for the script.
 */
export default class MigrationJob implements ISFdmuRunCustomAddonJob {
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Script definition for the job.
   */
  public script: Script;

  /**
   * Execution tasks in execution order.
   */
  public tasks: MigrationJobTask[] = [];

  /**
   * Query execution order.
   */
  public queryTasks: MigrationJobTask[] = [];

  /**
   * Delete execution order.
   */
  public deleteTasks: MigrationJobTask[] = [];

  /**
   * Update execution order.
   */
  public updateTasks: MigrationJobTask[] = [];

  /**
   * Mapping resolver for object and field mappings.
   */
  public mappingResolver: MappingResolver = new MappingResolver();

  /**
   * Recorded pipeline stages for diagnostics.
   */
  public stageHistory: JobStageNameType[] = [];

  /**
   * Value mapping definitions keyed by object/field.
   */
  public valueMapping: Map<string, Map<string, string>> = new Map();

  /**
   * Collected CSV issues.
   */
  public csvIssues: CsvIssueRowType[] = [];

  /**
   * Cached CSV content for repairs.
   */
  public cachedCsvContent: CachedCsvContent = new CachedCsvContent();

  /**
   * Per-object record counts derived during prepare stage.
   */
  public recordCounts: Map<string, number> = new Map();

  /**
   * Total record count derived during prepare stage.
   */
  public totalRecordCount = 0;

  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Optional metadata provider.
   */
  private _metadataProvider?: IMetadataProvider;

  /**
   * Maps source CSV paths to raw CSV input paths.
   */
  private _rawCsvPathBySourcePath: Map<string, string> = new Map();

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a migration job instance.
   *
   * @param options - Job options.
   */
  public constructor(options: MigrationJobOptionsType) {
    this.script = options.script;
    this._metadataProvider = options.metadataProvider;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Runs the full job pipeline.
   */
  public async runPipelineAsync(): Promise<void> {
    await this.loadAsync();
    await this.setupAsync();
    await this.processCsvAsync();
    await this.prepareAsync();
    await this.runAddonsAsync();
    await this.executeAsync();
  }

  /**
   * Resolves a task by a field path.
   *
   * @param fieldPath - Full field path.
   * @returns Task and field name or null.
   */
  public getTaskByFieldPath(fieldPath: string): { task: MigrationJobTask | null; field: string } {
    const resolved = this._resolveTaskByFieldPath(fieldPath);
    if (resolved) {
      return resolved;
    }
    const field = (fieldPath || '').split('.').filter(Boolean).pop() ?? '';
    return { task: null, field };
  }

  /**
   * Loads the script and expands polymorphic lookups.
   */
  public loadAsync(): Promise<void> {
    this._recordStage('load');
    this.script.expandPolymorphicLookups();
    return Promise.resolve();
  }

  /**
   * Builds the job tasks and resolves metadata.
   */
  public async setupAsync(): Promise<void> {
    this._recordStage('setup');
    this.script.job = this;

    await this._setupOrgsAsync();
    await this._initializeAddonManagerAsync();

    const initialObjects = this._getAllScriptObjects();
    this.script.objectsMap.clear();
    initialObjects.forEach((object) => object.setup(this.script));
    await this._loadFieldMappingConfigurationFileAsync(initialObjects);

    this.mappingResolver = new MappingResolver();
    this.mappingResolver.addScriptObjects(initialObjects);
    this._refreshSourceTargetFieldMapping();

    await this._describeObjectsAsync(initialObjects);

    await this._ensureParentLookupObjectsAsync();
    this._linkLookupRelationships();
    this._ensureLookupFieldsInQuery();
    this._refreshSourceTargetFieldMapping();
    if (this._metadataProvider) {
      this._normalizeOperationsByMetadata();
      this._excludeObjectsAfterDescribe();
      await this._ensureUserGroupPairAfterExcludeAsync();
      if (this._removeLookupsToExcludedObjects()) {
        this._excludeObjectsAfterDescribe();
        await this._ensureUserGroupPairAfterExcludeAsync();
      }
      this._refreshSourceTargetFieldMapping();
    }

    this._createTasks();
  }

  /**
   * Handles CSV processing stage.
   */
  public async processCsvAsync(): Promise<void> {
    this._recordStage('processCsv');
    await this._loadValueMappingFileAsync();

    const sourceIsCsv = this.script.sourceOrg?.isFileMedia ?? false;
    const targetIsCsv = this.script.targetOrg?.isFileMedia ?? false;
    if (!sourceIsCsv && !targetIsCsv) {
      return;
    }
    if (!sourceIsCsv) {
      return;
    }

    const csvTasks = this._getCsvTasks();
    if (csvTasks.length === 0) {
      return;
    }

    await this._ensureCsvDirectoriesAsync();
    if (sourceIsCsv) {
      await this._clearCsvDirectoryAsync(this.script.sourceDirectoryPath, 'unableToDeleteSourceDirectory');
    }
    await this._prepareUserAndGroupCsvSourcesAsync(csvTasks);

    const logger = this._getLogger();
    if (this.script.importCSVFilesAsIs) {
      await this._copyCsvFilesToSourceDirectoryAsync(csvTasks);
      logger.log('processingCsvFilesSkipped');
      return;
    }

    logger.log('processingCsvFiles');
    await this._validateAndRepairSourceCsvFilesAsync(csvTasks);
    logger.log('validationCsvFileCompleted');

    if (this.script.validateCSVFilesOnly) {
      throw new SuccessExit();
    }

    this.cachedCsvContent.clear();
  }

  /**
   * Prepares the job for execution.
   */
  public async prepareAsync(): Promise<void> {
    this._recordStage('prepare');
    this._refreshSourceTargetFieldMapping();
    await this._preflightReadinessAsync();
    this._createTasks();
    this.tasks.forEach((task) => task.refreshPreflightState());
    await this._calculateRecordCountsAsync();
  }

  /**
   * Runs add-on pipeline stages.
   */
  public async runAddonsAsync(): Promise<void> {
    this._recordStage('addons');
    await this._runAddonEventAsync(ADDON_EVENTS.onBefore);
  }

  /**
   * Executes the job.
   */
  public async executeAsync(): Promise<void> {
    this._recordStage('execute');
    await this._deleteOldRecordsAsync();
    await this._retrieveRecordsAsync();
    await this._updateRecordsAsync();
    await this._runAddonEventAsync(ADDON_EVENTS.onAfter);
  }

  /**
   * Returns task by source object name.
   *
   * @param sObjectName - Source object name.
   * @returns Task or undefined.
   */
  public getTaskBySObjectName(sObjectName: string): MigrationJobTask | undefined {
    return this.tasks.find((task) => task.sObjectName === sObjectName);
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Records the pipeline stage.
   *
   * @param stage - Stage name.
   */
  private _recordStage(stage: JobStageNameType): void {
    this.stageHistory.push(stage);
  }

  /**
   * Initializes org connections and validation.
   */
  private async _setupOrgsAsync(): Promise<void> {
    const sourceOrg = this.script.sourceOrg;
    const targetOrg = this.script.targetOrg;
    if (sourceOrg) {
      await sourceOrg.setupAsync(true);
    }
    if (targetOrg) {
      await targetOrg.setupAsync(false);
    }
    if (sourceOrg) {
      await sourceOrg.promptUserForProductionModificationAsync();
    }
    if (targetOrg && targetOrg !== sourceOrg) {
      await targetOrg.promptUserForProductionModificationAsync();
    }
  }

  /**
   * Resolves a task by a field path using lookup traversal.
   *
   * @param fieldPath - Full field path.
   * @param prevTask - Previous task in the traversal.
   * @returns Task and resolved field name or null.
   */
  private _resolveTaskByFieldPath(
    fieldPath: string,
    prevTask?: MigrationJobTask
  ): { task: MigrationJobTask; field: string } | null {
    const parts = (fieldPath || '').split('.').filter(Boolean);
    if (parts.length === 0) {
      return null;
    }

    if (!prevTask) {
      const objectTask = this.tasks.find((task) => task.sObjectName === parts[0]);
      if (!objectTask) {
        return null;
      }
      parts.shift();
      return this._resolveTaskByFieldPath(parts.join('.'), objectTask);
    }

    const fieldName = parts.length > 1 ? Common.getFieldNameId(undefined, parts[0]) : parts[0];
    const fieldDescribe = prevTask.scriptObject.fieldsInQueryMap.get(fieldName);
    if (!fieldDescribe) {
      return null;
    }

    if (fieldDescribe.lookup) {
      const fieldTask = this.tasks.find((task) => task.sObjectName === fieldDescribe.referencedObjectType);
      if (!fieldTask) {
        return null;
      }
      parts.shift();
      return this._resolveTaskByFieldPath(parts.join('.'), fieldTask);
    }

    return {
      task: prevTask,
      field: fieldName,
    };
  }

  /**
   * Ensures an addon manager instance is configured.
   */
  private async _initializeAddonManagerAsync(): Promise<void> {
    if (!this.script.addonManager) {
      this.script.addonManager = new SfdmuRunAddonManager(this.script);
    }
    const manager = this.script.addonManager as AddonManagerType | undefined;
    if (manager?.initializeAsync) {
      await manager.initializeAsync();
    }
  }

  /**
   * Refreshes source-to-target mapping registry on the script.
   */
  private _refreshSourceTargetFieldMapping(): void {
    this.script.sourceTargetFieldMapping = this.mappingResolver.getObjectMappings();
  }

  /**
   * Performs preflight readiness work before real queries and deletes.
   */
  private async _preflightReadinessAsync(): Promise<void> {
    const logger = this._getLogger();
    logger.log('newLine');
    logger.log('analysingData');

    await Common.serialExecAsync(
      this.tasks.map((task) => async () => {
        await this._prepareTaskForPreflightAsync(task);
        return undefined;
      })
    );

    this._refreshSourceTargetFieldMapping();
    this.tasks.forEach((task) => task.refreshPreflightState());
  }

  /**
   * Prepares a single task for later query and delete stages.
   *
   * @param task - Task to prepare.
   */
  private async _prepareTaskForPreflightAsync(task: MigrationJobTask): Promise<void> {
    const logger = this._getLogger();
    logger.log('processingObject', task.sObjectName);

    task.scriptObject.createDeleteQuery();
    task.scriptObject.ensureLookupFieldsInQuery();
    await this._prepareLookupRelationshipsForTaskAsync(task);
    task.scriptObject.refreshQueryState();
    this._precomputeMappedFieldNames(task);
  }

  /**
   * Ensures lookup relationship fields and external id links are ready.
   *
   * @param task - Task being prepared.
   */
  private async _prepareLookupRelationshipsForTaskAsync(task: MigrationJobTask): Promise<void> {
    const lookupFields = [...task.scriptObject.fieldsInQueryMap.values()].filter(
      (field) => field.lookup && field.parentLookupObject
    );
    if (lookupFields.length === 0) {
      return;
    }

    await Common.serialExecAsync(
      lookupFields.map((lookupField) => () => {
        const parentObject = lookupField.parentLookupObject;
        if (!parentObject) {
          return Promise.resolve(undefined);
        }

        const parentExternalIdField = this._ensureParentExternalIdField(task, lookupField, parentObject);
        task.scriptObject.ensureLookupFieldsInQuery();
        const relationshipFieldNames = this._getRelationshipFieldNames(lookupField);
        relationshipFieldNames.forEach((relationshipFieldName) => {
          const relationshipField = this._ensureRelationshipField(
            task.scriptObject,
            lookupField,
            relationshipFieldName
          );
          this._linkChildRelationship(parentExternalIdField, relationshipField);
        });
        return Promise.resolve(undefined);
      })
    );
  }

  /**
   * Ensures the parent external id field is present in the parent query.
   *
   * @param task - Child task.
   * @param lookupField - Child lookup field.
   * @param parentObject - Parent script object.
   * @returns Parent external id field describe.
   */
  private _ensureParentExternalIdField(
    task: MigrationJobTask,
    lookupField: SFieldDescribe,
    parentObject: ScriptObject
  ): SFieldDescribe {
    const logger = this._getLogger();
    const nextParentObject = parentObject;
    let parentExternalIdFieldName = nextParentObject.complexExternalId;
    let parentExternalIdField = nextParentObject.fieldsInQueryMap.get(parentExternalIdFieldName);

    if (!parentExternalIdField) {
      nextParentObject.ensureFieldInQuery(parentExternalIdFieldName);
      logger.log(
        'theExternalIdNotFoundInTheQuery',
        task.sObjectName,
        lookupField.nameId,
        parentExternalIdFieldName,
        nextParentObject.name,
        nextParentObject.name,
        nextParentObject.externalId
      );
      this._logVerboseObject(
        nextParentObject.name,
        `Added externalId field ${parentExternalIdFieldName} due to child lookup ${task.sObjectName}.${lookupField.nameId}.`
      );
      parentExternalIdFieldName = nextParentObject.complexExternalId;
      parentExternalIdField = nextParentObject.fieldsInQueryMap.get(parentExternalIdFieldName);
    }

    if (!parentExternalIdField) {
      throw new OrgMetadataError(logger.getResourceString('noExternalKey', nextParentObject.name));
    }

    return parentExternalIdField;
  }

  /**
   * Returns relationship field names for a lookup field.
   *
   * @param lookupField - Lookup field describe.
   * @returns Relationship field names.
   */
  private _getRelationshipFieldNames(lookupField: SFieldDescribe): string[] {
    void this;
    const names = new Set<string>();
    if (lookupField.fullName__r) {
      names.add(lookupField.fullName__r);
    }
    if (lookupField.fullOriginalName__r) {
      names.add(lookupField.fullOriginalName__r);
    }
    return [...names.values()];
  }

  /**
   * Ensures a relationship field describe exists and links it to the lookup field.
   *
   * @param scriptObject - Child script object.
   * @param lookupField - Lookup field describe.
   * @param relationshipFieldName - Relationship field name.
   * @returns Relationship field describe.
   */
  private _ensureRelationshipField(
    scriptObject: ScriptObject,
    lookupField: SFieldDescribe,
    relationshipFieldName: string
  ): SFieldDescribe {
    void this;
    const sourceDescribe = scriptObject.sourceSObjectDescribe;
    const targetDescribe = scriptObject.targetSObjectDescribe;
    const primaryDescribe = sourceDescribe ?? targetDescribe;
    let relationshipField = primaryDescribe?.fieldsMap.get(relationshipFieldName);
    const nextLookupField = lookupField;

    if (!relationshipField) {
      relationshipField = new SFieldDescribe({
        objectName: scriptObject.name,
        name: relationshipFieldName,
        lookup: true,
        referencedObjectType: nextLookupField.referencedObjectType,
        parentLookupObject: nextLookupField.parentLookupObject,
        idSField: nextLookupField,
        isDescribed: true,
      });
      relationshipField.scriptObject = scriptObject;
      this._logVerboseObject(
        scriptObject.name,
        `Created relationship field ${relationshipFieldName} for lookup ${lookupField.nameId}.`
      );
    }

    relationshipField.parentLookupObject = nextLookupField.parentLookupObject;
    relationshipField.idSField = nextLookupField;
    relationshipField.scriptObject = scriptObject;
    if (nextLookupField.isPolymorphicField && nextLookupField.polymorphicReferenceObjectType) {
      relationshipField.isPolymorphicField = true;
      relationshipField.polymorphicReferenceObjectType = nextLookupField.polymorphicReferenceObjectType;
    }
    nextLookupField.__rSField = relationshipField;

    if (sourceDescribe && !sourceDescribe.fieldsMap.has(relationshipFieldName)) {
      sourceDescribe.addField(relationshipField);
    }
    if (targetDescribe && !targetDescribe.fieldsMap.has(relationshipFieldName)) {
      targetDescribe.addField(relationshipField);
    }

    return relationshipField;
  }

  /**
   * Links a child relationship field to the parent external id field.
   *
   * @param parentExternalIdField - Parent external id field.
   * @param relationshipField - Relationship field to link.
   */
  private _linkChildRelationship(parentExternalIdField: SFieldDescribe, relationshipField: SFieldDescribe): void {
    void this;
    const existing = parentExternalIdField.child__rSFields.some((field) => field.name === relationshipField.name);
    if (!existing) {
      parentExternalIdField.child__rSFields.push(relationshipField);
    }
  }

  /**
   * Precomputes mapped field names using the mapped target query.
   *
   * @param task - Task to update.
   */
  private _precomputeMappedFieldNames(task: MigrationJobTask): void {
    void this;
    const sourceFieldNames = task.scriptObject.fieldsInQuery;
    if (sourceFieldNames.length === 0) {
      return;
    }

    const targetQuery = task.scriptObject.targetQuery;
    const sanitizedQuery = targetQuery.includes(REFERENCE_FIELD_OBJECT_SEPARATOR)
      ? targetQuery.replaceAll(REFERENCE_FIELD_OBJECT_SEPARATOR, POLYMORPHIC_FIELD_PARSER_PLACEHOLDER)
      : targetQuery;
    const parsedTargetQuery = parseQuery(sanitizedQuery);
    const targetFieldNames = (parsedTargetQuery.fields ?? []).map((fieldType) => {
      const field = fieldType as { field?: string };
      const fieldName = field.field ?? '';
      if (!fieldName || !fieldName.includes(POLYMORPHIC_FIELD_PARSER_PLACEHOLDER)) {
        return fieldName;
      }
      return fieldName.replaceAll(POLYMORPHIC_FIELD_PARSER_PLACEHOLDER, REFERENCE_FIELD_OBJECT_SEPARATOR);
    });

    const maxIndex = Math.min(sourceFieldNames.length, targetFieldNames.length);
    for (let index = 0; index < maxIndex; index += 1) {
      const sourceFieldName = sourceFieldNames[index];
      const targetFieldName = targetFieldNames[index];
      if (!targetFieldName) {
        continue;
      }
      const fieldDescribe = task.scriptObject.fieldsInQueryMap.get(sourceFieldName);
      if (!fieldDescribe) {
        continue;
      }
      fieldDescribe.mappedName = targetFieldName;
    }
  }

  /**
   * Calculates record counts for CSV-based tasks.
   */
  private async _calculateRecordCountsAsync(): Promise<void> {
    this.recordCounts = new Map();
    this.totalRecordCount = 0;
    const orgDataService = new OrgDataService(this.script);

    await Common.serialExecAsync(
      this.tasks.map((task) => async () => {
        const sourceCount = await this._resolveSourceRecordCountAsync(task, orgDataService);
        this.recordCounts.set(task.sObjectName, sourceCount);
        this.totalRecordCount += sourceCount;
        const nextTask = task;
        nextTask.sourceData.totalRecordCount = sourceCount;

        const targetCount = await this._resolveTargetRecordCountAsync(task, orgDataService);
        nextTask.targetData.totalRecordCount = targetCount;
        return undefined;
      })
    );
  }

  /**
   * Resolves the source record count for the provided task.
   *
   * @param task - Task to inspect.
   * @param orgDataService - Org data service instance.
   * @returns Record count for the source side.
   */
  private async _resolveSourceRecordCountAsync(
    task: MigrationJobTask,
    orgDataService: OrgDataService
  ): Promise<number> {
    const sourceOrg = this.script.sourceOrg;
    const sourceIsFile = sourceOrg?.isFileMedia ?? false;
    if (sourceIsFile || task.scriptObject.useSourceCSVFile) {
      const sourceFile = this._getSourceCsvFilePath(task);
      const exists = await this._pathExistsAsync(sourceFile);
      if (!exists) {
        return 0;
      }
      const rows = await Common.readCsvFileAsync(sourceFile, 0, undefined, false, true);
      const count = rows.length;
      return count;
    }

    if (!sourceOrg?.isOrgMedia) {
      return 0;
    }

    return this._queryOrgRecordCountAsync(task, orgDataService, false);
  }

  /**
   * Resolves the target record count for the provided task.
   *
   * @param task - Task to inspect.
   * @param orgDataService - Org data service instance.
   * @returns Record count for the target side.
   */
  private async _resolveTargetRecordCountAsync(
    task: MigrationJobTask,
    orgDataService: OrgDataService
  ): Promise<number> {
    const targetOrg = this.script.targetOrg;
    if (!targetOrg?.isOrgMedia) {
      return 0;
    }
    if (!task.preflightEligibility.canQueryTarget) {
      return 0;
    }
    return this._queryOrgRecordCountAsync(task, orgDataService, true);
  }

  /**
   * Queries the org for a COUNT() result based on the task query.
   *
   * @param task - Task to inspect.
   * @param orgDataService - Org data service instance.
   * @param isTarget - True to use target query settings.
   * @returns Count of matching records.
   */
  private async _queryOrgRecordCountAsync(
    task: MigrationJobTask,
    orgDataService: OrgDataService,
    isTarget: boolean
  ): Promise<number> {
    const logger = this._getLogger();
    const org = isTarget ? this.script.targetOrg : this.script.sourceOrg;
    if (!org || !org.isOrgMedia) {
      return 0;
    }

    const baseQuery = task.createQuery(undefined, true, undefined, false, isTarget);
    if (!baseQuery) {
      return 0;
    }
    const countQuery = this._buildCountQuery(baseQuery);
    if (!countQuery) {
      return 0;
    }

    try {
      const records = await orgDataService.queryOrgAsync(countQuery, org, {
        useBulk: false,
        useQueryAll: isTarget ? task.scriptObject.queryAllTarget : task.scriptObject.useQueryAll,
      });
      const count = this._extractCountValue(records);
      const limit = this._resolveCountLimit(task, isTarget);
      const resolvedCount = typeof limit === 'number' ? Math.min(count, limit) : count;
      logger.log(
        'totalRecordsAmountByQueryString',
        task.sObjectName,
        String(resolvedCount),
        logger.getResourceString(isTarget ? 'target' : 'source')
      );
      return resolvedCount;
    } catch {
      const limit = this._resolveCountLimit(task, isTarget);
      const fallback = typeof limit === 'number' ? limit : 0;
      logger.log(
        'totalRecordsAmountByQueryString',
        task.sObjectName,
        String(fallback),
        logger.getResourceString(isTarget ? 'target' : 'source')
      );
      return fallback;
    }
  }

  /**
   * Builds a COUNT() query from the provided base query.
   *
   * @param query - Base query string.
   * @returns COUNT query string.
   */
  private _buildCountQuery(query: string): string {
    void this;
    if (!query) {
      return '';
    }
    const sanitized = query.includes(REFERENCE_FIELD_OBJECT_SEPARATOR)
      ? query.replaceAll(REFERENCE_FIELD_OBJECT_SEPARATOR, POLYMORPHIC_FIELD_PARSER_PLACEHOLDER)
      : query;
    try {
      const parsed = parseQuery(sanitized);
      parsed.fields = [getComposedField('COUNT(Id) CNT')];
      parsed.limit = undefined;
      parsed.offset = undefined;
      parsed.orderBy = undefined;
      const composed = composeQuery(parsed);
      return composed.replaceAll(POLYMORPHIC_FIELD_PARSER_PLACEHOLDER, REFERENCE_FIELD_OBJECT_SEPARATOR);
    } catch {
      const fromIndex = query.search(/\bFROM\b/i);
      if (fromIndex < 0) {
        return '';
      }
      return `SELECT COUNT(Id) CNT ${query.slice(fromIndex).trimStart()}`;
    }
  }

  /**
   * Extracts the COUNT() value from aggregate results.
   *
   * @param records - Aggregate records list.
   * @returns Parsed count.
   */
  private _extractCountValue(records: Array<Record<string, unknown>>): number {
    void this;
    if (records.length === 0) {
      return 0;
    }
    const first = records[0] ?? {};
    const raw = first['CNT'] ?? first['expr0'] ?? first['Expr0'] ?? 0;
    const parsed = Number.parseInt(String(raw), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Resolves a LIMIT value to clamp COUNT results.
   *
   * @param task - Task to inspect.
   * @param isTarget - True to use target query metadata.
   * @returns Limit or undefined.
   */
  private _resolveCountLimit(task: MigrationJobTask, isTarget: boolean): number | undefined {
    void this;
    const parsed = isTarget ? task.data.parsedTargetQuery : task.scriptObject.parsedQuery;
    const rawLimit = parsed?.limit;
    if (rawLimit === null || typeof rawLimit === 'undefined') {
      return undefined;
    }
    const limit = typeof rawLimit === 'number' ? rawLimit : Number.parseInt(String(rawLimit), 10);
    if (Number.isNaN(limit) || limit <= 0) {
      return undefined;
    }
    return limit;
  }

  /**
   * Executes a global addon event when available.
   *
   * @param event - Addon event name.
   */
  private async _runAddonEventAsync(event: ADDON_EVENTS): Promise<void> {
    const manager = this.script.addonManager as AddonManagerType | undefined;
    if (manager?.runAddonEventAsync) {
      await manager.runAddonEventAsync(event);
      return;
    }
    if (manager?.triggerAddonModuleMethodAsync) {
      await manager.triggerAddonModuleMethodAsync(event);
    }
  }

  /**
   * Executes object-scoped addon events in query task order.
   *
   * @param event - Addon event name.
   * @returns True when any object addon executed.
   */
  private async _runObjectAddonEventAsync(event: ADDON_EVENTS): Promise<boolean> {
    const manager = this.script.addonManager as AddonManagerType | undefined;
    if (!manager?.triggerAddonModuleMethodAsync) {
      return false;
    }

    let processed = false;
    await Common.serialExecAsync(
      this.queryTasks.map((task) => async () => {
        const result = await manager.triggerAddonModuleMethodAsync?.(event, task.sObjectName);
        processed = Boolean(result) || processed;
        return undefined;
      })
    );
    return processed;
  }

  /**
   * Executes delete phase for tasks that require it.
   */
  private async _deleteOldRecordsAsync(): Promise<void> {
    const logger = this._getLogger();
    logger.log('newLine');
    logger.log('deletingTargetData');

    let deleted = false;
    await Common.serialExecAsync(
      this.deleteTasks.map((task) => async () => {
        const wasDeleted = await task.deleteOldRecordsAsync();
        deleted = deleted || wasDeleted;
        return undefined;
      })
    );

    if (deleted) {
      logger.log('deletingDataCompleted');
    } else {
      logger.log('deletingDataSkipped');
    }
  }

  /**
   * Executes data retrieval phase for query tasks.
   */
  private async _retrieveRecordsAsync(): Promise<void> {
    const logger = this._getLogger();
    const step1 = logger.getResourceString('step1');
    const step2 = logger.getResourceString('step2');

    logger.log('newLine');
    logger.log(`${logger.getResourceString('source')}:`);
    logger.log('separator');

    logger.log('newLine');
    logger.logColored('retrievingData', 'green', step1);
    await this._runRetrievePassAsync('forwards', false);
    logger.log('retrievingDataCompleted', step1);

    logger.log('newLine');
    logger.logColored('retrievingData', 'green', step2);

    logger.log('pass1');
    logger.log('separator');
    await this._runRetrievePassAsync('backwards', false);

    logger.log('newLine');
    logger.log('pass2');
    logger.log('separator');
    await this._runRetrievePassAsync('backwards', false);

    logger.log('newLine');
    logger.log('pass3');
    logger.log('separator');
    await this._runRetrievePassAsync('forwards', true);

    logger.log('newLine');
    logger.log('pass4');
    logger.log('separator');
    await this._runRetrievePassAsync('forwards', true);

    logger.log('newLine');
    logger.log(`${logger.getResourceString('target')}:`);
    logger.log('separator');
    await this._runRetrievePassAsync('target', false);
    logger.log('retrievingDataCompleted', step2);

    logger.log('newLine');
    logger.logColored('processingAddon', 'green');
    const beforeProcessed = await this._runObjectAddonEventAsync(ADDON_EVENTS.onBefore);
    if (!beforeProcessed) {
      logger.log('nothingToProcess');
    }

    logger.log('newLine');
    logger.logColored('fetchingSummary', 'green');
    this.queryTasks.forEach((task) => {
      logger.log(
        'amountOfRetrievedRecordsByQueries',
        task.sObjectName,
        logger.getResourceString('source'),
        String(task.sourceData.queryCount),
        String(task.sourceData.idRecordsMap.size)
      );
      if (task.targetData.org?.isFileMedia) {
        logger.log('targetNotQueriedCsv', task.sObjectName, logger.getResourceString('target'));
      } else if (task.scriptObject.operation === OPERATION.Insert) {
        logger.log('targetNotQueriedInsert', task.sObjectName, logger.getResourceString('target'));
      } else {
        logger.log(
          'amountOfRetrievedRecordsByQueries',
          task.sObjectName,
          logger.getResourceString('target'),
          String(task.targetData.queryCount),
          String(task.targetData.idRecordsMap.size)
        );
      }
    });
    await this._runAddonEventAsync(ADDON_EVENTS.onDataRetrieved);
    logger.log('newLine');
  }

  /**
   * Executes a single retrieval pass for all query tasks.
   *
   * @param queryMode - Query mode to execute.
   * @param reversed - True when using reversed pass logic.
   * @returns True when any task retrieved records.
   */
  private async _runRetrievePassAsync(queryMode: RetrieveQueryModeType, reversed: boolean): Promise<boolean> {
    const results = await Common.serialExecAsync(
      this.queryTasks.map((task) => async () => task.retrieveRecordsAsync(queryMode, reversed))
    );
    const retrieved = results.some(Boolean);
    if (!retrieved) {
      this._getLogger().log('noRecords');
    }
    return retrieved;
  }

  /**
   * Executes update phase for all tasks.
   */
  private async _updateRecordsAsync(): Promise<void> {
    const logger = this._getLogger();
    const step1 = logger.getResourceString('step1');
    const step2 = logger.getResourceString('step2');
    const hasDeleteFromSource = this.tasks.some((task) => task.scriptObject.isDeletedFromSourceOperation);
    const tasksToProcess = hasDeleteFromSource ? this.deleteTasks : this.tasks;
    const targetIsFile = this.script.targetOrg?.isFileMedia ?? false;

    let noAbortPrompt = false;
    let totalProcessedRecordsAmount = 0;
    const totalProcessedRecordsByObjectsMap = new Map<string, number>();
    let allMissingParentLookups: Array<Record<string, unknown>> = [];
    const passSummaryByObject = new Map<string, Map<string, CrudSummaryType>>();
    const passLabels = {
      forward: logger.getResourceString('pass1'),
      backward1: logger.getResourceString('pass2'),
      backward2: logger.getResourceString('pass3'),
      delete: logger.getResourceString('deletePass'),
    };

    const recordPassSummary = (objectName: string, passLabel: string, summary: CrudSummaryType): void => {
      if (!passLabel) {
        return;
      }
      let passMap = passSummaryByObject.get(objectName);
      if (!passMap) {
        passMap = new Map();
        passSummaryByObject.set(objectName, passMap);
      }
      const existing = passMap.get(passLabel) ?? { inserted: 0, updated: 0, deleted: 0 };
      passMap.set(passLabel, {
        inserted: existing.inserted + summary.inserted,
        updated: existing.updated + summary.updated,
        deleted: existing.deleted + summary.deleted,
      });
    };

    const isSummaryEmpty = (summary: CrudSummaryType): boolean =>
      summary.inserted + summary.updated + summary.deleted === 0;

    const handleMissingParentsAsync = async (data: ProcessedData, sObjectName: string): Promise<void> => {
      if (targetIsFile) {
        return;
      }
      if (data.missingParentLookups.length === 0) {
        return;
      }
      allMissingParentLookups = allMissingParentLookups.concat(data.missingParentLookups);
      await this._writeMissingParentLookupReportAsync(allMissingParentLookups);
      if (noAbortPrompt) {
        logger.warn(
          'missingParentLookupsPrompt',
          sObjectName,
          String(data.missingParentLookups.length),
          MISSING_PARENT_LOOKUP_RECORDS_ERRORS_FILENAME
        );
        return;
      }
      await Common.abortWithPrompt(
        'missingParentLookupsPrompt',
        this.script.promptOnMissingParentObjects,
        'continueTheJob',
        '',
        async () => {
          await this._writeMissingParentLookupReportAsync(allMissingParentLookups);
        },
        sObjectName,
        String(data.missingParentLookups.length),
        MISSING_PARENT_LOOKUP_RECORDS_ERRORS_FILENAME
      );
      noAbortPrompt = true;
    };

    // Step 1: forwards
    logger.log('newLine');
    logger.logColored('updatingTarget', 'green', step1);

    await Common.serialExecAsync(
      tasksToProcess.map((task) => async () => {
        const processedRecordsAmount = await task.updateRecordsAsync('forwards', async (data) =>
          handleMissingParentsAsync(data, task.sObjectName)
        );
        recordPassSummary(task.sObjectName, passLabels.forward, task.lastCrudSummary);
        if (processedRecordsAmount > 0) {
          logger.log('updatingTargetObjectCompleted', task.sObjectName, String(processedRecordsAmount));
          logger.log('newLine');
        }
        totalProcessedRecordsAmount += processedRecordsAmount;
        totalProcessedRecordsByObjectsMap.set(
          task.sObjectName,
          (totalProcessedRecordsByObjectsMap.get(task.sObjectName) ?? 0) + processedRecordsAmount
        );
        return undefined;
      })
    );

    logger.log('newLine');
    if (totalProcessedRecordsAmount > 0) {
      logger.log('updatingTargetCompleted', step1, String(totalProcessedRecordsAmount));
    } else {
      logger.log('nothingUpdated');
    }

    // Step 2: backwards passes
    logger.log('newLine');
    logger.logColored('updatingTarget', 'green', step2);

    totalProcessedRecordsAmount = 0;
    if (this.script.targetOrg?.isOrgMedia) {
      logger.log('newLine');
      logger.log('pass1');
      logger.log('separator');

      await Common.serialExecAsync(
        this.tasks.map((task) => async () => {
          const processedRecordsAmount = await task.updateRecordsAsync('backwards', async (data) =>
            handleMissingParentsAsync(data, task.sObjectName)
          );
          recordPassSummary(task.sObjectName, passLabels.backward1, task.lastCrudSummary);
          if (processedRecordsAmount > 0) {
            logger.log('updatingTargetObjectCompleted', task.sObjectName, String(processedRecordsAmount));
            logger.log('newLine');
          }
          totalProcessedRecordsAmount += processedRecordsAmount;
          totalProcessedRecordsByObjectsMap.set(
            task.sObjectName,
            (totalProcessedRecordsByObjectsMap.get(task.sObjectName) ?? 0) + processedRecordsAmount
          );
          return undefined;
        })
      );

      logger.log('newLine');
      logger.log('pass2');
      logger.log('separator');

      await Common.serialExecAsync(
        this.tasks.map((task) => async () => {
          const processedRecordsAmount = await task.updateRecordsAsync('backwards', async (data) =>
            handleMissingParentsAsync(data, task.sObjectName)
          );
          recordPassSummary(task.sObjectName, passLabels.backward2, task.lastCrudSummary);
          if (processedRecordsAmount > 0) {
            logger.log('updatingTargetObjectCompleted', task.sObjectName, String(processedRecordsAmount));
            logger.log('newLine');
          }
          totalProcessedRecordsAmount += processedRecordsAmount;
          totalProcessedRecordsByObjectsMap.set(
            task.sObjectName,
            (totalProcessedRecordsByObjectsMap.get(task.sObjectName) ?? 0) + processedRecordsAmount
          );
          return undefined;
        })
      );
    }

    logger.log('newLine');
    if (totalProcessedRecordsAmount > 0) {
      logger.log('updatingTargetCompleted', step2, String(totalProcessedRecordsAmount));
    } else {
      logger.log('nothingUpdated');
    }

    // Delete by hierarchy
    const hasDeleteByHierarchy = this.deleteTasks.some((task) => task.scriptObject.isHierarchicalDeleteOperation);
    if (hasDeleteByHierarchy) {
      logger.log('newLine');
      logger.logColored('deletingTarget', 'green', step1);

      let totalDeleted = 0;
      await Common.serialExecAsync(
        this.deleteTasks.map((task) => async () => {
          if (!task.scriptObject.isHierarchicalDeleteOperation) {
            return undefined;
          }
          logger.log('newLine');
          const deletedRecords = await task.deleteRecordsAsync();
          recordPassSummary(task.sObjectName, passLabels.delete, task.lastCrudSummary);
          if (deletedRecords > 0) {
            logger.log('deletingRecordsCompleted', task.sObjectName, String(deletedRecords));
          }
          totalDeleted += deletedRecords;
          totalProcessedRecordsByObjectsMap.set(task.sObjectName, deletedRecords);
          return undefined;
        })
      );

      logger.log('newLine');
      if (totalDeleted > 0) {
        logger.log('deletingDataCompleted');
      } else {
        logger.log('nothingToDelete2');
      }
      logger.log('newLine');
    }

    logger.log('newLine');
    logger.logColored('processingAddon', 'green');
    const afterProcessed = await this._runObjectAddonEventAsync(ADDON_EVENTS.onAfter);
    if (!afterProcessed) {
      logger.log('nothingToProcess');
    }

    // Summary
    logger.log('newLine');
    logger.logColored('updatingSummary', 'green');
    this._logDiagnostics(logger.getResourceString('updatingSummary'));
    const passLabelsToLog = [passLabels.forward, passLabels.backward1, passLabels.backward2].filter(Boolean);
    const hasDeletePass = [...passSummaryByObject.values()].some((passMap) => passMap.has(passLabels.delete));
    if (hasDeletePass) {
      passLabelsToLog.push(passLabels.delete);
    }
    this.queryTasks.forEach((task) => {
      const passMap = passSummaryByObject.get(task.sObjectName);
      const totalProcessed = passLabelsToLog.reduce((total, passLabel) => {
        const summary = passMap?.get(passLabel) ?? { inserted: 0, updated: 0, deleted: 0 };
        return total + summary.inserted + summary.updated + summary.deleted;
      }, 0);
      logger.log('updatingTotallyUpdated', task.sObjectName, String(totalProcessed));
      this._logDiagnostics(
        logger.getResourceString('updatingTotallyUpdated', task.sObjectName, String(totalProcessed))
      );
      passLabelsToLog.forEach((passLabel) => {
        const summary = passMap?.get(passLabel) ?? { inserted: 0, updated: 0, deleted: 0 };
        if (isSummaryEmpty(summary)) {
          logger.log('updatingPassNone', passLabel);
          this._logDiagnostics(logger.getResourceString('updatingPassNone', passLabel));
          return;
        }
        logger.log(
          'updatingPassSummary',
          passLabel,
          String(summary.updated),
          String(summary.deleted),
          String(summary.inserted)
        );
        this._logDiagnostics(
          logger.getResourceString(
            'updatingPassSummary',
            passLabel,
            String(summary.updated),
            String(summary.deleted),
            String(summary.inserted)
          )
        );
      });
    });

    logger.log('newLine');
    if (!targetIsFile) {
      await this._writeMissingParentLookupReportAsync(allMissingParentLookups);
    }
  }

  /**
   * Returns all objects in the script.
   *
   * @returns Script objects list.
   */
  private _getAllScriptObjects(): ScriptObject[] {
    return this.script.getAllObjects().filter((object) => !object.excluded);
  }

  /**
   * Ensures object sets exist when adding objects dynamically.
   */
  private _ensureObjectSet(): void {
    if (this.script.objectSets.length > 0) {
      return;
    }
    if (this.script.objects.length > 0) {
      this.script.objectSets.push(new ScriptObjectSet(this.script.objects));
      this.script.objects = [];
      return;
    }
    this.script.objectSets.push(new ScriptObjectSet());
  }

  /**
   * Adds a script object to the default object set.
   *
   * @param object - Script object to add.
   */
  private _addObjectToDefaultSet(object: ScriptObject, reason?: string): void {
    this._ensureObjectSet();
    this.script.objectSets[0].objects.push(object);
    if (reason) {
      this._logVerboseObject(object.name, `Added to object set. ${reason}`);
      return;
    }
    this._logVerboseObject(object.name, 'Added to object set.');
  }

  /**
   * Describes objects using the metadata provider.
   *
   * @param objects - Script objects to describe.
   */
  private async _describeObjectsAsync(objects: ScriptObject[]): Promise<void> {
    if (!this._metadataProvider) {
      return;
    }

    await Promise.all(objects.map(async (object) => object.describeAsync(this._metadataProvider)));
  }

  /**
   * Adds missing parent lookup objects based on metadata.
   */
  private async _ensureParentLookupObjectsAsync(): Promise<void> {
    if (!this._metadataProvider) {
      return;
    }

    const addedObjects = this._collectMissingParentLookupObjects();
    if (addedObjects.length === 0) {
      return;
    }

    addedObjects.forEach((object) => {
      this._addObjectToDefaultSet(object, 'Auto-added due to missing parent lookup.');
      object.setup(this.script);
    });

    this.mappingResolver.addScriptObjects(addedObjects);
    await this._describeObjectsAsync(addedObjects);
    await this._ensureParentLookupObjectsAsync();
  }

  /**
   * Collects missing parent lookup objects based on field metadata.
   *
   * @returns Newly created objects.
   */
  private _collectMissingParentLookupObjects(): ScriptObject[] {
    const objects = this._getAllScriptObjects().filter((object) => !object.excluded);
    const allObjects = this.script.getAllObjects();
    const objectNames = new Map(objects.map((obj) => [obj.name.toLowerCase(), obj]));
    const excludedNames = new Set<string>([
      ...allObjects.filter((obj) => obj.excluded).map((obj) => obj.name.toLowerCase()),
      ...(this.script.excludedObjects ?? []).map((name) => name.toLowerCase()),
    ]);
    const added: ScriptObject[] = [];

    objects.forEach((object) => {
      if (!object.isDescribed) {
        return;
      }
      object.fieldsInQueryMap.forEach((field) => {
        if (!field.lookup) {
          return;
        }

        const referenceTargets = this._resolveLookupReferenceTargets(field);
        referenceTargets.forEach((referenceTarget) => {
          const referencedObjectType = this.mappingResolver.mapObjectNameToSource(referenceTarget);
          const nameKey = referencedObjectType.toLowerCase();
          if (excludedNames.has(nameKey)) {
            this._logVerboseField(
              object.name,
              field.nameId,
              `Skipped auto-add because referenced object ${referencedObjectType} is excluded.`
            );
            return;
          }
          if (objectNames.has(nameKey)) {
            return;
          }
          const newObject = createAutoParentObject(referencedObjectType);
          objectNames.set(nameKey, newObject);
          added.push(newObject);
        });
      });
    });

    return added;
  }

  /**
   * Resolves lookup reference targets for auto-add.
   *
   * @param field - Lookup field.
   * @returns Target object names.
   */
  private _resolveLookupReferenceTargets(field: SFieldDescribe): string[] {
    void this;
    if (field.isPolymorphicField && field.polymorphicReferenceObjectType) {
      return [field.polymorphicReferenceObjectType];
    }

    const referenceTo = field.referenceTo ?? [];
    const userGroupTargets = referenceTo.filter((reference) => {
      const normalized = reference.toLowerCase();
      return normalized === USER_OBJECT_NAME.toLowerCase() || normalized === GROUP_OBJECT_NAME.toLowerCase();
    });
    if (userGroupTargets.length > 0) {
      return userGroupTargets;
    }

    if (field.referencedObjectType) {
      return [field.referencedObjectType];
    }

    return referenceTo;
  }

  /**
   * Links lookup fields to parent objects.
   */
  private _linkLookupRelationships(): void {
    const objects = this._getAllScriptObjects();
    const objectByName = new Map(objects.map((obj) => [obj.name.toLowerCase(), obj]));

    objects.forEach((object) => {
      const describe = object.sourceSObjectDescribe ?? object.targetSObjectDescribe;
      if (!describe) {
        return;
      }
      describe.fieldsMap.forEach((field) => {
        if (!field.lookup || !field.referencedObjectType) {
          return;
        }
        const referencedObjectType = this.mappingResolver.mapObjectNameToSource(field.referencedObjectType);
        const parent =
          objectByName.get(referencedObjectType.toLowerCase()) ??
          objectByName.get(field.referencedObjectType.toLowerCase());
        if (!parent) {
          return;
        }
        const updatedField = field;
        updatedField.parentLookupObject = parent;
        updatedField.scriptObject = object;
        updatedField.originalReferencedObjectType =
          updatedField.originalReferencedObjectType || updatedField.referencedObjectType;
        updatedField.referencedObjectType = referencedObjectType;
      });
    });
  }

  /**
   * Ensures lookup __r fields are present in queries.
   */
  private _ensureLookupFieldsInQuery(): void {
    this._getAllScriptObjects().forEach((object) => object.ensureLookupFieldsInQuery());
  }

  /**
   * Ensures User and Group objects remain paired after exclusions.
   */
  private async _ensureUserGroupPairAfterExcludeAsync(): Promise<void> {
    if (!this._metadataProvider) {
      return;
    }

    const allObjects = this.script.getAllObjects();
    const activeObjects = allObjects.filter((object) => !object.excluded);
    const hasUser = activeObjects.some((object) => object.isUser());
    const hasGroup = activeObjects.some((object) => object.isGroup());
    const userExcluded = allObjects.some((object) => object.isUser() && object.excluded);
    const groupExcluded = allObjects.some((object) => object.isGroup() && object.excluded);
    let requiresUser = false;
    let requiresGroup = false;
    let hasPolymorphicLookups = false;
    activeObjects.forEach((object) => {
      const explicitTargets = object.getExplicitPolymorphicTargets();
      if (explicitTargets.hasExplicit) {
        hasPolymorphicLookups = true;
        requiresUser = requiresUser || explicitTargets.requiresUser;
        requiresGroup = requiresGroup || explicitTargets.requiresGroup;
      }

      object.polymorphicLookups.forEach((lookup) => {
        hasPolymorphicLookups = true;
        const referenced = (lookup.referencedObjectType ?? '').toLowerCase();
        if (!referenced) {
          requiresUser = true;
          requiresGroup = true;
        } else if (referenced === USER_OBJECT_NAME.toLowerCase()) {
          requiresUser = true;
        } else if (referenced === GROUP_OBJECT_NAME.toLowerCase()) {
          requiresGroup = true;
        }
      });
    });

    if (!hasPolymorphicLookups || (!requiresUser && !requiresGroup)) {
      return;
    }

    if (!hasUser && !hasGroup && userExcluded && groupExcluded) {
      return;
    }

    const newObjects: ScriptObject[] = [];
    if (requiresGroup && !hasGroup) {
      const group = createAutoGroupScriptObject();
      newObjects.push(group);
    }
    if (requiresUser && !hasUser) {
      const user = createAutoUserScriptObject();
      newObjects.push(user);
    }

    if (newObjects.length === 0) {
      return;
    }

    newObjects.forEach((object) => {
      this._addObjectToDefaultSet(object, 'Auto-added to satisfy polymorphic lookup requirements.');
      object.setup(this.script);
    });

    this.mappingResolver.addScriptObjects(newObjects);
    await this._describeObjectsAsync(newObjects);
  }

  /**
   * Excludes objects with only Id or unreferenced auto-added objects.
   */
  private _excludeObjectsAfterDescribe(): void {
    const objects = this.script.getAllObjects();
    if (objects.length === 0) {
      return;
    }

    const targetIsFile = this.script.targetOrg?.isFileMedia ?? false;
    const referencedNames = new Set<string>();
    objects.forEach((object) => {
      object.fieldsInQueryMap.forEach((field) => {
        if (field.lookup && field.parentLookupObject) {
          referencedNames.add(field.parentLookupObject.name.toLowerCase());
        }
      });
    });

    const logger = this._getLogger();
    for (const object of objects) {
      if (object.excluded) {
        continue;
      }
      const isUserOrGroup = object.isUser() || object.isGroup();
      const onlyId = this._hasOnlyIdField(object);
      const isReferenced = referencedNames.has(object.name.toLowerCase());
      const isDeleteOperation = object.operation === OPERATION.Delete;
      if (onlyId && !isDeleteOperation && !isUserOrGroup) {
        const nextObject = object;
        nextObject.excluded = true;
        logger.warn('objectExcludedOnlyId', nextObject.name);
        this._logVerboseObject(nextObject.name, 'Excluded because only Id remains in query.');
        continue;
      }

      if (object.isAutoAdded && !object.isFromOriginalScript && !isReferenced && !isUserOrGroup) {
        const nextObject = object;
        nextObject.excluded = true;
        logger.warn('objectExcludedAutoAddedUnreferenced', nextObject.name);
        this._logVerboseObject(nextObject.name, 'Excluded because auto-added and unreferenced.');
        continue;
      }

      if (!targetIsFile && this._canUpdateObject(object) && !onlyId && !isDeleteOperation) {
        const updateableFields = object.fieldsToUpdate;
        if (updateableFields.length === 0) {
          const nextObject = object;
          nextObject.operation = OPERATION.Readonly;
          logger.warn('objectOperationChangedToReadonly', nextObject.name);
          this._logVerboseObject(nextObject.name, 'Operation changed to Readonly because no updateable fields remain.');
        }
      }
    }
  }

  /**
   * Removes lookup fields that reference excluded objects.
   *
   * @returns True when any fields were removed.
   */
  private _removeLookupsToExcludedObjects(): boolean {
    const objects = this.script.getAllObjects();
    if (objects.length === 0) {
      return false;
    }

    const excludedObjectNames = new Set([
      ...objects.filter((object) => object.excluded).map((object) => object.name.toLowerCase()),
      ...(this.script.excludedObjects ?? []).map((name) => name.toLowerCase()),
    ]);
    if (excludedObjectNames.size === 0) {
      return false;
    }

    const logger = this._getLogger();
    let removed = false;
    objects.forEach((object) => {
      if (object.excluded) {
        return;
      }
      if (object.removeLookupFieldsToExcludedObjects(excludedObjectNames, logger)) {
        removed = true;
      }
    });

    return removed;
  }

  /**
   * Forces readonly operations based on metadata and fixed object restrictions.
   */
  private _normalizeOperationsByMetadata(): void {
    if (this.script.targetOrg?.isFileMedia) {
      return;
    }
    const logger = this._getLogger();
    const objects = this.script.getAllObjects();

    for (const object of objects) {
      if (object.excluded) {
        continue;
      }

      const normalizedOperation = ScriptObject.getStrOperation(object.operation);
      const forceReadonlyReason = resolveForcedReadonlyReason(object, normalizedOperation);
      if (forceReadonlyReason && object.operation !== OPERATION.Readonly) {
        const nextObject = object;
        nextObject.operation = OPERATION.Readonly;
        this._disableDeleteFlagsForReadonlyOperation(nextObject);
        logger.warn('objectOperationForcedReadonly', nextObject.name, forceReadonlyReason);
        this._logVerboseObject(nextObject.name, `Operation forced to Readonly because ${forceReadonlyReason}.`);
        continue;
      }

      const operationDescribe = this._resolveDescribeForOperation(object);
      if (!operationDescribe) {
        continue;
      }

      this._normalizeDeleteFlagsByMetadata(object);
      const operationNormalization = resolveOperationByCrudMetadata(object.operation, operationDescribe);
      if (!operationNormalization || object.operation === OPERATION.Readonly) {
        continue;
      }

      const nextObject = object;
      const previousOperation = ScriptObject.getStrOperation(nextObject.operation);
      nextObject.operation = operationNormalization.operation;
      if (operationNormalization.operation === OPERATION.Readonly) {
        this._disableDeleteFlagsForReadonlyOperation(nextObject);
        logger.warn('objectOperationForcedReadonly', nextObject.name, operationNormalization.reason);
        this._logVerboseObject(
          nextObject.name,
          `Operation forced to Readonly because ${operationNormalization.reason}.`
        );
        continue;
      }
      logger.warn(
        'objectOperationChangedByMetadata',
        nextObject.name,
        previousOperation,
        ScriptObject.getStrOperation(nextObject.operation),
        operationNormalization.reason
      );
      this._logVerboseObject(
        nextObject.name,
        `Operation changed from ${previousOperation} to ${ScriptObject.getStrOperation(nextObject.operation)} because ${
          operationNormalization.reason
        }.`
      );
    }
  }

  /**
   * Resolves describe metadata for operation permission checks.
   *
   * @param object - Script object.
   * @returns Describe metadata used for operation checks.
   */
  private _resolveDescribeForOperation(object: ScriptObject): SObjectDescribe | undefined {
    void this;
    if (object.isDeletedFromSourceOperation) {
      return object.sourceSObjectDescribe ?? object.targetSObjectDescribe;
    }
    return object.targetSObjectDescribe ?? object.sourceSObjectDescribe;
  }

  /**
   * Disables target delete flags when the target object is not deletable.
   *
   * @param object - Script object to normalize.
   */
  private _normalizeDeleteFlagsByMetadata(object: ScriptObject): void {
    const nextObject = object;
    if (object.isDeletedFromSourceOperation) {
      return;
    }

    const targetDescribe = nextObject.targetSObjectDescribe ?? nextObject.sourceSObjectDescribe;
    if (!targetDescribe?.deletable) {
      const disabledFlags: string[] = [];
      if (nextObject.deleteOldData) {
        nextObject.deleteOldData = false;
        disabledFlags.push('deleteOldData');
      }
      if (nextObject.deleteByHierarchy) {
        nextObject.deleteByHierarchy = false;
        disabledFlags.push('deleteByHierarchy');
      }
      if (nextObject.hardDelete) {
        nextObject.hardDelete = false;
        disabledFlags.push('hardDelete');
      }
      if (disabledFlags.length > 0) {
        const logger = this._getLogger();
        logger.warn('objectDeleteFlagsDisabled', nextObject.name, disabledFlags.join(', '));
        this._logVerboseObject(
          nextObject.name,
          `Disabled flags [${disabledFlags.join(', ')}] because the target object is not deletable.`
        );
      }
    }
  }

  /**
   * Clears target-delete flags after converting operation to Readonly.
   *
   * @param object - Script object to normalize.
   */
  private _disableDeleteFlagsForReadonlyOperation(object: ScriptObject): void {
    void this;
    const nextObject = object;
    nextObject.deleteOldData = false;
    nextObject.deleteByHierarchy = false;
    nextObject.hardDelete = false;
  }

  /**
   * Returns true when the query contains only Id.
   *
   * @param object - Script object to inspect.
   * @returns True when only Id is present.
   */
  private _hasOnlyIdField(object: ScriptObject): boolean {
    void this;
    const fields = object.fieldsInQuery.map((field) => field.trim()).filter((field) => field.length > 0);
    return fields.length === 1 && fields[0].toLowerCase() === 'id';
  }

  /**
   * Returns true when object should be included in update phase.
   *
   * @param object - Script object to inspect.
   * @returns True when eligible for update phase.
   */
  private _canUpdateObject(object: ScriptObject): boolean {
    void this;
    return (
      object.operation === OPERATION.Insert ||
      object.operation === OPERATION.Update ||
      object.operation === OPERATION.Upsert
    );
  }

  /**
   * Returns true when object should be included in delete phase.
   *
   * @param object - Script object to inspect.
   * @returns True when eligible for delete phase.
   */
  private _canDeleteObject(object: ScriptObject): boolean {
    void this;
    return object.operation === OPERATION.Delete || object.deleteOldData;
  }

  /**
   * Creates job tasks and ordering.
   */
  private _createTasks(): void {
    this.tasks = [];
    this.queryTasks = [];
    this.deleteTasks = [];
    this.updateTasks = [];

    const objects = this._getAllScriptObjects();
    const taskMap = this._createTaskMap(objects);
    this.tasks = this._buildTaskChain(objects, taskMap);

    if (this.script.keepObjectOrderWhileExecute) {
      this.queryTasks = [...this.tasks];
      this.deleteTasks = this.queryTasks.filter((task) => this._canDeleteObject(task.scriptObject));
      this.updateTasks = this.queryTasks.filter((task) => this._canUpdateObject(task.scriptObject));
      return;
    }

    this._putMasterDetailsBefore(this.tasks);

    this.tasks.forEach((task) => {
      if (task.scriptObject.processAllSource || task.scriptObject.isLimitedQuery) {
        this.queryTasks.push(task);
      }
    });
    this.tasks.forEach((task) => {
      if (!this.queryTasks.includes(task)) {
        this.queryTasks.push(task);
      }
    });

    let swapped = true;
    for (let iteration = 0; iteration < 10 && swapped; iteration += 1) {
      swapped = this._updateQueryTaskOrder();
    }

    const updateObjects = objects.filter((object) => this._canUpdateObject(object));
    this.updateTasks = this._buildTaskChain(updateObjects, taskMap);
    this._putMasterDetailsBefore(this.updateTasks);
    applySpecialTaskOrder(this.updateTasks, SPECIAL_OBJECT_UPDATE_ORDER);

    const deleteObjects = objects.filter((object) => this._canDeleteObject(object));
    const deleteChain = this._buildTaskChain(deleteObjects, taskMap);
    this._putMasterDetailsBefore(deleteChain);
    this.deleteTasks = [...deleteChain].reverse();
    applySpecialTaskOrder(this.deleteTasks, SPECIAL_OBJECT_DELETE_ORDER);
  }

  /**
   * Adjusts ordering so master-detail parents run first.
   *
   * @param tasks - Task list to reorder.
   */
  private _putMasterDetailsBefore(tasks: MigrationJobTask[]): void {
    void this;
    let swapped = true;
    for (let iteration = 0; iteration < 10 && swapped; iteration += 1) {
      swapped = false;
      const tempTasks = [...tasks];
      for (let leftIndex = 0; leftIndex < tempTasks.length - 1; leftIndex += 1) {
        const leftTask = tempTasks[leftIndex];
        for (let rightIndex = leftIndex + 1; rightIndex < tempTasks.length; rightIndex += 1) {
          const rightTask = tempTasks[rightIndex];
          const rightIsParent = leftTask.scriptObject.parentMasterDetailObjects.some(
            (parent) => parent.name === rightTask.sObjectName
          );
          const leftTaskIndex = tasks.indexOf(leftTask);
          const rightTaskIndex = tasks.indexOf(rightTask);
          if (rightIsParent && rightTaskIndex > leftTaskIndex) {
            tasks.splice(rightTaskIndex, 1);
            tasks.splice(leftTaskIndex, 0, rightTask);
            swapped = true;
          }
        }
      }
    }
  }

  /**
   * Updates query task order for special object dependencies.
   *
   * @returns True when any swap happened.
   */
  private _updateQueryTaskOrder(): boolean {
    let swapped = false;
    const tempTasks = [...this.queryTasks];
    for (let leftIndex = 0; leftIndex < tempTasks.length - 1; leftIndex += 1) {
      const leftTask = tempTasks[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < tempTasks.length; rightIndex += 1) {
        const rightTask = tempTasks[rightIndex];
        const childObjects = SPECIAL_OBJECT_QUERY_ORDER.get(rightTask.scriptObject.name);
        const rightMaster = Boolean(rightTask.scriptObject.master);
        const leftMaster = Boolean(leftTask.scriptObject.master);
        const rightShouldBeBeforeTheLeft =
          childObjects?.includes(leftTask.scriptObject.name) && (rightMaster || (!leftMaster && !rightMaster));
        const leftTaskIndex = this.queryTasks.indexOf(leftTask);
        const rightTaskIndex = this.queryTasks.indexOf(rightTask);
        if (rightShouldBeBeforeTheLeft && rightTaskIndex > leftTaskIndex) {
          this.queryTasks.splice(rightTaskIndex, 1);
          this.queryTasks.splice(leftTaskIndex, 0, rightTask);
          swapped = true;
        }
      }
    }
    return swapped;
  }

  /**
   * Creates a task map for the given objects.
   *
   * @param objects - Script objects to map.
   * @returns Task map keyed by script object instance.
   */
  private _createTaskMap(objects: ScriptObject[]): Map<ScriptObject, MigrationJobTask> {
    const map = new Map<ScriptObject, MigrationJobTask>();
    objects.forEach((object) => {
      const updatedObject = object;
      const task = new MigrationJobTask({
        scriptObject: updatedObject,
        job: this,
        targetObjectName: this.mappingResolver.mapObjectNameToTarget(updatedObject.name),
      });

      const shouldProcessAll =
        Boolean(updatedObject.master) || updatedObject.isSpecialObject || updatedObject.isObjectWithoutRelationships;
      if (shouldProcessAll) {
        updatedObject.processAllSource = true;
        updatedObject.processAllTarget = true;
      } else {
        updatedObject.processAllSource = false;
        updatedObject.processAllTarget = updatedObject.hasComplexExternalId || updatedObject.hasAutonumberExternalId;
      }

      map.set(updatedObject, task);
    });
    return map;
  }

  /**
   * Builds an ordered task chain using the legacy algorithm.
   *
   * @param objects - Objects to include in the chain.
   * @param taskMap - Task lookup map.
   * @returns Ordered task list.
   */
  private _buildTaskChain(objects: ScriptObject[], taskMap: Map<ScriptObject, MigrationJobTask>): MigrationJobTask[] {
    const tasks: MigrationJobTask[] = [];
    if (this.script.keepObjectOrderWhileExecute) {
      const recordTypeTasks: MigrationJobTask[] = [];
      const orderedTasks: MigrationJobTask[] = [];
      objects.forEach((object) => {
        const task = taskMap.get(object);
        if (task) {
          if (object.name === RECORD_TYPE_SOBJECT_NAME) {
            recordTypeTasks.push(task);
            return;
          }
          orderedTasks.push(task);
        }
      });
      return [...recordTypeTasks, ...orderedTasks];
    }

    let lowerIndexForAnyObjects = 0;
    let lowerIndexForReadonlyObjects = 0;

    objects.forEach((object) => {
      const task = taskMap.get(object);
      if (!task) {
        return;
      }

      if (object.name === RECORD_TYPE_SOBJECT_NAME) {
        tasks.unshift(task);
        lowerIndexForAnyObjects += 1;
        lowerIndexForReadonlyObjects += 1;
        return;
      }

      if (object.isReadonlyObject && !object.isHierarchicalDeleteOperation) {
        tasks.splice(lowerIndexForReadonlyObjects, 0, task);
        lowerIndexForAnyObjects += 1;
        return;
      }

      if (tasks.length === 0) {
        tasks.push(task);
        return;
      }

      let indexToInsert = tasks.length;
      for (let taskIndex = tasks.length - 1; taskIndex >= lowerIndexForAnyObjects; taskIndex -= 1) {
        const existingTask = tasks[taskIndex];
        const isParentLookup = existingTask.scriptObject.parentLookupObjects.some(
          (parent) => parent.name === object.name
        );
        if (isParentLookup) {
          indexToInsert = taskIndex;
        }
      }
      tasks.splice(indexToInsert, 0, task);
    });

    return tasks;
  }

  /**
   * Returns the logger for CSV-related messages.
   *
   * @returns Logger instance.
   */
  private _getLogger(): LoggerType {
    return this.script.logger ?? Common.logger;
  }

  /**
   * Writes a verbose object-level log message to the file log.
   *
   * @param objectName - Object API name.
   * @param message - Message without object prefix.
   */
  private _logVerboseObject(objectName: string, message: string): void {
    const logger = this._getLogger();
    logger.verboseFile(`{${objectName}} ${message}`);
  }

  /**
   * Writes a verbose field-level log message to the file log.
   *
   * @param objectName - Object API name.
   * @param fieldName - Field API name.
   * @param message - Message without field prefix.
   */
  private _logVerboseField(objectName: string, fieldName: string, message: string): void {
    if (!fieldName) {
      return;
    }
    const logger = this._getLogger();
    logger.verboseFile(`{${objectName}.${fieldName}} ${message}`);
  }

  /**
   * Returns tasks that rely on CSV input.
   *
   * @returns CSV-bound tasks.
   */
  private _getCsvTasks(): MigrationJobTask[] {
    const sourceIsFile = Boolean(this.script.sourceOrg?.isFileMedia);
    const baseTasks = this.queryTasks.length > 0 ? this.queryTasks : this.tasks;
    return baseTasks.filter((task) => sourceIsFile || task.scriptObject.useSourceCSVFile);
  }

  /**
   * Returns the raw CSV file path for a task.
   *
   * @param task - Job task.
   * @returns Raw CSV file path.
   */
  private _getRawCsvFilePath(task: MigrationJobTask): string {
    return Common.getCSVFilename(this.script.rawSourceDirectoryPath, task.sObjectName);
  }

  /**
   * Returns the processed source CSV file path for a task.
   *
   * @param task - Job task.
   * @returns Source CSV file path.
   */
  private _getSourceCsvFilePath(task: MigrationJobTask): string {
    return Common.getCSVFilename(this.script.sourceDirectoryPath, task.sObjectName, CSV_SOURCE_FILE_SUFFIX);
  }

  /**
   * Extracts the object name from a CSV filename.
   *
   * @param csvFilename - CSV file path.
   * @returns Object name or undefined.
   */
  private _getObjectNameFromCsvFilename(csvFilename: string): string | undefined {
    void this;
    const baseName = path.basename(csvFilename, '.csv');
    if (!baseName) {
      return undefined;
    }
    if (baseName.endsWith(CSV_SOURCE_FILE_SUFFIX)) {
      return baseName.slice(0, -CSV_SOURCE_FILE_SUFFIX.length);
    }
    return baseName;
  }

  /**
   * Ensures CSV directories exist.
   */
  private async _ensureCsvDirectoriesAsync(): Promise<void> {
    this._logDiagnostics(`Ensuring directory exists: ${this.script.sourceDirectoryPath}.`);
    await fs.mkdir(this.script.sourceDirectoryPath, { recursive: true });
    this._logDiagnostics(`Ensuring directory exists: ${this.script.reportsDirectoryPath}.`);
    await fs.mkdir(this.script.reportsDirectoryPath, { recursive: true });
    this._logDiagnostics(`Ensuring directory exists: ${this.script.rawSourceDirectoryPath}.`);
    await fs.mkdir(this.script.rawSourceDirectoryPath, { recursive: true });
  }

  /**
   * Clears a CSV directory before regenerating its contents.
   *
   * @param directoryPath - Directory to clean.
   * @param errorResourceKey - Message key for delete failures.
   */
  private async _clearCsvDirectoryAsync(directoryPath: string, errorResourceKey: string): Promise<void> {
    const logger = this._getLogger();
    try {
      this._logDiagnostics(`Clearing directory: ${directoryPath}.`);
      Common.deleteFolderRecursive(directoryPath, true, false);
      await fs.mkdir(directoryPath, { recursive: true });
      this._logDiagnostics(`Cleared directory: ${directoryPath}.`);
    } catch (error) {
      const message = logger.getResourceString(errorResourceKey, directoryPath);
      logger.error(message);
      this._logDiagnostics(message);
      throw new CommandInitializationNoStackError(message);
    }
  }

  /**
   * Prepares User/Group CSV files from UserAndGroup when needed.
   *
   * @param csvTasks - Tasks to validate.
   */
  private async _prepareUserAndGroupCsvSourcesAsync(csvTasks: MigrationJobTask[]): Promise<void> {
    const needsUser = csvTasks.some((task) => task.sObjectName === USER_OBJECT_NAME);
    const needsGroup = csvTasks.some((task) => task.sObjectName === GROUP_OBJECT_NAME);
    if (!needsUser && !needsGroup) {
      return;
    }

    const rawUserPath = Common.getCSVFilename(this.script.rawSourceDirectoryPath, USER_OBJECT_NAME);
    const rawGroupPath = Common.getCSVFilename(this.script.rawSourceDirectoryPath, GROUP_OBJECT_NAME);
    const userExists = await this._pathExistsAsync(rawUserPath);
    const groupExists = await this._pathExistsAsync(rawGroupPath);
    if ((needsUser && userExists) || (needsGroup && groupExists)) {
      if ((!needsUser || userExists) && (!needsGroup || groupExists)) {
        return;
      }
    }

    const userAndGroupPath = Common.getCSVFilename(this.script.rawSourceDirectoryPath, USER_AND_GROUP_FILENAME);
    if (!(await this._pathExistsAsync(userAndGroupPath))) {
      return;
    }

    const rows = await Common.readCsvFileAsync(userAndGroupPath);
    if (rows.length === 0) {
      return;
    }

    const userRows: Array<Record<string, unknown>> = [];
    const groupRows: Array<Record<string, unknown>> = [];

    rows.forEach((row) => {
      const idValue = String(row['Id'] ?? '').trim();
      if (!idValue) {
        return;
      }
      const prefix = idValue.slice(0, 3).toUpperCase();
      if (needsUser && !userExists && prefix === '005') {
        userRows.push(row);
      }
      if (needsGroup && !groupExists && prefix === '00G') {
        groupRows.push(row);
      }
    });

    const logger = this._getLogger();
    if (needsUser && !userExists) {
      await Common.writeCsvFileAsync(rawUserPath, userRows, true);
      this._logDiagnostics(`Saved CSV file: ${rawUserPath}.`);
      logger.verboseFile(
        `{${USER_OBJECT_NAME}} Prepared ${userRows.length} records from ${USER_AND_GROUP_FILENAME}.csv.`
      );
    }
    if (needsGroup && !groupExists) {
      await Common.writeCsvFileAsync(rawGroupPath, groupRows, true);
      this._logDiagnostics(`Saved CSV file: ${rawGroupPath}.`);
      logger.verboseFile(
        `{${GROUP_OBJECT_NAME}} Prepared ${groupRows.length} records from ${USER_AND_GROUP_FILENAME}.csv.`
      );
    }
  }

  /**
   * Loads `FieldMapping.csv` and merges it with inline object mappings.
   * Inline `fieldMapping` entries keep higher priority than file entries.
   *
   * @param objects - Script objects for the current object set.
   */
  private async _loadFieldMappingConfigurationFileAsync(objects: ScriptObject[]): Promise<void> {
    const filePath = path.join(this.script.basePath, FIELD_MAPPING_FILENAME);
    const csvRows = await Common.readCsvFileAsync(filePath);
    if (csvRows.length === 0) {
      return;
    }

    const objectsByName = new Map<string, ScriptObject>();
    objects.forEach((object) => {
      objectsByName.set(object.name.toLowerCase(), object);
    });

    const csvMappingsByObject = new Map<string, ScriptMappingItem[]>();
    csvRows.forEach((row) => {
      const objectName = String(row['ObjectName'] ?? '').trim();
      const target = String(row['Target'] ?? '').trim();
      if (!objectName || !target) {
        return;
      }

      const scriptObject = objectsByName.get(objectName.toLowerCase());
      if (!scriptObject || !scriptObject.useFieldMapping) {
        return;
      }

      const fieldName = String(row['FieldName'] ?? '').trim();
      const mapping = new ScriptMappingItem();
      if (!fieldName) {
        mapping.targetObject = target;
      } else {
        mapping.sourceField = fieldName;
        mapping.targetField = target;
      }

      const objectMappings = csvMappingsByObject.get(scriptObject.name) ?? [];
      objectMappings.push(mapping);
      csvMappingsByObject.set(scriptObject.name, objectMappings);
    });

    csvMappingsByObject.forEach((csvMappings, objectName) => {
      if (csvMappings.length === 0) {
        return;
      }
      const scriptObject = objectsByName.get(objectName.toLowerCase());
      if (!scriptObject) {
        return;
      }
      scriptObject.fieldMapping = [...csvMappings, ...scriptObject.fieldMapping];
      this._logVerboseObject(
        scriptObject.name,
        `Loaded ${csvMappings.length} mapping entries from ${FIELD_MAPPING_FILENAME}.`
      );
    });
  }

  /**
   * Loads the CSV value mapping file.
   */
  private async _loadValueMappingFileAsync(): Promise<void> {
    const valueMappingFilePath = path.join(this.script.basePath, VALUE_MAPPING_CSV_FILENAME);
    const csvRows = await Common.readCsvFileAsync(valueMappingFilePath, 0, undefined, true);
    if (csvRows.length === 0) {
      return;
    }

    const logger = this._getLogger();
    logger.log('readingValuesMappingFile', VALUE_MAPPING_CSV_FILENAME);

    csvRows.forEach((row) => {
      const objectName = String(row['ObjectName'] ?? '').trim();
      const fieldName = String(row['FieldName'] ?? '').trim();
      if (!objectName || !fieldName) {
        return;
      }
      const scriptObject = this.script.objectsMap.get(objectName);
      if (!scriptObject || !scriptObject.useValuesMapping) {
        return;
      }
      const key = `${objectName}${fieldName}`;
      let fieldMap = this.valueMapping.get(key);
      if (!fieldMap) {
        fieldMap = new Map<string, string>();
        this.valueMapping.set(key, fieldMap);
      }
      const rawValue = String(row['RawValue'] ?? '').trim();
      const mappedValue = String(row['Value'] ?? '').trim();
      fieldMap.set(rawValue, mappedValue);
      this._logVerboseField(objectName, fieldName, `Value mapping added: '${rawValue}' -> '${mappedValue}'.`);
    });
  }

  /**
   * Copies raw CSV files into the source directory.
   *
   * @param csvTasks - Tasks to copy.
   */
  private async _copyCsvFilesToSourceDirectoryAsync(csvTasks: MigrationJobTask[]): Promise<void> {
    await Promise.all(
      csvTasks.map(async (task) => {
        const rawFile = this._getRawCsvFilePath(task);
        const sourceFile = this._getSourceCsvFilePath(task);
        if (await this._pathExistsAsync(rawFile)) {
          this._logVerboseObject(
            task.sObjectName,
            `CSV source file found. Rewriting ${rawFile} into internal source format ${sourceFile}.`
          );
          const rawRows = await Common.readCsvFileAsync(rawFile);
          await Common.writeCsvFileAsync(sourceFile, rawRows, true, undefined, false, true);
          this._logDiagnostics(`Saved CSV file: ${sourceFile}.`);
        } else {
          this._logVerboseObject(
            task.sObjectName,
            `CSV source file not found at ${rawFile}. Creating empty file ${sourceFile}.`
          );
          await Common.writeCsvFileAsync(sourceFile, [], true, undefined, false, true);
          this._logDiagnostics(`Saved CSV file: ${sourceFile}.`);
        }
      })
    );
  }

  /**
   * Loads raw CSV data into cache using the source file path as key.
   *
   * @param rawCsvFilename - Raw CSV file path.
   * @param sourceCsvFilename - Source CSV output path.
   * @returns Cached CSV map.
   */
  private async _loadRawCsvIntoCacheAsync(
    rawCsvFilename: string,
    sourceCsvFilename: string,
    objectName: string
  ): Promise<Map<string, Record<string, unknown>>> {
    const cached = this.cachedCsvContent.csvDataCacheMap.get(sourceCsvFilename);
    if (cached) {
      this._logVerboseObject(objectName, `CSV cache hit for ${sourceCsvFilename}. Rows=${cached.size}.`);
      return cached;
    }

    this._rawCsvPathBySourcePath.set(sourceCsvFilename, rawCsvFilename);
    if (!(await this._pathExistsAsync(rawCsvFilename))) {
      this._logVerboseObject(objectName, `CSV raw file missing at ${rawCsvFilename}.`);
      return new Map();
    }

    const csvRows = await Common.readCsvFileAsync(rawCsvFilename);
    const fileMap = new Map<string, Record<string, unknown>>();

    csvRows.forEach((row) => {
      const indexKey = Common.makeId(18).toUpperCase();
      const candidateId = row['Id'];
      const resolvedKey = typeof candidateId === 'undefined' || candidateId === null ? indexKey : String(candidateId);
      fileMap.set(resolvedKey, row);
    });

    this.cachedCsvContent.csvDataCacheMap.set(sourceCsvFilename, fileMap);
    const firstRow = fileMap.values().next().value as Record<string, unknown> | undefined;
    const columns = firstRow ? Object.keys(firstRow).join(', ') : '';
    this._logVerboseObject(
      objectName,
      `CSV raw file loaded from ${rawCsvFilename}. Rows=${fileMap.size}${columns ? ` Columns=${columns}` : ''}.`
    );
    return fileMap;
  }

  /**
   * Validates and repairs all source CSV files.
   *
   * @param csvTasks - Tasks to validate.
   */
  private async _validateAndRepairSourceCsvFilesAsync(csvTasks: MigrationJobTask[]): Promise<void> {
    this.csvIssues = [];
    const logger = this._getLogger();

    await this._removeCsvIssuesReportAsync();

    const validationResults = await Promise.all(csvTasks.map((task) => this._validateCsvFileAsync(task)));
    this.csvIssues.push(...validationResults.flat());

    const isValidateOnly = this.script.validateCSVFilesOnly;
    let promptHandled = false;
    if (this.csvIssues.length > 0 && !isValidateOnly) {
      await this._promptToAbortCsvIssuesAsync();
      promptHandled = true;
    }

    await Common.serialExecAsync(
      csvTasks.map((task) => async () => {
        const issues = await this._repairCsvAsync(task, true);
        this.csvIssues.push(...issues);
        return undefined;
      })
    );

    await Common.serialExecAsync(
      csvTasks.map((task) => async () => {
        const issues = await this._repairCsvAsync(task, false);
        this.csvIssues.push(...issues);
        return undefined;
      })
    );

    this.csvIssues.push(...this._addMissingIdColumnFinalPass(csvTasks));

    await this._saveCachedCsvDataFilesAsync();
    this._logCsvIssueSummaryByFile();
    logger.log('csvFilesWereUpdated', String(this.cachedCsvContent.updatedFilenames.size));

    if (this.csvIssues.length > 0) {
      if (isValidateOnly) {
        await this._writeCsvIssuesReportAsync();
        logger.warn('csvValidateOnlyIssuesFound', CSV_ISSUES_ERRORS_FILENAME);
        logger.log('csvValidateOnlyNormalizedWritten');
      } else {
        if (!promptHandled) {
          await this._promptToAbortCsvIssuesAsync();
        } else {
          await this._writeCsvIssuesReportAsync();
        }
        logger.warn('incorrectCsvFiles', String(this.csvIssues.length), CSV_ISSUES_ERRORS_FILENAME);
      }
    } else if (isValidateOnly) {
      logger.log('csvValidateOnlyNoIssues');
      logger.log('csvValidateOnlyNormalizedWritten');
    } else {
      this._logDiagnostics('No issues in CSV files were found.');
    }
  }

  /**
   * Validates a single CSV file.
   *
   * @param task - Task to validate.
   * @returns CSV issues.
   */
  private async _validateCsvFileAsync(task: MigrationJobTask): Promise<CsvIssueRowType[]> {
    const rawCsvFilename = this._getRawCsvFilePath(task);
    const sourceCsvFilename = this._getSourceCsvFilePath(task);
    const logger = this._getLogger();
    const fieldsToUpdateMap = task.scriptObject.fieldsToUpdateMap;
    const writableFieldNames = new Set([...fieldsToUpdateMap.keys()].map((fieldName) => fieldName.toLowerCase()));
    const requiredFields = [...fieldsToUpdateMap.keys()];
    const skipMissingFieldsWhenIdsExcluded: string[] = [];
    const lookupFieldPairs: CsvLookupFieldPairType[] = [];

    fieldsToUpdateMap.forEach((field, fieldName) => {
      if (field.isSimpleReference || fieldName === 'Id') {
        skipMissingFieldsWhenIdsExcluded.push(fieldName);
      }
    });

    if (!this.script.excludeIdsFromCSVFiles && !requiredFields.includes('Id')) {
      requiredFields.push('Id');
    }

    task.scriptObject.fieldsInQueryMap.forEach((field, fieldName) => {
      if (!field.lookup || !writableFieldNames.has(fieldName.toLowerCase())) {
        return;
      }
      const referenceFieldName = field.fullOriginalName__r || field.fullName__r || field.name__r;
      lookupFieldPairs.push({
        idFieldName: field.nameId,
        referenceFieldName,
      });
    });

    const exists = await this._pathExistsAsync(rawCsvFilename);
    this._logVerboseObject(
      task.sObjectName,
      `CSV validation start. file=${rawCsvFilename} requiredFields=${requiredFields.join(', ') || 'none'} excludeIds=${
        this.script.excludeIdsFromCSVFiles
      }`
    );
    const issues = await CsvValidationService.validateCsvAsync({
      sourceCsvFilename: rawCsvFilename,
      sObjectName: task.sObjectName,
      requiredFields,
      lookupFieldPairs,
      skipMissingFieldsWhenIdsExcluded,
      excludeIdsFromCsvFiles: this.script.excludeIdsFromCSVFiles,
      missingCsvFileErrorMessage: logger.getResourceString('missingCsvFile'),
      missingColumnErrorMessage: logger.getResourceString('missingColumnsInCsvFile'),
    });

    if (!exists) {
      await Common.writeCsvFileAsync(sourceCsvFilename, [], true, undefined, false, true);
      this._logDiagnostics(`Saved CSV file: ${sourceCsvFilename}.`);
    }

    if (issues.length > 0) {
      this._logVerboseObject(task.sObjectName, `CSV validation completed with ${issues.length} issue(s).`);
    } else {
      this._logVerboseObject(task.sObjectName, 'CSV validation completed with no issues.');
    }
    return issues;
  }

  /**
   * Repairs CSV content in two passes.
   *
   * @param task - Task to repair.
   * @param fixColumns - True to adjust columns.
   * @returns CSV issues.
   */
  private async _repairCsvAsync(task: MigrationJobTask, fixColumns: boolean): Promise<CsvIssueRowType[]> {
    const rawCsvFilename = this._getRawCsvFilePath(task);
    const sourceCsvFilename = this._getSourceCsvFilePath(task);
    const currentFileMap = await this._loadRawCsvIntoCacheAsync(rawCsvFilename, sourceCsvFilename, task.sObjectName);

    if (currentFileMap.size === 0) {
      return [];
    }

    const firstRow = currentFileMap.values().next().value as Record<string, unknown> | undefined;
    if (!firstRow) {
      return [];
    }

    const issues: CsvIssueRowType[] = [];

    if (fixColumns) {
      this._logVerboseObject(task.sObjectName, `CSV repair pass started. fixColumns=${fixColumns}.`);
      this._trimCsvColumnNames(task.sObjectName, sourceCsvFilename, currentFileMap, firstRow);
      this._normalizeCsvColumnCase(task, sourceCsvFilename, currentFileMap);
      if (!this.script.forcePostProcessCsvIdFix) {
        this._addMissingIdColumn(task.sObjectName, sourceCsvFilename, currentFileMap, firstRow);
      } else {
        this._logVerboseObject(
          task.sObjectName,
          'Skipping first-pass Id repair because forcePostProcessCsvIdFix=true.'
        );
      }
      this._logVerboseObject(task.sObjectName, 'CSV repair pass completed (column fixes).');
      return issues;
    }

    this._logVerboseObject(task.sObjectName, `CSV repair pass started. fixColumns=${fixColumns}.`);
    if (!Object.prototype.hasOwnProperty.call(firstRow, 'Id') || this.script.excludeIdsFromCSVFiles) {
      await this._updateChildOriginalIdColumnsAsync(task, currentFileMap);
    }

    // Normalize legacy RecordType lookup columns before filling missing lookup Ids.
    // This allows lookup resolution to use the real composite external id instead of generated placeholders.
    this._fixOldRecordTypeColumns(task, sourceCsvFilename, currentFileMap);

    const lookupFields = this._getWritableLookupFields(task);

    await Common.serialExecAsync(
      lookupFields.map((field) => async () => {
        await this._addMissingLookupColumnsAsync(task, field, currentFileMap, issues);
        return undefined;
      })
    );

    this._removeColumnsNotInQuery(task, sourceCsvFilename, currentFileMap);
    this._logVerboseObject(task.sObjectName, 'CSV repair pass completed (lookup fixes).');
    return issues;
  }

  /**
   * Removes extra whitespace from CSV header columns.
   *
   * @param sourceCsvFilename - CSV file path.
   * @param currentFileMap - Cached file map.
   * @param firstRow - First CSV row.
   */
  private _trimCsvColumnNames(
    objectName: string,
    sourceCsvFilename: string,
    currentFileMap: Map<string, Record<string, unknown>>,
    firstRow: Record<string, unknown>
  ): void {
    const columnsToUpdate = Object.keys(firstRow).filter((field) => field !== field.trim());
    if (columnsToUpdate.length === 0) {
      return;
    }

    for (const row of currentFileMap.values()) {
      for (const column of columnsToUpdate) {
        const trimmed = column.trim();
        row[trimmed] = row[column];
        delete row[column];
      }
    }
    this.cachedCsvContent.updatedFilenames.add(sourceCsvFilename);
    this._logVerboseObject(objectName, `CSV columns trimmed: ${columnsToUpdate.join(', ')}.`);
  }

  /**
   * Normalizes CSV column casing based on the final query field names.
   *
   * @param task - Task being repaired.
   * @param sourceCsvFilename - CSV file path.
   * @param currentFileMap - Cached file map.
   */
  private _normalizeCsvColumnCase(
    task: MigrationJobTask,
    sourceCsvFilename: string,
    currentFileMap: Map<string, Record<string, unknown>>
  ): void {
    const queryFields = task.scriptObject.fieldsInQuery;
    if (queryFields.length === 0) {
      return;
    }

    const canonicalMap = new Map<string, string>();
    queryFields.forEach((fieldName) => {
      canonicalMap.set(fieldName.toLowerCase(), fieldName);
    });

    let updated = false;
    for (const row of currentFileMap.values()) {
      Object.keys(row).forEach((column) => {
        const canonical = canonicalMap.get(column.toLowerCase());
        if (!canonical || canonical === column) {
          return;
        }
        if (!Object.prototype.hasOwnProperty.call(row, canonical)) {
          row[canonical] = row[column];
        }
        delete row[column];
        updated = true;
      });
    }

    if (updated) {
      this.cachedCsvContent.updatedFilenames.add(sourceCsvFilename);
      this._logVerboseObject(task.sObjectName, 'CSV column casing normalized to match query fields.');
    }
  }

  /**
   * Removes CSV columns that are not part of the final query.
   *
   * @param task - Task being repaired.
   * @param sourceCsvFilename - CSV file path.
   * @param currentFileMap - Cached file map.
   */
  private _removeColumnsNotInQuery(
    task: MigrationJobTask,
    sourceCsvFilename: string,
    currentFileMap: Map<string, Record<string, unknown>>
  ): void {
    const queryFields = task.scriptObject.fieldsInQuery;
    if (queryFields.length === 0) {
      return;
    }

    const allowed = new Set(queryFields.map((field) => field.toLowerCase()));
    let removed = 0;
    for (const row of currentFileMap.values()) {
      Object.keys(row).forEach((column) => {
        if (allowed.has(column.toLowerCase())) {
          return;
        }
        delete row[column];
        removed += 1;
      });
    }

    if (removed > 0) {
      this.cachedCsvContent.updatedFilenames.add(sourceCsvFilename);
      this._logVerboseObject(task.sObjectName, `CSV columns removed because they are not in query. Count=${removed}.`);
    }
  }

  /**
   * Adds missing Id column values when absent.
   *
   * @param sourceCsvFilename - CSV file path.
   * @param currentFileMap - Cached file map.
   * @param firstRow - First CSV row.
   */
  private _addMissingIdColumn(
    objectName: string,
    sourceCsvFilename: string,
    currentFileMap: Map<string, Record<string, unknown>>,
    firstRow: Record<string, unknown>
  ): void {
    if (Object.prototype.hasOwnProperty.call(firstRow, 'Id')) {
      return;
    }

    for (const [id, row] of currentFileMap.entries()) {
      row['Id'] = id;
    }
    this.cachedCsvContent.updatedFilenames.add(sourceCsvFilename);
    this._logVerboseObject(
      objectName,
      `CSV Id column added with generated values to ${currentFileMap.size} record(s).`
    );
  }

  /**
   * Ensures every repaired source CSV has an Id column.
   * If Id is still missing after all repair passes, generates random values and reports the issue.
   *
   * @param csvTasks - CSV tasks to validate in cache.
   * @returns Added CSV issues.
   */
  private _addMissingIdColumnFinalPass(csvTasks: MigrationJobTask[]): CsvIssueRowType[] {
    const existingIssueKeys = new Set(
      this.csvIssues.map(
        (issue) => `${issue['sObject name'] ?? ''}|${issue['Field name'] ?? ''}|${issue.Error.trim().toLowerCase()}`
      )
    );
    const createdIssues: CsvIssueRowType[] = [];

    for (const task of csvTasks) {
      const sourceCsvFilename = this._getSourceCsvFilePath(task);
      const currentFileMap = this.cachedCsvContent.csvDataCacheMap.get(sourceCsvFilename);
      if (!currentFileMap || currentFileMap.size === 0) {
        continue;
      }

      const firstRow = currentFileMap.values().next().value as Record<string, unknown> | undefined;
      if (!firstRow) {
        continue;
      }

      const existingIdColumn = Object.keys(firstRow).find((columnName) => columnName.toLowerCase() === 'id');
      const usedIds = new Set<string>();
      let generatedIds = 0;
      let normalizedIds = 0;
      let hasChanges = false;
      let missingIdColumn = false;

      if (!existingIdColumn) {
        missingIdColumn = true;
        for (const row of currentFileMap.values()) {
          row['Id'] = this._generateUniqueCsvId(usedIds);
          generatedIds += 1;
        }
        hasChanges = true;
      } else if (existingIdColumn !== 'Id') {
        for (const row of currentFileMap.values()) {
          row['Id'] = row[existingIdColumn];
          delete row[existingIdColumn];
        }
        hasChanges = true;
        normalizedIds += currentFileMap.size;
      }

      for (const row of currentFileMap.values()) {
        const currentIdRaw = row['Id'];
        const currentId =
          currentIdRaw === null || typeof currentIdRaw === 'undefined' ? '' : String(currentIdRaw).trim();
        if (!currentId || usedIds.has(currentId)) {
          row['Id'] = this._generateUniqueCsvId(usedIds);
          generatedIds += 1;
          hasChanges = true;
          continue;
        }
        if (row['Id'] !== currentId) {
          row['Id'] = currentId;
          normalizedIds += 1;
          hasChanges = true;
        }
        usedIds.add(currentId);
      }

      if (hasChanges) {
        this.cachedCsvContent.updatedFilenames.add(sourceCsvFilename);
        this._logVerboseObject(
          task.sObjectName,
          `CSV Id final repair pass completed. generated=${generatedIds} normalized=${normalizedIds}.`
        );
      }

      if (missingIdColumn) {
        const issue = this._createMissingCsvColumnIssue(task.sObjectName, 'Id');
        const issueKey = `${issue['sObject name'] ?? ''}|${
          issue['Field name'] ?? ''
        }|${issue.Error.trim().toLowerCase()}`;
        if (existingIssueKeys.has(issueKey)) {
          continue;
        }
        existingIssueKeys.add(issueKey);
        createdIssues.push(issue);
      }
    }

    return createdIssues;
  }

  /**
   * Generates a unique synthetic CSV Id value.
   *
   * @param usedIds - Id set already used in the file.
   * @returns Unique generated Id.
   */
  private _generateUniqueCsvId(usedIds: Set<string>): string {
    void this;
    let generatedId = Common.makeId(18).toUpperCase();
    while (usedIds.has(generatedId)) {
      generatedId = Common.makeId(18).toUpperCase();
    }
    usedIds.add(generatedId);
    return generatedId;
  }

  /**
   * Updates child lookup Id columns when parent Ids are synthesized.
   *
   * @param task - Parent task.
   * @param parentFileMap - Parent CSV data map.
   */
  private async _updateChildOriginalIdColumnsAsync(
    task: MigrationJobTask,
    parentFileMap: Map<string, Record<string, unknown>>
  ): Promise<void> {
    if (!this.script.excludeIdsFromCSVFiles) {
      return;
    }
    const parentExternalIdColumnName = task.scriptObject.complexOriginalExternalId;
    if (parentExternalIdColumnName === 'Id') {
      return;
    }

    const childIdFields = this._getChildLookupIdFields(task.scriptObject);
    if (childIdFields.length > 0) {
      this._logVerboseObject(
        task.sObjectName,
        `Updating child lookup Id columns for ${childIdFields.length} field(s) using ${parentExternalIdColumnName}.`
      );
    }
    await Common.serialExecAsync(
      childIdFields.map((childIdField) => async () => {
        await this._updateChildLookupColumnsAsync(childIdField, parentExternalIdColumnName, parentFileMap);
        return undefined;
      })
    );
  }

  /**
   * Updates child lookup columns for a specific lookup field.
   *
   * @param childIdField - Child lookup Id field.
   * @param parentExternalIdColumnName - Parent external Id column name.
   * @param parentFileMap - Parent CSV data map.
   */
  private async _updateChildLookupColumnsAsync(
    childIdField: SFieldDescribe,
    parentExternalIdColumnName: string,
    parentFileMap: Map<string, Record<string, unknown>>
  ): Promise<void> {
    const childScriptObject = childIdField.scriptObject;
    if (!childScriptObject) {
      return;
    }

    const childTask = this.getTaskBySObjectName(childScriptObject.name);
    if (!childTask) {
      return;
    }

    const childFilePath = this._getSourceCsvFilePath(childTask);
    const childFileMap = await Common.readCsvFileOnceAsync(this.cachedCsvContent.csvDataCacheMap, childFilePath);
    if (childFileMap.size === 0) {
      return;
    }

    const childFirstRow = childFileMap.values().next().value as Record<string, unknown> | undefined;
    if (!childFirstRow) {
      return;
    }

    const columnChildOriginalNameR = childIdField.fullOriginalName__r;
    if (!Object.prototype.hasOwnProperty.call(childFirstRow, columnChildOriginalNameR)) {
      return;
    }

    const columnChildIdNameR = childIdField.fullIdName__r;
    const columnChildNameId = childIdField.nameId;
    const parentExternalIdMap = new Map<string, Record<string, unknown>>();
    let updatedRows = 0;

    for (const row of parentFileMap.values()) {
      const key = this._getRecordValue(row, parentExternalIdColumnName);
      if (key) {
        parentExternalIdMap.set(key, row);
      }
    }

    for (const row of childFileMap.values()) {
      const extIdValue = this._getRecordValue(row, columnChildOriginalNameR);
      if (!extIdValue) {
        continue;
      }
      const parentRow = parentExternalIdMap.get(extIdValue);
      if (!parentRow) {
        continue;
      }
      const parentId = this._getRecordValue(parentRow, 'Id');
      if (!parentId) {
        continue;
      }
      row[columnChildNameId] = parentId;
      row[columnChildIdNameR] = parentId;
      this.cachedCsvContent.updatedFilenames.add(childFilePath);
      updatedRows += 1;
    }

    if (updatedRows > 0) {
      this._logVerboseField(
        childScriptObject.name,
        childIdField.name,
        `Updated child lookup Id columns for ${updatedRows} record(s).`
      );
    }
  }

  /**
   * Adds missing lookup columns in the CSV file.
   *
   * @param task - Task being repaired.
   * @param field - Lookup field to fix.
   * @param currentFileMap - Current CSV map.
   * @param issues - CSV issues accumulator.
   */
  private async _addMissingLookupColumnsAsync(
    task: MigrationJobTask,
    field: SFieldDescribe,
    currentFileMap: Map<string, Record<string, unknown>>,
    issues: CsvIssueRowType[]
  ): Promise<void> {
    if (!field.parentLookupObject) {
      return;
    }

    const columnNameR = field.fullOriginalName__r || field.fullName__r || field.name__r;
    const columnNameId = field.nameId;
    const parentExternalId = field.parentLookupObject.complexOriginalExternalId;
    const parentObjectName = field.parentLookupObject.name;
    const parentTask = this.getTaskBySObjectName(parentObjectName);
    if (!parentTask) {
      return;
    }
    if (!columnNameR) {
      return;
    }

    const isSelfLookup = parentTask.sObjectName === task.sObjectName;
    const allowGeneratedIds = this.script.excludeIdsFromCSVFiles;
    const parentFilePath = this._getSourceCsvFilePath(parentTask);
    const parentFileMap = await Common.readCsvFileOnceAsync(this.cachedCsvContent.csvDataCacheMap, parentFilePath);
    const parentCsvRowsMap = new Map<string, Record<string, unknown>>();
    let addedIdColumn = 0;
    let addedReferenceColumn = 0;
    let createdParentRows = 0;
    let resolvedConflicts = 0;
    let reportedConflicts = 0;

    for (const parentRow of parentFileMap.values()) {
      const key = this._getRecordValue(parentRow, parentExternalId);
      if (key) {
        parentCsvRowsMap.set(key, parentRow);
      }
    }

    for (const csvRow of currentFileMap.values()) {
      const hasIdColumn = Object.prototype.hasOwnProperty.call(csvRow, columnNameId);
      const hasReferenceColumn = Object.prototype.hasOwnProperty.call(csvRow, columnNameR);

      if (hasIdColumn && hasReferenceColumn) {
        const conflict = this._resolveLookupConflict(
          task,
          field,
          csvRow,
          columnNameId,
          columnNameR,
          parentExternalId,
          parentFileMap,
          parentCsvRowsMap,
          issues
        );
        if (conflict.resolved) {
          resolvedConflicts += 1;
        }
        if (conflict.reported) {
          reportedConflicts += 1;
        }
        continue;
      }

      if (!hasIdColumn) {
        const outcome = this._handleMissingLookupIdColumn(
          task,
          csvRow,
          columnNameId,
          columnNameR,
          parentExternalId,
          parentObjectName,
          parentFileMap,
          parentCsvRowsMap,
          parentFilePath,
          issues,
          isSelfLookup,
          allowGeneratedIds
        );
        addedIdColumn += outcome.addedId;
        addedReferenceColumn += outcome.addedReference;
        createdParentRows += outcome.createdParents;
        continue;
      }

      if (!hasReferenceColumn) {
        const outcome = this._handleMissingLookupReferenceColumn(
          task,
          csvRow,
          columnNameId,
          columnNameR,
          parentExternalId,
          parentObjectName,
          parentFileMap,
          parentCsvRowsMap,
          parentFilePath,
          issues,
          isSelfLookup,
          allowGeneratedIds
        );
        addedReferenceColumn += outcome.addedReference;
        createdParentRows += outcome.createdParents;
      }
    }

    if (addedIdColumn > 0 || addedReferenceColumn > 0 || createdParentRows > 0 || resolvedConflicts > 0) {
      this._logVerboseField(
        task.sObjectName,
        field.name,
        `CSV lookup columns updated. addedId=${addedIdColumn} addedReference=${addedReferenceColumn} createdParents=${createdParentRows} conflictsResolved=${resolvedConflicts} conflictsReported=${reportedConflicts}.`
      );
    }
  }

  /**
   * Fixes legacy RecordType column names in CSVs.
   *
   * @param task - Task being repaired.
   * @param sourceCsvFilename - CSV file path.
   * @param currentFileMap - Current CSV map.
   */
  private _fixOldRecordTypeColumns(
    task: MigrationJobTask,
    sourceCsvFilename: string,
    currentFileMap: Map<string, Record<string, unknown>>
  ): void {
    if (task.sObjectName !== RECORD_TYPE_SOBJECT_NAME) {
      const recordTypeLookup = [...task.scriptObject.fieldsInQueryMap.values()].find(
        (field) => field.lookup && field.parentLookupObject?.name === RECORD_TYPE_SOBJECT_NAME
      );
      if (!recordTypeLookup) {
        return;
      }

      const oldColumnName = OLD_DEFAULT_RECORD_TYPE_ID_FIELD_R_NAME;
      const newColumnName = recordTypeLookup.fullName__r;
      const relationshipName = recordTypeLookup.name__r;
      const legacyKeyPartNames = Common.getFieldFromComplexField(
        recordTypeLookup.parentLookupObject?.originalExternalId ?? ''
      )
        .split(COMPLEX_FIELDS_SEPARATOR)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      const legacyColumnNames = legacyKeyPartNames.map((part) => `${relationshipName}.${part}`);
      let updated = false;

      for (const row of currentFileMap.values()) {
        const hasLegacyColumns = legacyColumnNames.some((columnName) =>
          Object.prototype.hasOwnProperty.call(row, columnName)
        );
        if (!hasLegacyColumns && !Object.prototype.hasOwnProperty.call(row, oldColumnName)) {
          continue;
        }

        const combinedValue = legacyColumnNames
          .map((columnName) => this._getRecordValue(row, columnName) ?? '')
          .filter((value) => value.length > 0)
          .join(COMPLEX_FIELDS_SEPARATOR);
        if (combinedValue.length > 0) {
          row[newColumnName] = combinedValue;
        }

        legacyColumnNames.forEach((columnName) => {
          if (Object.prototype.hasOwnProperty.call(row, columnName) && columnName !== newColumnName) {
            delete row[columnName];
          }
        });
        updated = true;
      }

      if (updated) {
        this.cachedCsvContent.updatedFilenames.add(sourceCsvFilename);
        this._logVerboseField(
          task.sObjectName,
          recordTypeLookup.name,
          `CSV legacy RecordType columns normalized to ${newColumnName}.`
        );
      }
      return;
    }

    const oldColumnNames = task.scriptObject.externalId.split(COMPLEX_FIELDS_SEPARATOR);
    const newColumnName = task.scriptObject.complexExternalId;
    let updated = false;

    for (const row of currentFileMap.values()) {
      if (Object.prototype.hasOwnProperty.call(row, newColumnName)) {
        continue;
      }
      const combined = oldColumnNames
        .map((name) => {
          const value = row[name];
          if (value) {
            delete row[name];
            return String(value);
          }
          return '';
        })
        .filter((value) => value.length > 0)
        .join(COMPLEX_FIELDS_SEPARATOR);
      row[newColumnName] = combined;
      updated = true;
    }

    if (updated) {
      this.cachedCsvContent.updatedFilenames.add(sourceCsvFilename);
      this._logVerboseObject(task.sObjectName, `CSV combined RecordType externalId columns into ${newColumnName}.`);
    }
  }

  /**
   * Writes updated CSV files from cache.
   */
  private async _saveCachedCsvDataFilesAsync(): Promise<void> {
    const logger = this._getLogger();
    const writeTasks = [...this.cachedCsvContent.csvDataCacheMap.entries()].map(([filePath, csvData]) => async () => {
      const rawPath = this._rawCsvPathBySourcePath.get(filePath);
      const objectName = this._getObjectNameFromCsvFilename(filePath);
      const csvRows = [...csvData.values()];
      const firstRow = csvRows[0];
      const originalColumns = firstRow ? Object.keys(firstRow) : [];
      const orderedColumns = originalColumns.length
        ? Common.orderCsvColumnsWithIdFirstAndErrorsLast(originalColumns)
        : [];
      const columnsAlreadyOrdered =
        originalColumns.length === orderedColumns.length &&
        originalColumns.every((column, index) => column === orderedColumns[index]);
      if (firstRow && !columnsAlreadyOrdered) {
        this.cachedCsvContent.updatedFilenames.add(filePath);
      }

      const rawExists = rawPath ? await this._pathExistsAsync(rawPath) : false;
      if (this.cachedCsvContent.updatedFilenames.has(filePath) || !rawExists) {
        logger.log('writingCsvFile', filePath);
        if (objectName) {
          this._logVerboseObject(objectName, `CSV cache written to ${filePath}. Rows=${csvData.size}.`);
        }
        if (csvRows.length > 0) {
          await Common.writeCsvFileAsync(filePath, csvRows, true, orderedColumns, true, true);
        } else {
          await Common.writeCsvFileAsync(filePath, [], true, undefined, false, true);
        }
        this._logDiagnostics(`Saved CSV file: ${filePath}.`);
        return undefined;
      }
      if (rawPath && rawExists) {
        if (objectName) {
          this._logVerboseObject(objectName, `CSV cache unchanged. Copying raw file ${rawPath} to ${filePath}.`);
        }
        await fs.copyFile(rawPath, filePath);
        this._logDiagnostics(`Saved CSV file: ${filePath}.`);
        return undefined;
      }
      if (objectName) {
        this._logVerboseObject(objectName, `CSV cache empty. Writing empty file ${filePath}.`);
      }
      await Common.writeCsvFileAsync(filePath, [], true, undefined, false, true);
      this._logDiagnostics(`Saved CSV file: ${filePath}.`);
      return undefined;
    });
    await Common.serialExecAsync(writeTasks);
  }

  /**
   * Removes the CSV issues report file at the start of validation.
   */
  private async _removeCsvIssuesReportAsync(): Promise<void> {
    const reportPath = path.join(this.script.reportsDirectoryPath, CSV_ISSUES_ERRORS_FILENAME);
    if (!(await this._pathExistsAsync(reportPath))) {
      return;
    }
    try {
      await fs.unlink(reportPath);
    } catch {
      // Best-effort cleanup to avoid stale reports.
    }
  }

  /**
   * Logs CSV issue summary counts by file and error category.
   */
  private _logCsvIssueSummaryByFile(): void {
    if (this.csvIssues.length === 0) {
      return;
    }

    const issuesByFile = new Map<string, Map<string, number>>();
    for (const issue of this.csvIssues) {
      const objectName = issue['sObject name'];
      if (!objectName) {
        continue;
      }
      const filePath = Common.getCSVFilename(this.script.sourceDirectoryPath, objectName, CSV_SOURCE_FILE_SUFFIX);
      const error = issue.Error ?? 'UNKNOWN';
      let fileMap = issuesByFile.get(filePath);
      if (!fileMap) {
        fileMap = new Map<string, number>();
        issuesByFile.set(filePath, fileMap);
      }
      fileMap.set(error, (fileMap.get(error) ?? 0) + 1);
    }

    issuesByFile.forEach((errorMap, filePath) => {
      const summary = [...errorMap.entries()].map(([error, count]) => `${error}=${count}`).join(', ');
      this._logDiagnostics(`CSV issues summary for ${filePath}: ${summary}.`);
    });
  }

  /**
   * Prompts or logs CSV issues as needed.
   */
  private async _promptToAbortCsvIssuesAsync(): Promise<void> {
    if (!this.script.promptOnIssuesInCSVFiles) {
      await this._writeCsvIssuesReportAsync();
      return;
    }

    await Common.abortWithPrompt(
      'incorrectCsvFiles',
      this.script.promptOnIssuesInCSVFiles,
      'continueTheJob',
      '',
      async () => {
        await this._writeCsvIssuesReportAsync();
      },
      String(this.csvIssues.length),
      CSV_ISSUES_ERRORS_FILENAME
    );
  }

  /**
   * Writes CSV issue report file.
   */
  private async _writeCsvIssuesReportAsync(): Promise<void> {
    const logger = this._getLogger();
    if (this.csvIssues.length === 0) {
      this._logDiagnostics('No issues in CSV files were found.');
      return;
    }
    const reportPath = path.join(this.script.reportsDirectoryPath, CSV_ISSUES_ERRORS_FILENAME);
    logger.log('writingCsvFile', reportPath);
    await CsvReportService.writeCsvIssuesReportAsync(this.script.reportsDirectoryPath, this.csvIssues, false);
    this._logDiagnostics(`Saved CSV file: ${reportPath}.`);
    await this._logCsvIssuesReportDiagnosticsAsync(reportPath);
  }

  /**
   * Logs CSV issue report contents into the diagnostic file log.
   *
   * @param reportPath - CSV issues report path.
   */
  private async _logCsvIssuesReportDiagnosticsAsync(reportPath: string): Promise<void> {
    const logger = this._getLogger();
    try {
      const raw = await fs.readFile(reportPath, 'utf8');
      logger.verboseFile('newLine');
      logger.verboseFile('csvIssuesDiagnosticHeader');
      raw.split(/\r?\n/).forEach((line) => logger.verboseFile(line));
      logger.verboseFile('newLine');
    } catch {
      // Ignore missing diagnostics for CSV issues report.
    }
  }

  /**
   * Writes the missing parent lookup records report.
   *
   * @param records - Missing parent lookup records.
   */
  private async _writeMissingParentLookupReportAsync(records: Array<Record<string, unknown>>): Promise<void> {
    const logger = this._getLogger();
    if (records.length === 0) {
      this._logDiagnostics('No missing parent CSV records were found.');
      return;
    }
    const reportPath = path.join(this.script.reportsDirectoryPath, MISSING_PARENT_LOOKUP_RECORDS_ERRORS_FILENAME);
    await fs.mkdir(this.script.reportsDirectoryPath, { recursive: true });
    logger.log('writingCsvFile', reportPath);
    await Common.writeCsvFileAsync(reportPath, records, true, undefined, false, true);
    this._logDiagnostics(`Saved CSV file: ${reportPath}.`);
  }

  /**
   * Writes a diagnostic-only message to the file log.
   *
   * @param message - Diagnostic message.
   */
  private _logDiagnostics(message: string): void {
    Common.logDiagnostics(message, this._getLogger());
  }

  /**
   * Creates a CSV issue row for missing parent lookup records.
   *
   * @param sObjectName - Child object name.
   * @param fieldName - Child field name.
   * @param fieldValue - Child field value.
   * @param parentObjectName - Parent object name.
   * @param parentFieldName - Parent field name.
   * @returns CSV issue row.
   */
  private _createMissingParentLookupIssue(
    sObjectName: string,
    fieldName: string,
    fieldValue: string,
    parentObjectName: string,
    parentFieldName: string
  ): CsvIssueRowType {
    const logger = this._getLogger();
    return {
      'Date update': Common.formatDateTime(new Date()),
      'sObject name': sObjectName,
      'Field name': fieldName,
      'Field value': fieldValue,
      'Parent SObject name': parentObjectName,
      'Parent field name': parentFieldName,
      'Parent field value': null,
      Error: logger.getResourceString('missingParentLookupRecords'),
    };
  }

  /**
   * Creates a CSV issue row for conflicting lookup values.
   *
   * @param sObjectName - Child object name.
   * @param fieldName - Lookup field name.
   * @param idValue - Lookup Id value.
   * @param referenceValue - Lookup reference value.
   * @param parentFieldName - Parent external id field name.
   * @returns CSV issue row.
   */
  private _createLookupConflictIssue(
    sObjectName: string,
    fieldName: string,
    idValue: string,
    referenceValue: string,
    parentFieldName: string
  ): CsvIssueRowType {
    void this;
    return {
      'Date update': Common.formatDateTime(new Date()),
      'sObject name': sObjectName,
      'Field name': fieldName,
      'Field value': idValue,
      'Parent SObject name': null,
      'Parent field name': parentFieldName,
      'Parent field value': referenceValue,
      Error: 'LOOKUP ID/REFERENCE CONFLICT',
    };
  }

  /**
   * Creates a CSV issue row for a missing CSV column.
   *
   * @param sObjectName - Object API name.
   * @param fieldName - Missing field API name.
   * @returns CSV issue row.
   */
  private _createMissingCsvColumnIssue(sObjectName: string, fieldName: string): CsvIssueRowType {
    const logger = this._getLogger();
    return {
      'Date update': Common.formatDateTime(new Date()),
      'sObject name': sObjectName,
      'Field name': fieldName,
      'Field value': null,
      'Parent SObject name': null,
      'Parent field name': null,
      'Parent field value': null,
      Error: logger.getResourceString('missingColumnsInCsvFile'),
    };
  }

  /**
   * Finds a parent row by Id value, regardless of map key.
   *
   * @param parentFileMap - Parent CSV map.
   * @param idValue - Id to locate.
   * @returns Parent row or undefined.
   */
  private _findParentRowById(
    parentFileMap: Map<string, Record<string, unknown>>,
    idValue: string
  ): Record<string, unknown> | undefined {
    const direct = parentFileMap.get(idValue);
    if (direct) {
      return direct;
    }
    for (const row of parentFileMap.values()) {
      const candidate = this._getRecordValue(row, 'Id');
      if (candidate === idValue) {
        return row;
      }
    }
    return undefined;
  }

  /**
   * Resolves lookup conflicts when both Id and reference columns are present.
   *
   * @param task - Task being processed.
   * @param field - Lookup field metadata.
   * @param csvRow - CSV row to update.
   * @param columnNameId - Lookup Id column name.
   * @param columnNameR - Lookup reference column name.
   * @param parentExternalId - Parent external Id column name.
   * @param parentFileMap - Parent CSV map.
   * @param parentCsvRowsMap - Parent CSV lookup map.
   * @param issues - CSV issues accumulator.
   * @returns Conflict resolution status.
   */
  private _resolveLookupConflict(
    task: MigrationJobTask,
    field: SFieldDescribe,
    csvRow: Record<string, unknown>,
    columnNameId: string,
    columnNameR: string,
    parentExternalId: string,
    parentFileMap: Map<string, Record<string, unknown>>,
    parentCsvRowsMap: Map<string, Record<string, unknown>>,
    issues: CsvIssueRowType[]
  ): { resolved: boolean; reported: boolean } {
    const row = csvRow;
    const idValue = this._getRecordValue(csvRow, columnNameId);
    const refValue = this._getRecordValue(csvRow, columnNameR);
    if (!idValue || !refValue) {
      return { resolved: false, reported: false };
    }

    const parentById = this._findParentRowById(parentFileMap, idValue);
    const parentByRef = parentCsvRowsMap.get(refValue);

    if (parentById) {
      const expectedRef = this._getRecordValue(parentById, parentExternalId);
      if (expectedRef && expectedRef !== refValue) {
        row[columnNameR] = expectedRef;
        this.cachedCsvContent.updatedFilenames.add(this._getSourceCsvFilePath(task));
        return { resolved: true, reported: false };
      }
      return { resolved: false, reported: false };
    }

    if (parentByRef) {
      const expectedId = this._getRecordValue(parentByRef, 'Id');
      if (expectedId && expectedId !== idValue) {
        row[columnNameId] = expectedId;
        this.cachedCsvContent.updatedFilenames.add(this._getSourceCsvFilePath(task));
        return { resolved: true, reported: false };
      }
      return { resolved: false, reported: false };
    }

    issues.push(this._createLookupConflictIssue(task.sObjectName, field.name, idValue, refValue, parentExternalId));
    return { resolved: false, reported: true };
  }

  /**
   * Handles missing lookup Id columns in CSV.
   *
   * @param task - Task being processed.
   * @param field - Lookup field metadata.
   * @param csvRow - CSV row to update.
   * @param columnNameId - Lookup Id column name.
   * @param columnNameR - Lookup reference column name.
   * @param parentExternalId - Parent external Id column name.
   * @param parentFileMap - Parent CSV map.
   * @param parentCsvRowsMap - Parent lookup map.
   * @param parentFilePath - Parent CSV file path.
   * @param issues - CSV issues accumulator.
   * @param isSelfLookup - True for self lookups.
   * @param allowGeneratedIds - True when Ids may be generated.
   * @returns Added column counts.
   */
  private _handleMissingLookupIdColumn(
    task: MigrationJobTask,
    csvRow: Record<string, unknown>,
    columnNameId: string,
    columnNameR: string,
    parentExternalId: string,
    parentObjectName: string,
    parentFileMap: Map<string, Record<string, unknown>>,
    parentCsvRowsMap: Map<string, Record<string, unknown>>,
    parentFilePath: string,
    issues: CsvIssueRowType[],
    isSelfLookup: boolean,
    allowGeneratedIds: boolean
  ): { addedId: number; addedReference: number; createdParents: number } {
    const row = csvRow;
    let addedId = 0;
    let createdParents = 0;

    if (!Object.prototype.hasOwnProperty.call(csvRow, columnNameR)) {
      const composedReferenceValue = this._composeLegacyLookupReferenceValue(csvRow, columnNameR, parentExternalId);
      if (composedReferenceValue !== null) {
        row[columnNameR] = composedReferenceValue;
      }
    }

    if (!Object.prototype.hasOwnProperty.call(csvRow, columnNameR)) {
      this.cachedCsvContent.updatedFilenames.add(this._getSourceCsvFilePath(task));
      if (allowGeneratedIds) {
        row[columnNameId] = this.cachedCsvContent.nextId;
        row[columnNameR] = this.cachedCsvContent.nextId;
      } else {
        row[columnNameId] = null;
        row[columnNameR] = null;
      }
      return { addedId: 1, addedReference: 1, createdParents: 0 };
    }

    const desiredExternalIdValue = this._getRecordValue(csvRow, columnNameR);
    this.cachedCsvContent.updatedFilenames.add(this._getSourceCsvFilePath(task));
    if (!desiredExternalIdValue) {
      row[columnNameId] = null;
      return { addedId: 1, addedReference: 0, createdParents: 0 };
    }

    if (!allowGeneratedIds) {
      row[columnNameId] = null;
      return { addedId: 1, addedReference: 0, createdParents: 0 };
    }

    let parentRow = parentCsvRowsMap.get(desiredExternalIdValue);
    if (!parentRow) {
      if (!this.script.excludeIdsFromCSVFiles) {
        issues.push(
          this._createMissingParentLookupIssue(
            task.sObjectName,
            columnNameR,
            desiredExternalIdValue,
            parentObjectName,
            parentExternalId
          )
        );
      }

      if (isSelfLookup) {
        row[columnNameId] = null;
        return { addedId: 1, addedReference: 0, createdParents: 0 };
      }

      const newId = this.cachedCsvContent.nextId;
      row[columnNameId] = newId;
      parentRow = {
        Id: newId,
        [parentExternalId]: desiredExternalIdValue,
      };
      parentFileMap.set(newId, parentRow);
      parentCsvRowsMap.set(desiredExternalIdValue, parentRow);
      this.cachedCsvContent.updatedFilenames.add(parentFilePath);
      createdParents = 1;
    } else {
      const parentId = this._getRecordValue(parentRow, 'Id');
      if (parentId) {
        row[columnNameId] = parentId;
      } else {
        row[columnNameId] = this.cachedCsvContent.nextId;
      }
    }

    addedId = 1;
    return { addedId, addedReference: 0, createdParents };
  }

  /**
   * Composes a lookup reference value from legacy split relationship columns.
   *
   * @param csvRow - CSV row being repaired.
   * @param columnNameR - Canonical lookup reference column name.
   * @param parentExternalId - Parent external id field name.
   * @returns Composed reference value when legacy columns exist, otherwise null.
   */
  private _composeLegacyLookupReferenceValue(
    csvRow: Record<string, unknown>,
    columnNameR: string,
    parentExternalId: string
  ): string | null {
    const row = csvRow;
    const separatorIndex = columnNameR.indexOf('.');
    if (separatorIndex <= 0) {
      return null;
    }

    const relationshipName = columnNameR.slice(0, separatorIndex);
    const parentExternalIdParts = Common.getFieldFromComplexField(parentExternalId)
      .split(COMPLEX_FIELDS_SEPARATOR)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parentExternalIdParts.length <= 1) {
      return null;
    }

    const legacyColumnNames = parentExternalIdParts.map((part) => `${relationshipName}.${part}`);
    const hasLegacyColumns = legacyColumnNames.some((columnName) =>
      Object.prototype.hasOwnProperty.call(row, columnName)
    );
    if (!hasLegacyColumns) {
      return null;
    }

    const composedValue = legacyColumnNames
      .map((columnName) => this._getRecordValue(row, columnName) ?? '')
      .filter((value) => value.length > 0)
      .join(COMPLEX_FIELDS_SEPARATOR);
    legacyColumnNames.forEach((columnName) => {
      if (Object.prototype.hasOwnProperty.call(row, columnName)) {
        delete row[columnName];
      }
    });
    return composedValue;
  }

  /**
   * Handles missing lookup reference columns in CSV.
   *
   * @param task - Task being processed.
   * @param field - Lookup field metadata.
   * @param csvRow - CSV row to update.
   * @param columnNameId - Lookup Id column name.
   * @param columnNameR - Lookup reference column name.
   * @param parentExternalId - Parent external Id column name.
   * @param parentFileMap - Parent CSV map.
   * @param parentCsvRowsMap - Parent lookup map.
   * @param parentFilePath - Parent CSV file path.
   * @param issues - CSV issues accumulator.
   * @param isSelfLookup - True for self lookups.
   * @param allowGeneratedIds - True when Ids may be generated.
   * @returns Added column counts.
   */
  private _handleMissingLookupReferenceColumn(
    task: MigrationJobTask,
    csvRow: Record<string, unknown>,
    columnNameId: string,
    columnNameR: string,
    parentExternalId: string,
    parentObjectName: string,
    parentFileMap: Map<string, Record<string, unknown>>,
    parentCsvRowsMap: Map<string, Record<string, unknown>>,
    parentFilePath: string,
    issues: CsvIssueRowType[],
    isSelfLookup: boolean,
    allowGeneratedIds: boolean
  ): { addedReference: number; createdParents: number } {
    const row = csvRow;
    let createdParents = 0;
    const idValue = this._getRecordValue(csvRow, columnNameId);
    this.cachedCsvContent.updatedFilenames.add(this._getSourceCsvFilePath(task));

    if (!idValue) {
      row[columnNameR] = null;
      return { addedReference: 1, createdParents: 0 };
    }

    let parentRow = this._findParentRowById(parentFileMap, idValue);
    if (!parentRow) {
      if (!this.script.excludeIdsFromCSVFiles) {
        issues.push(
          this._createMissingParentLookupIssue(task.sObjectName, columnNameId, idValue, parentObjectName, 'Id')
        );
      }
      if (allowGeneratedIds) {
        if (isSelfLookup) {
          row[columnNameR] = null;
          return { addedReference: 1, createdParents: 0 };
        }
        const newReferenceId = this.cachedCsvContent.nextId;
        row[columnNameR] = newReferenceId;
        parentRow = {
          Id: idValue,
          [parentExternalId]: newReferenceId,
        };
        parentFileMap.set(idValue, parentRow);
        parentCsvRowsMap.set(newReferenceId, parentRow);
        this.cachedCsvContent.updatedFilenames.add(parentFilePath);
        createdParents = 1;
      } else {
        row[columnNameR] = null;
      }
    } else {
      row[columnNameR] = parentRow[parentExternalId];
    }

    return { addedReference: 1, createdParents };
  }

  /**
   * Returns child lookup Id fields for the parent object.
   *
   * @param parentObject - Parent script object.
   * @returns Child lookup fields.
   */
  private _getChildLookupIdFields(parentObject: ScriptObject): SFieldDescribe[] {
    const childFields: SFieldDescribe[] = [];
    this.tasks.forEach((task) => {
      const writableFieldNames = new Set(
        [...task.scriptObject.fieldsToUpdateMap.keys()].map((fieldName) => fieldName.toLowerCase())
      );
      task.scriptObject.fieldsInQueryMap.forEach((field) => {
        if (
          field.lookup &&
          writableFieldNames.has(field.name.toLowerCase()) &&
          field.parentLookupObject?.name === parentObject.name
        ) {
          childFields.push(field);
        }
      });
    });
    return childFields;
  }

  /**
   * Returns lookup fields that are writable for the current task operation.
   *
   * @param task - Task being processed.
   * @returns Writable lookup fields.
   */
  private _getWritableLookupFields(task: MigrationJobTask): SFieldDescribe[] {
    void this;
    const writableFieldNames = new Set(
      [...task.scriptObject.fieldsToUpdateMap.keys()].map((fieldName) => fieldName.toLowerCase())
    );
    const writableLookupFields: SFieldDescribe[] = [];
    task.scriptObject.fieldsInQueryMap.forEach((field, fieldName) => {
      if (!field.lookup || !writableFieldNames.has(fieldName.toLowerCase())) {
        return;
      }
      writableLookupFields.push(field);
    });
    return writableLookupFields;
  }

  /**
   * Reads a record value as a string.
   *
   * @param record - CSV record.
   * @param fieldName - Field name to read.
   * @returns String value or null.
   */
  private _getRecordValue(record: Record<string, unknown>, fieldName: string): string | null {
    void this;
    if (!record || !fieldName) {
      return null;
    }
    const value = record[fieldName];
    if (value === null || typeof value === 'undefined') {
      return null;
    }
    return String(value);
  }

  /**
   * Checks if a path exists.
   *
   * @param filePath - Path to check.
   * @returns True when the path exists.
   */
  private async _pathExistsAsync(filePath: string): Promise<boolean> {
    void this;
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
