/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { ICsvChunk, CommonUtils, CsvChunks } from "../common_components/commonUtils";
import { OPERATION, CONSTANTS } from "../common_components/statics";
import { IOrgConnectionData } from "../../models";
import { MessageUtils } from "../common_components/messages";
import { IApiEngine, IApiJobCreateResult } from "../../models/api_models/interfaces";
import { ApiEngineBase, ApiInfo, IApiEngineInitParameters } from "../../models/api_models";
import { Sfdx } from "../common_components/sfdx";





/**
 * Implementation of the Salesforce Bulk API v1.0
 *
 * @export
 * @class BulkApiV1_0sf
 */
export class BulkApiV1_0Engine extends ApiEngineBase implements IApiEngine {

    constructor(init: IApiEngineInitParameters) {
        super(init);
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
        let connection = Sfdx.createOrgConnection(this.connectionData);
        connection.bulk.pollTimeout = CONSTANTS.POLL_TIMEOUT;
        let job = connection.bulk.createJob(this.sObjectName, this.strOperation.toLowerCase());
        let recordChunks = CommonUtils.chunkArray(allRecords, this.bulkApiV1BatchSize);
        let chunks = new CsvChunks().fromArrayChunks(recordChunks);
        this.apiJobCreateResult = {
            chunks,
            jobCreateResult: new ApiInfo({
                jobState: "Undefined",
                strOperation: this.strOperation,
                sObjectName: this.sObjectName,
                job,
                jobId: job.id
            }),
            allRecords
        };
        return this.apiJobCreateResult;
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
