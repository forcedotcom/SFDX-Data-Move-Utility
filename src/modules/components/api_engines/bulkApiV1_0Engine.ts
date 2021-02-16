/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApiEngineBase, ApiInfo, IApiEngineInitParameters } from '../../models/api_models';
import { Common } from '../common_components/common';
import { CONSTANTS } from '../common_components/statics';
import { IApiEngine, IApiJobCreateResult, ICsvChunk } from '../../models/api_models/helper_interfaces';
import { Sfdx } from '../common_components/sfdx';
import { CsvChunks } from '../../models';
import { OPERATION } from '../../../addons/components/shared_packages/commonComponents';



/**
 * Implementation of the Salesforce Bulk API v1.0
 *
 * @export
 * @class BulkApiV1_0sf
 */
// tslint:disable-next-line: class-name
export class BulkApiV1_0Engine extends ApiEngineBase implements IApiEngine {

    constructor(init: IApiEngineInitParameters) {
        super(init);
    }


    // ----------------------- Interface IApiProcess ----------------------------------
    getEngineName(): string {
        return "Bulk API V1.0";
    }

    async createCRUDApiJobAsync(allRecords: Array<any>): Promise<IApiJobCreateResult> {
        let connection = Sfdx.createOrgConnection(this.connectionData);
        connection.bulk.pollTimeout = CONSTANTS.POLL_TIMEOUT;
        let job = connection.bulk.createJob(
            this.sObjectName,
            this.strOperation.toLowerCase(),
            {
                concurrencyMode: this.concurrencyMode
            }
        );
        let recordChunks = Common.chunkArray(allRecords, this.bulkApiV1BatchSize);
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
            let pollTimer: any;
            let numberBatchRecordsProcessed = 0;
            let job = this.apiJobCreateResult.apiInfo.job;
            let connection = this.apiJobCreateResult.connection;
            let records = csvChunk.records;
            let batch = job.createBatch();
            batch.execute(records);
            batch.on("error", function (batchInfo: any) {
                if (pollTimer) {
                    clearInterval(pollTimer);
                }
                if (progressCallback) {
                    progressCallback(new ApiInfo({
                        jobState: "Failed",
                        errorMessage: batchInfo.stateMessage,
                        jobId: job.id,
                        batchId: batch.id
                    }));
                }
                // ERROR RESULT
                resolve(null);
                return;
            });
            batch.on("queue", function (batchInfo: any) {
                batch.poll(self.pollingIntervalMs, CONSTANTS.POLL_TIMEOUT);
                if (progressCallback) {
                    // Progress message: job was created
                    progressCallback(new ApiInfo({
                        jobState: "Open",
                        jobId: job.id
                    }));
                    // Progress message: batch was created
                    progressCallback(new ApiInfo({
                        jobState: "UploadStart",
                        jobId: job.id,
                        batchId: batch.id
                    }));
                }
                pollTimer = setInterval(function () {
                    connection.bulk.job(job.id).batch(batch.id).check((error: any, results: any) => {
                        if (error) {
                            clearInterval(pollTimer);
                            if (progressCallback) {
                                progressCallback(new ApiInfo({
                                    jobState: "Failed",
                                    errorMessage: error,
                                    jobId: job.id,
                                    batchId: batch.id
                                }));
                            }
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
                                    jobId: job.id,
                                    batchId: batch.id
                                }));
                            }
                            numberBatchRecordsProcessed = processed;
                            let progress = new ApiInfo({
                                jobState: "InProgress",
                                numberRecordsProcessed: self.numberJobRecordsSucceeded + processed,
                                numberRecordsFailed: self.numberJobRecordsFailed + failed,
                                jobId: job.id,
                                batchId: batch.id
                            });
                            if (progressCallback) {
                                // Progress message: N batch records were processed
                                progressCallback(progress);
                            }
                        }
                    });
                }, self.pollingIntervalMs);
            });
            batch.on("response", async function (resultRecords: any) {
                clearInterval(pollTimer);
                records.forEach((record, index) => {
                    if (resultRecords[index].success) {
                        record[CONSTANTS.ERRORS_FIELD_NAME] = null;
                        if (self.operation == OPERATION.Insert && self.updateRecordId) {
                            record["Id"] = resultRecords[index].id;
                        }
                        self.numberJobRecordsSucceeded++;
                    } else {
                        if (resultRecords[index].errors) {
                            record[CONSTANTS.ERRORS_FIELD_NAME] = resultRecords[index].errors.join('; ');
                        } else {
                            record[CONSTANTS.ERRORS_FIELD_NAME] = null;
                        }
                        self.numberJobRecordsFailed++;
                    }
                });
                if (progressCallback) {
                    if (self.numberJobRecordsFailed > 0) {
                        // Some records are failed
                        progressCallback(new ApiInfo({
                            jobState: "JobComplete",
                            numberRecordsProcessed: self.numberJobRecordsSucceeded,
                            numberRecordsFailed: self.numberJobRecordsFailed,
                            jobId: job.id,
                            batchId: batch.id
                        }));
                    }
                    // Progress message: operation finished
                    progressCallback(new ApiInfo({
                        jobState: "OperationFinished",
                        jobId: job.id,
                        batchId: batch.id
                    }));
                }
                // SUCCESS RESULT
                resolve(records);
            });
        });
    }
    // ----------------------- ---------------- -------------------------------------------    

}
