/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { DATA_CACHE_TYPES } from '../../common/Enumerations.js';
import {
  BINARY_CACHE_SUB_DIRECTORY,
  CSV_SOURCE_SUB_DIRECTORY,
  CSV_TARGET_SUB_DIRECTORY,
  DEFAULT_API_VERSION,
  DEFAULT_BULK_API_THRESHOLD_RECORDS,
  DEFAULT_BULK_API_V1_BATCH_SIZE,
  DEFAULT_BULK_API_VERSION,
  DEFAULT_MAX_PARALLEL_BLOB_DOWNLOADS,
  DEFAULT_POLLING_INTERVAL_MS,
  DEFAULT_POLLING_QUERY_TIMEOUT_MS,
  DEFAULT_REST_API_BATCH_SIZE,
  OBJECT_SET_SUBDIRECTORY_PREFIX,
  QUERY_BULK_API_THRESHOLD,
  RAW_SOURCE_SUB_DIRECTORY,
  REPORTS_SUB_DIRECTORY,
  SOURCE_RECORDS_CACHE_SUB_DIRECTORY,
} from '../../constants/Constants.js';
import type LoggingService from '../../logging/LoggingService.js';
import type ObjectMapping from '../../mapping/ObjectMapping.js';
import type { ICommandRunInfo } from '../common/ICommandRunInfo.js';
import type MigrationJob from '../job/MigrationJob.js';
import type SObjectDescribe from '../sf/SObjectDescribe.js';
import type ScriptAddonManifestDefinition from './ScriptAddonManifestDefinition.js';
import type { LookupIdMapType } from './LookupIdMapType.js';
import type ScriptObject from './ScriptObject.js';
import ScriptObjectSet from './ScriptObjectSet.js';
import ScriptOrg from './ScriptOrg.js';

type ConcurrencyModeType = 'Serial' | 'Parallel';

/**
 * Root script definition from export.json.
 */
export default class Script {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Org definitions from export.json.
   */
  public orgs: ScriptOrg[] = [];

  /**
   * Flat object list when object sets are not provided.
   */
  public objects: ScriptObject[] = [];

  /**
   * Object API names excluded from processing.
   */
  public excludedObjects: string[] = [];

  /**
   * Object sets parsed from export.json.
   */
  public objectSets: ScriptObjectSet[] = [];

  /**
   * Polling interval for async operations.
   */
  public pollingIntervalMs = DEFAULT_POLLING_INTERVAL_MS;

  /**
   * Polling timeout for query operations.
   */
  public pollingQueryTimeoutMs = DEFAULT_POLLING_QUERY_TIMEOUT_MS;

  /**
   * Concurrency mode for the migration.
   */
  public concurrencyMode: ConcurrencyModeType = 'Parallel';

  /**
   * Threshold for switching to Bulk API.
   */
  public bulkThreshold = DEFAULT_BULK_API_THRESHOLD_RECORDS;

  /**
   * Threshold for Bulk API queries.
   */
  public queryBulkApiThreshold = QUERY_BULK_API_THRESHOLD;

  /**
   * Bulk API version selection.
   */
  public bulkApiVersion = DEFAULT_BULK_API_VERSION;

  /**
   * Bulk API v1 batch size.
   */
  public bulkApiV1BatchSize = DEFAULT_BULK_API_V1_BATCH_SIZE;

  /**
   * REST API batch size override.
   */
  public restApiBatchSize: number | undefined = DEFAULT_REST_API_BATCH_SIZE;

  /**
   * All-or-none DML flag.
   */
  public allOrNone = false;

  /**
   * Prompt on missing parent objects.
   */
  public promptOnMissingParentObjects = true;

  /**
   * Prompts user when CSV validation/repair issues are detected.
   */
  public promptOnIssuesInCSVFiles = true;

  /**
   * Validates CSV files and stops before DML execution.
   */
  public validateCSVFilesOnly = false;

  /**
   * API version override.
   */
  public apiVersion = DEFAULT_API_VERSION;

  /**
   * Proxy URL for org connections.
   */
  public proxyUrl = '';

  /**
   * Enables writing target CSV result files.
   */
  public createTargetCSVFiles = true;

  /**
   * Imports input CSV files as-is without repair/normalization.
   */
  public importCSVFilesAsIs = false;

  /**
   * Excludes Id columns from non-service CSV input/output processing.
   */
  public excludeIdsFromCSVFiles = false;

  /**
   * Test-only switch: skip first-pass Id repair for source CSV files.
   * Allows deterministic verification of final post-processing Id repair.
   */
  public forcePostProcessCsvIdFix = false;

  /**
   * Preserve explicit object order during execution.
   */
  public keepObjectOrderWhileExecute = false;

  /**
   * Allow field truncation during updates.
   */
  public allowFieldTruncation = false;

  /**
   * Force REST API for updates.
   */
  public alwaysUseRestApiToUpdateRecords = false;

  /**
   * Run in simulation mode.
   */
  public simulationMode = false;

