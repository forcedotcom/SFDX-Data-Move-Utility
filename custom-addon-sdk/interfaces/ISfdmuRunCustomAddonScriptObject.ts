/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type ISfdmuRunCustomAddonScriptAddonManifestDefinition from './ISfdmuRunCustomAddonScriptAddonManifestDefinition.js';
import type ISfdmuRunCustomAddonScriptMappingItem from './ISfdmuRunCustomAddonScriptMappingItem.js';
import type ISfdmuRunCustomAddonScriptMockField from './ISfdmuRunCustomAddonScriptMockField.js';
import type { OPERATION } from './common.js';

/**
 * Provides access to an object included in the currently running {@link ISfdmuRunCustomAddonScript}.
 *
 * @see {@link https://help.sfdmu.com/full-documentation/configuration-and-running/full-exportjson-format | Full export.json format} for the detailed information about the fields.
 *
 * @export
 * @interface ISfdmuRunCustomAddonScriptObject
 */
export default interface ISfdmuRunCustomAddonScriptObject {
  mockFields?: ISfdmuRunCustomAddonScriptMockField[];
  fieldMapping?: ISfdmuRunCustomAddonScriptMappingItem[];
  query?: string;
  deleteQuery?: string;
  operation?: OPERATION;
  externalId?: string;
  originalExternalId?: string;
  originalExternalIdIsEmpty?: boolean;
  deleteOldData?: boolean;
  deleteFromSource?: boolean;
  deleteByHierarchy?: boolean;
  hardDelete?: boolean;
  respectOrderByOnDeleteRecords?: boolean;
  updateWithMockData?: boolean;
  // mockCSVData?: boolean;
  sourceRecordsFilter?: string;
  targetRecordsFilter?: string;
  excluded?: boolean;
  useQueryAll?: boolean;
  queryAllTarget?: boolean;
  skipExistingRecords?: boolean;
  useCSVValuesMapping?: boolean;
  useFieldMapping?: boolean;
  /**
   * Preferred values-mapping flag used by current runtime logic.
   * The legacy `useCSVValuesMapping` flag is still recognized for backward compatibility.
   */
  useValuesMapping?: boolean;
  master?: boolean;
  excludedFields?: string[];
  excludedFromUpdateFields?: string[];
  excludedFieldsFromUpdate?: string[];
  restApiBatchSize?: number;
  bulkApiV1BatchSize?: number;
  alwaysUseBulkApiToUpdateRecords?: boolean;
  alwaysUseRestApi?: boolean;
  alwaysUseBulkApi?: boolean;
  parallelBulkJobs?: number;
  parallelRestJobs?: number;

  useSourceCSVFile?: boolean;
  skipRecordsComparison?: boolean;

  beforeAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];
  afterAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];
  beforeUpdateAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];
  afterUpdateAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];
  filterRecordsAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];

  // ---- Runtime -----
  /**
   * API name of the current sObject.
   *
   * @type {string}
   * @memberof ISfdmuRunCustomAddonScriptObject
   */
  readonly name?: string;
  objectName?: string;

  /** Extra fields to be updated on target records. */
  extraFieldsToUpdate: string[];

  processAllSource?: boolean;
  processAllTarget?: boolean;
  isFromOriginalScript?: boolean;
  sourceSObjectDescribe?: unknown;
  targetSObjectDescribe?: unknown;
  isExtraObject?: boolean;

  /**
   * Polymorphic lookup object hints defined in export.json.
   */
  polymorphicLookups?: Array<{
    fieldName: string;
    referencedObjectType?: string;
  }>;

  /**
   * True when the object is auto-added by the runtime.
   */
  isAutoAdded?: boolean;
}
