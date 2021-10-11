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

}