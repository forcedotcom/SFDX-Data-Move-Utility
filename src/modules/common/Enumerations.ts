/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Supported data media types.
 */
export enum DATA_MEDIA_TYPE {
  /**
   * Salesforce org data source/target.
   */
  Org,

  /**
   * CSV file data source/target.
   */
  File,
}

/**
 * Supported migration operations.
 */
export enum OPERATION {
  Insert,
  Update,
  Upsert,
  Readonly,
  Delete,
  DeleteSource,
  DeleteHierarchy,
  HardDelete,
  Unknown,
}

/**
 * Supported API engines.
 */
export enum API_ENGINE {
  DEFAULT_ENGINE,
  REST_API,
  BULK_API_V1,
  BULK_API_V2,
}

/**
 * Result statuses reported during execution.
 */
export enum RESULT_STATUSES {
  Undefined = 'Undefined',
  ApiOperationStarted = 'ApiOperationStarted',
  ApiOperationFinished = 'ApiOperationFinished',
  Information = 'Information',
  JobCreated = 'JobCreated',
  BatchCreated = 'BatchCreated',
  DataUploaded = 'DataUploaded',
  InProgress = 'InProgress',
  Completed = 'Completed',
  FailedOrAborted = 'FailedOrAborted',
  ProcessError = 'ProcessError',
}

/**
 * Severity levels for runtime messages.
 */
export enum MESSAGE_IMPORTANCE {
  Silent,
  Low,
  Normal,
  High,
  Warn,
  Error,
}

/**
 * Event identifiers used by the add-on pipeline.
 */
export enum ADDON_EVENTS {
  none = 'none',
  onBefore = 'onBefore',
  onAfter = 'onAfter',
  onBeforeUpdate = 'onBeforeUpdate',
  onAfterUpdate = 'onAfterUpdate',
  onDataRetrieved = 'onDataRetrieved',
  filterRecordsAddons = 'filterRecordsAddons',
}

/**
 * Special mock pattern markers.
 */
export enum SPECIAL_MOCK_PATTERN_TYPES {
  haveAnyValue,
  missingValue,
}

/**
 * Cache implementation choices for data storage.
 */
export enum DATA_CACHE_TYPES {
  InMemory = 'InMemory',
  CleanFileCache = 'CleanFileCache',
  FileCache = 'FileCache',
}
