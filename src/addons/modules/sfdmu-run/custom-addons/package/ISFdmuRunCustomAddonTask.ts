/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunCustomAddonTaskData } from ".";
import { OPERATION } from "./common";


/**
 * The currently running migration task.
 * Each SFDMU Job has multiple Tasks, each task dedicated to work with one SF object.
 * @see {@link ISFdmuRunCustomAddonJob}
 *
 * @export
 * @interface ISFdmuRunCustomAddonTask
 */
export default interface ISFdmuRunCustomAddonTask {

  /**
   * The operation, performed with the current SF object. 
   *
   * @type {OPERATION}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly operation: OPERATION;


  /**
   * The Api name of the processed SF object.
   *
   * @type {string}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly sObjectName: string;


  /**
   * The target Api name of the SF object in case the Field Mapping feature is active. 
   *
   * @type {string}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly targetSObjectName: string;


  /**
   * The mapping between the record retireved from the Source to the record, retireved from the Target.
   * The records are matched using the specified externalId.
   * 
   * @type {Map<any, any>}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly sourceToTargetRecordMap: Map<any, any>;


  /**
   * The mapping between the source field api names to the target api names in case the Field Mapping feature is active.
   *
   * @type {Map<any, any>}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly sourceToTargetFieldNameMap: Map<any, any>;


  /**
   * The current update mode.
   * Each SF object can be updated twice, for the first time when the records are inserted
   * and for the second time when the Plugin populates the missing lookups 
   * from the previously inserted records.
   *
   * @type {("FIRST_UPDATE" | "SECOND_UPDATE")}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly updateMode: "FIRST_UPDATE" | "SECOND_UPDATE";


  /**
   * Returns the task data associated with the data Source of this migration task.
   *
   * @type {ISfdmuRunCustomAddonTaskData}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly sourceTaskData: ISfdmuRunCustomAddonTaskData;


  /**
    * Returns the task data associated with the data Target of this migration task.
   *
   * @type {ISfdmuRunCustomAddonTaskData}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly targetTaskData: ISfdmuRunCustomAddonTaskData;

  /**
   * The list of the fields included in the sobject's query string.
   *
   * @type {Array<string>}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly fieldsInQuery: Array<string>;

  /**
   * The list of the fields which should be updated with this sobject.
   * This property returns the subset of the fields from the {@link ISFdmuRunCustomAddonTask.fieldsInQuery | fieldsInQuery}, 
   * containing only the fields which can be updated in the Target.
   *
   * @type {Array<string>}
   * @memberof ISFdmuRunCustomAddonTask
   */
  readonly fieldsToUpdate: Array<string>;
}