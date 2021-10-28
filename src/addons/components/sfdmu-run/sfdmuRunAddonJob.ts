/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import { MigrationJob } from "../../../modules/models";
import { ISFdmuRunCustomAddonJob, ISFdmuRunCustomAddonTask } from "../../modules/sfdmu-run/custom-addons/package";
import SfdmuRunAddonTask from "./sfdmuRunAddonTask";


export default class SfdmuRunAddonJob implements ISFdmuRunCustomAddonJob {

    #migrationJob: MigrationJob;
    #pluginTasks: SfdmuRunAddonTask[];

    constructor(migrationJob: MigrationJob) {
        this.#migrationJob = migrationJob;
        this.#pluginTasks = this.#migrationJob.tasks.map(jobTask => new SfdmuRunAddonTask(jobTask));
    }


    get tasks(): SfdmuRunAddonTask[] {
        return this.#pluginTasks;
    }

    getTaskByFieldPath(fieldPath: string): { task: ISFdmuRunCustomAddonTask; field: string; } {
        let out = this.#migrationJob.getTaskByFieldPath(fieldPath);
        if (!out) {
            return {
                field: fieldPath.split('.').pop(),
                task: null
            }
        }
        let task = this.tasks.find(task => task.sObjectName == out.task.sObjectName);
        return {
            field: out.field,
            task
        }
    }
}