/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import { MigrationJob } from "../../../modules/models";
import { ISFdmuRunCustomAddonJob } from "../../modules/sfdmu-run/custom-addons/package";
import SfdmuRunAddonTask from "./sfdmuRunAddonTask";


export default class SfdmuRunAddonJob implements ISFdmuRunCustomAddonJob  {
    
    #migrationJob : MigrationJob;
    #pluginTasks: SfdmuRunAddonTask[];

    constructor(migrationJob : MigrationJob){ 
        this.#migrationJob = migrationJob; 
        this.#pluginTasks = this.#migrationJob.tasks.map(jobTask => new SfdmuRunAddonTask(jobTask));
    }
    
    get tasks() : SfdmuRunAddonTask[] {
       return this.#pluginTasks;
    }
}