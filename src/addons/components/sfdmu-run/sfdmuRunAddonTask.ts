/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import SfdmuRunAddonTaskData from "./SfdmuRunAddonTaskData";

import { MigrationJobTask, ProcessedData } from "../../../modules/models";
import { OPERATION } from "../../../modules/components/common_components/enumerations";
import { ISFdmuRunCustomAddonTask } from "../../modules/sfdmu-run/custom-addons/package";



export default class SfdmuRunAddonTask implements ISFdmuRunCustomAddonTask  {

    #migrationJobTask: MigrationJobTask;
    #sourceTaskData: SfdmuRunAddonTaskData;
    #targetTaskData: SfdmuRunAddonTaskData;


    constructor(migrationJobTask: MigrationJobTask) {
        this.#migrationJobTask = migrationJobTask;
        this.#sourceTaskData = new SfdmuRunAddonTaskData(migrationJobTask.sourceData);
        this.#targetTaskData = new SfdmuRunAddonTaskData(migrationJobTask.targetData);
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

    get sourceTaskData(): SfdmuRunAddonTaskData {
        return this.#sourceTaskData;
    }

    get targetTaskData(): SfdmuRunAddonTaskData {
        return this.#targetTaskData;
    }

    get processedData(): ProcessedData {
        return this.#migrationJobTask.processedData;
    }

    get updateMode(): "FIRST_UPDATE" | "SECOND_UPDATE" {
        return this.#migrationJobTask.updateMode == 'forwards' ? 'FIRST_UPDATE' : 'SECOND_UPDATE';
    }

    get fieldsInQuery(): string[] {
        return this.#migrationJobTask.data.fieldsInQuery;
    }

     get fieldsToUpdate(): string[] {
        return this.#migrationJobTask.data.fieldsToUpdate;
    }



}