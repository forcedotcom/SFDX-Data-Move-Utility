/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type ISFdmuRunCustomAddonJob from './ISFdmuRunCustomAddonJob.js';
import type ISfdmuRunCustomAddonScriptAddonManifestDefinition from './ISfdmuRunCustomAddonScriptAddonManifestDefinition.js';
import type ISfdmuRunCustomAddonScriptObject from './ISfdmuRunCustomAddonScriptObject.js';
import type ISfdmuRunCustomAddonScriptOrg from './ISfdmuRunCustomAddonScriptOrg.js';
import type { DATA_CACHE_TYPES } from './common.js';

/**
 * Provides access to the currently running export.json script.
 *
 * @see {@link https://help.sfdmu.com/full-documentation/configuration-and-running/full-exportjson-format | Full export.json format} for the detailed information about the fields.
 *
 * @export
 * @interface ISfdmuRunCustomAddonScript
 */
export default interface ISfdmuRunCustomAddonScript {
  orgs?: ISfdmuRunCustomAddonScriptOrg[];
  objects?: ISfdmuRunCustomAddonScriptObject[];
  objectSets?: Array<{ objects: ISfdmuRunCustomAddonScriptObject[] }>;
  objectsMap?: Map<string, ISfdmuRunCustomAddonScriptObject>;
  excludedObjects?: string[];
  job?: ISFdmuRunCustomAddonJob;

  /**
   * Base directory for the running script.
   */
  basePath?: string;

  /**
   * Source org definition resolved for the run.
   */
  sourceOrg?: ISfdmuRunCustomAddonScriptOrg;

  /**
   * Target org definition resolved for the run.
   */
  targetOrg?: ISfdmuRunCustomAddonScriptOrg;

  pollingIntervalMs?: number;
  pollingQueryTimeoutMs?: number;
  concurrencyMode?: 'Serial' | 'Parallel';
  bulkThreshold?: number;
  queryBulkApiThreshold?: number;
  bulkApiVersion?: string;
  bulkApiV1BatchSize?: number;
  restApiBatchSize?: number;
  allOrNone?: boolean;
  // promptOnUpdateError: boolean;
  promptOnMissingParentObjects?: boolean;
  promptOnIssuesInCSVFiles?: boolean;
  validateCSVFilesOnly?: boolean;
  apiVersion?: string;
  groupQuery?: string;
  createTargetCSVFiles?: boolean;
  importCSVFilesAsIs?: boolean;
  alwaysUseRestApiToUpdateRecords?: boolean;
  excludeIdsFromCSVFiles?: boolean;
  /**
   * Common delimiter for non-service CSV read/write operations.
   * Supports values such as comma, semicolon, tab, or a custom delimiter.
   */
  csvFileDelimiter?: string;
  /**
   * CSV read delimiter for non-service files.
   *
   * @deprecated Use csvFileDelimiter.
   */
  csvReadFileDelimiter?: string;
  /**
   * CSV write delimiter for non-service files.
   *
   * @deprecated Use csvFileDelimiter.
   */
  csvWriteFileDelimiter?: string;
  /**
   * Encoding used for non-service CSV read/write operations.
   */
  csvFileEncoding?: string;
  /**
   * Data Loader-like null handling for CSV processing.
   */
  csvInsertNulls?: boolean;
  /**
   * Enables parsing of European date formats from CSV input.
   */
  csvUseEuropeanDateFormat?: boolean;
  /**
   * Writes non-service CSV headers in uppercase when enabled.
   */
  csvWriteUpperCaseHeaders?: boolean;
  /**
   * Controls UTF-8 BOM handling for non-service CSV read/write.
   */
  csvUseUtf8Bom?: boolean;
  /**
   * Writes all non-service CSV values in quotes when enabled.
   */
  csvAlwaysQuoted?: boolean;
  /**
   * Uses per-object-set raw CSV folders for non-service input/output.
   */
  useSeparatedCSVFiles?: boolean;
  // fileLog: boolean;
  keepObjectOrderWhileExecute?: boolean;
  allowFieldTruncation?: boolean;
  simulationMode?: boolean;
  /**
   * Current zero-based object set index used by runtime.
   */
  objectSetIndex?: number;
  proxyUrl?: string;
  canModify?: string;
  binaryDataCache?: DATA_CACHE_TYPES;
  sourceRecordsCache?: DATA_CACHE_TYPES;
  parallelBinaryDownloads?: number;
  parallelBulkJobs?: number;
  parallelRestJobs?: number;

  beforeAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];
  afterAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];
  dataRetrievedAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];
  sourceTargetFieldMapping?: Map<string, unknown>;

  /**
   * Returns all configured script objects.
   *
   * @returns Script objects list.
   */
  getAllObjects(): ISfdmuRunCustomAddonScriptObject[];

  /**
   * Adds a script object to the first object set.
   *
   * @param object Script object to add.
   */
  addObjectToFirstSet(object: ISfdmuRunCustomAddonScriptObject): void;
}
