/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISFdmuRunCustomAddonTask } from ".";

/**
 * The currently running migration job.
 * This object holds array of {@link ISFdmuRunCustomAddonJob.tasks | Tasks}.
 *
 * @export
 * @interface ISFdmuRunCustomAddonJob
 */
export default interface ISFdmuRunCustomAddonJob {

    /**
     * The migration Tasks related to this Job.
     *
     * @type {ISFdmuRunCustomAddonTask[]}
     * @memberof ISFdmuRunCustomAddonJob
     */
    tasks: ISFdmuRunCustomAddonTask[];


    /**
     * Finds the sobject by the provided field path, then returns the {@link ISFdmuRunCustomAddonTask | Task}, 
     * associated with this sobject. 
     * This method can help you to locate and access the source/target records which contain the desired field.
     *
     * @param {string} fieldPath The  full field path to the field, e.g. ```Account.Test1__r.Text2__r.Name```.
     *                              In this case the method will find the sobject referenced by the lookup field ```Text2__c```. 
     *                              So you will be able to access the records of this sobject including the desired Name field.
    * @return {{
    *         task: ISFdmuRunCustomAddonTask,
    *         field: string
    *     }}  Returns the Task and the field name, for example { task: [Task of Text2__c], field: 'Name' }
    * @memberof ISFdmuRunCustomAddonJob
    */
     getTaskByFieldPath(fieldPath: string): {
        task: ISFdmuRunCustomAddonTask,
        field: string
    };

}