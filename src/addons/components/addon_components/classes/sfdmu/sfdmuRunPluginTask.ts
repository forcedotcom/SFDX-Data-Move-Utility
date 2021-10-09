/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import SfdmuRunPluginTaskData from "./sfdmuRunPluginTaskData";

import { MigrationJobTask, ProcessedData } from "../../../../../modules/models";
import { OPERATION } from "../../../../../modules/components/common_components/enumerations";



export default class SfdmuRunPluginTask  {

    #migrationJobTask: MigrationJobTask;
    #sourceTaskData: SfdmuRunPluginTaskData;
    #targetTaskData: SfdmuRunPluginTaskData;


    constructor(migrationJobTask: MigrationJobTask) {
        this.#migrationJobTask = migrationJobTask;
        this.#sourceTaskData = new SfdmuRunPluginTaskData(migrationJobTask.sourceData);
        this.#targetTaskData = new SfdmuRunPluginTaskData(migrationJobTask.targetData);
    }


    getTargetCSVFilename(operation: OPERATION, fileNameSuffix?: string): string {
        return this.#migrationJobTask.data.getTargetCSVFilename(operation, fileNameSuffix);
    }

    get sourceCsvFilename(): string {
        return this.#migrationJobTask.data.sourceCsvFilename;
    }

    get operation(): OPERATION {
        return this.#migrationJobTask.operation;
    }

    get sObjectName(): string {
        return this.#migrationJobTask.sObjectName;
    }

    get targetSObjectName(): string {
        return this.#migrationJobTask.scriptObject.targetObjectName;
    }

    get sourceToTargetRecordMap(): Map<any, any> {
        return this.#migrationJobTask.data.sourceToTargetRecordMap;
    }

    get sourceToTargetFieldNameMap(): Map<any, any> {
        return this.#migrationJobTask.scriptObject.sourceToTargetFieldNameMap;
    }

    get sourceTaskData(): SfdmuRunPluginTaskData {
        return this.#sourceTaskData;
    }

    get targetTaskData(): SfdmuRunPluginTaskData {
        return this.#targetTaskData;
    }

    get processedData(): ProcessedData {
        return this.#migrationJobTask.processedData;
    }

    get updateMode(): "FIRST_UPDATE" | "SECOND_UPDATE" {
        return this.#migrationJobTask.updateMode == 'forwards' ? 'FIRST_UPDATE' : 'SECOND_UPDATE';
    }


}