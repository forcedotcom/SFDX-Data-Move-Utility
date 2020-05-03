/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { CommonUtils, ICsvChunk } from "./commonUtils";
import parse = require('csv-parse/lib/sync');
import { RESOURCES } from "./messages";
import { RESULT_STATUSES, OPERATION, CONSTANTS } from "./statics";
import { ApiResult, ApiResultRecord, IApiProcess, MigrationJobTask, IApiJobCreateResult, ApiProcessBase } from "../models";
const request = require('request');
const endpoint = '/services/data/[v]/jobs/ingest';
const requestTimeout = 10 * 60 * 1000;// 10 minutes of timeout for long-time operations and for large csv files and slow internet connection





/**
 * Implementation of the Salesforce Bulk API v2.0
 *
 * @export
 * @class BulkApiV2_0sf
 */
export class BulkApiV2_0sf extends ApiProcessBase implements IApiProcess {

    operationType: string | "insert" | "update" | "delete";
    sourceRecords: Array<object> = new Array<object>();
    sourceRecordsHashmap: Map<string, object> = new Map<string, object>();

    get endpointUrl(): string {
        return endpoint.replace('[v]', `v${this.version}`);
    }

    constructor(task: MigrationJobTask, isSource: boolean, operation: OPERATION, updateRecordId: boolean) {
        super(task, isSource, operation, updateRecordId);
    }


    // ----------------------- Interface IApiProcess ----------------------------------
    async executeCRUD(allRecords: Array<any>, progressCallback: (progress: ApiResult) => void): Promise<Array<any>> {
        await this.createCRUDApiJobAsync(allRecords);
        return await this.processCRUDApiJobAsync(progressCallback);
    }

    async createCRUDApiJobAsync(allRecords: Array<any>): Promise<IApiJobCreateResult> {
        let csvChunks = CommonUtils.createCsvStringsFromArray(allRecords,
            CONSTANTS.BULK_API_V2_MAX_CSV_SIZE_IN_BYTES,
            CONSTANTS.BULK_API_V2_BLOCK_SIZE);
        this.apiJobCreateResult = {
            chunks: csvChunks,
            jobCreateResult: new ApiResult({
                jobState: "Undefined",
                strOperation: this.strOperation,
                sObjectName: this.sObjectName,
            }),
            allRecords
        };
        return this.apiJobCreateResult;
    }

