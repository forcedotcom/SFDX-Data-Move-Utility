
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DATA_MEDIA_TYPE } from "../../base/enumerations";


/**
 * Holds the data for each data layer (Source / Target) per migration task
 */
export default interface ISfdmuRunPluginTaskData {
    readonly records: Array<any>,
    readonly isSource: boolean,
    readonly extIdRecordsMap: Map<string, string>,
    readonly idRecordsMap: Map<string, any>,
    readonly sObjectName: string,
    readonly mediaType: DATA_MEDIA_TYPE
}