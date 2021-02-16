/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { MigrationJobTask } from "../../../../modules/models";
import { OPERATION } from "../../../components/shared_packages/commonComponents";
import { ISfdmuRunPluginTask, ISfdmuRunPluginTaskData } from "../../../components/shared_packages/sfdmuRunAddonComponents";
import SfdmuRunPluginTaskData from "./sfdmuRunPluginTaskData";

export default  class SfdmuRunPluginTask implements ISfdmuRunPluginTask {
    
    #migrationJobTask : MigrationJobTask;
    #sourceTaskData : ISfdmuRunPluginTaskData;
    #targetTaskData : ISfdmuRunPluginTaskData;

    constructor(migrationJobTask : MigrationJobTask){
        this.#migrationJobTask = migrationJobTask;
        this.#sourceTaskData = new SfdmuRunPluginTaskData(migrationJobTask.sourceData);
        this.#targetTaskData = new SfdmuRunPluginTaskData(migrationJobTask.targetData);
    }

    getTargetCSVFilename(operation: OPERATION, fileNameSuffix?: string): string {
        return this.#migrationJobTask.data.getTargetCSVFilename(operation, fileNameSuffix);
    }
    
    get operation(): OPERATION {
        return this.#migrationJobTask.operation;
    }

    get sObjectName(): string {
        return this.#migrationJobTask.sObjectName;
    }

    get sourceToTargetRecordMap(): Map<any, any> {
        return this.#migrationJobTask.data.sourceToTargetRecordMap;
    }

    get sourceTaskData(): ISfdmuRunPluginTaskData {
        return this.#sourceTaskData;
    }
    
    get targetTaskData(): ISfdmuRunPluginTaskData {
        return this.#targetTaskData;
    }

    
}