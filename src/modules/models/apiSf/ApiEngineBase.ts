/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { OPERATION } from "../../components/common_components/statics";
import { MessageUtils } from "../../components/common_components/messages";
import { IOrgConnectionData } from "..";
import { IApiJobCreateResult, IApiEngineInitParameters } from "./interfaces";




/**
 * Base class for all ApiProcess inherited classes
 *
 * @export
 * @class ApiProcessBase
 */
export default class ApiEngineBase {

    isSource: boolean;
    pollingIntervalMs: number
    bulkApiV1BatchSize: number;
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
    }

}