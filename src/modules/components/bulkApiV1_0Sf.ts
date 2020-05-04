/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { ICsvChunk, CommonUtils, CsvChunks } from "./commonUtils";
import { OPERATION, CONSTANTS } from "./statics";
import { IOrgConnectionData } from "../models";
import { MessageUtils } from "./messages";
import { IApiEngine, IApiJobCreateResult } from "../models/apiSf/interfaces";
import { ApiEngineBase, ApiInfo, IApiEngineInitParameters } from "../models/apiSf";
import { ApiSf } from "./apiSf";





/**
 * Implementation of the Salesforce Bulk API v1.0
 *
 * @export
 * @class BulkApiV1_0sf
 */
export class BulkApiV1_0sf extends ApiEngineBase implements IApiEngine {

    constructor(params: IApiEngineInitParameters) {
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
        let connection = ApiSf.createOrgConnection(this.connectionData);
        connection.bulk.pollTimeout = CONSTANTS.POLL_TIMEOUT;
        let job = connection.bulk.createJob(this.sObjectName, this.strOperation.toLowerCase());
        let chunks = CommonUtils.chunkArray(allRecords, this.bulkApiV1BatchSize);
        let csvChunks = new CsvChunks().fromArrayOfRecords(chunks);
        this.apiJobCreateResult = {
            chunks: csvChunks,
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
