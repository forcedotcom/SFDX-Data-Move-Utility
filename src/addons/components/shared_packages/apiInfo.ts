/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import ApiResultRecord from './apiResultRecord';
import { MESSAGE_IMPORTANCE, RESULT_STATUSES } from './commonComponents';



/**
* Represents set of records returned by the API operation
*
* @export
* @class BulkAPIResult
*/
export default class ApiInfo {

    constructor(init?: Partial<ApiInfo>) {
        Object.assign(this, init);
        this.resultRecords = this.resultRecords || new Array<ApiResultRecord>();
    }

    sObjectName: string;
    strOperation: string;

    contentUrl: string;

    job: any;
    jobId: string;
    batchId: string;
    jobState: "Undefined" | "Info" | "OperationStarted" | "OperationFinished" | "Open" | "Closed" | "Aborted" | "Failed" | "UploadStart" | "UploadComplete" | "InProgress" | "JobComplete" = "Undefined";

    errorMessage: string;
    errorStack: string;

    numberRecordsProcessed: number;
    numberRecordsFailed: number;

    resultRecords: Array<ApiResultRecord>;
    informationMessageData: Array<string> = new Array<string>();

    get messageImportance(): MESSAGE_IMPORTANCE {

        switch (this.resultStatus) {

            // Silent
            default:
                return MESSAGE_IMPORTANCE.Silent;

            // Low
            case RESULT_STATUSES.DataUploaded:
                return MESSAGE_IMPORTANCE.Low;

            case RESULT_STATUSES.InProgress:
                return MESSAGE_IMPORTANCE.Normal;

            // High
            // Warn
            case RESULT_STATUSES.BatchCreated:
            case RESULT_STATUSES.JobCreated:
            case RESULT_STATUSES.ApiOperationStarted:
            case RESULT_STATUSES.ApiOperationFinished:
                return MESSAGE_IMPORTANCE.High;

            case RESULT_STATUSES.Completed:
                if (this.numberRecordsFailed == 0)
                    return MESSAGE_IMPORTANCE.High;
                else
                    return MESSAGE_IMPORTANCE.Warn;

            // Error
            case RESULT_STATUSES.ProcessError:
            case RESULT_STATUSES.FailedOrAborted:
                return MESSAGE_IMPORTANCE.Error;

        }
    }

    get resultStatus(): RESULT_STATUSES {

        if (!!this.errorMessage) {
            return RESULT_STATUSES.ProcessError;
        }

        switch (this.jobState) {

            default:
                return RESULT_STATUSES.Undefined;

            case "Info":
                return RESULT_STATUSES.Information;

            case "OperationStarted":
                return RESULT_STATUSES.ApiOperationStarted;

            case "OperationFinished":
                return RESULT_STATUSES.ApiOperationFinished;

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
