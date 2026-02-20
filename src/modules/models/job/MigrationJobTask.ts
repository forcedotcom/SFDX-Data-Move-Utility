/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { Connection } from '@jsforce/jsforce-node';
import type { WhereClause } from 'soql-parser-js';
import type { LookupIdMapType } from '../script/LookupIdMapType.js';
import ScriptMockField from '../script/ScriptMockField.js';
import ScriptObject from '../script/ScriptObject.js';
import type ScriptOrg from '../script/ScriptOrg.js';
import SFieldDescribe from '../sf/SFieldDescribe.js';
import { Common } from '../../common/Common.js';
import { ADDON_EVENTS, OPERATION, SPECIAL_MOCK_PATTERN_TYPES } from '../../common/Enumerations.js';
import ApiEngineExecutor from '../../api/ApiEngineExecutor.js';
import ApiEngineFactory from '../../api/ApiEngineFactory.js';
import {
  __ID_FIELD_NAME,
  __IS_PROCESSED_FIELD_NAME,
  __SOURCE_ID_FIELD_NAME,
  COMPLEX_FIELDS_SEPARATOR,
  CSV_TARGET_FILE_PERSON_ACCOUNTS_SUFFIX,
  CSV_TARGET_FILE_SUFFIX,
  ERRORS_FIELD_NAME,
  FIELD_MAPPING_EVAL_PATTERN_ORIGINAL_VALUE,
  FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_BUSINESS_ACCOUNT,
  FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_BUSINESS_CONTACT,
  FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_PERSON_ACCOUNT,
  FIELDS_MAPPING_EVAL_PATTERN,
  FIELDS_MAPPING_REGEX_PATTERN,
  LOG_FILE_NO_ANONYMIZE_MARKER,
  LOG_QUERY_SELECT_MAXLENGTH,
  LOG_QUERY_WHERE_MAXLENGTH,
  MAX_SOQL_WHERE_CLAUSE_CHARACTER_LENGTH,
  MOCK_ALL_FIELDS_PATTERN,
  MOCK_PATTERN_ENTIRE_ROW_FLAG,
  OBJECTS_NOT_TO_USE_IN_FILTERED_QUERYIN_CLAUSE,
  POLYMORPHIC_FIELD_PARSER_PLACEHOLDER,
  REFERENCE_FIELD_OBJECT_SEPARATOR,
  SPECIAL_MOCK_COMMANDS,
  SPECIAL_MOCK_PATTERNS,
  TARGET_CSV_OLD_ID_FIELD_NAME,
} from '../../constants/Constants.js';
import CjsDependencyAdapters from '../../dependencies/CjsDependencyAdapters.js';
import type { LoggerType } from '../../logging/LoggerType.js';
import MockGenerator from '../../mock/MockGenerator.js';
import OrgDataService from '../../org/OrgDataService.js';
import type { ISFdmuRunCustomAddonTask } from '../../../../custom-addon-sdk/interfaces/index.js';
import { CommandExecutionError } from '../common/CommandExecutionError.js';
import type MigrationJob from './MigrationJob.js';
import ProcessedData from './ProcessedData.js';
import TaskData from './TaskData.js';
import TaskOrgData from './TaskOrgData.js';
import type { TaskPreflightEligibilityType } from './TaskPreflightEligibilityType.js';

type QueryModeType = 'forwards' | 'backwards' | 'target';
type UpdateModeType = 'forwards' | 'backwards';

type MockFieldRuntimeType = {
  fn: string;
  locale: string;
  regExcl: string;
  regIncl: string;
  disallowMockAllRecord: boolean;
  allowMockAllRecord: boolean;
};

type CasualGeneratorType = Record<string, unknown> & {
  define: (name: string, generator: (...args: unknown[]) => unknown) => void;
};

type ValueMappingRegexType = {
  regexp?: RegExp;
  replaceValue?: string;
  sourceKey?: string;
};

type ProcessedFieldsToRemoveType = {
  notInsertableFields: string[];
  notUpdateableFields: string[];
};

const { parseQuery, composeQuery } = CjsDependencyAdapters.getSoqlParser();

/**
 * Result payload for preparing file-based target records.
 */
type FileTargetPrepareResultType = {
  /**
   * Prepared records for CSV output.
   */
  records: Array<Record<string, unknown>>;

  /**
   * Ordered field names for CSV output.
   */
  fieldNames: string[];

  /**
   * Processed data container for tracking.
   */
  processedData: ProcessedData;
};

/**
 * CRUD summary for a single execution pass.
 */
export type CrudSummaryType = {
  inserted: number;
  updated: number;
  deleted: number;
};

type ConnectionWithApiVersionType = Connection & {
  getApiVersion?: () => string;
};

/**
 * Initialization payload for a migration job task.
 */
export type MigrationJobTaskInitType = {
  /**
   * Parent migration job.
   */
  job: MigrationJob;

  /**
   * Script object definition.
   */
  scriptObject: ScriptObject;

  /**
   * Target object API name after mapping.
   */
  targetObjectName?: string;
};

/**
 * Runtime task representing a single script object.
 */
export default class MigrationJobTask implements ISFdmuRunCustomAddonTask {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Parent migration job.
   */
  public job: MigrationJob;

  /**
   * Script object definition.
   */
  public scriptObject: ScriptObject;

  /**
   * Target object API name after mapping.
   */
  public targetObjectName = '';

  /**
   * Task-scoped derived data.
   */
  public data: TaskData;

  /**
   * Source-side runtime data maps.
   */
  public sourceData: TaskOrgData;

  /**
   * Target-side runtime data maps.
   */
  public targetData: TaskOrgData;

  /**
   * Preflight eligibility flags.
   */
  public preflightEligibility: TaskPreflightEligibilityType = {
    canDelete: false,
    canQuerySource: false,
    canQueryTarget: false,
  };

  /**
   * Map of source records to their target counterparts.
   */
  public sourceToTargetRecordMap: Map<Record<string, unknown>, Record<string, unknown>> = new Map();

  /**
   * Processed data output for this task.
   */
  public processedData: ProcessedData = new ProcessedData();

  /**
   * Current update pass for legacy add-on access.
   */
  public updateMode: 'FIRST_UPDATE' | 'SECOND_UPDATE' = 'FIRST_UPDATE';

  /**
   * Temporary records for add-on filtering.
   */
  public tempRecords: Array<Record<string, unknown>> = [];

  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Cache for filtered query values across passes.
   */
  private _filteredQueryValueCache: Map<string, Set<string>> = new Map();

  /**
   * Cached org connections for DML operations.
   */
  private _connectionCache: Map<string, Connection> = new Map();

  /**
   * Last CRUD summary for this task.
   */
  private _lastCrudSummary: CrudSummaryType = {
    inserted: 0,
    updated: 0,
    deleted: 0,
  };

  /**
   * Zero-based update pass counter for the current object set.
   */
  private _updatePassNumber = -1;

  /**
   * Dedupes field capability warnings emitted for this task execution.
   */
  private _warnedFieldCapabilityKeys: Set<string> = new Set();

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a migration job task.
   *
   * @param init - Task initialization values.
   */
  public constructor(init: MigrationJobTaskInitType) {
    this.job = init.job;
    this.scriptObject = init.scriptObject;
    this.targetObjectName = init.targetObjectName ?? init.scriptObject.name;
    this.data = new TaskData(this);
    this.sourceData = new TaskOrgData(this, true);
    this.targetData = new TaskOrgData(this, false);
  }

  // ------------------------------------------------------//
  // -------------------- GETTERS/SETTERS ---------------- //
  // ------------------------------------------------------//

  /**
   * Source object API name.
   *
   * @returns Source object name.
   */
  public get sObjectName(): string {
    return this.scriptObject.name;
  }

  /**
   * Returns the CRUD operation for this task.
   *
   * @returns Operation enum value.
   */
  public get operation(): OPERATION {
    return this.scriptObject.operation;
  }

  /**
   * Returns the target object API name.
   *
   * @returns Target object name.
   */
  public get targetSObjectName(): string {
    return this.targetObjectName;
  }

  /**
   * Returns the field name mapping for this task.
   *
   * @returns Source to target field map.
   */
  public get sourceToTargetFieldNameMap(): Map<string, string> {
    const mapping = this.job.script.sourceTargetFieldMapping.get(this.sObjectName);
    return mapping?.fieldMapping.sourceToTarget ?? new Map();
  }

  /**
   * Returns the source task data.
   *
   * @returns Source task data.
   */
  public get sourceTaskData(): TaskOrgData {
    return this.sourceData;
  }

  /**
   * Returns the target task data.
   *
   * @returns Target task data.
   */
  public get targetTaskData(): TaskOrgData {
    return this.targetData;
  }

  /**
   * Returns field names included in the query.
   *
   * @returns Field names list.
   */
  public get fieldsInQuery(): string[] {
    return this.data.fieldsInQuery;
  }

  /**
   * Returns field names eligible for update.
   *
   * @returns Field names list.
   */
  public get fieldsToUpdate(): string[] {
    return this.data.fieldsToUpdate;
  }

