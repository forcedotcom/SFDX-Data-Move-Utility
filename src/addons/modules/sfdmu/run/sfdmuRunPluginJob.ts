/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import { MigrationJob } from "../../../../modules/models";
import { ISfdmuRunPluginJob, ISfdmuRunPluginTask } from "../../../components/shared_packages/sfdmuRunAddonComponents";
import SfdmuRunPluginTask from "./SfdmuRunPluginTask";

export default class SfdmuRunPluginJob implements ISfdmuRunPluginJob {
    
    #migrationJob : MigrationJob;
    #pluginTasks: ISfdmuRunPluginTask[];

    constructor(migrationJob : MigrationJob){
        
        // Setup props
        this.#migrationJob = migrationJob;
        
        // Setup tasks
        this.#pluginTasks = this.#migrationJob.tasks.map(jobTask => new SfdmuRunPluginTask(jobTask));

    }
    
    get tasks() : ISfdmuRunPluginTask[] {
       return this.#pluginTasks;
    }
}