    async processCRUDApiJobAsync(progressCallback: (progress: ApiResult) => void): Promise<Array<any>> {
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

    async processCRUDApiBatchAsync(csvChunk: ICsvChunk, progressCallback: (progress: ApiResult) => void): Promise<Array<any>> {

        let self = this;

        // Create bulk job *************************
        let jobResult = await this.createBulkJobAsync(this.sObjectName, this.strOperation.toLowerCase());
        if (progressCallback) {
            // Progress message: job was created
            progressCallback(jobResult);
        }
        if (jobResult.resultStatus != RESULT_STATUSES.JobCreated) {
            // ERROR RESULT
            return null;
        }

        // Create bulk batch *************************
        let batchResult = await this.createBulkBatchAsync(jobResult.contentUrl, csvChunk.csvString, csvChunk.records);
        if (progressCallback) {
            // Progress message: job was created
            progressCallback(batchResult);
        }
        if (batchResult.resultStatus != RESULT_STATUSES.BatchCreated) {
            // ERROR RESULT
            return null;
        }

        // Close batch *************************
        batchResult = await this.closeBulkJobAsync(jobResult.contentUrl);
        if (progressCallback) {
            // Progress message: job was created
            progressCallback(batchResult);
        }
        if (batchResult.resultStatus != RESULT_STATUSES.DataUploaded) {
            // ERROR RESULT
            return null;
        }

        // Poll bulk batch status *************************
        let numberBatchRecordsProcessed = 0;
        batchResult = await this.waitForBulkJobCompleteAsync(jobResult.contentUrl, this.script.pollingIntervalMs, function (progress: ApiResult) {
            if (numberBatchRecordsProcessed != progress.numberRecordsProcessed) {
                // Store current number of processed value
                numberBatchRecordsProcessed = progress.numberRecordsProcessed;
                // Total processed and total failed
                progress.numberRecordsProcessed += self.numberJobRecordsSucceeded;
                progress.numberRecordsFailed += self.numberJobRecordsFailed;
                if (progressCallback) {
                    // Progress message: N records processed
                    progressCallback(progress);
                }
            }
        });
        if (batchResult.resultStatus != RESULT_STATUSES.Completed) {
            // ERROR RESULT
            return null;
        }

        // Get bulk batch result *************************
        batchResult = await this.getBulkJobResultAsync(jobResult.contentUrl);
        let rets = batchResult.resultRecords;

        csvChunk.records.forEach((record, index) => {
            if (rets[index].isSuccess) {
                if (self.updateRecordId) {
                    record["Id"] = rets[index].id;
                    record["Errors"] = null;
                }
                self.numberJobRecordsSucceeded++;
            } else {
                if (rets[index].errorMessage) {
                    record["Errors"] = rets[index].errorMessage;
                }
                self.numberJobRecordsFailed++;
            }
        });

        // SUCCESS RESULT
        return csvChunk.records;

    }

    // ----------------------- ---------------- -------------------------------------------    

    /**
     * Creates new Bulk job
     *
     * @param {string} objectAPIName Object to process
     * @param {string} operationType Operation type to perform
     * @returns {Promise<ApiResult>}
     * @memberof BulkAPI2sf
     */
    async createBulkJobAsync(objectAPIName: string, operationType: string | "insert" | "update" | "delete"): Promise<ApiResult> {

        let self = this;
        this.operationType = operationType;
        return new Promise(resolve => {
            request.post({
                url: this.instanceUrl + this.endpointUrl,
                body: JSON.stringify({
                    object: objectAPIName,
                    contentType: 'CSV',
                    operation: operationType,
                    lineEnding: 'LF'
                }),
                auth: {
                    'bearer': this.accessToken
                },
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Accept': 'application/json'
                }
            }, function (error: any, response: any, body: any) {
                if (!error && response.statusCode == 200) {
                    let info = JSON.parse(body);
                    resolve(new ApiResult({
                        jobId: info.id,
                        contentUrl: info.contentUrl,
                        sObjectName: self.sObjectName,
                        strOperation: self.strOperation,
                        jobState: info.state,
                        errorMessage: info.errorMessage
                    }));
                }
                else {
                    self._apiRequestErrorHandler(resolve, error, response, body);
                }
            });
        });
    }

    /**
     *  Create batch for the given bulk job and initializes uploading of csv content
     *
     * @param {string} contentUrl Content url returned by createBulkJob()
     * @param {string} csvContent The string contains records to process in serialized csv format
     * @param {Array<object>} records Records to process were used to generate the csv string
     * @returns {Promise<ApiResult>}
     * @memberof BulkAPI2sf
     */
    async createBulkBatchAsync(contentUrl: string, csvContent: string, records: Array<object>): Promise<ApiResult> {
        let self = this;
        this.sourceRecords = records;
        if (this.operationType == "insert") {
            this.sourceRecordsHashmap = CommonUtils.mapArrayItemsByHashcode(records, undefined);
        } else {
            this.sourceRecordsHashmap = CommonUtils.mapArrayItemsByPropertyName(records, "Id");
        }
        return new Promise(resolve => {
            request.put({
                timeout: requestTimeout,
                url: this.instanceUrl + '/' + contentUrl,
                body: csvContent,
                auth: {
                    'bearer': this.accessToken
                },
                headers: {
                    'Content-Type': 'text/csv',
                    'Accept': 'application/json'
                }
            }, function (error: any, response: any) {
                if (!error && response.statusCode == 201) {
                    resolve(new ApiResult({
                        jobState: "UploadStart",
                        sObjectName: self.sObjectName,
                        strOperation: self.strOperation,
                    }));
                }
                else {
                    self._apiRequestErrorHandler(resolve, error, response, undefined);
                }
            });
        });
    }