  /**
   * Summary of the last CRUD execution for this task.
   *
   * @returns CRUD summary.
   */
  public get lastCrudSummary(): CrudSummaryType {
    return { ...this._lastCrudSummary };
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Resolves a lookup Id using polymorphic map merging when needed.
   *
   * @param field - Lookup field metadata.
   * @param lookupValue - Lookup value to resolve.
   * @param userMap - User lookup map.
   * @param groupMap - Group lookup map.
   * @param defaultMap - Default lookup map for non-polymorphic fields.
   * @returns Resolved Id or undefined.
   */
  public resolveLookupIdValue(
    field: SFieldDescribe,
    lookupValue: string,
    userMap: LookupIdMapType,
    groupMap: LookupIdMapType,
    defaultMap: LookupIdMapType
  ): string | undefined {
    if (!lookupValue) {
      return undefined;
    }
    const resolvedMap = this._resolveLookupMap(field, userMap, groupMap, defaultMap);
    return resolvedMap.get(lookupValue);
  }

  /**
   * Applies value mapping rules to the provided records.
   *
   * @param records - Records to map.
   */
  public mapRecords(records: Array<Record<string, unknown>>): void {
    this._applyValueMapping(records);
  }

  /**
   * Refreshes preflight task data and eligibility flags.
   */
  public refreshPreflightState(): void {
    this.sourceData.reset();
    this.targetData.reset();
    this.data.refreshFromScriptObject();

    const script = this.job.script;
    const sourceIsFile = script.sourceOrg?.isFileMedia ?? false;
    const sourceIsOrg = script.sourceOrg?.isOrgMedia ?? true;
    const targetIsOrg = script.targetOrg?.isOrgMedia ?? true;
    const canDelete = targetIsOrg && (this.scriptObject.deleteOldData || this.scriptObject.deleteByHierarchy);
    const canQuerySource = sourceIsFile || sourceIsOrg || this.scriptObject.useSourceCSVFile;
    const canQueryTarget =
      targetIsOrg && (this.scriptObject.deleteOldData || this.scriptObject.operation !== OPERATION.Insert);

    this.preflightEligibility = {
      canDelete,
      canQuerySource,
      canQueryTarget,
    };
  }

  /**
   * Builds a query string for the current task.
   *
   * @param fieldNames - Optional field list override.
   * @param removeLimits - True to strip LIMIT/OFFSET/ORDER BY.
   * @param parsedQuery - Optional base parsed query.
   * @param useFieldMapping - True to apply field mapping.
   * @param isTargetQuery - True when composing a target query.
   * @returns Query string.
   */
  public createQuery(
    fieldNames?: string[],
    removeLimits = false,
    parsedQuery?: unknown,
    useFieldMapping = false,
    isTargetQuery = false
  ): string {
    void fieldNames;
    void parsedQuery;
    void useFieldMapping;
    const baseQuery = this._getBaseQuery(isTargetQuery);
    if (!baseQuery) {
      return '';
    }
    let resolvedQuery = baseQuery;
    if (isTargetQuery) {
      resolvedQuery = this._applyTargetQueryFilters(resolvedQuery);
    } else {
      resolvedQuery = this._applySourceRecordsFilter(resolvedQuery);
    }
    if (removeLimits) {
      resolvedQuery = this._stripQueryLimits(resolvedQuery);
    }
    return resolvedQuery;
  }

  /**
   * Builds filtered queries for the current task and pass.
   *
   * @param queryMode - Pass mode for query planning.
   * @param reversed - True when using reversed pass logic.
   * @param fieldNames - Optional field list override.
   * @returns Array of filtered query strings.
   */
  public createFilteredQueries(queryMode: QueryModeType, reversed: boolean, fieldNames?: string[]): string[] {
    return this._createFilteredQueries(queryMode, reversed, fieldNames);
  }

  /**
   * Registers records into task maps using resolved external id values.
   *
   * @param records - Records to ingest.
   * @param orgData - Org-scoped data container.
   * @param isTarget - True when ingesting target records.
   * @returns Number of newly added records.
   */
  public registerRecords(records: Array<Record<string, unknown>>, orgData: TaskOrgData, isTarget: boolean): number {
    let newRecordsCount = 0;
    records.forEach((record) => {
      const recordId = this._getRecordIdValue(record);
      if (recordId) {
        const extIdValue = this._getResolvedExternalIdValue(record, isTarget);
        if (extIdValue) {
          orgData.extIdToRecordIdMap.set(extIdValue, recordId);
          orgData.extIdToRecordMap.set(extIdValue, record);
        }
        if (!orgData.idRecordsMap.has(recordId)) {
          orgData.idRecordsMap.set(recordId, record);
          const nextRecord = record;
          nextRecord[__ID_FIELD_NAME] = recordId;
          if (isTarget && extIdValue) {
            this._linkSourceToTargetRecord(extIdValue, record);
          }
          newRecordsCount += 1;
        }
      } else {
        const nextRecord = record;
        nextRecord[__ID_FIELD_NAME] = Common.makeId(18);
      }
    });
    return newRecordsCount;
  }

  /**
   * Deletes existing target records when configured.
   */
  public async deleteOldRecordsAsync(): Promise<boolean> {
    const logger = this._getLogger();
    logger.verboseFile(
      `[diagnostic] deleteOldRecords start: object=${this.sObjectName} target=${this.targetObjectName} deleteOldData=${this.scriptObject.deleteOldData}`
    );
    if (
      !this.scriptObject.deleteOldData ||
      this.scriptObject.operation === OPERATION.Readonly ||
      !this.targetData.org ||
      !this.targetData.org.isOrgMedia
    ) {
      logger.log('nothingToDelete', this.sObjectName);
      return false;
    }

    const deleteQuery = this.scriptObject.deleteQuery || this.data.deleteQuery;
    if (!deleteQuery) {
      logger.log('nothingToDelete', this.sObjectName);
      return false;
    }

    logger.log('deletingTargetSObjectRecords', this.sObjectName);
    logger.verboseFile(`[diagnostic] delete query: ${deleteQuery}`);

    const orgDataService = new OrgDataService(this.job.script);
    const records = await orgDataService.queryOrgAsync(deleteQuery, this.targetData.org, {
      useBulk: this.targetData.useBulkQueryApi,
      useQueryAll: this.scriptObject.queryAllTarget || this.scriptObject.hardDelete,
    });

    if (records.length === 0) {
      logger.log('nothingToDelete', this.sObjectName);
      return false;
    }

    logger.log('amountOfRecordsToDelete', this.sObjectName, String(records.length));
    logger.verboseFile(`[diagnostic] deleteOldRecords found=${records.length}`);
    const recordsToDelete = records
      .map((record) => String(record['Id'] ?? ''))
      .filter((recordId) => recordId.length > 0)
      .map((recordId) => ({ Id: recordId }));

    if (recordsToDelete.length === 0) {
      logger.log('nothingToDelete', this.sObjectName);
      return false;
    }

    const deleteOperation = this.scriptObject.hardDelete ? OPERATION.HardDelete : OPERATION.Delete;
    logger.verboseFile(
      `[diagnostic] deleteOldRecords executing: object=${this.targetObjectName} count=${
        recordsToDelete.length
      } hardDelete=${String(this.scriptObject.hardDelete)}`
    );
    const deletedRecords = await this._executeCrudAsync(
      this.targetData.org,
      this.targetObjectName,
      deleteOperation,
      recordsToDelete,
      false
    );
    await this._writeTargetCsvAsync(deletedRecords, deleteOperation, '');

    logger.log('deletingRecordsCompleted', this.sObjectName);
    logger.verboseFile('[diagnostic] deleteOldRecords completed');
    return true;
  }

  /**
   * Deletes target records for hierarchical delete operations.
   *
   * @returns Number of records deleted.
   */
  public async deleteRecordsAsync(): Promise<number> {
    const logger = this._getLogger();
    const summary: CrudSummaryType = {
      inserted: 0,
      updated: 0,
      deleted: 0,
    };
    this._lastCrudSummary = summary;
    logger.verboseFile(
      `[diagnostic] deleteRecords start: object=${this.sObjectName} target=${
        this.targetObjectName
      } deleteByHierarchy=${String(this.scriptObject.isHierarchicalDeleteOperation)}`
    );
    if (!this.scriptObject.isHierarchicalDeleteOperation || !this.targetData.org || !this.targetData.org.isOrgMedia) {
      return 0;
    }

    const recordsToDelete = this.sourceData.records
      .map((source) => this.sourceToTargetRecordMap.get(source))
      .filter((target): target is Record<string, unknown> => Boolean(target))
      .map((target) => String(target['Id'] ?? ''))
      .filter((recordId) => recordId.length > 0)
      .map((recordId) => ({ Id: recordId }));

    logger.log('amountOfRecordsToDelete', this.sObjectName, String(recordsToDelete.length));
    if (recordsToDelete.length === 0) {
      return 0;
    }

    const deleteOperation = this.scriptObject.hardDelete ? OPERATION.HardDelete : OPERATION.Delete;
    logger.verboseFile(
      `[diagnostic] deleteRecords executing: object=${this.targetObjectName} count=${
        recordsToDelete.length
      } hardDelete=${String(this.scriptObject.hardDelete)}`
    );
    const deletedRecords = await this._executeCrudAsync(
      this.targetData.org,
      this.targetObjectName,
      deleteOperation,
      recordsToDelete,
      false
    );
    await this._writeTargetCsvAsync(deletedRecords, deleteOperation, '');

    logger.log('deletingRecordsCompleted', this.sObjectName);
    logger.verboseFile('[diagnostic] deleteRecords completed');
    summary.deleted = deletedRecords.length;
    return deletedRecords.length;
  }

  /**
   * Retrieves source or target records for this task.
   */
  public async retrieveRecordsAsync(queryMode: QueryModeType, reversed: boolean): Promise<boolean> {
    const shouldSkipDeleteRetrieve =
      this.scriptObject.operation === OPERATION.Delete &&
      !this.scriptObject.isDeletedFromSourceOperation &&
      !this.scriptObject.isHierarchicalDeleteOperation;
    if (shouldSkipDeleteRetrieve) {
      return false;
    }

    const orgDataService = new OrgDataService(this.job.script);
    let hasRecords = false;
    if (queryMode !== 'target') {
      hasRecords = await this._retrieveSourceRecordsAsync(queryMode, reversed, orgDataService);
    }

    if (this.scriptObject.isDeletedFromSourceOperation) {
      return hasRecords;
    }

    if (queryMode === 'target') {
      return this._retrieveTargetRecordsAsync(queryMode, orgDataService);
    }

    return hasRecords;
  }

  /**
   * Updates or inserts target records for this task.
   *
   * @param updateMode - Update pass mode.
   * @param warnMissingParentsAsync - Callback invoked when missing parents are detected.
   * @returns Number of records processed.
   */
  public async updateRecordsAsync(
    updateMode: UpdateModeType = 'forwards',
    warnMissingParentsAsync?: (data: ProcessedData) => Promise<void>
  ): Promise<number> {
    const logger = this._getLogger();
    this.updateMode = updateMode === 'backwards' ? 'SECOND_UPDATE' : 'FIRST_UPDATE';
    const summary: CrudSummaryType = {
      inserted: 0,
      updated: 0,
      deleted: 0,
    };
    this._lastCrudSummary = summary;
    logger.verboseFile(
      `[diagnostic] update start: object=${this.sObjectName} target=${
        this.targetObjectName
      } mode=${updateMode} operation=${ScriptObject.getStrOperation(this.scriptObject.operation)} fieldMapping=${String(
        this.scriptObject.useFieldMapping
      )}`
    );
    if (this.scriptObject.isDeletedFromSourceOperation) {
      if (updateMode !== 'forwards') {
        return 0;
      }
      const deleted = await this._deleteSourceRecordsAsync();
      summary.deleted = deleted;
      return deleted;
    }
    if (this.scriptObject.operation === OPERATION.Readonly || this.scriptObject.operation === OPERATION.Delete) {
      return 0;
    }

    this._updatePassNumber += 1;
    const targetIsFile = this.job.script.targetOrg?.isFileMedia ?? false;
    if (targetIsFile) {
      const fileResult = await this._updateRecordsForFileTargetAsync(updateMode);
      this._lastCrudSummary = fileResult.summary;
      return fileResult.processedCount;
    }

    const applyPassSummary = (passSummary: CrudSummaryType): void => {
      summary.inserted += passSummary.inserted;
      summary.updated += passSummary.updated;
      summary.deleted += passSummary.deleted;
    };

    let totalProcessed = 0;
    let totalNonProcessed = 0;

    const businessPass = await this._updateRecordsForPassAsync(updateMode, warnMissingParentsAsync, false);
    totalProcessed += businessPass.processedCount;
    totalNonProcessed += businessPass.nonProcessedCount;
    applyPassSummary(businessPass.summary);

    if (this._isPersonAccountOrContact()) {
      logger.log('updatePersonAccountsAndContacts', this.sObjectName);
      const personPass = await this._updateRecordsForPassAsync(updateMode, warnMissingParentsAsync, true);
      totalProcessed += personPass.processedCount;
      totalNonProcessed += personPass.nonProcessedCount;
      applyPassSummary(personPass.summary);

      if (
        this.sObjectName === 'Account' &&
        (this.scriptObject.operation === OPERATION.Insert || this.scriptObject.operation === OPERATION.Upsert)
      ) {
        await this._insertPersonContactsFromPersonAccountsAsync(personPass.processedData);
      }
    }

    if (totalNonProcessed > 0) {
      logger.log('skippedUpdatesWarning', this.sObjectName, String(totalNonProcessed));
    }

    logger.verboseFile(`[diagnostic] update complete: processed=${totalProcessed}`);
    return totalProcessed;
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Executes a single update pass for the task.
   *
   * @param updateMode - Update pass mode.
   * @param warnMissingParentsAsync - Callback for missing parent warnings.
   * @param processPersonAccounts - True when processing person accounts.
   * @returns Pass results and processed data.
   */
  private async _updateRecordsForPassAsync(
    updateMode: UpdateModeType,
    warnMissingParentsAsync: ((data: ProcessedData) => Promise<void>) | undefined,
    processPersonAccounts: boolean
  ): Promise<{
    processedCount: number;
    nonProcessedCount: number;
    processedData: ProcessedData;
    summary: CrudSummaryType;
  }> {
    const logger = this._getLogger();
    const summary: CrudSummaryType = {
      inserted: 0,
      updated: 0,
      deleted: 0,
    };
    const targetIsFile = this.job.script.targetOrg?.isFileMedia ?? false;
    const processedData = await this._createProcessedDataAsync(updateMode, processPersonAccounts);
    this.processedData = processedData;

    if (processPersonAccounts && this.sObjectName === 'Contact') {
      return {
        processedCount: 0,
        nonProcessedCount: 0,
        processedData,
        summary,
      };
    }

    const personSuffix = processedData.processPersonAccounts ? CSV_TARGET_FILE_PERSON_ACCOUNTS_SUFFIX : '';
    logger.verboseFile(
      `[diagnostic] update prepared: fields=${processedData.fields.length} cloned=${
        processedData.clonedToSourceMap.size
      } missingParents=${processedData.missingParentLookups.length} targetIsFile=${String(targetIsFile)}`
    );

    if (processedData.missingParentLookups.length > 0 && warnMissingParentsAsync) {
      await warnMissingParentsAsync(processedData);
    }

    if (targetIsFile) {
      if (updateMode !== 'forwards') {
        return {
          processedCount: 0,
          nonProcessedCount: 0,
          processedData,
          summary,
        };
      }
      const records = [...processedData.clonedToSourceMap.keys()];
      if (records.length === 0) {
        return {
          processedCount: 0,
          nonProcessedCount: 0,
          processedData,
          summary,
        };
      }
      logger.verboseFile(`[diagnostic] csv target write: records=${records.length}`);
      await this._writeTargetCsvAsync(records, this.scriptObject.operation, personSuffix);
      if (this.scriptObject.operation === OPERATION.Insert) {
        summary.inserted = records.length;
      } else if (this.scriptObject.operation === OPERATION.Update || this.scriptObject.operation === OPERATION.Upsert) {
        summary.updated = records.length;
      }
      return {
        processedCount: records.length,
        nonProcessedCount: 0,
        processedData,
        summary,
      };
    }

    const manager = this.job.script.addonManager as
      | {
          triggerAddonModuleMethodAsync?: (
            event: ADDON_EVENTS,
            objectName?: string,
            contextOverrides?: {
              passNumber?: number;
              isFirstPass?: boolean;
              objectSetIndex?: number;
            }
          ) => Promise<void>;
        }
      | undefined;
    if (manager?.triggerAddonModuleMethodAsync) {
      processedData.recordsToInsert = [...processedData.clonedToSourceMap.keys()];
      logger.verboseFile('[diagnostic] addon onBeforeUpdate start');
      await manager.triggerAddonModuleMethodAsync(
        ADDON_EVENTS.onBeforeUpdate,
        this.sObjectName,
        this._getAddonInvocationContext()
      );
      logger.verboseFile('[diagnostic] addon onBeforeUpdate complete');
    }

    processedData.recordsToInsert = [];
    processedData.recordsToUpdate = [];
    const fieldsToCompareRecords = this._resolveFieldsToCompare();
    const fieldsToRemove = this._resolveFieldsToRemove(processedData, fieldsToCompareRecords);
    this._populateProcessedRecords(processedData, updateMode, fieldsToCompareRecords, fieldsToRemove);
    logger.verboseFile(
      `[diagnostic] update classified: toInsert=${processedData.recordsToInsert.length} toUpdate=${processedData.recordsToUpdate.length} nonProcessed=${processedData.nonProcessedRecordsAmount}`
    );

    let totalProcessed = 0;
    if (processedData.recordsToInsert.length > 0) {
      logger.log(
        'amountOfRecordsTo',
        this.sObjectName,
        logger.getResourceString('insert'),
        String(processedData.recordsToInsert.length)
      );
      const inserted = await this._executeTargetRecordsAsync(
        OPERATION.Insert,
        processedData.recordsToInsert,
        personSuffix
      );
      totalProcessed += inserted.length;
      summary.inserted = inserted.length;
      this._registerInsertedTargetRecords(processedData, inserted);
    }

    if (processedData.recordsToUpdate.length > 0) {
      logger.log(
        'amountOfRecordsTo',
        this.sObjectName,
        logger.getResourceString('update'),
        String(processedData.recordsToUpdate.length)
      );
      const updated = await this._executeTargetRecordsAsync(
        OPERATION.Update,
        processedData.recordsToUpdate,
        personSuffix
      );
      totalProcessed += updated.length;
      summary.updated = updated.length;
      this._registerUpdatedTargetRecords(processedData, updated);
    }

    if (manager?.triggerAddonModuleMethodAsync) {
      logger.verboseFile('[diagnostic] addon onAfterUpdate start');
      await manager.triggerAddonModuleMethodAsync(
        ADDON_EVENTS.onAfterUpdate,
        this.sObjectName,
        this._getAddonInvocationContext()
      );
      logger.verboseFile('[diagnostic] addon onAfterUpdate complete');
    }

    return {
      processedCount: totalProcessed,
      nonProcessedCount: processedData.nonProcessedRecordsAmount,
      processedData,
      summary,
    };
  }

  /**
   * Writes target CSV output when the target is file-based.
   *
   * @param updateMode - Update pass mode.
   * @returns Processed count and summary.
   */
  private async _updateRecordsForFileTargetAsync(
    updateMode: UpdateModeType
  ): Promise<{ processedCount: number; summary: CrudSummaryType }> {
    const summary: CrudSummaryType = {
      inserted: 0,
      updated: 0,
      deleted: 0,
    };
    if (updateMode !== 'forwards') {
      return { processedCount: 0, summary };
    }

    const prepared = await this._prepareFileTargetRecordsAsync();
    this.processedData = prepared.processedData;
    let records = prepared.records;
    if (records.length === 0) {
      return { processedCount: 0, summary };
    }

    const manager = this.job.script.addonManager as
      | {
          triggerAddonModuleMethodAsync?: (
            event: ADDON_EVENTS,
            objectName?: string,
            contextOverrides?: {
              passNumber?: number;
              isFirstPass?: boolean;
              objectSetIndex?: number;
            }
          ) => Promise<void>;
        }
      | undefined;
    if (manager?.triggerAddonModuleMethodAsync) {
      prepared.processedData.recordsToInsert = [...records];
      await manager.triggerAddonModuleMethodAsync(
        ADDON_EVENTS.onBeforeUpdate,
        this.sObjectName,
        this._getAddonInvocationContext()
      );
      records = prepared.processedData.recordsToInsert.length > 0 ? prepared.processedData.recordsToInsert : records;
      prepared.processedData.recordsToInsert = [];
    }

    const sanitizedRecords = this._sanitizePlainTargetCsvRecords(records, prepared.fieldNames);
    await this._writePlainTargetCsvFileAsync(sanitizedRecords, prepared.fieldNames);
    await this._writeTargetCsvAsync(sanitizedRecords, this.scriptObject.operation, '');

    if (this.scriptObject.operation === OPERATION.Insert) {
      summary.inserted = records.length;
    } else if (this.scriptObject.operation === OPERATION.Update || this.scriptObject.operation === OPERATION.Upsert) {
      summary.updated = records.length;
    }

    return { processedCount: records.length, summary };
  }

  /**
   * Prepares records for file-based target output.
   *
   * @returns Prepared records and processed data.
   */
  private async _prepareFileTargetRecordsAsync(): Promise<FileTargetPrepareResultType> {
    const processedData = new ProcessedData();
    processedData.processPersonAccounts = false;
    processedData.fields = this.data.sFieldsToUpdate;
    const processingFields = processedData.fields.length > 0 ? processedData.fields : this.data.sFieldsInQuery;
    processedData.fields = processingFields;

    if (this.sourceData.records.length === 0) {
      return { records: [], fieldNames: this._resolvePlainTargetCsvFieldNames(), processedData };
    }

    let records = this.sourceData.records.map((record) => ({ ...record }));
    records = await this._filterRecordsAsync(records);
    records = this._applyMocking(records, processingFields);
    records = this._truncateRecords(records, processingFields);
    this._applyValueMapping(records);
    records = this._mapRecordsToTarget(records);

    const internalIdToSourceMap = this._buildInternalIdToSourceMapFromSourceRecords();
    processedData.clonedToSourceMap = this._mapRecordsToSources(records, internalIdToSourceMap);
    processedData.clonedToSourceMap.forEach((source, cloned) => {
      this.sourceToTargetRecordMap.set(source, cloned);
    });

    const fieldNames = this._resolvePlainTargetCsvFieldNames();
    return {
      records,
      fieldNames,
      processedData,
    };
  }

  /**
   * Builds a map of internal record ids to source records.
   *
   * @returns Internal id map.
   */
  private _buildInternalIdToSourceMapFromSourceRecords(): Map<string, Record<string, unknown>> {
    const map = new Map<string, Record<string, unknown>>();
    this.sourceData.records.forEach((record) => {
      const recordId = this._getInternalRecordId(record);
      if (recordId) {
        map.set(recordId, record);
      }
    });
    return map;
  }

  /**
   * Resolves the ordered field list for file-based target CSV output.
   *
   * @returns Field names to include in the CSV.
   */
  private _resolvePlainTargetCsvFieldNames(): string[] {
    const scriptObject = this.scriptObject;
    const baseFields = scriptObject.isAutoAdded ? scriptObject.fieldsInQuery : scriptObject.expandedOriginalQueryFields;
    let fieldNames = this._expandComplexFieldNames(baseFields);

    const externalIdFields = this._expandComplexFieldNames([scriptObject.originalExternalId]);
    fieldNames = Common.distinctStringArray([...fieldNames, ...externalIdFields]);

    if (!this._containsFieldName(fieldNames, 'Id')) {
      fieldNames.push('Id');
    }

    if (!this.job.script.excludeIdsFromCSVFiles) {
      const lookupReferenceFields = this._resolveLookupExternalIdFieldNames(fieldNames);
      const normalized = this._normalizeFieldNamesCase([...fieldNames, ...lookupReferenceFields]);
      return Common.orderCsvColumnsWithIdFirstAndErrorsLast(normalized);
    }

    const lookupReferenceFields = this._resolveLookupExternalIdFieldNames(fieldNames);
    const filtered = this._removeIdAndLookupFields(fieldNames);
    const normalized = this._normalizeFieldNamesCase([...filtered, ...lookupReferenceFields]);
    return Common.orderCsvColumnsWithIdFirstAndErrorsLast(normalized);
  }

  /**
   * Expands complex field tokens into individual field names.
   *
   * @param fieldNames - Field names to expand.
   * @returns Expanded field list.
   */
  private _expandComplexFieldNames(fieldNames: string[]): string[] {
    void this;
    const expanded: string[] = [];
    fieldNames.forEach((fieldName) => {
      if (!fieldName) {
        return;
      }
      if (!Common.isComplexField(fieldName)) {
        expanded.push(fieldName);
        return;
      }
      const plainField = Common.getFieldFromComplexField(fieldName);
      const parts = plainField
        .split(COMPLEX_FIELDS_SEPARATOR)
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      if (parts.length === 0) {
        return;
      }
      expanded.push(...parts);
    });
    return expanded;
  }

  /**
   * Removes Id and lookup Id fields from the provided list.
   *
   * @param fieldNames - Field names to filter.
   * @returns Filtered field list.
   */
  private _removeIdAndLookupFields(fieldNames: string[]): string[] {
    const removeSet = new Set<string>();
    removeSet.add('id');
    this.data.sFieldsInQuery.forEach((field) => {
      if (field.isSimpleReference) {
        removeSet.add(field.nameId.toLowerCase());
      }
    });
    return fieldNames.filter((fieldName) => {
      const normalized = fieldName.toLowerCase();
      if (removeSet.has(normalized)) {
        return false;
      }
      if (normalized.endsWith('.id')) {
        return false;
      }
      return true;
    });
  }

  /**
   * Resolves lookup reference fields to parent external ids.
   *
   * @param fieldNames - Field names before exclusions.
   * @param useMetadataExternalIdOnly - True to include only metadata External ID fields.
   * @returns Lookup reference field names.
   */
  private _resolveLookupExternalIdFieldNames(fieldNames: string[], useMetadataExternalIdOnly = false): string[] {
    const fieldSet = new Set(fieldNames.map((name) => name.toLowerCase()));
    const referenceFields: string[] = [];

    this.data.sFieldsInQuery.forEach((field) => {
      if (!field.isSimpleReference || !field.parentLookupObject) {
        return;
      }
      if (!fieldSet.has(field.nameId.toLowerCase())) {
        return;
      }
      const parts = this._resolveParentExternalIdFieldParts(field, useMetadataExternalIdOnly);
      parts.forEach((part) => {
        referenceFields.push(`${field.name__r}.${part}`);
      });
    });

    return Common.distinctStringArray(referenceFields);
  }

  /**
   * Resolves parent external id parts for a lookup field.
   *
   * @param field - Lookup field.
   * @param useMetadataExternalIdOnly - True to keep only metadata External ID fields.
   * @returns Parent external id parts.
   */
  private _resolveParentExternalIdFieldParts(field: SFieldDescribe, useMetadataExternalIdOnly: boolean): string[] {
    if (!field.parentLookupObject?.originalExternalId) {
      return [];
    }
    const parentObject = field.parentLookupObject;
    const parentTask = this.job.getTaskBySObjectName(parentObject.name);
    const rawParts = this._splitComplexField(parentObject.originalExternalId);
    const normalizedParts = parentTask
      ? parentTask._normalizeFieldNamesCase(rawParts)
      : this._normalizeFieldNamesCase(rawParts, parentObject);
    return Common.distinctStringArray(
      normalizedParts.filter((part) => {
        const normalizedPart = part.toLowerCase();
        if (normalizedPart === 'id') {
          return false;
        }
        if (useMetadataExternalIdOnly && Common.isComplexOr__rField(part)) {
          return false;
        }
        if (!useMetadataExternalIdOnly) {
          return true;
        }
        return this._isFieldMarkedAsExternalIdInMetadata(parentObject, part);
      }),
      true
    );
  }

  /**
   * Returns true when the field is marked as External ID in parent metadata.
   *
   * @param parentObject - Parent script object.
   * @param fieldName - Parent field name.
   * @returns True when metadata marks the field as External ID.
   */
  private _isFieldMarkedAsExternalIdInMetadata(parentObject: ScriptObject, fieldName: string): boolean {
    void this;
    const describe = parentObject.sourceSObjectDescribe ?? parentObject.targetSObjectDescribe;
    if (!describe) {
      return false;
    }
    const exact = describe.fieldsMap.get(fieldName);
    if (exact) {
      return Boolean(exact.isExternalIdInMetadata);
    }
    const normalizedFieldName = fieldName.toLowerCase();
    const matchedField = [...describe.fieldsMap.values()].find(
      (candidate) => candidate.name.toLowerCase() === normalizedFieldName
    );
    return Boolean(matchedField?.isExternalIdInMetadata);
  }

  /**
   * Populates lookup reference fields with parent external id values.
   *
   * @param records - Records to update.
   * @param fieldNames - Field names to populate.
   */
  private _populateLookupExternalIdValues(records: Array<Record<string, unknown>>, fieldNames: string[]): void {
    const fieldSet = new Set(fieldNames.map((name) => name.toLowerCase()));
    const canonicalFieldMap = new Map<string, string>();
    fieldNames.forEach((name) => {
      canonicalFieldMap.set(name.toLowerCase(), name);
    });
    this.data.sFieldsInQuery.forEach((field) => {
      if (!field.isSimpleReference || !field.parentLookupObject) {
        return;
      }
      const parent = field.parentLookupObject;
      const parentTask = this.job.getTaskBySObjectName(parent.name);
      if (!parentTask) {
        return;
      }
      const parts = parentTask._normalizeFieldNamesCase(this._splitComplexField(parent.originalExternalId));
      if (parts.length === 0) {
        return;
      }
      const referenceFields = parts.map((part) => `${field.name__r}.${part}`);
      if (!referenceFields.some((name) => fieldSet.has(name.toLowerCase()))) {
        return;
      }
      records.forEach((record) => {
        const recordKeyMap = new Map<string, string>();
        Object.keys(record).forEach((key) => {
          recordKeyMap.set(key.toLowerCase(), key);
        });
        const parentId = this._getRecordFieldValue(record, field.nameId);
        if (!parentId) {
          return;
        }
        const parentRecord = parentTask.sourceData.idRecordsMap.get(parentId);
        if (!parentRecord) {
          return;
        }
        const parentProjectedRecord = parentTask.sourceToTargetRecordMap.get(parentRecord) ?? parentRecord;
        parts.forEach((part, index) => {
          const referenceFieldName = referenceFields[index];
          if (!fieldSet.has(referenceFieldName.toLowerCase())) {
            return;
          }
          if (recordKeyMap.has(referenceFieldName.toLowerCase())) {
            return;
          }
          const value = parentTask._getRecordFieldValue(parentProjectedRecord, part);
          if (typeof value !== 'undefined') {
            const canonicalFieldName = canonicalFieldMap.get(referenceFieldName.toLowerCase()) ?? referenceFieldName;
            // eslint-disable-next-line no-param-reassign
            record[canonicalFieldName] = value;
            recordKeyMap.set(referenceFieldName.toLowerCase(), canonicalFieldName);
          }
        });
      });
    });
  }

  /**
   * Splits complex field tokens into individual field names.
   *
   * @param fieldName - Field name to split.
   * @returns Field name parts.
   */
  private _splitComplexField(fieldName: string): string[] {
    void this;
    const plainField = Common.getFieldFromComplexField(fieldName);
    return plainField
      .split(COMPLEX_FIELDS_SEPARATOR)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  /**
   * Checks whether the field list includes a name (case-insensitive).
   *
   * @param fieldNames - Field names list.
   * @param fieldName - Field name to check.
   * @returns True when present.
   */
  private _containsFieldName(fieldNames: string[], fieldName: string): boolean {
    void this;
    const normalized = fieldName.toLowerCase();
    return fieldNames.some((item) => item.toLowerCase() === normalized);
  }

  /**
   * Normalizes field name casing using describe metadata.
   *
   * @param fieldNames - Field names to normalize.
   * @param scriptObject - Optional script object override.
   * @returns Normalized field names.
   */
  private _normalizeFieldNamesCase(fieldNames: string[], scriptObject?: ScriptObject): string[] {
    const activeScriptObject = scriptObject ?? this.scriptObject;
    const describe = activeScriptObject.sourceSObjectDescribe ?? activeScriptObject.targetSObjectDescribe;
    if (!describe) {
      return Common.distinctStringArray(fieldNames, true);
    }

    const caseMap = new Map<string, string>();
    const relationshipMap = new Map<string, SFieldDescribe>();
    describe.fieldsMap.forEach((field, fieldName) => {
      const normalized = fieldName.toLowerCase();
      if (field.isDescribed || !caseMap.has(normalized)) {
        caseMap.set(normalized, fieldName);
      }
      if (field.lookup && field.isDescribed) {
        relationshipMap.set(field.name__r.toLowerCase(), field);
      }
    });

    const normalized = fieldNames.map((fieldName) =>
      this._normalizeFieldNamePathCase(fieldName, caseMap, relationshipMap)
    );

    return Common.distinctStringArray(normalized, true);
  }

  /**
   * Normalizes a field name path using describe metadata.
   *
   * @param fieldName - Field name to normalize.
   * @param caseMap - Field name case map.
   * @param relationshipMap - Relationship name map.
   * @returns Normalized field name.
   */
  private _normalizeFieldNamePathCase(
    fieldName: string,
    caseMap: Map<string, string>,
    relationshipMap: Map<string, SFieldDescribe>
  ): string {
    if (!fieldName) {
      return fieldName;
    }
    if (!Common.is__rField(fieldName)) {
      return caseMap.get(fieldName.toLowerCase()) ?? fieldName;
    }
    const segments = fieldName.split('.');
    if (segments.length === 0) {
      return fieldName;
    }
    const relationshipSegment = segments[0] ?? '';
    const relationshipField = relationshipMap.get(relationshipSegment.toLowerCase());
    if (!relationshipField) {
      return fieldName;
    }
    const correctedRelationship = relationshipField.name__r || relationshipSegment;
    if (segments.length === 1) {
      return correctedRelationship;
    }
    const remainder = segments.slice(1).join('.');
    const parentObject = relationshipField.parentLookupObject;
    const parentTask = parentObject ? this.job.getTaskBySObjectName(parentObject.name) : undefined;
    if (parentTask) {
      const normalizedRemainder = parentTask._normalizeFieldNamesCase([remainder])[0] ?? remainder;
      return `${correctedRelationship}.${normalizedRemainder}`;
    }
    if (parentObject) {
      const normalizedRemainder = this._normalizeFieldNamesCase([remainder], parentObject)[0] ?? remainder;
      return `${correctedRelationship}.${normalizedRemainder}`;
    }
    return `${correctedRelationship}.${remainder}`;
  }

  /**
   * Removes internal and excluded columns from file-based target records.
   *
   * @param records - Records to sanitize.
   * @param fieldNames - Ordered field names to keep.
   * @returns Sanitized records.
   */
  private _sanitizePlainTargetCsvRecords(
    records: Array<Record<string, unknown>>,
    fieldNames: string[]
  ): Array<Record<string, unknown>> {
    if (records.length === 0) {
      return records;
    }

    this._populateLookupExternalIdValues(records, fieldNames);

    return records.map((record) => {
      const sanitized: Record<string, unknown> = {};
      const recordKeyMap = new Map<string, string>();
      Object.keys(record).forEach((key) => {
        recordKeyMap.set(key.toLowerCase(), key);
      });
      fieldNames.forEach((fieldName) => {
        const recordKey = recordKeyMap.get(fieldName.toLowerCase());
        if (recordKey && Object.prototype.hasOwnProperty.call(record, recordKey)) {
          sanitized[fieldName] = record[recordKey];
        }
      });
      this._removeRecordFields(sanitized, [__ID_FIELD_NAME, __SOURCE_ID_FIELD_NAME, __IS_PROCESSED_FIELD_NAME]);
      return sanitized;
    });
  }

  /**
   * Writes the plain target CSV file for file media targets.
   *
   * @param records - Records to write.
   * @param fieldNames - Ordered field names to output.
   */
  private async _writePlainTargetCsvFileAsync(
    records: Array<Record<string, unknown>>,
    fieldNames: string[]
  ): Promise<void> {
    const targetFilename = Common.getCSVFilename(this.job.script.rawSourceDirectoryPath, this.sObjectName);
    await mkdir(path.dirname(targetFilename), { recursive: true });
    const logger = this._getLogger();
    logger.verboseFile('writingToFile', this.sObjectName, targetFilename);
    logger.verboseFile(
      `[diagnostic] target CSV (plain): file=${targetFilename} records=${records.length} fields=${fieldNames.length}`
    );
    await Common.writeCsvFileAsync(targetFilename, records, true, fieldNames, true, false);
  }

  /**
   * Returns true when person account handling applies to this task.
   *
   * @returns True when Account/Contact with person accounts enabled.
   */
  private _isPersonAccountOrContact(): boolean {
    if (!this.job.script.isPersonAccountEnabled) {
      return false;
    }
    return this.sObjectName === 'Account' || this.sObjectName === 'Contact';
  }

  /**
   * Filters update fields for person-account-specific passes.
   *
   * @param processedData - Processed data container.
   * @param processPersonAccounts - True when processing person accounts.
   * @returns True when processing should continue.
   */
  private _applyPersonAccountFieldFiltering(
    fields: SFieldDescribe[],
    processPersonAccounts: boolean
  ): { shouldProcess: boolean; fields: SFieldDescribe[] } {
    if (!this._isPersonAccountOrContact()) {
      return { shouldProcess: true, fields };
    }

    if (!processPersonAccounts) {
      if (this.sObjectName === 'Account') {
        const filtered = fields.filter((field) => {
          const fieldName = field.nameId ?? field.name;
          if (field.person) {
            this._logVerboseField(
              this.sObjectName,
              fieldName,
              '[diagnostic] Excluded from business-account pass: person-account field is not valid for this pass.'
            );
            return false;
          }
          if (FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_BUSINESS_ACCOUNT.includes(fieldName)) {
            this._logVerboseField(
              this.sObjectName,
              fieldName,
              '[diagnostic] Excluded from business-account pass: field is not valid for business-account DML.'
            );
            return false;
          }
          return true;
        });
        return { shouldProcess: true, fields: filtered };
      }
      const filtered = fields.filter((field) => {
        const fieldName = field.nameId ?? field.name;
        if (FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_BUSINESS_CONTACT.includes(fieldName)) {
          this._logVerboseField(
            this.sObjectName,
            fieldName,
            '[diagnostic] Excluded from business-contact pass: field is not valid for business-contact DML.'
          );
          return false;
        }
        return true;
      });
      return { shouldProcess: true, fields: filtered };
    }

    if (this.sObjectName === 'Account') {
      const filtered = fields.filter((field) => {
        const fieldName = field.nameId ?? field.name;
        if (FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_PERSON_ACCOUNT.includes(fieldName)) {
          this._logVerboseField(
            this.sObjectName,
            fieldName,
            '[diagnostic] Excluded from person-account pass: field is not valid for person-account DML.'
          );
          return false;
        }
        return true;
      });
      return { shouldProcess: true, fields: filtered };
    }

    this._getLogger().verboseFile(
      `[diagnostic] Person-account pass skipped: object=${this.sObjectName} reason=Contact is handled via related Account mapping in this pass.`
    );
    return { shouldProcess: false, fields };
  }

  /**
   * Determines whether a record is a person account/contact.
   *
   * @param source - Source record to inspect.
   * @returns True when the record is a person account/contact.
   */
  private _isPersonAccountRecord(source: Record<string, unknown>): boolean {
    void this;
    const rawValue = source['IsPersonAccount'];
    if (typeof rawValue === 'boolean') {
      return rawValue;
    }
    if (typeof rawValue === 'number') {
      return rawValue === 1;
    }
    if (typeof rawValue === 'string') {
      const normalized = rawValue.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') {
        return true;
      }
      if (normalized === 'false' || normalized === '0' || normalized === '') {
        return false;
      }
    }
    return Boolean(rawValue);
  }

  /**
   * Normalizes Name/FirstName/LastName fields for person account updates.
   *
   * @param processedData - Processed data container.
   * @param source - Source record.
   * @param cloned - Cloned record to update.
   * @param isPersonRecord - True for person account records.
   */
  private _updatePersonAccountFields(
    processedData: ProcessedData,
    source: Record<string, unknown>,
    cloned: Record<string, unknown>,
    isPersonRecord: boolean
  ): void {
    if (this.sObjectName !== 'Account') {
      return;
    }

    if (isPersonRecord) {
      this._updatePersonAccountPersonFields(processedData, source, cloned);
      return;
    }

    this._updatePersonAccountBusinessFields(processedData, source, cloned);
  }

  /**
   * Normalizes FirstName/LastName for person account records.
   *
   * @param processedData - Processed data container.
   * @param source - Source record.
   * @param cloned - Cloned record to update.
   */
  private _updatePersonAccountPersonFields(
    processedData: ProcessedData,
    source: Record<string, unknown>,
    cloned: Record<string, unknown>
  ): void {
    void this;
    if (!cloned['FirstName'] && !cloned['LastName'] && processedData.fieldNames.includes('FirstName')) {
      const nameValue = String(source['Name'] ?? '').trim();
      const parts = nameValue.split(' ').filter((part) => part.length > 0);
      // eslint-disable-next-line no-param-reassign
      cloned['FirstName'] = parts[0] ?? '';
      // eslint-disable-next-line no-param-reassign
      cloned['LastName'] = parts[1] ?? '';
      const hasFirst = String(cloned['FirstName'] ?? '').trim().length > 0;
      const hasLast = String(cloned['LastName'] ?? '').trim().length > 0;
      if (!hasFirst && !hasLast) {
        // eslint-disable-next-line no-param-reassign
        cloned['FirstName'] = Common.makeId(10);
      }
    }
  }

  /**
   * Normalizes Name for business account records.
   *
   * @param processedData - Processed data container.
   * @param source - Source record.
   * @param cloned - Cloned record to update.
   */
  private _updatePersonAccountBusinessFields(
    processedData: ProcessedData,
    source: Record<string, unknown>,
    cloned: Record<string, unknown>
  ): void {
    void this;
    if (!processedData.fieldNames.includes('Name')) {
      return;
    }

    const currentName = String(cloned['Name'] ?? '').trim();
    if (!currentName) {
      const first = String(source['FirstName'] ?? '').trim();
      const last = String(source['LastName'] ?? '').trim();
      const composed = `${first}${first && last ? ' ' : ''}${last}`.trim();
      // eslint-disable-next-line no-param-reassign
      cloned['Name'] = composed;
    }
    const resolvedName = String(cloned['Name'] ?? '').trim();
    if (!resolvedName) {
      // eslint-disable-next-line no-param-reassign
      cloned['Name'] = Common.makeId(10);
    }
  }

  /**
   * Links target person contacts back to source contacts after person account inserts.
   *
   * @param personAccountsInsertData - Processed data from person account inserts.
   * @returns Number of mapped person contacts.
   */
  private async _insertPersonContactsFromPersonAccountsAsync(personAccountsInsertData: ProcessedData): Promise<number> {
    if (this.sObjectName !== 'Account') {
      return 0;
    }
    if (!this.job.script.isPersonAccountEnabled) {
      return 0;
    }

    const contactTask = this.job.getTaskBySObjectName('Contact');
    const targetOrg = contactTask?.targetData.org;
    if (!contactTask || !targetOrg?.isOrgMedia) {
      return 0;
    }

    const targetPersonAccountIdToSourceContactMap = new Map<string, Record<string, unknown>>();
    const targetAccountIds: string[] = [];

    contactTask.sourceData.records.forEach((sourceContact) => {
      const accountId = contactTask._getRecordFieldValue(sourceContact, 'AccountId');
      if (!accountId || contactTask.sourceToTargetRecordMap.has(sourceContact)) {
        return;
      }
      const sourceAccount = this.sourceData.idRecordsMap.get(accountId);
      if (!sourceAccount) {
        return;
      }
      const targetAccount = personAccountsInsertData.insertedRecordsSourceToTargetMap.get(sourceAccount);
      if (!targetAccount) {
        return;
      }
      const targetAccountId = contactTask._getRecordIdValue(targetAccount);
      if (!targetAccountId) {
        return;
      }
      targetPersonAccountIdToSourceContactMap.set(targetAccountId, sourceContact);
      targetAccountIds.push(targetAccountId);
    });

    if (targetAccountIds.length === 0) {
      return 0;
    }

    const accountIdFieldName = contactTask.scriptObject.mapFieldNameToTarget('AccountId');
    const baseQuery = contactTask.createQuery(undefined, false, undefined, false, true);
    if (!baseQuery) {
      return 0;
    }
    const queries = contactTask._buildFilteredQueryStrings(baseQuery, accountIdFieldName, targetAccountIds);
    if (queries.length === 0) {
      return 0;
    }

    const logger = this._getLogger();
    logger.log('queryingIn2', this.sObjectName, logger.getResourceString('personContact'));
    contactTask.targetData.queryCount += queries.length;

    const orgDataService = new OrgDataService(this.job.script);
    const records = await contactTask._retrieveFilteredRecordsAsync(queries, targetOrg, orgDataService, {
      useBulk: contactTask.targetData.useBulkQueryApi,
      useQueryAll: contactTask.scriptObject.queryAllTarget,
    });

    if (records.length === 0) {
      return 0;
    }

    contactTask.registerRecords(records, contactTask.targetData, true);
    contactTask.targetData.totalRecordCount = contactTask.targetData.idRecordsMap.size;

    let newRecordsCount = 0;
    records.forEach((targetContact) => {
      const accountId = contactTask._getRecordFieldValue(targetContact, accountIdFieldName);
      if (!accountId) {
        return;
      }
      const sourceContact = targetPersonAccountIdToSourceContactMap.get(accountId);
      if (!sourceContact || contactTask.sourceToTargetRecordMap.has(sourceContact)) {
        return;
      }
      contactTask.sourceToTargetRecordMap.set(sourceContact, targetContact);
      // eslint-disable-next-line no-param-reassign
      sourceContact[__IS_PROCESSED_FIELD_NAME] = true;
      newRecordsCount += 1;
    });

    logger.log(
      'queryingFinished',
      this.sObjectName,
      logger.getResourceString('personContact'),
      String(newRecordsCount)
    );
    return newRecordsCount;
  }

  /**
   * Returns the resolved external id field name for the specified side.
   *
   * @param isTarget - True for target side.
   * @returns External id field name.
   */
  private _getResolvedExternalIdFieldName(isTarget: boolean): string {
    if (isTarget) {
      return this.scriptObject.getMappedExternalIdFieldName();
    }
    return this.scriptObject.externalId;
  }

  /**
   * Resolves an external id value for a record.
   *
   * @param record - Record to inspect.
   * @param isTarget - True when resolving target external ids.
   * @returns External id value or undefined.
   */
  private _getResolvedExternalIdValue(record: Record<string, unknown>, isTarget: boolean): string | undefined {
    const fieldName = this._getResolvedExternalIdFieldName(isTarget);
    if (!fieldName) {
      return undefined;
    }
    return this._getRecordExternalIdValue(record, fieldName);
  }

  /**
   * Resolves an external id value for the given field name.
   *
   * @param record - Record to inspect.
   * @param fieldName - External id field name.
   * @returns External id value or undefined.
   */
  private _getRecordExternalIdValue(record: Record<string, unknown>, fieldName: string): string | undefined {
    const directValue = this._getRecordFieldValue(record, fieldName);
    if (directValue) {
      return directValue;
    }

    if (!Common.isComplexField(fieldName)) {
      return undefined;
    }

    const complexFieldName = Common.getComplexField(fieldName);
    if (complexFieldName !== fieldName) {
      const complexValue = this._getRecordFieldValue(record, complexFieldName);
      if (complexValue) {
        return complexValue;
      }
    }

    const plainField = Common.getFieldFromComplexField(fieldName);
    const parts = plainField
      .split(COMPLEX_FIELDS_SEPARATOR)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    const values = parts
      .map((part) => this._getRecordFieldValue(record, part) ?? '')
      .filter((value) => value.length > 0);
    if (values.length === 0) {
      return undefined;
    }
    return values.join(COMPLEX_FIELDS_SEPARATOR);
  }

  /**
   * Reads a record field value as a string.
   *
   * @param record - Record to inspect.
   * @param fieldName - Field name to read.
   * @returns Field value or undefined.
   */
  private _getRecordFieldValue(record: Record<string, unknown>, fieldName: string): string | undefined {
    void this;
    if (!fieldName || !Object.prototype.hasOwnProperty.call(record, fieldName)) {
      return undefined;
    }
    const rawValue = record[fieldName];
    if (rawValue === null || typeof rawValue === 'undefined') {
      return undefined;
    }
    const textValue = String(rawValue);
    return textValue.length > 0 ? textValue : undefined;
  }

  /**
   * Reads the record Id value as a string.
   *
   * @param record - Record to inspect.
   * @returns Record Id or empty string.
   */
  private _getRecordIdValue(record: Record<string, unknown>): string {
    void this;
    const rawValue = record.Id;
    if (rawValue === null || typeof rawValue === 'undefined') {
      return '';
    }
    return String(rawValue);
  }

  /**
   * Links a target record to its source record using external id value.
   *
   * @param externalIdValue - External id value.
   * @param targetRecord - Target record.
   */
  private _linkSourceToTargetRecord(externalIdValue: string, targetRecord: Record<string, unknown>): void {
    const sourceId = this.sourceData.extIdToRecordIdMap.get(externalIdValue);
    if (!sourceId) {
      return;
    }
    const sourceRecord = this.sourceData.idRecordsMap.get(sourceId);
    if (!sourceRecord) {
      return;
    }
    this.sourceToTargetRecordMap.set(sourceRecord, targetRecord);
  }

  /**
   * Builds processed data for the update pipeline.
   *
   * @param updateMode - Update pass mode.
   * @returns Processed data container.
   */
  private async _createProcessedDataAsync(
    updateMode: UpdateModeType,
    processPersonAccounts = false
  ): Promise<ProcessedData> {
    const processedData = new ProcessedData();
    processedData.processPersonAccounts = processPersonAccounts;
    processedData.fields = this._resolveProcessingFields(updateMode);

    const personFieldFilter = this._applyPersonAccountFieldFiltering(processedData.fields, processPersonAccounts);
    processedData.fields = personFieldFilter.fields;
    if (!personFieldFilter.shouldProcess) {
      return processedData;
    }

    if (processedData.fields.length === 0 || this.sourceData.records.length === 0) {
      return processedData;
    }

    const compareSourceFields: string[] = [];
    const fieldNamesToClone = Common.distinctStringArray(processedData.fieldNames.concat(compareSourceFields));
    const cloneToSourceMap = Common.cloneArrayOfObjects(this.sourceData.records, fieldNamesToClone);
    const internalIdToSourceMap = this._buildInternalIdToSourceMap(cloneToSourceMap);

    const preparedMap = new Map<Record<string, unknown>, Record<string, unknown>>();
    const isPersonAccountFlow = this._isPersonAccountOrContact();
    cloneToSourceMap.forEach((source, cloned) => {
      const isPersonRecord = isPersonAccountFlow ? this._isPersonAccountRecord(source) : false;
      if (isPersonAccountFlow) {
        if (processPersonAccounts) {
          if (this.sObjectName === 'Account' && !isPersonRecord) {
            return;
          }
        } else if (isPersonRecord) {
          return;
        }
      }
      this._updateLookupIdFields(processedData, source, cloned);
      if (isPersonAccountFlow) {
        this._updatePersonAccountFields(processedData, source, cloned, isPersonRecord);
      }
      preparedMap.set(cloned, source);
    });

    let workingRecords = await this._filterRecordsAsync([...preparedMap.keys()]);
    workingRecords = this._applyMocking(workingRecords, processedData.fields);
    workingRecords = this._truncateRecords(workingRecords, processedData.fields);
    this._applyValueMapping(workingRecords);
    workingRecords = this._mapRecordsToTarget(workingRecords);

    processedData.clonedToSourceMap = this._mapRecordsToSources(workingRecords, internalIdToSourceMap);

    return processedData;
  }

  /**
   * Resolves fields that should be used during the update pass.
   *
   * @param updateMode - Update pass mode.
   * @returns Field list.
   */
  private _resolveProcessingFields(updateMode: UpdateModeType): SFieldDescribe[] {
    const baseFields = this.data.sFieldsToUpdate;
    const selected = baseFields.filter((field) => {
      if (updateMode === 'forwards') {
        if (field.isSimpleNotLookup) {
          return true;
        }
        if (field.isSimpleReference && field.parentLookupObject) {
          const parentTask = this.job.getTaskBySObjectName(field.parentLookupObject.name);
          return parentTask ? this.data.prevTasks.includes(parentTask) : false;
        }
        return false;
      }
      return field.isSimpleReference;
    });

    const fields = selected.concat(new SFieldDescribe({ name: __ID_FIELD_NAME }));
    if (this.scriptObject.operation !== OPERATION.Insert) {
      const idField = this.data.sFieldsInQuery.find((field) => field.nameId === 'Id');
      if (idField) {
        fields.push(idField);
      }
    }

    const fieldMap = new Map<string, SFieldDescribe>();
    fields.forEach((field) => {
      if (!field) {
        return;
      }
      const key = field.nameId ?? field.name;
      if (!fieldMap.has(key)) {
        fieldMap.set(key, field);
      }
    });
    return [...fieldMap.values()];
  }

  /**
   * Builds a map of internal record ids to source records.
   *
   * @param cloneToSourceMap - Map of cloned to source records.
   * @returns Internal id to source record map.
   */
  private _buildInternalIdToSourceMap(
    cloneToSourceMap: Map<Record<string, unknown>, Record<string, unknown>>
  ): Map<string, Record<string, unknown>> {
    const idMap = new Map<string, Record<string, unknown>>();
    cloneToSourceMap.forEach((source, cloned) => {
      const recordId = this._getInternalRecordId(cloned);
      if (recordId) {
        idMap.set(recordId, source);
      }
    });
    return idMap;
  }

  /**
   * Maps processed records back to their source records using internal ids.
   *
   * @param records - Processed records.
   * @param internalIdToSourceMap - Internal id to source record map.
   * @returns Map of processed record to source record.
   */
  private _mapRecordsToSources(
    records: Array<Record<string, unknown>>,
    internalIdToSourceMap: Map<string, Record<string, unknown>>
  ): Map<Record<string, unknown>, Record<string, unknown>> {
    const map = new Map<Record<string, unknown>, Record<string, unknown>>();
    records.forEach((record) => {
      const recordId = this._getInternalRecordId(record);
      if (!recordId) {
        return;
      }
      const source = internalIdToSourceMap.get(recordId);
      if (source) {
        map.set(record, source);
      }
    });
    return map;
  }

  /**
   * Filters records using add-on hooks and targetRecordsFilter.
   *
   * @param records - Records to filter.
   * @returns Filtered records.
   */
  private async _filterRecordsAsync(records: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
    let workingRecords = records;
    const manager = this.job.script.addonManager as
      | {
          triggerAddonModuleMethodAsync?: (
            event: ADDON_EVENTS,
            objectName?: string,
            contextOverrides?: {
              passNumber?: number;
              isFirstPass?: boolean;
              objectSetIndex?: number;
            }
          ) => Promise<void>;
        }
      | undefined;
    if (manager?.triggerAddonModuleMethodAsync) {
      this.tempRecords = workingRecords;
      await manager.triggerAddonModuleMethodAsync(
        ADDON_EVENTS.filterRecordsAddons,
        this.sObjectName,
        this._getAddonInvocationContext()
      );
      workingRecords = this.tempRecords;
    }

    const filter = this.scriptObject.targetRecordsFilter?.trim();
    if (!filter) {
      return workingRecords;
    }

    try {
      const alasql = CjsDependencyAdapters.getAlasql() as (
        query: string,
        data?: Array<Array<Record<string, unknown>>>
      ) => Array<Record<string, unknown>>;
      const selected = alasql(`SELECT * FROM ? WHERE ${filter}`, [workingRecords]);
      return Array.isArray(selected) ? selected : workingRecords;
    } catch (error) {
      const logger = this._getLogger();
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('skippedTargetRecordsFilterWarning', message);
      return workingRecords;
    }
  }

  /**
   * Applies mock patterns to the provided records.
   *
   * @param records - Records to update.
   * @param fields - Fields in scope for mocking.
   * @returns Mocked records.
   */
  private _applyMocking(
    records: Array<Record<string, unknown>>,
    fields: SFieldDescribe[]
  ): Array<Record<string, unknown>> {
    if (records.length === 0) {
      return records;
    }
    if (!this.scriptObject.updateWithMockData || this.scriptObject.mockFields.length === 0) {
      return records;
    }

    const casualModule = CjsDependencyAdapters.getCasual() as Record<string, unknown>;
    const casualByLocale = new Map<string, CasualGeneratorType>();
    this._resolveCasualGeneratorByLocale(casualModule, '', casualByLocale);
    MockGenerator.resetCounter();

    const recordIds = records.map((record) => this._resolveMockIdsValue(record));
    const recordFields = Object.keys(records[0] ?? {});
    const fieldNameToMockFieldMap = this._buildMockFieldRuntimeMap(fields, recordFields);
    if (fieldNameToMockFieldMap.size === 0) {
      return records;
    }

    const logger = this._getLogger();
    const mockedFields = [...fieldNameToMockFieldMap.keys()];
    const mockedFieldsList = mockedFields.join(', ');
    logger.log('applyingMocking', this.sObjectName, mockedFieldsList);
    Common.logDiagnostics(logger.getResourceString('applyingMocking', this.sObjectName, mockedFieldsList), logger);
    const mockApplyCounts = new Map<string, number>();
    fieldNameToMockFieldMap.forEach((mockField, fieldName) => {
      Common.logDiagnostics(
        logger.getResourceString('mockingFieldPattern', this.sObjectName, fieldName, mockField.fn),
        logger
      );
      mockApplyCounts.set(fieldName, 0);
    });

    const updatedRecords = records.map((originalRecord, index) => {
      const updatedRecord = { ...originalRecord };
      let doNotMock = false;
      let mockAllRecord = false;
      const fieldsToMock = new Map<string, boolean>();

      fieldNameToMockFieldMap.forEach((mockField, fieldName) => {
        if (doNotMock) {
          return;
        }
        const value = updatedRecord[fieldName];
        const excluded = Boolean(mockField.regExcl) && this._testMockRegex(mockField.regExcl, value);
        const included = Boolean(mockField.regIncl) && this._testMockRegex(mockField.regIncl, value);

        if (included && mockField.allowMockAllRecord) {
          mockAllRecord = true;
        }
        if (excluded && mockField.disallowMockAllRecord) {
          doNotMock = true;
        } else if (mockAllRecord || ((!mockField.regExcl || !excluded) && (!mockField.regIncl || included))) {
          fieldsToMock.set(fieldName, true);
        }
      });

      if (!doNotMock) {
        fieldNameToMockFieldMap.forEach((mockField, fieldName) => {
          if (mockAllRecord || fieldsToMock.has(fieldName)) {
            const value = updatedRecord[fieldName];
            if (mockField.fn === 'ids') {
              updatedRecord[fieldName] = recordIds[index];
              mockApplyCounts.set(fieldName, (mockApplyCounts.get(fieldName) ?? 0) + 1);
              return;
            }
            const casualGenerator = this._resolveCasualGeneratorByLocale(
              casualModule,
              mockField.locale,
              casualByLocale
            );
            void casualGenerator;
            // eslint-disable-next-line no-eval
            updatedRecord[fieldName] = eval(`casualGenerator.${mockField.fn}`);
            mockApplyCounts.set(fieldName, (mockApplyCounts.get(fieldName) ?? 0) + 1);
            void value;
          }
        });
      }

      return updatedRecord;
    });

    fieldNameToMockFieldMap.forEach((mockField, fieldName) => {
      const count = mockApplyCounts.get(fieldName) ?? 0;
      Common.logDiagnostics(
        logger.getResourceString('mockingFieldApplied', this.sObjectName, fieldName, mockField.fn, String(count)),
        logger
      );
    });

    return updatedRecords;
  }

  /**
   * Builds runtime mock field configuration.
   *
   * @param fields - Candidate fields.
   * @param recordFields - Fields present in records.
   * @returns Mock field runtime map.
   */
  private _buildMockFieldRuntimeMap(
    fields: SFieldDescribe[],
    recordFields: string[]
  ): Map<string, MockFieldRuntimeType> {
    const fieldNameToMockFieldMap = new Map<string, MockFieldRuntimeType>();
    fields.forEach((fieldDescribe) => {
      const mockField = this._getMockPatternByFieldName(fieldDescribe.name);
      if (!mockField.pattern) {
        return;
      }
      const shouldInclude =
        mockField.name === MOCK_ALL_FIELDS_PATTERN
          ? recordFields.includes(fieldDescribe.name)
          : recordFields.includes(mockField.name);
      if (!shouldInclude) {
        return;
      }

      const mockFieldNameToUse = mockField.name === MOCK_ALL_FIELDS_PATTERN ? fieldDescribe.name : mockField.name;
      if (this._isSystemFieldExcludedFromMocking(mockFieldNameToUse)) {
        return;
      }
      let fn = mockField.pattern;
      if (SPECIAL_MOCK_COMMANDS.some((command) => fn.startsWith(`${command}(`))) {
        fn = fn.replace(/\(/, `('${mockFieldNameToUse}',`).replace(/\)/, ', value)');
      }

      const excludedRegex = mockField.excludedRegex ?? '';
      const includedRegex = mockField.includedRegex ?? '';
      fieldNameToMockFieldMap.set(mockFieldNameToUse, {
        fn,
        locale: String(mockField.locale ?? '').trim(),
        regExcl: excludedRegex.split(MOCK_PATTERN_ENTIRE_ROW_FLAG)[0].trim(),
        regIncl: includedRegex.split(MOCK_PATTERN_ENTIRE_ROW_FLAG)[0].trim(),
        disallowMockAllRecord: excludedRegex.includes(MOCK_PATTERN_ENTIRE_ROW_FLAG),
        allowMockAllRecord: includedRegex.includes(MOCK_PATTERN_ENTIRE_ROW_FLAG),
      });
    });
    return fieldNameToMockFieldMap;
  }

  /**
   * Returns true when a field must never be mocked because it is used by runtime bookkeeping.
   *
   * @param fieldName - Field name to check.
   * @returns True when the field is protected from mocking.
   */
  private _isSystemFieldExcludedFromMocking(fieldName: string): boolean {
    void this;
    if (!fieldName) {
      return false;
    }
    return (
      fieldName === __ID_FIELD_NAME ||
      fieldName === __SOURCE_ID_FIELD_NAME ||
      fieldName === __IS_PROCESSED_FIELD_NAME ||
      fieldName === 'Id'
    );
  }

  /**
   * Tests mock regex expressions against a value.
   *
   * @param expr - Regex expression.
   * @param value - Value to test.
   * @returns True when matched.
   */
  private _testMockRegex(expr: string, value: unknown): boolean {
    void this;
    if (!expr) {
      return false;
    }
    const anyValue = SPECIAL_MOCK_PATTERNS.get(SPECIAL_MOCK_PATTERN_TYPES.haveAnyValue);
    const missingValue = SPECIAL_MOCK_PATTERNS.get(SPECIAL_MOCK_PATTERN_TYPES.missingValue);
    if (expr === anyValue) {
      return Boolean(value);
    }
    if (expr === missingValue) {
      return !value;
    }
    return new RegExp(expr, 'ig').test(String(value ?? ''));
  }

  /**
   * Resolves the casual generator by locale with fallback to default locale.
   *
   * @param casualModule - Raw casual module export.
   * @param locale - Requested locale key.
   * @param cache - Locale to generator cache.
   * @returns Casual generator instance.
   */
  private _resolveCasualGeneratorByLocale(
    casualModule: Record<string, unknown>,
    locale: string,
    cache: Map<string, CasualGeneratorType>
  ): CasualGeneratorType {
    const requestedLocale = String(locale ?? '').trim();
    const cacheKey = requestedLocale || '__default__';
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const defaultGenerator = this._isCasualGenerator(casualModule) ? casualModule : undefined;
    const normalizedLocale = requestedLocale.replace('-', '_');
    const localeCandidate =
      (requestedLocale && casualModule[requestedLocale]) || (normalizedLocale && casualModule[normalizedLocale]);
    const resolvedGenerator = this._isCasualGenerator(localeCandidate) ? localeCandidate : defaultGenerator;
    if (!resolvedGenerator) {
      throw new CommandExecutionError(`Unable to resolve casual generator for locale "${requestedLocale}".`);
    }

    MockGenerator.createCustomGenerators(resolvedGenerator);
    cache.set(cacheKey, resolvedGenerator);
    return resolvedGenerator;
  }

  /**
   * Returns true when value matches the minimal casual generator contract.
   *
   * @param value - Value to inspect.
   * @returns True when define() is available.
   */
  private _isCasualGenerator(value: unknown): value is CasualGeneratorType {
    void this;
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as Partial<CasualGeneratorType>).define === 'function'
    );
  }

