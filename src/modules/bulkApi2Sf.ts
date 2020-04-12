/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CommonUtils } from "./common";

const request = require('request');
const endpoint = '/services/data/[v]/jobs/ingest';
// 10 minutes of timeout for long-time operations and for large csv files and slow internet connection
const requestTimeout = 10 * 60 * 1000;
import parse = require('csv-parse/lib/sync');

const ErrorMessages = {
    UnprocessedRecord: "Unprocessed record",
    MissingSourceTargetMapping: "Invalid record hashcode. Unable to find matching record from the response returned by the bulk job"
}


export enum RESULT_STATUSES {
    Undefined = "Undefined",
    JobCreated = "JobCreated",
    BatchCreated = "BatchCreated",
    DataUploaded = "DataUploaded",
    InProgress = "InProgress",
    Completed = "Completed",
    FailedOrAborted = "FailedOrAborted",
    ProcessError = "ProcessError"
}


export class BulkApiResultRecord {

    constructor(init: Partial<BulkApiResultRecord>) {
        Object.assign(this, init);
    }

    id: string;
    sourceRecord: object;
    targetRecord: object;

    isFailed: boolean;
    isUnprocessed: boolean;
    isMissingSourceTargetMapping: boolean;

    get isSuccess() {
        return !this.isFailed
            && !this.isUnprocessed
            && !this.isMissingSourceTargetMapping;
    }

    isCreated: boolean;
    errorMessage: string;
}


export class BulkAPIResult {

    constructor(init?: Partial<BulkAPIResult>) {
        Object.assign(this, init);
        this.resultRecords = this.resultRecords || new Array<BulkApiResultRecord>();
    }

    contentUrl: string;

    jobId: string;
    jobState: "Undefined" | "Open" | "Closed" | "Aborted" | "Failed" | "UploadStart" | "UploadComplete" | "InProgress" | "JobComplete" = "Undefined";

    errorMessage: string;
    errorStack: string;

    numberRecordsProcessed: number;
    numberRecordsFailed: number;

    resultRecords: Array<BulkApiResultRecord>;

    get resultStatus(): RESULT_STATUSES {

        if (!!this.errorMessage) {
            return RESULT_STATUSES.ProcessError;
        }

        switch (this.jobState) {

            default:
                return RESULT_STATUSES.Undefined;

            case "Open":
                return RESULT_STATUSES.JobCreated;

            case "UploadStart":
                return RESULT_STATUSES.BatchCreated;

            case "UploadComplete":
                return RESULT_STATUSES.DataUploaded;

            case "InProgress":
            case "Closed":
                return RESULT_STATUSES.InProgress;

            case "Aborted":
            case "Failed":
                return RESULT_STATUSES.FailedOrAborted;

            case "JobComplete":
                return RESULT_STATUSES.Completed;
        }
    }
}





export class BulkApi2sf {

    instanceUrl: string;
    accessToken: string;
    endpointUrl: string;

    operationType: "insert" | "update" | "delete";

    sourceRecords: Array<object> = new Array<object>();
    sourceRecordsHashmap: Map<string, object> = new Map<string, object>();


    constructor(apiVersion: string, accessToken: string, instanceUrl: string) {
        this.instanceUrl = instanceUrl;
        this.accessToken = accessToken;
        this.endpointUrl = endpoint.replace('[v]', `v${apiVersion}`);
    }


