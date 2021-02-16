/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { TaskOrgData } from "../../../../modules/models";;
import { DATA_MEDIA_TYPE } from "../../../components/shared_packages/commonComponents";
import { ISfdmuRunPluginTaskData } from "../../../components/shared_packages/sfdmuRunAddonComponents";



export default class SfdmuRunPluginTaskData implements ISfdmuRunPluginTaskData {

    #taskOrgData: TaskOrgData;

    constructor(taskOrgData: TaskOrgData) {
        this.#taskOrgData = taskOrgData;
    }

    get mediaType(): DATA_MEDIA_TYPE {
        let numValue: number = this.#taskOrgData.org.media;
        return <DATA_MEDIA_TYPE>numValue;
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