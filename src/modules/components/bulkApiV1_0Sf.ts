/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { CommonUtils } from "./commonUtils";
import parse = require('csv-parse/lib/sync');
import { MessageUtils, RESOURCES } from "./messages";
import { RESULT_STATUSES, OPERATION } from "./statics";
import { ApiResult, ApiResultRecord, IApiProcess, MigrationJobTask, ScriptOrg, IApiJobCreateResult, ApiProcessBase } from "../models";



/**
 * Implementation of the Salesforce Bulk API v2.0
 *
 * @export
 * @class BulkApiV1_0sf
 */
export class BulkApiV1_0sf extends ApiProcessBase implements IApiProcess {

    constructor(task: MigrationJobTask, isSource: boolean, operation: OPERATION) {
        super(task, isSource, operation);
    }


    // ----------------------- Interface IApiProcess ----------------------------------
    async executeCRUD(allRcords: Array<any>, progressCallback: (progress: ApiResult) => void): Promise<Array<any>> {
        await this.createCRUDApiJobAsync(allRcords);
        return await this.processCRUDApiJobAsync(progressCallback);
    }

    async createCRUDApiJobAsync(allRecords: Array<any>): Promise<IApiJobCreateResult> {
        // TODO: Implement this

    }

    async processCRUDApiJobAsync(progressCallback: (progress: ApiResult) => void): Promise<Array<any>> {
        // TODO: Implement this
    }

    async processCRUDApiBatchAsync(chunkRecords: Array<any>, progressCallback: (progress: ApiResult) => void): Promise<Array<any>> {
        // TODO: Implement this
    }

    // ----------------------- ---------------- -------------------------------------------    

}