    /**
     * Creates new Bulk job
     *
     * @param {string} objectAPIName Object to process
     * @param {string} operationType Operation type to perform
     * @returns {Promise<BulkAPIResult>}
     * @memberof BulkAPI2sf
     */
    async createBulkJobAsync(objectAPIName: string, operationType: "insert" | "update" | "delete"): Promise<BulkAPIResult> {
        let _this = this;
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
                    resolve(new BulkAPIResult({
                        jobId: info.id,
                        contentUrl: info.contentUrl,

                        jobState: info.state,
                        errorMessage: info.errorMessage
                    }));
                }
                else {
                    _this._apiRequestErrorHandler(resolve, error, response, body);
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
     * @returns {Promise<BulkAPIResult>}
     * @memberof BulkAPI2sf
     */
    async createBulkBatchAsync(contentUrl: string, csvContent: string, records: Array<object>): Promise<BulkAPIResult> {
        let _this = this;
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
                    resolve(new BulkAPIResult({
                        jobState: "UploadStart"
                    }));
                }
                else {
                    _this._apiRequestErrorHandler(resolve, error, response, undefined);
                }
            });
        });
    }



    /**
     * Closes bulk job and forces csv content to be uploaded 
     *
     * @param {string} contentUrl Content url returned by createBulkJob()
     * @returns {Promise<BulkAPIResult>}
     * @memberof BulkAPI2sf
     */
    async closeBulkJobAsync(contentUrl: string): Promise<BulkAPIResult> {
        let _this = this;
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
                    resolve(new BulkAPIResult({
                        jobState: info.state
                    }));
                }
                else {
                    _this._apiRequestErrorHandler(resolve, error, response, body);
                }
            });
        });
    }



    /**
     * Polls  job for the status
     *
     * @param {string} contentUrl Content url returned by createBulkJob()
     * @returns {Promise<BulkAPIResult>} 
     * @memberof BulkAPI2sf
     */
    async pollBulkJobAsync(contentUrl: string): Promise<BulkAPIResult> {
        let _this = this;
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
                    resolve(new BulkAPIResult({
                        errorMessage: info.errorMessage,
                        jobState: info.state,
                        numberRecordsFailed: info.numberRecordsFailed,
                        numberRecordsProcessed: info.numberRecordsProcessed
                    }));
                }
                else {
                    _this._apiRequestErrorHandler(resolve, error, response, body);
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
     * @param {(result: BulkAPIResult) => any} pollCallback
     * @returns {Promise<BulkAPIResult>}
     * @memberof BulkAPI2sf
     */
    async waitForBulkJobCompleteAsync(contentUrl: string,
        pollInterval: number,
        pollCallback: (result: BulkAPIResult) => any): Promise<BulkAPIResult> {

        let _this = this;

        return new Promise(resolve => {

            let interval = setInterval(async () => {

                try {

                    let res = await _this.pollBulkJobAsync(contentUrl);

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
                            _this._apiRequestErrorHandler(resolve, {
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
                    _this._apiRequestErrorHandler(resolve, e, null, null);
                }

            }, pollInterval);
        });
    }





    /**
     * Returns completed job result, inculding all source and target records with status per target record.
     * The returned records has THE SAME order like the records that the source records.
     * 
     * Because the target records returned by the Bulk API V2 HAVE NO 
     * the same garanteed order like the source records, we have to use workarround. 
     * So for Insert (there is no unque Record Id for the source record) - we are using object hashcode 
     * to identify the same source and target record and to map between them.
     * For Update / Delete we are directly using Record Id for the source to target mapping.
     *
     * @param {string} contentUrl Content url returned by createBulkJob()
     * @returns {Promise<BulkAPIResult>}
     * @memberof BulkAPI2sf
     */
    async getBulkJobResultAsync(contentUrl: string): Promise<BulkAPIResult> {
        let _this = this;
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
                        resolve(new BulkAPIResult({
                            jobState: "InProgress"
                        }));
                        return;
                    }

                    try {
                        let csv = parse(body, {
                            skip_empty_lines: true,
                            cast: _this._csvCast
                        });

                        let allRecords = CommonUtils.transformArrayOfArrays(csv);
                        let failedRecords = await _this._getBulkJobUnsuccessfullResultAsync(contentUrl, true);
                        let unprocessedRecords = await _this._getBulkJobUnsuccessfullResultAsync(contentUrl, false);
                        allRecords = allRecords.concat(failedRecords, unprocessedRecords);

                        let map: Map<object, object>;

                        if (_this.operationType == "insert") {
                            map = CommonUtils.mapArraysByHashcode(undefined, allRecords, [
                                "sf__Created",
                                "sf__Id",
                                "sf__Error",
                                "sf__Unprocessed"
                            ], _this.sourceRecordsHashmap);
                        } else {
                            map = CommonUtils.mapArraysByItemProperty(undefined, allRecords, "Id", _this.sourceRecordsHashmap);
                        }
                        let resultRecords = _this.sourceRecords.map(record => {
                            let targetRecords = map.get(record);
                            let ret = new BulkApiResultRecord({
                                sourceRecord: record,
                                targetRecord: targetRecords,
                                isMissingSourceTargetMapping: !targetRecords,
                                isFailed: targetRecords && !!targetRecords["sf__Error"],
                                isUnprocessed: targetRecords && !!targetRecords["sf__Unprocessed"],
                                errorMessage: targetRecords && targetRecords["sf__Error"],
                                id: targetRecords && (targetRecords["sf__Id"] || targetRecords["Id"]),
                                isCreated: targetRecords && !!targetRecords["sf__Created"]
                            });
                            if (ret.isUnprocessed){
                                ret.errorMessage = ErrorMessages.UnprocessedRecord;
                            } else if (ret.isMissingSourceTargetMapping){
                                ret.errorMessage = ErrorMessages.MissingSourceTargetMapping;
                            }
                            return ret;
                        });
                        resolve(new BulkAPIResult({
                            resultRecords: resultRecords,
                            jobState: "JobComplete"
                        }));
                    } catch (e) {
                        if (typeof e.message == "string") {
                            _this._apiRequestErrorHandler(
                                resolve,
                                e,
                                undefined,
                                undefined
                            );
                        } else {
                            let responseError = JSON.parse(e.message);
                            _this._apiRequestErrorHandler(
                                resolve,
                                responseError.error,
                                responseError.response,
                                responseError.body
                            );
                        }
                    }
                }
                else {
                    _this._apiRequestErrorHandler(resolve, error, response, body);
                }
            });
        });
    }






    // ----------------------- Private members -------------------------------------------
    private async _getBulkJobUnsuccessfullResultAsync(contentUrl: string, isGetFailed: boolean): Promise<Array<object>> {
        let _this = this;
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
                        cast: _this._csvCast
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
        if (!response) {
            // Runtime error
            resolve(new BulkAPIResult({
                errorMessage: error.message,
                errorStack: error.stack
            }));
        } else {
            // Rest API error
            let info = body && JSON.parse(body)[0] || {
                message: "Unexpected error",
            };
            resolve(new BulkAPIResult({
                errorMessage: info.message,
            }));
        }
    }

}