  /**
   * Finds the mock pattern for a specific field.
   *
   * @param fieldName - Field name to inspect.
   * @returns Mock field definition.
   */
  private _getMockPatternByFieldName(fieldName: string): ScriptMockField {
    return (
      this.scriptObject.mockFields.find(
        (field) =>
          (field.name === fieldName || field.name === MOCK_ALL_FIELDS_PATTERN) &&
          !field.excludeNames.includes(fieldName)
      ) ?? new ScriptMockField()
    );
  }

  /**
   * Truncates textual fields when configured.
   *
   * @param records - Records to update.
   * @param fields - Fields to inspect.
   * @returns Truncated records.
   */
  private _truncateRecords(
    records: Array<Record<string, unknown>>,
    fields: SFieldDescribe[]
  ): Array<Record<string, unknown>> {
    if (records.length === 0 || !this.job.script.allowFieldTruncation) {
      return records;
    }
    const truncatable = fields.filter((field) => field.isTextual && field.length > 0);
    if (truncatable.length === 0) {
      return records;
    }
    records.forEach((record) => {
      truncatable.forEach((field) => {
        if (!Object.prototype.hasOwnProperty.call(record, field.name)) {
          return;
        }
        const value = record[field.name];
        if (value === null || typeof value === 'undefined') {
          return;
        }
        // eslint-disable-next-line no-param-reassign
        record[field.name] = String(value).slice(0, field.length);
      });
    });
    return records;
  }

