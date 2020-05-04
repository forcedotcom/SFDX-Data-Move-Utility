/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { ICsvChunk } from "./commonUtils";
import { OPERATION } from "./statics";
import { IOrgConnectionData } from "../models";
import { MessageUtils } from "./messages";
import { IApiProcess, IApiJobCreateResult } from "../models/apiSf/interfaces";
import { ApiProcessBase, ApiInfo, IApiProcessParameters } from "../models/apiSf";





/**
 * Implementation of the Salesforce Bulk API v1.0
 *
 * @export
 * @class BulkApiV1_0sf
 */
export class BulkApiV1_0sf extends ApiProcessBase implements IApiProcess {

    constructor(params: IApiProcessParameters) {
        super(params);
    }


    // ----------------------- Interface IApiProcess ----------------------------------
    getEngineName(): string {
        return "Bulk API V1.0";
    }

    async executeCRUD(allRcords: Array<any>, progressCallback: (progress: ApiInfo) => void): Promise<Array<any>> {
        await this.createCRUDApiJobAsync(allRcords);
        return await this.processCRUDApiJobAsync(progressCallback);
    }

    async createCRUDApiJobAsync(allRecords: Array<any>): Promise<IApiJobCreateResult> {
        // TODO: Implement this
        return null;
    }

    async processCRUDApiJobAsync(progressCallback: (progress: ApiInfo) => void): Promise<Array<any>> {
        // TODO: Implement this
        return null;
    }

    async processCRUDApiBatchAsync(csvChunk: ICsvChunk, progressCallback: (progress: ApiInfo) => void): Promise<Array<any>> {
        // TODO: Implement this
        return null;
    }

    getStrOperation() : string {
        return this.strOperation;
    }
    // ----------------------- ---------------- -------------------------------------------    

}
