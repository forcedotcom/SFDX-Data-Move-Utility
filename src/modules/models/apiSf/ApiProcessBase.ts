/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { OPERATION } from "../../components/statics";
import { MessageUtils } from "../../components/messages";
import { IOrgConnectionData } from "..";
import { IApiJobCreateResult } from "./interfaces";




/**
 * Base class for all ApiProcess inherited classes
 *
 * @export
 * @class ApiProcessBase
 */
export class ApiProcessBase {

    isSource: boolean;
    pollingIntervalMs: number
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

    constructor(logger: MessageUtils, 
                connectionData : IOrgConnectionData, 
                sObjectName : string, 
                operation: OPERATION, 
                pollingIntervalMs: number,
                updateRecordId: boolean) {
        this.logger = logger;
        this.connectionData = connectionData;
        this.sObjectName = sObjectName;
        this.operation = operation;
        this.pollingIntervalMs = pollingIntervalMs;
        this.updateRecordId = updateRecordId;
    }

}