  /**
   * Applies value mapping rules to record values.
   *
   * @param records - Records to update.
   */
  private _applyValueMapping(records: Array<Record<string, unknown>>): void {
    if (records.length === 0 || !this.scriptObject.useValuesMapping || this.job.valueMapping.size === 0) {
      return;
    }

    const logger = this._getLogger();
    const fieldNames = Object.keys(records[0] ?? {}).filter((field) => !field.startsWith('___'));
    let mappingApplied = false;
    const mappedFields: string[] = [];

    fieldNames.forEach((field) => {
      const key = `${this.sObjectName}${field}`;
      const valuesMap = this.job.valueMapping.get(key);
      if (!valuesMap || valuesMap.size === 0) {
        return;
      }

      mappedFields.push(field);

      const regexMapping = this._resolveValueMappingRegex(valuesMap);
      let appliedCount = 0;
      const mappingEntries: Array<{ raw: string; mapped: string }> = [];
      valuesMap.forEach((mappedValue, rawValue) => {
        mappingEntries.push({ raw: rawValue, mapped: mappedValue });
      });
      const mappingRulesSummary = mappingEntries.map((entry) => `${entry.raw} -> ${entry.mapped}`).join('; ') || 'none';
      logger.verboseFile(
        `${LOG_FILE_NO_ANONYMIZE_MARKER}${logger.getResourceString(
          'mappingValueRules',
          this.sObjectName,
          field,
          mappingRulesSummary
        )}`
      );
      const ruleCounts = new Map<string, number>();

      records.forEach((record) => {
        const rawValue =
          record[field] === null || typeof record[field] === 'undefined' ? '' : String(record[field]).trim();
        let newValue: unknown;

        let regexMatched = false;
        if (regexMapping.regexp && regexMapping.regexp.test(rawValue)) {
          regexMatched = true;
          const replacement = this._evaluateValueMappingExpression(rawValue, regexMapping.replaceValue);
          const replacementText = typeof replacement === 'undefined' ? '' : String(replacement);
          newValue = rawValue.replace(regexMapping.regexp, replacementText);
        }

        if (regexMatched && regexMapping.sourceKey) {
          ruleCounts.set(regexMapping.sourceKey, (ruleCounts.get(regexMapping.sourceKey) ?? 0) + 1);
        }

        const resolveMappedValue = (candidateKey: string): { resolved?: string; used: boolean } => {
          if (!valuesMap.has(candidateKey)) {
            return { used: false };
          }
          const mapped = valuesMap.get(candidateKey);
          if (typeof mapped === 'string' && mapped.length === 0) {
            return { used: false };
          }
          return { resolved: mapped, used: true };
        };

        let ruleKey: string | undefined;
        if (newValue) {
          const candidateKey = String(newValue);
          const mapping = resolveMappedValue(candidateKey);
          if (mapping.used) {
            ruleKey = candidateKey;
            newValue = mapping.resolved;
          }
        }
        if (!newValue) {
          const mapping = resolveMappedValue(rawValue);
          if (mapping.used) {
            ruleKey = rawValue;
            newValue = mapping.resolved;
          } else {
            newValue = rawValue;
          }
        }

        if (ruleKey) {
          ruleCounts.set(ruleKey, (ruleCounts.get(ruleKey) ?? 0) + 1);
        }

        newValue = this._normalizeMappedValue(newValue);
        newValue = this._evaluateValueMappingExpression(rawValue, newValue);

        if (typeof newValue !== 'undefined') {
          const previous = record[field];
          // eslint-disable-next-line no-param-reassign
          record[field] = newValue;
          if (previous !== newValue) {
            appliedCount += 1;
          }
          this._applyMappedLookupValue(field, newValue, record);
        }
      });

      if (appliedCount > 0) {
        this._logVerboseField(this.sObjectName, field, `Value mapping applied to ${appliedCount} records.`);
      }
      mappingEntries.forEach((entry) => {
        const ruleLabel = `${entry.raw} -> ${entry.mapped}`;
        const count = ruleCounts.get(entry.raw) ?? 0;
        logger.verboseFile(
          `${LOG_FILE_NO_ANONYMIZE_MARKER}${logger.getResourceString(
            'mappingValueRuleApplied',
            this.sObjectName,
            field,
            ruleLabel,
            String(count)
          )}`
        );
      });
    });

    if (mappedFields.length > 0) {
      const fieldsList = mappedFields.join(', ');
      logger.log('mappingValuesFields', this.sObjectName, fieldsList);
      Common.logDiagnostics(logger.getResourceString('mappingValuesFields', this.sObjectName, fieldsList), logger);
      mappingApplied = true;
    }

    if (!mappingApplied) {
      return;
    }
  }

