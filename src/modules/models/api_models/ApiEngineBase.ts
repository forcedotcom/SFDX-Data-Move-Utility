/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { OPERATION } from "../../components/common_components/statics";
import { MessageUtils } from "../../components/common_components/messages";

import { IApiJobCreateResult, IApiEngineInitParameters } from "./interfaces";
import { ApiInfo, IApiEngine } from ".";
import { ICsvChunk } from "../../components/common_components/commonUtils";
import { IOrgConnectionData } from "../common_models/interfaces";




/**
 * Base class for all ApiProcess inherited classes
 *
 * @export
 * @class ApiProcessBase
 */
export default class ApiEngineBase  implements IApiEngine {

    isSource: boolean;
    pollingIntervalMs: number
    bulkApiV1BatchSize: number;
    allOrNone: boolean;
    operation: OPERATION;
    updateRecordId: boolean;
    sObjectName : string;
    logger: MessageUtils;

    connectionData : IOrgConnectionData;

    apiJobCreateResult: IApiJobCreateResult;

    numberJobRecordsSucceeded: number =  0;
    numberJobRecordsFailed: number =  0;

    get instanceUrl(){
        return this.connectionData.instanceUrl;
    }

    get accessToken(){
        return this.connectionData.accessToken;
    }

    get version(){
        return this.connectionData.apiVersion;
    }

    get strOperation(): string {
        if ((typeof this.operation != "string") == true) {
            return OPERATION[this.operation].toString();
        }
        return this.operation.toString();
    }

    constructor(init: IApiEngineInitParameters) {
        this.logger = init.logger;
        this.connectionData = init.connectionData;
        this.sObjectName = init.sObjectName;
        this.operation = init.operation;
        this.pollingIntervalMs = init.pollingIntervalMs;
        this.updateRecordId = init.updateRecordId;
        this.bulkApiV1BatchSize = init.bulkApiV1BatchSize;
        this.allOrNone = init.allOrNone;
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
        // TODO: Override this
        return null;
    }

    async processCRUDApiJobAsync(progressCallback: (progress: ApiInfo) => void): Promise<Array<any>> {
        let allResultRecords = new Array<any>();
        for (let index = 0; index < this.apiJobCreateResult.chunks.chunks.length; index++) {
            const csvCunk = this.apiJobCreateResult.chunks.chunks[index];
            let resultRecords = await this.processCRUDApiBatchAsync(csvCunk, progressCallback);
            if (!resultRecords) {
                // ERROR RESULT
                return null;
            } else {
                allResultRecords = allResultRecords.concat(resultRecords);
            }
        }
        return allResultRecords;
    }

    async processCRUDApiBatchAsync(csvChunk: ICsvChunk, progressCallback: (progress: ApiInfo) => void): Promise<Array<any>> {
        // TODO: Override this
        return null;
    }

    getStrOperation(): string {
        return this.strOperation;
    }
    // ----------------------- ---------------- -------------------------------------------    

}