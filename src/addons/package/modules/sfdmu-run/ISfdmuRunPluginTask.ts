
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunPluginTaskData } from ".";
import { OPERATION } from "../../base/enumerations";

/**
 * Holds the data per migration task
 */
export default interface ISfdmuRunPluginTask {
    readonly sourceToTargetRecordMap: Map<any, any>,
    readonly sourceTaskData: ISfdmuRunPluginTaskData,
    readonly targetTaskData: ISfdmuRunPluginTaskData,
    readonly sObjectName: string,
    readonly operation: OPERATION,
    getTargetCSVFilename(operation: OPERATION, fileNameSuffix?: string): string,
    readonly sourceCsvFilename: string
}