  /**
   * CSV delimiter used for non-service CSV read/write operations.
   * Supports: `comma`, `semicolon`, `tab`, or a custom delimiter string.
   * Internal service files (`*_source`, `*_target`, reports) use a fixed delimiter.
   */
  public csvFileDelimiter = ',';

  /**
   * CSV delimiter used for reading non-service CSV files.
   *
   * @deprecated Use `csvFileDelimiter`.
   */
  public csvReadFileDelimiter = ',';

  /**
   * CSV delimiter used for writing non-service CSV files.
   *
   * @deprecated Use `csvFileDelimiter`.
   */
  public csvWriteFileDelimiter = ',';

  /**
   * CSV file encoding used for non-service CSV read/write operations.
   * Internal service files (`*_source`, `*_target`, reports) use UTF-8.
   */
  public csvFileEncoding: BufferEncoding = 'utf8';

  /**
   * CSV null insertion behavior (Data Loader-like).
   * When true, empty cells are interpreted as null on import.
   */
  public csvInsertNulls = true;

  /**
   * Enables European date/datetime parsing for CSV input.
   */
  public csvUseEuropeanDateFormat = false;

  /**
   * Writes non-service CSV headers in uppercase when enabled.
   */
  public csvWriteUpperCaseHeaders = false;

  /**
   * Controls UTF-8 BOM handling for non-service CSV read/write when encoding is UTF-8.
   * Internal service files (`*_source`, `*_target`, reports) are handled independently of this option.
   * For non-UTF-8 encodings this option is ignored.
   */
  public csvUseUtf8Bom = true;

  /**
   * Writes all non-service CSV values in quotes.
   * Internal service files (`*_source`, `*_target`, reports) are always quoted.
   */
  public csvAlwaysQuoted = true;

  /**
   * Uses separate raw CSV input/output directories per object set.
   * Internal service directories (`source`, `target`, `reports`) are object-set aware regardless of this option.
   */
  public useSeparatedCSVFiles = false;

  /**
   * Binary data cache storage type.
   */
  public binaryDataCache: DATA_CACHE_TYPES = DATA_CACHE_TYPES.InMemory;

  /**
   * Source records cache storage type.
   */
  public sourceRecordsCache: DATA_CACHE_TYPES = DATA_CACHE_TYPES.InMemory;

  /**
   * Parallel binary download limit.
   */
  public parallelBinaryDownloads = DEFAULT_MAX_PARALLEL_BLOB_DOWNLOADS;

  /**
   * Parallel Bulk API job limit.
   */
  public parallelBulkJobs = 1;

  /**
   * Parallel REST API job limit.
   */
  public parallelRestJobs = 1;

  /**
   * Add-on manifests executed before the run.
   */
  public beforeAddons: ScriptAddonManifestDefinition[] = [];

  /**
   * Add-on manifests executed after the run.
   */
  public afterAddons: ScriptAddonManifestDefinition[] = [];

  /**
   * Add-on manifests executed after data retrieval.
   */
  public dataRetrievedAddons: ScriptAddonManifestDefinition[] = [];

  /**
   * Custom Group query override for polymorphic lookups.
   */
  public groupQuery = '';

  /**
   * Original export.json payload for rehydration.
   */
  public workingJson: unknown;

  /**
   * Logging service for this run.
   */
  public logger?: LoggingService;

  /**
   * Source org definition.
   */
  public sourceOrg?: ScriptOrg;

  /**
   * Target org definition.
   */
  public targetOrg?: ScriptOrg;

  /**
   * Base directory for all path calculations.
   */
  public basePath = '';

  /**
   * Script objects keyed by API name.
   */
  public objectsMap: Map<string, ScriptObject> = new Map();

  /**
   * Mapping between source and target objects.
   */
  public sourceTargetFieldMapping: Map<string, ObjectMapping> = new Map();

  /**
   * Job instance bound to this script.
   */
  public job?: MigrationJob;

  /**
   * Add-on manager instance.
   */
  public addonManager?: unknown;

  /**
   * Command run metadata.
   */
  public runInfo?: ICommandRunInfo;

  /**
   * Domain name allowing production modifications without prompt.
   */
  public canModify = '';

  /**
   * Current object set index.
   */
  public objectSetIndex = 0;

  /**
   * Flag indicating full query logging.
   */
  public logfullquery = false;

  /**
   * Extra object descriptions required for the job.
   */
  public extraSObjectDescriptions: Map<string, SObjectDescribe> = new Map();

  // ------------------------------------------------------//
  // -------------------- GETTERS/SETTERS ----------------//
  // ------------------------------------------------------//

  /**
   * Returns true when both orgs support person accounts or use file media.
   *
   * @returns True when person accounts are supported.
   */
  public get isPersonAccountEnabled(): boolean {
    if (!this.sourceOrg || !this.targetOrg) {
      return false;
    }
    const sourceReady = this.sourceOrg.isFileMedia || this.sourceOrg.isPersonAccountEnabled;
    const targetReady = this.targetOrg.isFileMedia || this.targetOrg.isPersonAccountEnabled;
    return sourceReady && targetReady;
  }