  /**
   * Resolves regex-based value mapping configuration.
   *
   * @param valuesMap - Value mapping entries.
   * @returns Regex mapping configuration.
   */
  private _resolveValueMappingRegex(valuesMap: Map<string, string>): ValueMappingRegexType {
    void this;
    const regexPattern = new RegExp(FIELDS_MAPPING_REGEX_PATTERN);
    let resolved: ValueMappingRegexType = {};
    valuesMap.forEach((mappedValue, rawValue) => {
      if (!regexPattern.test(rawValue)) {
        return;
      }
      const pattern = rawValue.replace(regexPattern, '$1');
      try {
        resolved = {
          regexp: mappedValue ? new RegExp(pattern, 'gi') : undefined,
          replaceValue: mappedValue,
          sourceKey: rawValue,
        };
      } catch {
        // Ignore invalid regex patterns.
      }
    });
    return resolved;
  }

  /**
   * Normalizes mapped values for legacy conversions and eval expressions.
   *
   * @param mappedValue - Candidate mapped value.
   * @returns Normalized value.
   */
  private _normalizeMappedValue(mappedValue: unknown): unknown {
    void this;
    if (typeof mappedValue === 'string') {
      const trimmed = mappedValue.trim();
      if (trimmed === 'TRUE' || trimmed === 'true') {
        return true;
      }
      if (trimmed === 'FALSE' || trimmed === 'false') {
        return false;
      }
      if (trimmed === 'null' || trimmed === 'NULL' || trimmed === 'undefined' || trimmed === '#N/A') {
        return null;
      }
      return mappedValue;
    }

    if (mappedValue === null || typeof mappedValue === 'undefined') {
      return null;
    }

    return mappedValue;
  }

  /**
   * Evaluates an eval() mapping expression.
   *
   * @param rawValue - Original raw value.
   * @param mappedValue - Candidate mapped value.
   * @returns Evaluated value.
   */
  private _evaluateValueMappingExpression(rawValue: string, mappedValue: unknown): unknown {
    void this;
    if (typeof mappedValue !== 'string') {
      return mappedValue;
    }
    const evalPattern = new RegExp(FIELDS_MAPPING_EVAL_PATTERN, 'i');
    if (!evalPattern.test(mappedValue)) {
      return mappedValue;
    }

    const rawExpression = mappedValue.replace(evalPattern, '$1');
    const preparedExpression = this._replaceRawValueKeywordInEvalExpression(rawExpression, rawValue);
    try {
      return this._executeValueMappingEvalExpression(preparedExpression);
    } catch {
      const recovered = this._tryRecoverValueMappingEvalExpression(preparedExpression);
      if (recovered.recovered) {
        return recovered.value;
      }
      return rawValue;
    }
  }

  /**
   * Replaces RAW_VALUE placeholders with the original field value before evaluation.
   *
   * @param expression - Raw expression body from eval(...).
   * @param rawValue - Original field value.
   * @returns Prepared expression.
   */
  private _replaceRawValueKeywordInEvalExpression(expression: string, rawValue: string): string {
    void this;
    return expression.replace(new RegExp(FIELD_MAPPING_EVAL_PATTERN_ORIGINAL_VALUE, 'gi'), rawValue);
  }

  /**
   * Executes a prepared eval expression.
   *
   * @param expression - Prepared expression.
   * @returns Evaluated value.
   */
  private _executeValueMappingEvalExpression(expression: string): unknown {
    void this;
    // eslint-disable-next-line no-eval
    return eval(expression);
  }

  /**
   * Tries to recover an eval expression by quoting undefined identifiers and retrying.
   *
   * @param expression - Prepared expression.
   * @returns Recovery result.
   */
  private _tryRecoverValueMappingEvalExpression(expression: string): { recovered: boolean; value: unknown } {
    let currentExpression = expression;
    let lastError: unknown;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return {
          recovered: true,
          value: this._executeValueMappingEvalExpression(currentExpression),
        };
      } catch (error) {
        lastError = error;
      }

      const undefinedIdentifier = this._extractUndefinedIdentifierFromEvalError(lastError);
      if (!undefinedIdentifier || undefinedIdentifier === FIELD_MAPPING_EVAL_PATTERN_ORIGINAL_VALUE) {
        return {
          recovered: false,
          value: undefined,
        };
      }

