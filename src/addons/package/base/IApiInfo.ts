
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IApiResultRecord, MESSAGE_IMPORTANCE, RESULT_STATUSES } from ".";


export default interface IApiInfo {
    sObjectName: string;
    strOperation: string;
                                                                                                 
    contentUrl: string;

    job: any;
    jobId: string;
    batchId: string;
    jobState: "Undefined" | "Info" | "OperationStarted" | "OperationFinished" | "Open" | "Closed" | "Aborted" | "Failed" | "UploadStart" | "UploadComplete" | "InProgress" | "JobComplete";

    errorMessage: string;
    errorStack: string;

    numberRecordsProcessed: number;
    numberRecordsFailed: number;

    resultRecords: Array<IApiResultRecord>;
    informationMessageData: Array<string>;

    readonly messageImportance: MESSAGE_IMPORTANCE;
    readonly resultStatus: RESULT_STATUSES;
}