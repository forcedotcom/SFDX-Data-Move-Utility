/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RESULT_STATUSES } from "../../components/statics";
import { BulkApiResultRecord } from "..";



 /**
 * Represents set of records returned by the API operation
 *
 * @export
 * @class BulkAPIResult
 */
export default class BulkAPIResult {

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
