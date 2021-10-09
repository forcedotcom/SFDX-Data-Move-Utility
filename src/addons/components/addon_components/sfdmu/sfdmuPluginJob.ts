/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import { MigrationJob } from "../../../../modules/models";
import SfdmuRunPluginTask from "./sfdmuRunPluginTask";


export default class SfdmuPluginJob  {
    
    #migrationJob : MigrationJob;
    #pluginTasks: SfdmuRunPluginTask[];

    constructor(migrationJob : MigrationJob){
        
        // Setup props
        this.#migrationJob = migrationJob;
        
        // Setup tasks
        this.#pluginTasks = this.#migrationJob.tasks.map(jobTask => new SfdmuRunPluginTask(jobTask));

    }
    
    get tasks() : SfdmuRunPluginTask[] {
       return this.#pluginTasks;
    }
}