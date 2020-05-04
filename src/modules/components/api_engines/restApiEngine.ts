/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { ICsvChunk } from "../common_components/commonUtils";
import { OPERATION } from "../common_components/statics";
import { IOrgConnectionData } from "../../models";
import { MessageUtils } from "../common_components/messages";
import { IApiEngine, IApiJobCreateResult } from "../../models/api_models/interfaces";
import { ApiEngineBase, ApiInfo, IApiEngineInitParameters } from "../../models/api_models";





/**
 * Implementation of the Salesforce REST Api
 *
 * @export
 * @class BulkApiV1_0sf
 */
export class RestApiEngine extends ApiEngineBase implements IApiEngine {

    constructor(init: IApiEngineInitParameters) {
        super(init);
    }



    // ----------------------- Interface IApiProcess ----------------------------------
    getEngineName(): string {
        return "REST API";
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

    getStrOperation(): string {
        return this.strOperation;
    }
    // ----------------------- ---------------- -------------------------------------------    


}
