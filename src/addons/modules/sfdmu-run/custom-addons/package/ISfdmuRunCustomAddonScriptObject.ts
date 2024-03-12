/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunCustomAddonScriptAddonManifestDefinition, ISfdmuRunCustomAddonScriptMappingItem, ISfdmuRunCustomAddonScriptMockField, OPERATION } from ".";



/**
 * Provides an access to the object included in the currently running {@link ISfdmuRunCustomAddonScript}.
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
  deleteOldData?: boolean;
  deleteFromSource?: boolean;
  deleteByHierarchy?: boolean;
  hardDelete?: boolean;
  updateWithMockData?: boolean;
  //mockCSVData?: boolean;
  targetRecordsFilter?: string;
  excluded?: boolean;
  useCSVValuesMapping?: boolean;
  useFieldMapping?: boolean;
  useValuesMapping?: boolean;
  allRecords?: boolean;
  master?: boolean;
  excludedFields?: Array<string>;
  excludedFromUpdateFields?: Array<string>;
  restApiBatchSize?: number;
  bulkApiV1BatchSize?: number;
  parallelBulkJobs?: number;
  parallelRestJobs?: number;

  useSourceCSVFile: boolean;
  skipRecordsComparison: boolean;


  beforeAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];
  afterAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];
  beforeUpdateAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];
  afterUpdateAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];
  filterRecordsAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];

  // ---- Runtime -----
  /**
   * The API name of the current sObject
   *
   * @type {string}
   * @memberof ISfdmuRunCustomAddonScriptObject
   */
  readonly name?: string;
  objectName?: string

}
