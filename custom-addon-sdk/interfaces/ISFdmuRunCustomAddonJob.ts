/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type ISFdmuRunCustomAddonTask from './ISFdmuRunCustomAddonTask.js';

/**
 * The currently running migration job.
 * This object holds an array of {@link ISFdmuRunCustomAddonJob.tasks | tasks}.
 *
 * @export
 * @interface ISFdmuRunCustomAddonJob
 */
export default interface ISFdmuRunCustomAddonJob {
  /**
   * Migration tasks related to this job.
   *
   * @type {ISFdmuRunCustomAddonTask[]}
   * @memberof ISFdmuRunCustomAddonJob
   */
  tasks: ISFdmuRunCustomAddonTask[];

  /**
   * Finds the sObject by the provided field path, then returns the associated {@link ISFdmuRunCustomAddonTask | task}.
   * This method can help you to locate and access the source/target records which contain the desired field.
   *
   * @param {string} fieldPath The full field path to the field, e.g. ```Account.Test1__r.Text2__r.Name```.
   * In this case the method will find the sObject referenced by the lookup field ```Text2__c```.
   * So you will be able to access records of this sObject including the desired Name field.
   * @return {{
   * task: ISFdmuRunCustomAddonTask | null,
   * field: string
   * }} Returns the task and field name, for example { task: [Task of Text2__c], field: 'Name' }.
   * @memberof ISFdmuRunCustomAddonJob
   */
  getTaskByFieldPath(fieldPath: string): {
    task: ISFdmuRunCustomAddonTask | null;
    field: string;
  };
}
