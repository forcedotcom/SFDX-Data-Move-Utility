/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { OPERATION } from "../../components/common_components/statics";
import { Logger } from "../../components/common_components/logger";
import { IApiJobCreateResult, IApiEngineInitParameters } from "./interfaces";
import { ApiInfo, IApiEngine } from ".";
import { ICsvChunk, Common } from "../../components/common_components/common";
import { IOrgConnectionData } from "../common_models/interfaces";
import { ScriptObject } from "..";



/**
 * Base class for all ApiProcess inherited classes
 *
 * @export
 * @class ApiProcessBase
 */
export default class ApiEngineBase implements IApiEngine {

    pollingIntervalMs: number
    bulkApiV1BatchSize: number;
    allOrNone: boolean;
    operation: OPERATION;
    updateRecordId: boolean;
    sObjectName: string;
    targetCSVFullFilename: string;
    createTargetCSVFiles: boolean;
    logger: Logger;

    connectionData: IOrgConnectionData;

    apiJobCreateResult: IApiJobCreateResult;

    numberJobRecordsSucceeded: number = 0;
    numberJobRecordsFailed: number = 0;

    get instanceUrl() {
        return this.connectionData.instanceUrl;
    }

    get accessToken() {
        return this.connectionData.accessToken;
    }

    get version() {
        return this.connectionData.apiVersion;
    }

    get strOperation(): string {
        return ScriptObject.getStrOperation(this.operation);
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
        this.createTargetCSVFiles = init.createTargetCSVFiles;
        this.targetCSVFullFilename = init.targetCSVFullFilename;
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
        return null;
    }

    async processCRUDApiJobAsync(progressCallback: (progress: ApiInfo) => void): Promise<Array<any>> {
        let allResultRecords = new Array<any>();
        for (let index = 0; index < this.apiJobCreateResult.chunks.chunks.length; index++) {
            const csvCunk = this.apiJobCreateResult.chunks.chunks[index];
            let resultRecords = await this.processCRUDApiBatchAsync(csvCunk, progressCallback);
            if (!resultRecords) {
                // ERROR RESULT
                await this.writeToTargetCSVFileAsync(new Array<any>());
                return null;
            } else {
                allResultRecords = allResultRecords.concat(resultRecords);
            }
        }
        await this.writeToTargetCSVFileAsync(allResultRecords);
        return allResultRecords;
    }

    async processCRUDApiBatchAsync(csvChunk: ICsvChunk, progressCallback: (progress: ApiInfo) => void): Promise<Array<any>> {
        return null;
    }

    getStrOperation(): string {
        return this.strOperation;
    }
    // ----------------------- ---------------- -------------------------------------------    



    /**
     * Writes target records to csv file during CRUD api operation
     *
     * @param {Array<any>} records
     * @returns {Promise<void>}
     * @memberof ApiEngineBase
     */
    async writeToTargetCSVFileAsync(records: Array<any>): Promise<void> {
        if (this.createTargetCSVFiles) {
            await Common.writeCsvFileAsync(this.targetCSVFullFilename, records, true);
        }
    }

}