    /**
     * Closes bulk job and forces csv content to be uploaded 
     *
     * @param {string} contentUrl Content url returned by createBulkJob()
     * @returns {Promise<ApiResult>}
     * @memberof BulkAPI2sf
     */
    async closeBulkJobAsync(contentUrl: string): Promise<ApiResult> {
        let self = this;
        return new Promise(resolve => {
            request.patch({
                url: this.instanceUrl + '/' + contentUrl.replace("/batches", "/"),
                body: JSON.stringify({
                    "state": "UploadComplete"
                }),
                auth: {
                    'bearer': this.accessToken
                },
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Accept': 'application/json'
                }
            }, function (error: any, response: any, body: any) {
                if (!error && response.statusCode == 200) {
                    let info = JSON.parse(body);
                    resolve(new ApiResult({
                        jobState: info.state,
                        sObjectName: self.sObjectName,
                        strOperation: self.strOperation,
                    }));
                }
                else {
                    self._apiRequestErrorHandler(resolve, error, response, body);
                }
            });
        });
    }

    /**
     * Polls  job for the status
     *
     * @param {string} contentUrl Content url returned by createBulkJob()
     * @returns {Promise<ApiResult>} 
     * @memberof BulkAPI2sf
     */
    async pollBulkJobAsync(contentUrl: string): Promise<ApiResult> {
        let self = this;
        return new Promise(resolve => {
            request.get({
                url: this.instanceUrl + '/' + contentUrl.replace("/batches", "/"),
                auth: {
                    'bearer': this.accessToken
                },
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Accept': 'application/json'
                }
            }, function (error: any, response: any, body: any) {
                if (!error && response.statusCode == 200) {
                    let info = JSON.parse(body);
                    resolve(new ApiResult({
                        errorMessage: info.errorMessage,
                        jobState: info.state,
                        numberRecordsFailed: info.numberRecordsFailed,
                        numberRecordsProcessed: info.numberRecordsProcessed,
                        sObjectName: self.sObjectName,
                        strOperation: self.strOperation,
                    }));
                }
                else {
                    self._apiRequestErrorHandler(resolve, error, response, body);
                }
            });
        });
    }

    /**
     * Asks the server for the job status by given polling 
     * interval and returns job status when the job is completed or failed
     *
     * @param {string} contentUrl
     * @param {number} pollInterval
     * @param {(result: ApiResult) => any} pollCallback
     * @returns {Promise<ApiResult>}
     * @memberof BulkAPI2sf
     */
    async waitForBulkJobCompleteAsync(contentUrl: string,
        pollInterval: number,
        pollCallback: (result: ApiResult) => any): Promise<ApiResult> {

        let self = this;

        return new Promise(resolve => {

            let interval = setInterval(async () => {

                try {

                    let res = await self.pollBulkJobAsync(contentUrl);

                    switch (res.resultStatus) {

                        case RESULT_STATUSES.Completed:
                        case RESULT_STATUSES.FailedOrAborted:
                            clearInterval(interval);
                            resolve(res);
                            return;

                        case RESULT_STATUSES.Undefined:
                            throw new Error("Undefined job");

                        case RESULT_STATUSES.ProcessError:
                            clearInterval(interval);
                            self._apiRequestErrorHandler(resolve, {
                                message: res.errorMessage,
                                stack: res.errorStack
                            }, null, null);
                            return;

                        default:
                            if (pollCallback) {
                                pollCallback(res);
                            }
                            return;

                    }

                } catch (e) {
                    clearInterval(interval);
                    self._apiRequestErrorHandler(resolve, e, null, null);
                }

            }, pollInterval);
        });
    }

    /**
     * Returns completed job result, inculding all source and target records with status per target record.
     *
     * @param {string} contentUrl Content url returned by createBulkJob()
     * @returns {Promise<ApiResult>}
     * @memberof BulkAPI2sf
     */
    async getBulkJobResultAsync(contentUrl: string): Promise<ApiResult> {
        let self = this;
        return new Promise(resolve => {
            request.get({
                timeout: requestTimeout,
                url: this.instanceUrl + '/' + contentUrl.replace("/batches", "/") + 'successfulResults/',
                auth: {
                    'bearer': this.accessToken
                },
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Accept': 'application/json'
                }
            }, async function (error: any, response: any, body: any) {
                if (!error && response.statusCode >= 200 && response.statusCode < 400) {

                    if (response.statusCode != 200) {
                        resolve(new ApiResult({
                            jobState: "InProgress",
                            sObjectName: self.sObjectName,
                            strOperation: self.strOperation,
                        }));
                        return;
                    }

                    try {
                        let csv = parse(body, {
                            skip_empty_lines: true,
                            cast: self._csvCast
                        });

                        let allRecords = CommonUtils.transformArrayOfArrays(csv);
                        let failedRecords = await self._getBulkJobUnsuccessfullResultAsync(contentUrl, true);
                        let unprocessedRecords = await self._getBulkJobUnsuccessfullResultAsync(contentUrl, false);
                        allRecords = allRecords.concat(failedRecords, unprocessedRecords);

                        let map: Map<object, object>;

                        if (self.operationType == "insert") {
                            map = CommonUtils.mapArraysByHashcode(undefined, allRecords, [
                                "sf__Created",
                                "sf__Id",
                                "sf__Error",
                                "sf__Unprocessed"
                            ], self.sourceRecordsHashmap);
                        } else {
                            map = CommonUtils.mapArraysByItemProperty(undefined, allRecords, "Id", self.sourceRecordsHashmap);
                        }
                        let resultRecords = self.sourceRecords.map(sourceRecord => {
                            let targetRecord = map.get(sourceRecord);
                            let resultRecord = new ApiResultRecord({
                                sourceRecord,
                                targetRecord,
                                isMissingSourceTargetMapping: !targetRecord,
                                isFailed: targetRecord && !!targetRecord["sf__Error"],
                                isUnprocessed: targetRecord && !!targetRecord["sf__Unprocessed"],
                                errorMessage: targetRecord && targetRecord["sf__Error"],
                                id: targetRecord && (targetRecord["sf__Id"] || targetRecord["Id"]),
                                isCreated: targetRecord && !!targetRecord["sf__Created"]
                            });
                            if (resultRecord.isUnprocessed) {
                                resultRecord.errorMessage = self.logger.getResourceString(RESOURCES.unprocessedRecord);
                            } else if (resultRecord.isMissingSourceTargetMapping) {
                                resultRecord.errorMessage = self.logger.getResourceString(RESOURCES.invalidRecordHashcode);
                            }
                            return resultRecord;
                        });
                        resolve(new ApiResult({
                            resultRecords,
                            jobState: "JobComplete",
                            sObjectName: self.sObjectName,
                            strOperation: self.strOperation,
                        }));
                    } catch (e) {
                        if (typeof e.message == "string") {
                            self._apiRequestErrorHandler(
                                resolve,
                                e,
                                undefined,
                                undefined
                            );
                        } else {
                            let responseError = JSON.parse(e.message);
                            self._apiRequestErrorHandler(
                                resolve,
                                responseError.error,
                                responseError.response,
                                responseError.body
                            );
                        }
                    }
                }
                else {
                    self._apiRequestErrorHandler(resolve, error, response, body);
                }
            });
        });
    }




    // ----------------------- Private members -------------------------------------------
    private async _getBulkJobUnsuccessfullResultAsync(contentUrl: string, isGetFailed: boolean): Promise<Array<object>> {
        let self = this;
        return new Promise(resolve => {
            request.get({
                timeout: requestTimeout,
                url: this.instanceUrl + '/' + contentUrl.replace("/batches", "/") + (isGetFailed ? 'failedResults/' : 'unprocessedrecords/'),
                auth: {
                    'bearer': this.accessToken
                },
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Accept': 'application/json'
                }
            }, function (error: any, response: any, body: any) {
                if (!error && response.statusCode == 200) {
                    let csv = parse(body, {
                        skip_empty_lines: true,
                        cast: self._csvCast
                    });
                    let unprocessedRecords = CommonUtils.transformArrayOfArrays(csv);
                    if (!isGetFailed) {
                        unprocessedRecords.forEach(record => {
                            record["sf__Unprocessed"] = true
                        });
                    }
                    resolve(unprocessedRecords);
                }
                else {
                    throw new Error(JSON.stringify({
                        error,
                        response,
                        body
                    }));
                }
            });

        });
    }

    private _csvCast(value: any, context: any) {

        if (context.header || typeof context.column == "undefined") {
            return value;
        }

        if (value == "#N/A") {
            return null;
        }

        if (value == "TRUE" || value == "true")
            return true;
        else if (value == "FALSE" || value == "false")
            return false;

        if (!value) {
            return null;
        }

        return value;
    }

    private _apiRequestErrorHandler(resolve: any, error: any, response: any, body: any) {
        let self = this;
        if (!response) {
            // Runtime error
            resolve(new ApiResult({
                errorMessage: error.message,
                errorStack: error.stack,
                sObjectName: self.sObjectName,
                strOperation: self.strOperation,
            }));
        } else {
            // Rest API error
            let info = body && JSON.parse(body)[0] || {
                message: "Unexpected error",
            };
            resolve(new ApiResult({
                errorMessage: info.message,
                sObjectName: self.sObjectName,
                strOperation: self.strOperation,
            }));
        }
    }

}