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
import { Job } from "jsforce";





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
            apiInfo: new ApiInfo({
                jobState: "Undefined",
                strOperation: this.strOperation,
                sObjectName: this.sObjectName,
                job,
                jobId: job.id,
            }),
            allRecords,
            connection
        };
        return this.apiJobCreateResult;
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

        let self = this;

        return new Promise<Array<any>>((resolve, reject) => {
            if (progressCallback) {
                // Progress message: operation started
                progressCallback(new ApiInfo({
                    jobState: "OperationStarted"
                }));
            }

            // Create bulk batch and upload csv ***************************
            let pollTimer : any;
            let numberBatchRecordsProcessed = 0;
            let job = this.apiJobCreateResult.apiInfo.job;
            let connection = this.apiJobCreateResult.connection;
            let records = csvChunk.records;
            // Progress message: job was created
            progressCallback(new ApiInfo({
                jobState: "Open",
                jobId: job.jobId
            }));
            let batch = job.createBatch();
            batch.execute(records);
            batch.on("error", function (batchInfo: any) {
                if (pollTimer) {
                    clearInterval(pollTimer);
                }
                // ERROR RESULT
                resolve(null);
                return;
            });
            batch.on("queue", function (batchInfo: any) {
                batch.poll(self.pollingIntervalMs, CONSTANTS.POLL_TIMEOUT);
                if (progressCallback) {
                    // Progress message: batch was created
                    progressCallback(new ApiInfo({
                        jobState: "UploadStart",
                        jobId: job.jobId,
                        batchId: batch.id
                    }));
                }
                pollTimer = setInterval(function () {
                    connection.bulk.job(job.id).batch(batch.id).check((err: any, results: any) => {
                        if (err) {
                            clearInterval(pollTimer);
                            // ERROR RESULT                                                        
                            resolve(null);
                            return;
                        }
                        let processed = +results.numberRecordsProcessed;
                        let failed = +results.numberRecordsFailed;
                        if (numberBatchRecordsProcessed != processed) {
                            if (numberBatchRecordsProcessed == 0) {
                                // First time
                                // Progress message: data uploaded
                                progressCallback(new ApiInfo({
                                    jobState: "UploadComplete",
                                    jobId: job.jobId,
                                    batchId: batch.id
                                }));
                            }
                            numberBatchRecordsProcessed = processed;
                            let progress = new ApiInfo({
                                jobState: "InProgress",
                                jobId: job.jobId,
                                batchId: batch.id,
                                numberRecordsProcessed: self.numberJobRecordsSucceeded + processed,
                                numberRecordsFailed: self.numberJobRecordsFailed + failed
                            });
                            if (progressCallback) {
                                // Progress message: N batch records were processed
                                progressCallback(progress);
                            }
                        }
                    });
                }, self.pollingIntervalMs);
            });
            batch.on("response", function (resultRecords: any) {
                clearInterval(pollTimer);
                records.forEach((record, index) => {
                    if (resultRecords[index].success) {
                        if (self.operation == OPERATION.Insert && self.updateRecordId) {
                            record["Id"] = resultRecords[index].id;
                        }
                        record["Errors"] = null;
                        self.numberJobRecordsSucceeded++;
                    } else {
                        if (resultRecords[index].errors) {
                            record["Errors"] = resultRecords[index].errors.join('; ');
                        } else {
                            record["Errors"] = null;
                        }
                        self.numberJobRecordsFailed++;
                    }
                });
                if (progressCallback) {
                    // Progress message: operation finished
                    progressCallback(new ApiInfo({
                        jobState: "OperationFinished",
                        jobId: job.id,
                        batchId: batch.id
                    }));
                }
                resolve(records);
            });
        });
    }

    getStrOperation(): string {
        return this.strOperation;
    }
    // ----------------------- ---------------- -------------------------------------------    

}
