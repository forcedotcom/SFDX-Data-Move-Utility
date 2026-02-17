/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { OPERATION } from './common.js';
import type ISfdmuRunCustomAddonProcessedData from './ISfdmuRunCustomAddonProcessedData.js';
import type ISfdmuRunCustomAddonSFieldDescribe from './ISfdmuRunCustomAddonSFieldDescribe.js';
import type ISfdmuRunCustomAddonScriptObject from './ISfdmuRunCustomAddonScriptObject.js';
import type ISfdmuRunCustomAddonTaskData from './ISfdmuRunCustomAddonTaskData.js';
/**
 * The currently running migration task.
 * Each SFDMU job has multiple tasks, each task dedicated to one Salesforce object.
 *
 * @see {@link ISFdmuRunCustomAddonJob}
 *
 * @export
 * @interface ISFdmuRunCustomAddonTask
 */
export default interface ISFdmuRunCustomAddonTask {
  /**
   * The operation performed with the current Salesforce object.
   *
   * @type {OPERATION}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly operation: OPERATION;
  /**
   * API name of the processed Salesforce object.
   *
   * @type {string}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly sObjectName: string;
  /**
   * Target API name of the Salesforce object when field mapping is active.
   *
   * @type {string}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly targetSObjectName: string;

  /**
   * Script object definition for this task.
   */
  readonly scriptObject: ISfdmuRunCustomAddonScriptObject;
  /**
   * Mapping from source records to target records.
   * Records are matched using the configured externalId.
   *
   * @type {Map<Record<string, unknown>, Record<string, unknown>>}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly sourceToTargetRecordMap: Map<Record<string, unknown>, Record<string, unknown>>;
  /**
   * Mapping between source field API names and target field API names when field mapping is active.
   *
   * @type {Map<string, string>}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly sourceToTargetFieldNameMap: Map<string, string>;
  /**
   * The current update mode.
   * Each Salesforce object can be updated twice: first when records are inserted,
   * second when the plugin populates missing lookups
   * from the previously inserted records.
   *
   * @type {("FIRST_UPDATE" | "SECOND_UPDATE")}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly updateMode: 'FIRST_UPDATE' | 'SECOND_UPDATE';
  /**
   * Returns task data associated with the source side of this migration task.
   *
   * @type {ISfdmuRunCustomAddonTaskData}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly sourceTaskData: ISfdmuRunCustomAddonTaskData;
  /**
   * Returns task data associated with the target side of this migration task.
   *
   * @type {ISfdmuRunCustomAddonTaskData}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly targetTaskData: ISfdmuRunCustomAddonTaskData;

  /**
   * Source runtime data (alias for sourceTaskData).
   */
  readonly sourceData: ISfdmuRunCustomAddonTaskData;

  /**
   * Target runtime data (alias for targetTaskData).
   */
  readonly targetData: ISfdmuRunCustomAddonTaskData;

  /**
   * Runtime task data container.
   */
  readonly data: {
    fieldsInQueryMap: ReadonlyMap<string, ISfdmuRunCustomAddonSFieldDescribe>;
  };

  /**
   * Processed data for the current update pass.
   */
  readonly processedData: ISfdmuRunCustomAddonProcessedData;

  /**
   * List of fields included in the sObject query.
   *
   * @type {Array<string>}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly fieldsInQuery: string[];

  /**
   * List of fields that should be updated for this sObject.
   * This property returns the subset of the fields from the {@link ISFdmuRunCustomAddonTask.fieldsInQuery | fieldsInQuery},
   * containing only the fields which can be updated in the Target.
   *
   * @type {Array<string>}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly fieldsToUpdate: string[];

  /**
   * Gets or sets temporary records during transformation.
   * You can use this property to access and modify live source records when
   * the `filterRecordsAddons` Add-On event is running.
   */
  tempRecords: Array<Record<string, unknown>>;

  /**
   * Applies Values Mapping (if enabled for the associated sObject) to passed records.
   * The value mapping is defined by the ValueMapping.csv file.
   *
   * @see {@link https://help.sfdmu.com/full-documentation/advanced-features/values-mapping | Values Mapping} for detailed information about this feature.
   *
   * @param {Array<Record<string, unknown>>} records The records to map, e.g. the source records.
   * @memberof ISFdmuRunCustomAddonTask
   */
  mapRecords(records: Array<Record<string, unknown>>): void;
}
