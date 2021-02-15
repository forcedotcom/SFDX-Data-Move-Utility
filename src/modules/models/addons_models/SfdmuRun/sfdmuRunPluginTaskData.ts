/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { TaskOrgData } from "../..";;
import { PLUGIN_TASK_DATA_MEDIA_TYPE } from "../addonSharedPackage";
import { ISfdmuRunPluginTaskData } from "../sfdmuRunAddonSharedPackage";



export default class SfdmuRunPluginTaskData implements ISfdmuRunPluginTaskData {

    #taskOrgData: TaskOrgData;

    constructor(taskOrgData: TaskOrgData) {
        this.#taskOrgData = taskOrgData;
    }

    get mediaType(): PLUGIN_TASK_DATA_MEDIA_TYPE {
        let numValue: number = this.#taskOrgData.org.media;
        return <PLUGIN_TASK_DATA_MEDIA_TYPE>numValue;
    }

    get sObjectName(): string {
        return this.#taskOrgData.task.sObjectName;
    }

    get isSource(): boolean {
        return this.#taskOrgData.isSource;
    }

    get idRecordsMap(): Map<string, any> {
        return this.#taskOrgData.idRecordsMap;
    }

    get extIdRecordsMap(): Map<string, string> {
        return this.#taskOrgData.extIdRecordsMap;
    }

    get records(): any[] {
        return this.#taskOrgData.records;
    }
}