  /**
   * Returns the CSV source directory path.
   * The path is object-set specific when `objectSetIndex` is set.
   *
   * @returns Source directory path.
   */
  public get sourceDirectoryPath(): string {
    const suffix = this._getObjectSetSuffix();
    if (!suffix) {
      return path.join(this.basePath, CSV_SOURCE_SUB_DIRECTORY);
    }
    return path.join(this.basePath, CSV_SOURCE_SUB_DIRECTORY, suffix);
  }

  /**
   * Returns the raw source directory path for user CSV input.
   * Uses object-set subdirectories only when `useSeparatedCSVFiles=true`.
   *
   * @returns Raw source directory path.
   */
  public get rawSourceDirectoryPath(): string {
    if (!this.objectSetIndex || !this.useSeparatedCSVFiles) {
      return this.basePath;
    }
    const suffix = this._getObjectSetSuffix();
    return path.join(this.basePath, RAW_SOURCE_SUB_DIRECTORY, suffix);
  }

  /**
   * Returns the CSV target directory path.
   * The path is object-set specific when `objectSetIndex` is set.
   *
   * @returns Target directory path.
   */
  public get targetDirectoryPath(): string {
    const suffix = this._getObjectSetSuffix();
    if (!suffix) {
      return path.join(this.basePath, CSV_TARGET_SUB_DIRECTORY);
    }
    return path.join(this.basePath, CSV_TARGET_SUB_DIRECTORY, suffix);
  }

  /**
   * Returns the reports directory path.
   * The path is object-set specific when `objectSetIndex` is set.
   *
   * @returns Reports directory path.
   */
  public get reportsDirectoryPath(): string {
    const suffix = this._getObjectSetSuffix();
    if (!suffix) {
      return path.join(this.basePath, REPORTS_SUB_DIRECTORY);
    }
    return path.join(this.basePath, REPORTS_SUB_DIRECTORY, suffix);
  }

  /**
   * Returns the binary cache directory path.
   *
   * @returns Binary cache directory path.
   */
  public get binaryCacheDirectoryPath(): string {
    const orgUserName = this.sourceOrg?.orgUserName ?? '';
    return path.join(this.basePath, BINARY_CACHE_SUB_DIRECTORY, orgUserName);
  }

  /**
   * Returns the source records cache directory path.
   *
   * @returns Source records cache directory path.
   */
  public get sourceRecordsCacheDirectoryPath(): string {
    const orgUserName = this.sourceOrg?.orgUserName ?? '';
    return path.join(this.basePath, SOURCE_RECORDS_CACHE_SUB_DIRECTORY, orgUserName);
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Expands User/Group objects for each object set.
   */
  public expandPolymorphicLookups(): void {
    if (!Array.isArray(this.objectSets) || !Array.isArray(this.objects)) {
      return;
    }
    if (this.objectSets.length === 0 && this.objects.length > 0) {
      this.objectSets.push(new ScriptObjectSet(this.objects));
      this.objects = [];
    }

    for (const objectSet of this.objectSets) {
      objectSet.expandPolymorphicLookups();
    }
  }

  /**
   * Merges User and Group lookup maps without overriding existing keys.
   *
   * @param userMap - User lookup map.
   * @param groupMap - Group lookup map.
   * @returns Combined lookup map.
   */
  public mergeLookupMaps(userMap: LookupIdMapType, groupMap: LookupIdMapType): LookupIdMapType {
    void this;
    const merged = new Map<string, string>();
    for (const [key, value] of userMap) {
      merged.set(key, value);
    }
    for (const [key, value] of groupMap) {
      if (!merged.has(key)) {
        merged.set(key, value);
      }
    }
    return merged;
  }

  /**
   * Returns all script objects across object sets.
   *
   * @returns Flattened object list.
   */
  public getAllObjects(): ScriptObject[] {
    if (Array.isArray(this.objectSets) && this.objectSets.length > 0) {
      return this.objectSets.flatMap((set) => (Array.isArray(set.objects) ? set.objects : []));
    }
    return Array.isArray(this.objects) ? this.objects : [];
  }

  /**
   * Adds an object to the first object set.
   *
   * @param object - Script object to add.
   */
  public addObjectToFirstSet(object: ScriptObject): void {
    if (!Array.isArray(this.objectSets)) {
      this.objectSets = [];
    }
    if (!Array.isArray(this.objects)) {
      this.objects = [];
    }
    if (this.objectSets.length === 0) {
      this.objectSets.push(new ScriptObjectSet(this.objects));
      this.objects = [];
    }
    this.objectSets[0].objects.push(object);
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Returns the object set suffix for directory paths.
   *
   * @returns Object set suffix or empty string.
   */
  private _getObjectSetSuffix(): string {
    if (!this.objectSetIndex) {
      return '';
    }
    const normalizedPrefix = OBJECT_SET_SUBDIRECTORY_PREFIX.replace(/^[\\/]+/, '');
    return `${normalizedPrefix}${this.objectSetIndex + 1}`;
  }
}