      const escapedIdentifier = this._escapeRegex(undefinedIdentifier);
      const identifierPattern = new RegExp(`(^|[^\\w$.])(${escapedIdentifier})(?![\\w$])(?!\\s*\\()`, 'g');
      const nextExpression = currentExpression.replace(identifierPattern, `$1'${undefinedIdentifier}'`);
      if (nextExpression === currentExpression) {
        return {
          recovered: false,
          value: undefined,
        };
      }
      currentExpression = nextExpression;
    }

    return {
      recovered: false,
      value: undefined,
    };
  }

  /**
   * Extracts an undefined identifier name from a JS reference error.
   *
   * @param error - Thrown error.
   * @returns Undefined identifier name, or undefined.
   */
  private _extractUndefinedIdentifierFromEvalError(error: unknown): string | undefined {
    void this;
    const message = error instanceof Error ? error.message : String(error ?? '');
    const match = /^([A-Za-z_$][A-Za-z0-9_$]*) is not defined$/i.exec(message.trim());
    if (!match) {
      return undefined;
    }
    return match[1];
  }

  /**
   * Escapes regex special characters in a string literal.
   *
   * @param value - Raw text.
   * @returns Regex-escaped text.
   */
  private _escapeRegex(value: string): string {
    void this;
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Updates lookup Id values when mapping affects __r fields.
   *
   * @param fieldName - Field name in the record.
   * @param mappedValue - Mapped lookup value.
   * @param record - Record to update.
   */
  private _applyMappedLookupValue(fieldName: string, mappedValue: unknown, record: Record<string, unknown>): void {
    const describe = this.data.fieldsInQueryMap.get(fieldName);
    if (!describe || !describe.is__r || !describe.parentLookupObject) {
      return;
    }
    const parentTask = this.job.getTaskBySObjectName(describe.parentLookupObject.name);
    if (!parentTask) {
      return;
    }
    const lookupValue = typeof mappedValue === 'string' ? mappedValue : String(mappedValue ?? '');
    if (!lookupValue) {
      return;
    }
    const resolvedId = parentTask.sourceData.extIdToRecordIdMap.get(lookupValue);
    if (resolvedId) {
      // eslint-disable-next-line no-param-reassign
      record[describe.nameId] = resolvedId;
    }
  }

  /**
   * Updates lookup id values for parent relationships.
   *
   * @param processedData - Processed data container.
   * @param source - Source record.
   * @param cloned - Cloned record to update.
   */
  private _updateLookupIdFields(
    processedData: ProcessedData,
    source: Record<string, unknown>,
    cloned: Record<string, unknown>
  ): void {
    if (this.job.script.targetOrg?.isFileMedia) {
      return;
    }
    processedData.lookupIdFields.forEach((idField) => {
      // eslint-disable-next-line no-param-reassign
      cloned[idField.nameId] = null;
      const parentId = this._getRecordFieldValue(source, idField.nameId);
      if (!parentId) {
        return;
      }
      const parentObjectName = idField.parentLookupObject?.name;
      const parentTask = parentObjectName ? this.job.getTaskBySObjectName(parentObjectName) : undefined;
      const parentRecord = parentTask?.sourceData.idRecordsMap.get(parentId);
      const targetRecord = parentRecord ? parentTask?.sourceToTargetRecordMap.get(parentRecord) : undefined;
      const resolvedId = targetRecord ? String(targetRecord['Id'] ?? '') : '';
      if (resolvedId) {
        // eslint-disable-next-line no-param-reassign
        cloned[idField.nameId] = resolvedId;
        return;
      }
      if (parentId && idField.parentLookupObject) {
        processedData.missingParentLookups.push(this._createMissingParentLookupRecord(idField, source));
      }
    });
  }

  /**
   * Creates a missing parent lookup record entry.
   *
   * @param idField - Lookup field metadata.
   * @param source - Source record.
   * @returns Missing lookup record.
   */
  private _createMissingParentLookupRecord(
    idField: SFieldDescribe,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const parentObject = idField.parentLookupObject;
    const recordIdValue = this._getRecordIdValue(source) || this._getInternalRecordId(source);
    return {
      'Date update': Common.formatDateTime(new Date()),
      'Record Id': recordIdValue,
      'Lookup field name': idField.nameId,
      'Lookup reference field name': idField.fullName__r,
      'sObject name': idField.scriptObject?.name ?? this.sObjectName,
      'Parent SObject name': parentObject?.name ?? '',
      'Parent ExternalId field name': parentObject?.externalId ?? '',
      'Missing parent External Id value':
        this._getRecordFieldValue(source, idField.fullName__r) ??
        this._getRecordFieldValue(source, idField.nameId) ??
        '',
    };
  }

  /**
   * Maps record field names to target field names.
   *
   * @param records - Records to map.
   * @returns Mapped records.
   */
  private _mapRecordsToTarget(records: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    if (!this.scriptObject.useFieldMapping) {
      return records;
    }
    return records.map((record) => {
      const mapped: Record<string, unknown> = {};
      Object.entries(record).forEach(([fieldName, value]) => {
        if (
          fieldName === __ID_FIELD_NAME ||
          fieldName === __SOURCE_ID_FIELD_NAME ||
          fieldName === __IS_PROCESSED_FIELD_NAME
        ) {
          mapped[fieldName] = value;
          return;
        }
        mapped[this.scriptObject.mapFieldNameToTarget(fieldName)] = value;
      });
      return mapped;
    });
  }

  /**
   * Determines which fields should be used for record comparisons.
   *
   * @returns Field names to compare.
   */
  private _resolveFieldsToCompare(): string[] {
    void this;
    return [];
  }

  /**
   * Resolves fields to remove from insert/update payloads.
   *
   * @param processedData - Processed data container.
   * @param fieldsToCompareRecords - Fields to compare.
   * @returns Fields to remove configuration.
   */
  private _resolveFieldsToRemove(
    processedData: ProcessedData,
    fieldsToCompareRecords: string[]
  ): ProcessedFieldsToRemoveType {
    const explicitQueryFields = this._resolveExplicitQueryFieldSet();
    const insertExclusionReasons = new Map<string, Set<string>>();
    const updateExclusionReasons = new Map<string, Set<string>>();
    const addReason = (target: Map<string, Set<string>>, fieldName: string, reason: string): void => {
      if (!fieldName || !reason) {
        return;
      }
      const reasons = target.get(fieldName) ?? new Set<string>();
      reasons.add(reason);
      target.set(fieldName, reasons);
    };
    const notCreatableSourceFields = processedData.fields.filter(
      (field) => field.isDescribed && !field.creatable && field.nameId !== 'Id'
    );
    const notUpdateableSourceFields = processedData.fields.filter(
      (field) => field.isDescribed && !field.updateable && field.nameId !== 'Id'
    );

    this._warnFieldCapabilityByOperation(OPERATION.Insert, 'createable', notCreatableSourceFields, explicitQueryFields);
    this._warnFieldCapabilityByOperation(
      OPERATION.Update,
      'updateable',
      notUpdateableSourceFields,
      explicitQueryFields
    );

    const mappedFieldsToUpdate = processedData.fields
      .map((field) => this.scriptObject.mapFieldNameToTarget(field.nameId ?? field.name))
      .filter((fieldName) => fieldName.length > 0);

    const compareOnlyFields = fieldsToCompareRecords.filter((fieldName) => !mappedFieldsToUpdate.includes(fieldName));
    compareOnlyFields.forEach((fieldName) => {
      addReason(
        insertExclusionReasons,
        fieldName,
        'field is used only for comparison and excluded from Insert payload'
      );
      addReason(
        updateExclusionReasons,
        fieldName,
        'field is used only for comparison and excluded from Update payload'
      );
    });

    const notCreatableFields = notCreatableSourceFields.map((field) => {
      const sourceFieldName = field.nameId ?? field.name;
      const targetFieldName = this.scriptObject.mapFieldNameToTarget(sourceFieldName);
      addReason(insertExclusionReasons, targetFieldName, 'field is not createable for Insert operation');
      if (targetFieldName.toLowerCase() !== sourceFieldName.toLowerCase()) {
        addReason(insertExclusionReasons, targetFieldName, `mapped from source field ${sourceFieldName}`);
      }
      return targetFieldName;
    });

    const notUpdateableFields = notUpdateableSourceFields.map((field) => {
      const sourceFieldName = field.nameId ?? field.name;
      const targetFieldName = this.scriptObject.mapFieldNameToTarget(sourceFieldName);
      addReason(updateExclusionReasons, targetFieldName, 'field is not updateable for Update operation');
      if (targetFieldName.toLowerCase() !== sourceFieldName.toLowerCase()) {
        addReason(updateExclusionReasons, targetFieldName, `mapped from source field ${sourceFieldName}`);
      }
      return targetFieldName;
    });

    const notInsertableFields = Common.distinctStringArray(compareOnlyFields.concat(notCreatableFields));
    this._logDmlFieldExclusionsDiagnostic(OPERATION.Insert, insertExclusionReasons);
    this._logDmlFieldExclusionsDiagnostic(OPERATION.Update, updateExclusionReasons);

    return {
      notInsertableFields,
      notUpdateableFields: Common.distinctStringArray(notUpdateableFields.concat(compareOnlyFields)),
    };
  }

  /**
   * Resolves explicitly listed query fields from the original user query.
   *
   * @returns Lower-cased explicit query field names.
   */
  private _resolveExplicitQueryFieldSet(): Set<string> {
    const explicit = new Set<string>();
    const originalFields = this.scriptObject.originalFieldsInQuery;
    if (originalFields.length === 0) {
      return explicit;
    }

    originalFields.forEach((fieldName) => {
      const normalized = Common.getFieldFromComplexField(String(fieldName ?? '')).trim();
      if (!normalized || Common.isComplexOr__rField(normalized)) {
        return;
      }
      explicit.add(normalized.toLowerCase());
    });

    return explicit;
  }

  /**
   * Emits operation-aware warnings for fields explicitly listed in query but not writable.
   *
   * @param operationToValidate - Insert or Update operation context.
   * @param capabilityName - Capability token for the warning text.
   * @param fields - Candidate fields that fail capability checks.
   * @param explicitQueryFields - Explicit query field set.
   */
  private _warnFieldCapabilityByOperation(
    operationToValidate: OPERATION,
    capabilityName: 'createable' | 'updateable',
    fields: SFieldDescribe[],
    explicitQueryFields: Set<string>
  ): void {
    if (explicitQueryFields.size === 0 || fields.length === 0) {
      return;
    }

    const currentOperation = this.scriptObject.operation;
    const shouldWarn =
      (operationToValidate === OPERATION.Insert &&
        (currentOperation === OPERATION.Insert || currentOperation === OPERATION.Upsert)) ||
      (operationToValidate === OPERATION.Update &&
        (currentOperation === OPERATION.Update || currentOperation === OPERATION.Upsert));
    if (!shouldWarn) {
      return;
    }

    const logger = this._getLogger();
    const operationLabel = ScriptObject.getStrOperation(operationToValidate);
    fields.forEach((field) => {
      const sourceFieldName = (field.nameId || field.name || '').trim();
      if (!sourceFieldName) {
        return;
      }
      if (!explicitQueryFields.has(sourceFieldName.toLowerCase())) {
        return;
      }

      const warningKey = `${operationLabel}:${capabilityName}:${sourceFieldName.toLowerCase()}`;
      if (this._warnedFieldCapabilityKeys.has(warningKey)) {
        return;
      }
      this._warnedFieldCapabilityKeys.add(warningKey);
      logger.warn(
        'queryFieldNotWritableForOperationExcluded',
        this.sObjectName,
        sourceFieldName,
        capabilityName,
        operationLabel
      );
    });
  }

  /**
   * Writes detailed diagnostic lines for DML field exclusions.
   *
   * @param operationToValidate - Operation that excludes the field.
   * @param reasonsByField - Field to reason list map.
   */
  private _logDmlFieldExclusionsDiagnostic(
    operationToValidate: OPERATION,
    reasonsByField: Map<string, Set<string>>
  ): void {
    if (reasonsByField.size === 0) {
      return;
    }
    const currentOperation = this.scriptObject.operation;
    const shouldLog =
      (operationToValidate === OPERATION.Insert &&
        (currentOperation === OPERATION.Insert || currentOperation === OPERATION.Upsert)) ||
      (operationToValidate === OPERATION.Update &&
        (currentOperation === OPERATION.Update || currentOperation === OPERATION.Upsert));
    if (!shouldLog) {
      return;
    }

    const logger = this._getLogger();
    const operationLabel = ScriptObject.getStrOperation(operationToValidate);
    reasonsByField.forEach((reasons, fieldName) => {
      if (!fieldName || reasons.size === 0) {
        return;
      }
      logger.verboseFile(
        `[diagnostic] DML field excluded: object=${
          this.sObjectName
        } operation=${operationLabel} field=${fieldName} reasons=${[...reasons].join(' | ')}`
      );
    });
  }

  /**
   * Populates processed records lists for inserts and updates.
   *
   * @param processedData - Processed data container.
   * @param updateMode - Update pass mode.
   * @param fieldsToCompareRecords - Fields to compare.
   * @param fieldsToRemove - Fields to remove for insert/update.
   */
  private _populateProcessedRecords(
    processedData: ProcessedData,
    updateMode: UpdateModeType,
    fieldsToCompareRecords: string[],
    fieldsToRemove: ProcessedFieldsToRemoveType
  ): void {
    // eslint-disable-next-line no-param-reassign
    processedData.recordsToInsert = [];
    // eslint-disable-next-line no-param-reassign
    processedData.recordsToUpdate = [];

    const doNotDeleteIdFieldOnInsert = this.scriptObject.idFieldIsMapped;
    const { notInsertableFields, notUpdateableFields } = fieldsToRemove;
    processedData.clonedToSourceMap.forEach((sourceRecord, clonedRecord) => {
      this._classifyProcessedRecord(
        sourceRecord,
        clonedRecord,
        processedData,
        updateMode,
        fieldsToCompareRecords,
        notInsertableFields,
        notUpdateableFields,
        doNotDeleteIdFieldOnInsert
      );
    });
  }

  /**
   * Classifies a source/cloned record pair into insert/update/no-op buckets.
   *
   * @param sourceRecord - Original source record.
   * @param clonedRecord - Cloned and transformed source record.
   * @param processedData - Processed data container.
   * @param updateMode - Current update mode.
   * @param fieldsToCompareRecords - Fields used for comparison.
   * @param notInsertableFields - Fields removed on insert.
   * @param notUpdateableFields - Fields removed on update.
   * @param doNotDeleteIdFieldOnInsert - True when Id must be preserved on insert.
   */
  private _classifyProcessedRecord(
    sourceRecord: Record<string, unknown>,
    clonedRecord: Record<string, unknown>,
    processedData: ProcessedData,
    updateMode: UpdateModeType,
    fieldsToCompareRecords: string[],
    notInsertableFields: string[],
    notUpdateableFields: string[],
    doNotDeleteIdFieldOnInsert: boolean
  ): void {
    const mutableSourceRecord = sourceRecord;
    const mutableClonedRecord = clonedRecord;
    mutableSourceRecord[__IS_PROCESSED_FIELD_NAME] =
      typeof mutableSourceRecord[__IS_PROCESSED_FIELD_NAME] === 'undefined'
        ? false
        : mutableSourceRecord[__IS_PROCESSED_FIELD_NAME];
    mutableClonedRecord[__SOURCE_ID_FIELD_NAME] =
      mutableSourceRecord['Id'] ?? mutableSourceRecord[__ID_FIELD_NAME] ?? '';
    delete mutableClonedRecord[__ID_FIELD_NAME];

    const targetRecord = this.sourceToTargetRecordMap.get(mutableSourceRecord);
    if (targetRecord && this.scriptObject.skipExistingRecords) {
      mutableSourceRecord[__IS_PROCESSED_FIELD_NAME] = true;
      return;
    }

    const shouldCompare = this.scriptObject.skipRecordsComparison
      ? true
      : this._compareRecords(targetRecord, clonedRecord, fieldsToCompareRecords);

    if (updateMode === 'backwards') {
      this._classifyBackwardsRecord(
        mutableSourceRecord,
        mutableClonedRecord,
        processedData,
        targetRecord,
        shouldCompare,
        notUpdateableFields
      );
      return;
    }

    this._classifyForwardsRecord(
      mutableSourceRecord,
      mutableClonedRecord,
      processedData,
      targetRecord,
      shouldCompare,
      notInsertableFields,
      notUpdateableFields,
      doNotDeleteIdFieldOnInsert
    );
  }

  /**
   * Handles record classification in backwards mode.
   *
   * @param sourceRecord - Original source record.
   * @param clonedRecord - Cloned source record.
   * @param processedData - Processed data container.
   * @param targetRecord - Matched target record.
   * @param shouldCompare - True when record should be updated.
   * @param notUpdateableFields - Fields removed on update.
   */
  private _classifyBackwardsRecord(
    sourceRecord: Record<string, unknown>,
    clonedRecord: Record<string, unknown>,
    processedData: ProcessedData,
    targetRecord: Record<string, unknown> | undefined,
    shouldCompare: boolean,
    notUpdateableFields: string[]
  ): void {
    const mutableSourceRecord = sourceRecord;
    const mutableClonedRecord = clonedRecord;
    if (!targetRecord || !shouldCompare) {
      return;
    }
    mutableClonedRecord.Id = targetRecord['Id'];
    this._removeRecordFields(mutableClonedRecord, notUpdateableFields);
    processedData.recordsToUpdate.push(mutableClonedRecord);
    mutableSourceRecord[__IS_PROCESSED_FIELD_NAME] = true;
  }

  /**
   * Handles record classification in forwards mode.
   *
   * @param sourceRecord - Original source record.
   * @param clonedRecord - Cloned source record.
   * @param processedData - Processed data container.
   * @param targetRecord - Matched target record.
   * @param shouldCompare - True when record should be compared/updated.
   * @param notInsertableFields - Fields removed on insert.
   * @param notUpdateableFields - Fields removed on update.
   * @param doNotDeleteIdFieldOnInsert - True when Id should be preserved.
   */
  private _classifyForwardsRecord(
    sourceRecord: Record<string, unknown>,
    clonedRecord: Record<string, unknown>,
    processedData: ProcessedData,
    targetRecord: Record<string, unknown> | undefined,
    shouldCompare: boolean,
    notInsertableFields: string[],
    notUpdateableFields: string[],
    doNotDeleteIdFieldOnInsert: boolean
  ): void {
    const mutableSourceRecord = sourceRecord;
    const mutableClonedRecord = clonedRecord;

    const canInsert =
      this.scriptObject.operation === OPERATION.Upsert || this.scriptObject.operation === OPERATION.Insert;
    if (!targetRecord && canInsert) {
      if (!doNotDeleteIdFieldOnInsert) {
        delete mutableClonedRecord.Id;
      }
      this._removeRecordFields(mutableClonedRecord, notInsertableFields);
      processedData.recordsToInsert.push(mutableClonedRecord);
      mutableSourceRecord[__IS_PROCESSED_FIELD_NAME] = true;
      return;
    }

    const canUpdate =
      this.scriptObject.operation === OPERATION.Upsert || this.scriptObject.operation === OPERATION.Update;
    if (!targetRecord || !canUpdate || !shouldCompare) {
      return;
    }
    mutableClonedRecord.Id = targetRecord['Id'];
    this._removeRecordFields(mutableClonedRecord, notUpdateableFields);
    processedData.recordsToUpdate.push(mutableClonedRecord);
    mutableSourceRecord[__IS_PROCESSED_FIELD_NAME] = true;
  }

  /**
   * Deletes records from the source org when delete-from-source is enabled.
   *
   * @returns Number of deleted records.
   */
  private async _deleteSourceRecordsAsync(): Promise<number> {
    const logger = this._getLogger();
    if (!this.sourceData.org || !this.sourceData.org.isOrgMedia) {
      logger.log('nothingToDelete', this.sObjectName);
      return 0;
    }

    logger.log('deletingSourceSObjectRecords', this.sObjectName);
    logger.verboseFile(
      `[diagnostic] deleteSource executing: object=${this.sObjectName} count=${
        this.sourceData.records.length
      } hardDelete=${String(this.scriptObject.hardDelete)}`
    );

    const recordsToDelete = this.sourceData.records
      .map((record) => this._getRecordIdValue(record))
      .filter((recordId) => recordId.length > 0)
      .map((recordId) => ({ Id: recordId }));

    if (recordsToDelete.length === 0) {
      logger.log('nothingToDelete', this.sObjectName);
      return 0;
    }

    logger.log('amountOfRecordsToDelete', this.sObjectName, String(recordsToDelete.length));
    await this._executeCrudAsync(
      this.sourceData.org,
      this.sObjectName,
      this.scriptObject.hardDelete ? OPERATION.HardDelete : OPERATION.Delete,
      recordsToDelete,
      false
    );

    logger.log('deletingRecordsCompleted', this.sObjectName);
    logger.verboseFile('[diagnostic] deleteSource completed');
    return recordsToDelete.length;
  }

  /**
   * Executes target CRUD operations and handles CSV output.
   *
   * @param operation - CRUD operation.
   * @param records - Records to process.
   * @param fileSuffix - Optional suffix for target CSV filename.
   * @returns Processed records.
   */
  private async _executeTargetRecordsAsync(
    operation: OPERATION,
    records: Array<Record<string, unknown>>,
    fileSuffix: string
  ): Promise<Array<Record<string, unknown>>> {
    if (records.length === 0) {
      return [];
    }

    if (!this.targetData.org || !this.targetData.org.isOrgMedia || this.job.script.simulationMode) {
      this._getLogger().verboseFile(
        `[diagnostic] skip DML: object=${this.targetObjectName} operation=${ScriptObject.getStrOperation(
          operation
        )} targetIsOrg=${String(this.targetData.org?.isOrgMedia ?? false)} simulationMode=${String(
          this.job.script.simulationMode
        )}`
      );
      this._ensureRecordIds(records, operation);
      await this._writeTargetCsvAsync(records, operation, fileSuffix);
      return records;
    }

    this._stripInternalFieldsForDml(records);
    const processed = await this._executeCrudAsync(
      this.targetData.org,
      this.targetObjectName,
      operation,
      records,
      operation === OPERATION.Insert
    );
    await this._writeTargetCsvAsync(processed, operation, fileSuffix);
    return processed;
  }

  /**
   * Removes internal bookkeeping fields from DML payloads.
   *
   * @param records - Records to sanitize before DML.
   */
  private _stripInternalFieldsForDml(records: Array<Record<string, unknown>>): void {
    const fieldsToRemove = [__ID_FIELD_NAME, __SOURCE_ID_FIELD_NAME, __IS_PROCESSED_FIELD_NAME];
    records.forEach((record) => {
      // Avoid passing internal markers to Salesforce APIs.
      this._removeRecordFields(record, fieldsToRemove);
    });
  }

  /**
   * Writes records to the target CSV file when configured.
   *
   * @param records - Records to write.
   * @param operation - Operation type.
   * @param fileSuffix - Optional filename suffix.
   */
  private async _writeTargetCsvAsync(
    records: Array<Record<string, unknown>>,
    operation: OPERATION,
    fileSuffix: string
  ): Promise<void> {
    const script = this.job.script;
    if (!script.createTargetCSVFiles) {
      return;
    }
    const targetIsFile = script.targetOrg?.isFileMedia ?? false;
    const targetFilenames: string[] = [];

    if (targetIsFile) {
      targetFilenames.push(this._getTargetCsvFilenameForFile(fileSuffix));
      targetFilenames.push(this._getTargetCsvFilenameForOrg(operation, fileSuffix));
    } else {
      targetFilenames.push(this._getTargetCsvFilenameForOrg(operation, fileSuffix));
    }

    const uniqueTargets = targetFilenames
      .filter((value): value is string => Boolean(value))
      .filter((value, index, array) => array.indexOf(value) === index);
    if (uniqueTargets.length === 0) {
      return;
    }

    const sanitizedRecords = this._sanitizeTargetCsvRecords(records);
    const columns = this._getTargetCsvColumns(sanitizedRecords);
    const fieldNames = columns.length > 0 ? columns : Object.keys(sanitizedRecords[0] ?? {});

    await Common.serialExecAsync(
      uniqueTargets.map((targetFilename) => async () => {
        await mkdir(path.dirname(targetFilename), { recursive: true });
        this._getLogger().verboseFile('writingToFile', this.sObjectName, targetFilename);
        this._getLogger().verboseFile(
          `[diagnostic] target CSV: file=${targetFilename} records=${records.length} fields=${fieldNames.length}`
        );
        await Common.writeCsvFileAsync(targetFilename, sanitizedRecords, true, fieldNames, true, true);
        return undefined;
      })
    );
  }

  /**
   * Resolves the value used by the `ids` mock pattern.
   * Uses the source `Id` when available and falls back to the internal `___Id`.
   *
   * @param record - Source record in the current processing pipeline.
   * @returns Resolved id value or empty string.
   */
  private _resolveMockIdsValue(record: Record<string, unknown>): string {
    void this;
    const rawValue = record['Id'] ?? record[__ID_FIELD_NAME];
    if (rawValue === null || typeof rawValue === 'undefined') {
      return '';
    }
    return String(rawValue);
  }

  /**
   * Removes internal fields from target CSV payloads.
   *
   * @param records - Records to sanitize.
   * @returns Sanitized records.
   */
  private _sanitizeTargetCsvRecords(records: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const fieldsToRemove = [__ID_FIELD_NAME, __IS_PROCESSED_FIELD_NAME];
    const fieldsToMask: string[] = [];
    const includeOldIdColumn = records.some((record) =>
      Object.prototype.hasOwnProperty.call(record, __SOURCE_ID_FIELD_NAME)
    );
    return records.map((record) => {
      const sanitized = { ...record };
      const oldIdValue = sanitized[__SOURCE_ID_FIELD_NAME];
      this._removeRecordFields(sanitized, fieldsToRemove);
      if (Object.prototype.hasOwnProperty.call(sanitized, __SOURCE_ID_FIELD_NAME)) {
        delete sanitized[__SOURCE_ID_FIELD_NAME];
      }
      if (includeOldIdColumn) {
        sanitized[TARGET_CSV_OLD_ID_FIELD_NAME] =
          oldIdValue === null || typeof oldIdValue === 'undefined' ? null : String(oldIdValue);
      }
      if (!Object.prototype.hasOwnProperty.call(sanitized, ERRORS_FIELD_NAME)) {
        sanitized[ERRORS_FIELD_NAME] = null;
      }
      fieldsToMask.forEach((fieldName) => {
        if (sanitized[fieldName]) {
          sanitized[fieldName] = `[${fieldName}]`;
        }
      });
      return sanitized;
    });
  }

  /**
   * Builds ordered columns for target CSV files.
   *
   * @param records - Records to inspect.
   * @returns Ordered column names.
   */
  private _getTargetCsvColumns(records: Array<Record<string, unknown>>): string[] {
    void this;
    if (records.length === 0) {
      return [];
    }
    const record = records[0];
    return Common.orderCsvColumnsWithIdFirstAndErrorsLast(Object.keys(record));
  }

  /**
   * Resolves target CSV filename for file targets.
   *
   * @param fileSuffix - Optional filename suffix.
   * @returns Target CSV filename.
   */
  private _getTargetCsvFilenameForFile(fileSuffix: string): string {
    const suffix = `${fileSuffix}${CSV_TARGET_FILE_SUFFIX}`;
    return Common.getCSVFilename(this.job.script.targetDirectoryPath, this.targetObjectName, suffix);
  }

  /**
   * Resolves target CSV filename for org targets.
   *
   * @param operation - Operation type.
   * @param fileSuffix - Optional filename suffix.
   * @returns Target CSV filename.
   */
  private _getTargetCsvFilenameForOrg(operation: OPERATION, fileSuffix: string): string {
    const operationName = ScriptObject.getStrOperation(operation).toLowerCase();
    const suffix = `_${operationName}${fileSuffix}${CSV_TARGET_FILE_SUFFIX}`;
    return Common.getCSVFilename(this.job.script.targetDirectoryPath, this.targetObjectName, suffix);
  }

  /**
   * Registers inserted target records into maps.
   *
   * @param processedData - Processed data container.
   * @param insertedRecords - Inserted target records.
   */
  private _registerInsertedTargetRecords(
    processedData: ProcessedData,
    insertedRecords: Array<Record<string, unknown>>
  ): void {
    const recordsWithTargetId = insertedRecords.filter((record) => this._getRecordIdValue(record).length > 0);
    if (recordsWithTargetId.length === 0) {
      return;
    }

    this.registerRecords(recordsWithTargetId, this.targetData, true);
    recordsWithTargetId.forEach((target) => {
      const source = processedData.clonedToSourceMap.get(target);
      if (!source) {
        return;
      }
      this.sourceToTargetRecordMap.set(source, target);
      processedData.insertedRecordsSourceToTargetMap.set(source, target);
    });
  }

  /**
   * Registers updated target records into maps when missing.
   *
   * @param processedData - Processed data container.
   * @param updatedRecords - Updated target records.
   */
  private _registerUpdatedTargetRecords(
    processedData: ProcessedData,
    updatedRecords: Array<Record<string, unknown>>
  ): void {
    updatedRecords.forEach((target) => {
      const source = processedData.clonedToSourceMap.get(target);
      if (!source) {
        return;
      }
      if (!this.sourceToTargetRecordMap.has(source)) {
        this.sourceToTargetRecordMap.set(source, target);
      }
    });
  }

  /**
   * Ensures Ids are assigned for insert operations in simulation mode.
   *
   * @param records - Records to inspect.
   * @param operation - Operation type.
   */
  private _ensureRecordIds(records: Array<Record<string, unknown>>, operation: OPERATION): void {
    void this;
    if (operation !== OPERATION.Insert) {
      return;
    }
    records.forEach((record) => {
      if (!record['Id']) {
        // eslint-disable-next-line no-param-reassign
        record['Id'] = Common.makeId(18);
      }
    });
  }

  /**
   * Executes CRUD operations using a jsforce connection.
   *
   * @param org - Org definition.
   * @param sObjectName - Object name.
   * @param operation - Operation type.
   * @param records - Records to process.
   * @param updateRecordId - True to overwrite Ids from results.
   * @returns Processed records.
   */
  private async _executeCrudAsync(
    org: ScriptOrg,
    sObjectName: string,
    operation: OPERATION,
    records: Array<Record<string, unknown>>,
    updateRecordId: boolean
  ): Promise<Array<Record<string, unknown>>> {
    if (records.length === 0) {
      return [];
    }

    const connection = await this._getConnectionAsync(org);
    const engine = ApiEngineFactory.createEngine({
      connection,
      sObjectName,
      amountToProcess: records.length,
      bulkThreshold: this.job.script.bulkThreshold,
      alwaysUseRest: this.job.script.alwaysUseRestApiToUpdateRecords,
      forceBulk: operation === OPERATION.HardDelete,
      bulkApiVersion: this.job.script.bulkApiVersion,
    });
    const apiVersion = this._resolveApiVersion(connection);
    const isFinalDmlAttempt = this._isFinalDmlAttempt(operation);

    this._getLogger().log(
      'usingApiForDml',
      sObjectName,
      engine.getEngineName(),
      apiVersion,
      ScriptObject.getStrOperation(operation)
    );

    this._getLogger().verboseFile(
      `[diagnostic] DML start: object=${sObjectName} operation=${ScriptObject.getStrOperation(
        operation
      )} engine=${engine.getEngineName()} apiVersion=${apiVersion} count=${records.length} allOrNone=${String(
        this.job.script.allOrNone
      )} updateRecordId=${String(updateRecordId)} finalAttempt=${String(isFinalDmlAttempt)}`
    );

    const executor = new ApiEngineExecutor({
      engine,
      operation,
      records,
      updateRecordId,
      logger: this._getLogger(),
      script: this.job.script,
      scriptObject: this.scriptObject,
      isFinalDmlAttempt,
    });
    let processed: Array<Record<string, unknown>>;
    try {
      processed = await executor.executeCrudAsync();
    } catch (error) {
      if (!this._shouldFallbackHardDeleteToRest(operation, engine.getIsRestApiEngine(), error)) {
        throw error;
      }

      const restEngine = ApiEngineFactory.createEngine({
        connection,
        sObjectName,
        amountToProcess: records.length,
        bulkThreshold: this.job.script.bulkThreshold,
        alwaysUseRest: true,
        forceBulk: false,
        bulkApiVersion: this.job.script.bulkApiVersion,
      });

      this._getLogger().warn(
        'apiOperationFailedWithMessage',
        sObjectName,
        ScriptObject.getStrOperation(operation),
        'HardDelete via Bulk API is not enabled for this user. Falling back to REST API.'
      );
      this._getLogger().log(
        'usingApiForDml',
        sObjectName,
        restEngine.getEngineName(),
        apiVersion,
        ScriptObject.getStrOperation(operation)
      );
      this._getLogger().verboseFile(
        `[diagnostic] DML fallback: object=${sObjectName} operation=${ScriptObject.getStrOperation(
          operation
        )} engine=${restEngine.getEngineName()} apiVersion=${apiVersion} count=${records.length}`
      );

      const restExecutor = new ApiEngineExecutor({
        engine: restEngine,
        operation,
        records,
        updateRecordId,
        logger: this._getLogger(),
        script: this.job.script,
        scriptObject: this.scriptObject,
        isFinalDmlAttempt,
      });
      processed = await restExecutor.executeCrudAsync();
    }

    this._getLogger().verboseFile(
      `[diagnostic] DML complete: object=${sObjectName} operation=${ScriptObject.getStrOperation(
        operation
      )} engine=${engine.getEngineName()} processed=${processed.length}`
    );

    return processed;
  }

  /**
   * Returns true when hard delete should retry via REST API.
   *
   * @param operation - Current operation.
   * @param isRestEngine - True when current engine is REST.
   * @param error - Execution error.
   * @returns True when fallback should be used.
   */
  private _shouldFallbackHardDeleteToRest(operation: OPERATION, isRestEngine: boolean, error: unknown): boolean {
    void this;
    if (operation !== OPERATION.HardDelete || isRestEngine) {
      return false;
    }

    const message = error instanceof Error ? error.message : String(error ?? '');
    return /FeatureNotEnabled/i.test(message) && /hardDelete/i.test(message);
  }

  /**
   * Resolves or caches a connection for the provided org.
   *
   * @param org - Org definition.
   * @returns Connection instance.
   */
  private async _getConnectionAsync(org: ScriptOrg): Promise<Connection> {
    const orgName = org.name ?? '';
    if (!orgName) {
      throw new CommandExecutionError('Missing org name for connection.');
    }
    const cacheKey = `${orgName}:${this.job.script.apiVersion ?? ''}`;
    const cached = this._connectionCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const connection = await org.getConnectionAsync();
    this._connectionCache.set(cacheKey, connection);
    return connection;
  }

  /**
   * Resolves the API version used by the provided connection.
   *
   * @param connection - Org connection.
   * @returns API version string.
   */
  private _resolveApiVersion(connection: Connection): string {
    const apiVersion = (connection as ConnectionWithApiVersionType).getApiVersion?.();
    return apiVersion?.trim() ? apiVersion : this.job.script.apiVersion;
  }

  /**
   * Removes fields from a record by name.
   *
   * @param record - Record to update.
   * @param fieldsToRemove - Field names to remove.
   */
  private _removeRecordFields(record: Record<string, unknown>, fieldsToRemove: string[]): void {
    void this;
    fieldsToRemove.forEach((fieldName) => {
      if (Object.prototype.hasOwnProperty.call(record, fieldName)) {
        // eslint-disable-next-line no-param-reassign
        delete record[fieldName];
      }
    });
  }

  /**
   * Compares target and source records for changes.
   *
   * @param target - Target record.
   * @param cloned - Mapped source record.
   * @param fieldsToCompareRecords - Fields to compare.
   * @returns True when records differ.
   */
  private _compareRecords(
    target: Record<string, unknown> | undefined,
    cloned: Record<string, unknown>,
    fieldsToCompareRecords: string[]
  ): boolean {
    const hasTarget = Boolean(target);
    const hasCloned = Boolean(cloned);
    if ((hasTarget && !hasCloned) || (!hasTarget && hasCloned) || this.scriptObject.idFieldIsMapped) {
      return true;
    }

    return (
      Object.keys(cloned)
        .filter(
          (key) =>
            key !== 'Id' &&
            key !== __ID_FIELD_NAME &&
            key !== __SOURCE_ID_FIELD_NAME &&
            (fieldsToCompareRecords.length === 0 || fieldsToCompareRecords.includes(key))
        )
        // eslint-disable-next-line eqeqeq
        .some((key) => target?.[key] != cloned[key])
    );
  }

  /**
   * Resolves the internal record id used for bookkeeping.
   *
   * @param record - Record to inspect.
   * @returns Internal record id.
   */
  private _getInternalRecordId(record: Record<string, unknown>): string {
    void this;
    const rawValue = record[__ID_FIELD_NAME] ?? record.Id;
    if (rawValue === null || typeof rawValue === 'undefined') {
      return '';
    }
    return String(rawValue);
  }

  /**
   * Builds add-on invocation context metadata for the current update pass.
   *
   * @returns Add-on context override payload.
   */
  private _getAddonInvocationContext(): {
    passNumber: number;
    isFirstPass: boolean;
    objectSetIndex: number;
  } {
    return {
      passNumber: Math.max(0, this._updatePassNumber),
      isFirstPass: this._updatePassNumber <= 0,
      objectSetIndex: this.job.script.objectSetIndex,
    };
  }

  /**
   * Determines whether the current DML execution is the final retry attempt.
   *
   * @param operation - CRUD operation being executed.
   * @returns True when warning-level completion logs should be emitted immediately.
   */
  private _isFinalDmlAttempt(operation: OPERATION): boolean {
    if (
      operation === OPERATION.Delete ||
      operation === OPERATION.DeleteHierarchy ||
      operation === OPERATION.DeleteSource ||
      operation === OPERATION.HardDelete
    ) {
      if (
        this.scriptObject.operation === OPERATION.Delete ||
        this.scriptObject.operation === OPERATION.DeleteHierarchy ||
        this.scriptObject.operation === OPERATION.DeleteSource ||
        this.scriptObject.operation === OPERATION.HardDelete
      ) {
        return true;
      }
      return false;
    }

    if (!(this.targetData.org?.isOrgMedia ?? false)) {
      return true;
    }

    if (this.updateMode !== 'SECOND_UPDATE') {
      return false;
    }

    return this._updatePassNumber >= 2;
  }

  /**
   * Returns the logger for task operations.
   *
   * @returns Logger instance.
   */
  private _getLogger(): LoggerType {
    return this.job.script.logger ?? Common.logger;
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
    this._getLogger().verboseFile(`{${objectName}.${fieldName}} ${message}`);
  }

  /**
   * Builds filtered IN-clause queries for the provided pass.
   *
   * @param queryMode - Pass mode for query planning.
   * @param reversed - True when using reversed pass logic.
   * @param fieldNames - Optional field list override.
   * @returns Query list.
   */
  private _createFilteredQueries(queryMode: QueryModeType, reversed: boolean, fieldNames?: string[]): string[] {
    const queries: string[] = [];
    const fieldsToQueryMap = new Map<SFieldDescribe, string[]>();
    const isSource = queryMode !== 'target';
    void fieldNames;
    const excludedObjects = OBJECTS_NOT_TO_USE_IN_FILTERED_QUERYIN_CLAUSE.map((name) => name.toLowerCase());
    const isExcludedFromInClause = excludedObjects.includes(this.sObjectName.toLowerCase());

    if (reversed) {
      if (!isExcludedFromInClause) {
        const fields = Common.flatMap(
          this.data.sFieldsInQuery.filter((field) => field.child__rSFields.length > 0),
          (field) => field.child__rSFields.map((childField) => childField.idSField)
        ).filter((field): field is SFieldDescribe => Boolean(field));
        let values: string[] = [];
        fields.forEach((field) => {
          const relatedTask = field?.scriptObject ? this.job.getTaskBySObjectName(field.scriptObject.name) : undefined;
          const records = relatedTask?.sourceData.records ?? [];
          records.forEach((record) => {
            const rawValue = record[field.nameId];
            if (rawValue === null || typeof rawValue === 'undefined') {
              return;
            }
            const value = String(rawValue);
            if (value.length > 0) {
              values.push(value);
            }
          });
        });
        values = Common.distinctStringArray(values);
        if (values.length > 0) {
          fieldsToQueryMap.set(new SFieldDescribe({ name: 'Id', objectName: this.sObjectName }), values);
        }
      }
    } else {
      this.data.sFieldsInQuery.forEach((field) => {
        if (isSource) {
          if (
            field.isSimpleReference &&
            field.parentLookupObject &&
            !excludedObjects.includes(field.referencedObjectType.toLowerCase())
          ) {
            const parentTask = this.job.getTaskBySObjectName(field.parentLookupObject.name);
            if (!parentTask) {
              return;
            }
            if (queryMode !== 'forwards') {
              if (this.data.prevTasks.includes(parentTask)) {
                fieldsToQueryMap.set(field, [...parentTask.sourceData.idRecordsMap.keys()]);
              }
            } else if (this.data.nextTasks.includes(parentTask)) {
              fieldsToQueryMap.set(field, [...parentTask.sourceData.idRecordsMap.keys()]);
            }
          }
        } else if (field.isSimpleNotLookup && field.isExternalIdField) {
          fieldsToQueryMap.set(field, [...this.sourceData.extIdToRecordIdMap.keys()]);
        }
      });
    }

    const baseQuery = this.createQuery(undefined, false, undefined, false, !isSource);
    if (!baseQuery) {
      return [];
    }

    fieldsToQueryMap.forEach((inValues, field) => {
      const cache = this._ensureFilteredQueryValueCache(field.name);
      const filteredValues = inValues
        .map((value) => String(value))
        .filter((value) => value.length > 0 && !cache.has(value));
      if (filteredValues.length === 0) {
        return;
      }
      filteredValues.forEach((value) => cache.add(value));

      const fieldName = isSource ? field.name : field.targetName;
      Common.logDiagnostics(
        `Query planning (${queryMode}) for ${this.sObjectName}: field=${fieldName} values=${filteredValues.length}.`
      );
      const queriesForField = this._buildFilteredQueryStrings(baseQuery, fieldName, filteredValues);
      queries.push(...queriesForField);
    });

    Common.logDiagnostics(
      `Query planning (${queryMode}) for ${this.sObjectName}: generated ${queries.length} queries (reversed=${String(
        reversed
      )}).`
    );
    return queries;
  }

  /**
   * Returns the base query string from preflight output.
   *
   * @param isTargetQuery - True when building a target query.
   * @returns Base query string.
   */
  private _getBaseQuery(isTargetQuery: boolean): string {
    const baseQuery = isTargetQuery
      ? this.scriptObject.targetQuery || this.scriptObject.query
      : this.scriptObject.query;
    return baseQuery?.trim() ?? '';
  }

  /**
   * Applies legacy target-side query filtering rules.
   *
   * @param query - Target query string.
   * @returns Filtered target query string.
   */
  private _applyTargetQueryFilters(query: string): string {
    if (!query) {
      return '';
    }
    if (this.scriptObject.isHierarchicalDeleteOperation) {
      const withoutWhere = this._removeQueryWhereClause(query);
      return this._stripQueryLimits(withoutWhere);
    }
    if (this.scriptObject.queryAllTarget) {
      const withoutWhere = this._removeQueryWhereClause(query);
      return this._stripQueryLimits(withoutWhere);
    }
    return this._removeIsDeletedConditions(query);
  }

  /**
   * Removes the WHERE clause from a SOQL query while preserving GROUP/HAVING.
   *
   * @param query - Query string.
   * @returns Query without WHERE clause.
   */
  private _removeQueryWhereClause(query: string): string {
    const parts = this._splitQueryParts(query);
    return this._composeQuery(parts.prefix, '', parts.suffix);
  }

  /**
   * Removes IsDeleted conditions from target WHERE clauses.
   *
   * @param query - Query string.
   * @returns Query without IsDeleted conditions.
   */
  private _removeIsDeletedConditions(query: string): string {
    const sanitized = this._sanitizeQueryForParser(query);
    try {
      const parsed = parseQuery(sanitized);
      if (!parsed) {
        return query;
      }
      parsed.where = this._removeIsDeletedFromWhere(parsed.where);
      const composed = composeQuery(parsed);
      return this._restoreQueryFromParser(composed);
    } catch {
      return query;
    }
  }

  /**
   * Removes IsDeleted conditions from parsed WHERE clauses recursively.
   *
   * @param where - Parsed WHERE clause.
   * @returns Updated WHERE clause.
   */
  private _removeIsDeletedFromWhere(where: WhereClause | undefined): WhereClause | undefined {
    if (!where) {
      return undefined;
    }
    const mutableWhere = where as unknown as {
      left?: { field?: string };
      right?: WhereClause;
      operator?: unknown;
    };
    const leftField = mutableWhere.left?.field?.toLowerCase();
    if (leftField === 'isdeleted') {
      return undefined;
    }
    if (mutableWhere.right) {
      mutableWhere.right = this._removeIsDeletedFromWhere(mutableWhere.right);
      if (!mutableWhere.right) {
        mutableWhere.operator = undefined;
      }
    }
    return where;
  }

  /**
   * Replaces polymorphic separators to keep SOQL parser compatibility.
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
   * Restores polymorphic separators after SOQL parsing.
   *
   * @param query - Sanitized query.
   * @returns Restored query.
   */
  private _restoreQueryFromParser(query: string): string {
    void this;
    if (!query || !query.includes(POLYMORPHIC_FIELD_PARSER_PLACEHOLDER)) {
      return query;
    }
    return query.replaceAll(POLYMORPHIC_FIELD_PARSER_PLACEHOLDER, REFERENCE_FIELD_OBJECT_SEPARATOR);
  }

  /**
   * Adds the source records filter to the query when configured.
   *
   * @param query - Query to update.
   * @returns Updated query string.
   */
  private _applySourceRecordsFilter(query: string): string {
    const filter = this.scriptObject.sourceRecordsFilter?.trim();
    if (!filter) {
      return query;
    }
    const updated = this._mergeWhereCondition(query, filter);
    Common.logDiagnostics(`Applied sourceRecordsFilter for ${this.sObjectName}: "${filter}".`);
    return updated;
  }

  /**
   * Removes LIMIT/OFFSET/ORDER BY clauses when configured.
   *
   * @param query - Query string to update.
   * @returns Updated query string.
   */
  private _stripQueryLimits(query: string): string {
    const parts = this._splitQueryParts(query);
    const suffix = parts.suffix;
    if (!suffix) {
      return query;
    }
    const orderMatch = suffix.search(/\bORDER\s+BY\b/i);
    const limitMatch = suffix.search(/\bLIMIT\b/i);
    const offsetMatch = suffix.search(/\bOFFSET\b/i);
    const cutCandidates = [orderMatch, limitMatch, offsetMatch].filter((index) => index >= 0);
    const cutIndex = cutCandidates.length > 0 ? Math.min(...cutCandidates) : -1;
    const trimmedSuffix = cutIndex >= 0 ? suffix.slice(0, cutIndex).trimEnd() : suffix;
    return this._composeQuery(parts.prefix, parts.whereClause, trimmedSuffix);
  }

  /**
   * Builds filtered query strings by injecting IN clauses into the base query.
   *
   * @param baseQuery - Base query string.
   * @param fieldName - Field name for the IN clause.
   * @param values - Values for the IN clause.
   * @returns Query strings.
   */
  private _buildFilteredQueryStrings(baseQuery: string, fieldName: string, values: string[]): string[] {
    if (!baseQuery) {
      return [];
    }
    const sanitizedValues = values
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => `'${this._escapeInValue(value)}'`);
    if (sanitizedValues.length === 0) {
      return [];
    }

    const queries: string[] = [];
    let currentValues: string[] = [];

    const pushQuery = (vals: string[]): void => {
      if (vals.length === 0) {
        return;
      }
      const condition = `${fieldName} IN (${vals.join(', ')})`;
      queries.push(this._mergeWhereCondition(baseQuery, condition));
    };

    sanitizedValues.forEach((value) => {
      const candidateValues = [...currentValues, value];
      const condition = `${fieldName} IN (${candidateValues.join(', ')})`;
      const candidateQuery = this._mergeWhereCondition(baseQuery, condition);
      if (candidateQuery.length > MAX_SOQL_WHERE_CLAUSE_CHARACTER_LENGTH && currentValues.length > 0) {
        pushQuery(currentValues);
        currentValues = [value];
      } else {
        currentValues = candidateValues;
      }
    });

    pushQuery(currentValues);
    return queries;
  }

  /**
   * Merges an additional condition into the query WHERE clause.
   *
   * @param query - Base query.
   * @param condition - Condition to append.
   * @returns Updated query string.
   */
  private _mergeWhereCondition(query: string, condition: string): string {
    if (!query) {
      return '';
    }
    const parts = this._splitQueryParts(query);
    const existing = parts.whereClause.trim();
    const combined = existing ? `((${existing}) AND ${condition})` : condition;
    return this._composeQuery(parts.prefix, combined, parts.suffix);
  }

  /**
   * Splits a query into prefix, WHERE clause, and suffix sections.
   *
   * @param query - Query string.
   * @returns Query parts.
   */
  private _splitQueryParts(query: string): { prefix: string; whereClause: string; suffix: string } {
    void this;
    const whereMatch = /\bWHERE\b/i.exec(query);
    const tailRegex = /\b(ORDER\s+BY|LIMIT|OFFSET|GROUP\s+BY|HAVING)\b/i;

    if (!whereMatch) {
      const tailMatch = tailRegex.exec(query);
      if (!tailMatch || typeof tailMatch.index !== 'number') {
        return { prefix: query, whereClause: '', suffix: '' };
      }
      const index = tailMatch.index;
      return { prefix: query.slice(0, index), whereClause: '', suffix: query.slice(index) };
    }

    const whereIndex = whereMatch.index;
    const afterWhereIndex = whereIndex + whereMatch[0].length;
    const tailMatch = tailRegex.exec(query.slice(afterWhereIndex));
    if (!tailMatch || typeof tailMatch.index !== 'number') {
      return {
        prefix: query.slice(0, whereIndex),
        whereClause: query.slice(afterWhereIndex),
        suffix: '',
      };
    }

    const tailIndex = afterWhereIndex + tailMatch.index;
    return {
      prefix: query.slice(0, whereIndex),
      whereClause: query.slice(afterWhereIndex, tailIndex),
      suffix: query.slice(tailIndex),
    };
  }

  /**
   * Composes the query from its parts.
   *
   * @param prefix - Query prefix (SELECT ... FROM ...).
   * @param whereClause - WHERE clause contents.
   * @param suffix - Trailing clauses (ORDER BY/LIMIT/etc).
   * @returns Composed query string.
   */
  private _composeQuery(prefix: string, whereClause: string, suffix: string): string {
    void this;
    const base = prefix.trimEnd();
    const tail = suffix ? ` ${suffix.trimStart()}` : '';
    if (!whereClause.trim()) {
      return `${base}${tail}`.trim();
    }
    return `${base} WHERE ${whereClause.trim()}${tail}`.trim();
  }

  /**
   * Escapes IN-clause values.
   *
   * @param value - Raw value.
   * @returns Escaped value.
   */
  private _escapeInValue(value: string): string {
    void this;
    return String(value).replace(/(['\\])/g, '\\$1');
  }

  /**
   * Ensures a filtered query cache exists for a field.
   *
   * @param fieldName - Field name key.
   * @returns Cache set.
   */
  private _ensureFilteredQueryValueCache(fieldName: string): Set<string> {
    const existing = this._filteredQueryValueCache.get(fieldName);
    if (existing) {
      return existing;
    }
    const created = new Set<string>();
    this._filteredQueryValueCache.set(fieldName, created);
    return created;
  }

  /**
   * Picks the correct lookup map for the provided field.
   *
   * @param field - Lookup field metadata.
   * @param userMap - User lookup map.
   * @param groupMap - Group lookup map.
   * @param defaultMap - Default lookup map for non-polymorphic fields.
   * @returns Lookup map for matching.
   */
  private _resolveLookupMap(
    field: SFieldDescribe,
    userMap: LookupIdMapType,
    groupMap: LookupIdMapType,
    defaultMap: LookupIdMapType
  ): LookupIdMapType {
    if (!field.isPolymorphicField) {
      return defaultMap;
    }

    const referenced = (field.polymorphicReferenceObjectType || field.referencedObjectType || '').toLowerCase();
    if (referenced === 'user') {
      return userMap;
    }
    if (referenced === 'group') {
      return groupMap;
    }

    return this.job.script.mergeLookupMaps(userMap, groupMap);
  }

  /**
   * Logs query start information using legacy templates.
   *
   * @param messageKey - Message key for query start.
   * @param sourceKey - Source/target key.
   * @param mediaKey - Media key (org/csvFile).
   * @param queryMode - Query mode for step label.
   */
  private _logQueryStart(
    messageKey: 'queryingAll' | 'queryingIn',
    sourceKey: 'source' | 'target',
    mediaKey: 'org' | 'csvFile',
    queryMode: QueryModeType
  ): void {
    const logger = this.job.script.logger ?? Common.logger;
    const stepLabel = this._getQueryStepLabel(queryMode);
    logger.log(
      messageKey,
      this.sObjectName,
      logger.getResourceString(sourceKey),
      logger.getResourceString(mediaKey),
      stepLabel
    );
  }

  /**
   * Logs the query string with legacy truncation rules.
   *
   * @param query - SOQL query string.
   */
  private _logQueryString(query: string): void {
    const logger = this.job.script.logger ?? Common.logger;
    const formattedQuery = this._formatQueryStringForLog(query);
    logger.log('queryString', this.sObjectName, formattedQuery);
    Common.logDiagnostics(logger.getResourceString('queryString', this.sObjectName, query), logger);
  }

  /**
   * Formats a query string for logging.
   *
   * @param query - SOQL query string.
   * @returns Truncated query string.
   */
  private _formatQueryStringForLog(query: string): string {
    if (!query) {
      return '';
    }
    if (this.job.script.logfullquery) {
      return query;
    }

    const fromIndex = query.search(/\bFROM\b/i);
    if (fromIndex < 0) {
      return this._truncateQuerySegment(query, LOG_QUERY_SELECT_MAXLENGTH, true);
    }

    const selectPart = query.slice(0, fromIndex).trim();
    const remainder = query.slice(fromIndex + 4).trim();
    const whereIndex = remainder.search(/\bWHERE\b/i);
    const selectLogged = this._truncateQuerySegment(selectPart, LOG_QUERY_SELECT_MAXLENGTH, true);

    if (whereIndex < 0) {
      const fromLogged = this._truncateQuerySegment(remainder, LOG_QUERY_WHERE_MAXLENGTH, true);
      return `${selectLogged} FROM ${fromLogged}`;
    }

    const fromPart = remainder.slice(0, whereIndex).trim();
    const wherePart = remainder.slice(whereIndex + 5).trim();
    const whereLogged = this._truncateQuerySegment(wherePart, LOG_QUERY_WHERE_MAXLENGTH, true);
    return `${selectLogged} FROM ${fromPart} WHERE ${whereLogged}`;
  }

  /**
   * Truncates a query segment when needed.
   *
   * @param segment - Segment text.
   * @param maxLength - Maximum length before truncation.
   * @param shouldTruncate - True when truncation is required.
   * @returns Truncated segment.
   */
  private _truncateQuerySegment(segment: string, maxLength: number, shouldTruncate: boolean): string {
    void this;
    if (!shouldTruncate) {
      return segment;
    }
    if (segment.length <= maxLength) {
      return segment;
    }
    return `${segment.slice(0, maxLength)}...`;
  }

  /**
   * Retrieves records for filtered queries.
   *
   * @param queries - Filtered SOQL queries.
   * @param org - Org to query.
   * @param options - Query options.
   * @returns Retrieved records.
   */
  private async _retrieveFilteredRecordsAsync(
    queries: string[],
    org: NonNullable<TaskOrgData['org']>,
    orgDataService: OrgDataService,
    options: { useBulk?: boolean; useQueryAll?: boolean }
  ): Promise<Array<Record<string, unknown>>> {
    let records: Array<Record<string, unknown>> = [];
    await Common.serialExecAsync(
      queries.map((query) => async () => {
        this._logQueryString(query);
        const batch = await orgDataService.queryOrgAsync(query, org, options);
        records = records.concat(batch);
        return undefined;
      })
    );
    return records;
  }

  /**
   * Retrieves self-referencing records for the source org when required.
   *
   * @param queryMode - Query mode.
   * @param orgDataService - Org data service instance.
   */
  private async _retrieveSelfReferenceRecordsAsync(
    queryMode: QueryModeType,
    orgDataService: OrgDataService
  ): Promise<void> {
    if (queryMode !== 'forwards') {
      return;
    }
    if (!this.sourceData.isOrgMedia || this.scriptObject.processAllSource) {
      return;
    }
    const sourceOrg = this.sourceData.org;
    if (!sourceOrg) {
      return;
    }
    const inValues: string[] = [];
    this.data.sFieldsInQuery.forEach((field) => {
      if (!field.isSimpleSelfReference) {
        return;
      }
      this.sourceData.records.forEach((record) => {
        const value = this._getRecordFieldValue(record, field.name);
        if (value) {
          inValues.push(value);
        }
      });
    });
    const distinctValues = Common.distinctStringArray(inValues);
    if (distinctValues.length === 0) {
      return;
    }
    const logger = this.job.script.logger ?? Common.logger;
    logger.log('queryingSelfReferenceRecords', this.sObjectName, logger.getResourceString('source'));
    const baseQuery = this.createQuery(undefined, false, undefined, false, false);
    const queries = this._buildFilteredQueryStrings(baseQuery, 'Id', distinctValues);
    if (queries.length === 0) {
      return;
    }
    this.sourceData.queryCount += queries.length;
    let records: Array<Record<string, unknown>> = [];
    await Common.serialExecAsync(
      queries.map((query) => async () => {
        this._logQueryString(query);
        const batch = await orgDataService.queryOrgAsync(query, sourceOrg, {
          useBulk: this.sourceData.useBulkQueryApi,
          useQueryAll: this.scriptObject.useQueryAll,
        });
        records = records.concat(batch);
        return undefined;
      })
    );
    this._finalizeRetrievedRecords(records, this.sourceData, 'source', false);
  }

  /**
   * Populates lookup maps for the provided records.
   *
   * @param records - Records to inspect.
   * @param orgData - Task org data to update.
   */
  private _populateLookupMaps(records: Array<Record<string, unknown>>, orgData: TaskOrgData): void {
    const lookupFields = this.data.sFieldsInQuery.filter(
      (field) => field.isSimpleReference && field.parentLookupObject
    );
    if (lookupFields.length === 0 || records.length === 0) {
      return;
    }
    lookupFields.forEach((field) => {
      const referenceFieldName = field.fullName__r || field.fullOriginalName__r || field.name__r;
      const lookupMap = orgData.ensureLookupMap(field.nameId);
      records.forEach((record) => {
        const lookupId = this._getRecordFieldValue(record, field.nameId);
        if (!lookupId) {
          return;
        }
        const lookupValue = this._getRecordExternalIdValue(record, referenceFieldName);
        if (!lookupValue) {
          return;
        }
        lookupMap.set(lookupValue, lookupId);
      });
    });
  }

  /**
   * Resolves the step label for a query mode.
   *
   * @param queryMode - Query mode.
   * @returns Step label.
   */
  private _getQueryStepLabel(queryMode: QueryModeType): string {
    const logger = this.job.script.logger ?? Common.logger;
    return queryMode === 'forwards' ? logger.getResourceString('step1') : logger.getResourceString('step2');
  }

  /**
   * Builds a source CSV column-to-type map from task field metadata.
   *
   * @returns Column-to-type map used for CSV value casting.
   */
  private _createSourceCsvColumnDataTypeMap(): Map<string, string> {
    const columnTypeMap = new Map<string, string>();
    this.data.fieldsInQueryMap.forEach((field, queryFieldName) => {
      const fieldType = field.type?.trim().toLowerCase();
      if (!fieldType || fieldType === 'dynamic') {
        return;
      }

      const candidateNames = Common.distinctStringArray(
        [queryFieldName, field.name, field.nameId].filter((name): name is string => Boolean(name))
      );
      candidateNames.forEach((name) => {
        if (!columnTypeMap.has(name)) {
          columnTypeMap.set(name, fieldType);
        }
      });
    });
    return columnTypeMap;
  }

  /**
   * Retrieves source records for the current pass.
   *
   * @param queryMode - Query mode for the pass.
   * @param reversed - True when reversed pass is active.
   * @param orgDataService - Org data service instance.
   * @returns True when any records were queried.
   */
  private async _retrieveSourceRecordsAsync(
    queryMode: QueryModeType,
    reversed: boolean,
    orgDataService: OrgDataService
  ): Promise<boolean> {
    if (!this.preflightEligibility.canQuerySource) {
      return false;
    }
    const sourceOrg = this.sourceData.org;
    if (!sourceOrg) {
      return false;
    }

    let hasRecords = false;
    if ((sourceOrg.isFileMedia || this.scriptObject.useSourceCSVFile) && queryMode === 'forwards' && !reversed) {
      const query = this.createQuery();
      this._logQueryStart('queryingAll', 'source', 'csvFile', queryMode);
      this._logQueryString(query);
      this.sourceData.queryCount += 1;
      const csvColumnDataTypeMap = this._createSourceCsvColumnDataTypeMap();
      const records = await orgDataService.queryOrgOrCsvAsync(
        query,
        sourceOrg,
        this.data.sourceCsvFilename,
        this.scriptObject.useSourceCSVFile,
        {
          useBulk: this.sourceData.useBulkQueryApi,
          useQueryAll: this.scriptObject.useQueryAll,
          csvColumnDataTypeMap: csvColumnDataTypeMap.size > 0 ? csvColumnDataTypeMap : undefined,
          useInternalCsvFormat: true,
        }
      );
      const filteredRecords = this._filterSourceRecordsByExpression(records);
      hasRecords = true;
      this._finalizeRetrievedRecords(filteredRecords, this.sourceData, 'source', false);
    } else if (sourceOrg.isOrgMedia) {
      if (this.scriptObject.processAllSource && queryMode === 'forwards' && !reversed) {
        const query = this.createQuery();
        this._logQueryStart('queryingAll', 'source', 'org', queryMode);
        this._logQueryString(query);
        this.sourceData.queryCount += 1;
        const records = await orgDataService.queryOrgAsync(query, sourceOrg, {
          useBulk: this.sourceData.useBulkQueryApi,
          useQueryAll: this.scriptObject.useQueryAll,
        });
        hasRecords = true;
        this._finalizeRetrievedRecords(records, this.sourceData, 'source', false);
      } else if (!this.scriptObject.processAllSource) {
        const queries = this._createFilteredQueries(queryMode, reversed);
        if (queries.length > 0) {
          this._logQueryStart('queryingIn', 'source', 'org', queryMode);
          this.sourceData.queryCount += queries.length;
          const records = await this._retrieveFilteredRecordsAsync(queries, sourceOrg, orgDataService, {
            useBulk: this.sourceData.useBulkQueryApi,
            useQueryAll: this.scriptObject.useQueryAll,
          });
          hasRecords = true;
          this._finalizeRetrievedRecords(records, this.sourceData, 'source', false);
        }
      }
    }

    await this._retrieveSelfReferenceRecordsAsync(queryMode, orgDataService);
    return hasRecords;
  }

  /**
   * Filters CSV source records using sourceRecordsFilter when configured.
   *
   * @param records - Source records loaded from CSV.
   * @returns Filtered or original records.
   */
  private _filterSourceRecordsByExpression(records: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    const filter = this.scriptObject.sourceRecordsFilter?.trim();
    if (!filter || records.length === 0) {
      return records;
    }

    try {
      const alasql = CjsDependencyAdapters.getAlasql() as (
        query: string,
        data?: Array<Array<Record<string, unknown>>>
      ) => Array<Record<string, unknown>>;
      const selected = alasql(`SELECT * FROM ? WHERE ${filter}`, [records]);
      const filtered = Array.isArray(selected) ? selected : records;
      Common.logDiagnostics(
        `Applied sourceRecordsFilter for ${this.sObjectName}: "${filter}" (rows ${records.length} -> ${filtered.length}).`
      );
      return filtered;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Common.logDiagnostics(
        `Skipped sourceRecordsFilter for ${this.sObjectName}: "${filter}". Reason: ${message}.`,
        this._getLogger()
      );
      return records;
    }
  }

  /**
   * Retrieves target records for the current pass.
   *
   * @param queryMode - Query mode for the pass.
   * @param orgDataService - Org data service instance.
   * @returns True when any records were queried.
   */
  private async _retrieveTargetRecordsAsync(
    queryMode: QueryModeType,
    orgDataService: OrgDataService
  ): Promise<boolean> {
    if (!this.preflightEligibility.canQueryTarget) {
      return false;
    }
    const targetOrg = this.targetData.org;
    if (!targetOrg || !targetOrg.isOrgMedia || this.scriptObject.operation === OPERATION.Insert) {
      return false;
    }

    const fieldsInQuery = this.data.fieldsInQuery;
    const query = this.createQuery(fieldsInQuery, false, undefined, false, true);
    let records: Array<Record<string, unknown>> = [];
    let hasRecords = false;
    const forceFilteredHierarchyQuery = this.scriptObject.isHierarchicalDeleteOperation;

    if (this.scriptObject.processAllTarget && !forceFilteredHierarchyQuery) {
      this._logQueryStart('queryingAll', 'target', 'org', queryMode);
      this._logQueryString(query);
      this.targetData.queryCount += 1;
      records = await orgDataService.queryOrgAsync(query, targetOrg, {
        useBulk: this.targetData.useBulkQueryApi,
        useQueryAll: this.scriptObject.queryAllTarget,
      });
      hasRecords = true;
    } else {
      const queries = this._createFilteredQueries(queryMode, false, fieldsInQuery);
      if (queries.length > 0) {
        this._logQueryStart('queryingIn', 'target', 'org', queryMode);
        this.targetData.queryCount += queries.length;
        records = await this._retrieveFilteredRecordsAsync(queries, targetOrg, orgDataService, {
          useBulk: this.targetData.useBulkQueryApi,
          useQueryAll: this.scriptObject.queryAllTarget,
        });
        hasRecords = true;
      }
    }

    if (hasRecords) {
      this._finalizeRetrievedRecords(records, this.targetData, 'target', true);
    }
    return hasRecords;
  }

  /**
   * Registers retrieved records, updates lookup maps, and logs completion.
   *
   * @param records - Retrieved records.
   * @param orgData - Task org data to update.
   * @param sourceKey - Source/target key for logging.
   * @param isTarget - True when registering target records.
   * @returns Newly added records count.
   */
  private _finalizeRetrievedRecords(
    records: Array<Record<string, unknown>>,
    orgData: TaskOrgData,
    sourceKey: 'source' | 'target',
    isTarget: boolean
  ): number {
    const logger = this.job.script.logger ?? Common.logger;
    const nextOrgData = orgData;
    const newRecordsCount = this.registerRecords(records, nextOrgData, isTarget);
    this._populateLookupMaps(records, nextOrgData);
    nextOrgData.totalRecordCount = nextOrgData.idRecordsMap.size;
    logger.log('queryingFinished', this.sObjectName, logger.getResourceString(sourceKey), String(newRecordsCount));
    return newRecordsCount;
  }
}
