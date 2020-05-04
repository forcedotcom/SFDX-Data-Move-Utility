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
import ApiProcessBase from "../models/apiSf/ApiProcessBase";
import IApiProcess from "../models/apiSf/IApiProcess";
import ApiInfo from "../models/apiSf/apiInfo";
import IApiJobCreateResult from "../models/apiSf/IApiJobCreateResult";




/**
 * Implementation of the Salesforce REST Api
 *
 * @export
 * @class BulkApiV1_0sf
 */
export class RestApiSf extends ApiProcessBase implements IApiProcess {

    constructor(logger: MessageUtils, 
        connectionData : IOrgConnectionData, 
        sObjectName : string, 
        operation: OPERATION, 
        pollingIntervalMs: number,
        updateRecordId: boolean) {
        super(logger, connectionData, sObjectName, operation, pollingIntervalMs, updateRecordId);
    }


    // ----------------------- Interface IApiProcess ----------------------------------
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

    // ----------------------- ---------------- -------------------------------------------    

}
