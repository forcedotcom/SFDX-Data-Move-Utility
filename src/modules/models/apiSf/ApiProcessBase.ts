/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MigrationJobTask, ScriptOrg, IApiJobCreateResult, Script } from "..";
import { OPERATION } from "../../components/statics";
import { MessageUtils } from "../../components/messages";



/**
 * Base class for all ApiProcess inherited classes
 *
 * @export
 * @class ApiProcessBase
 */
export default class ApiProcessBase {

    task: MigrationJobTask;
    isSource: boolean;
    operation: OPERATION;
    updateRecordId: boolean;

    apiJobCreateResult: IApiJobCreateResult;

    numberJobRecordsSucceeded: number =  0;
    numberJobRecordsFailed: number =  0;

    get org(): ScriptOrg {
        return this.isSource ? this.task.sourceOrg : this.task.targetOrg;
    }

    get script(): Script {
        return this.org.script;
    }


    get logger(): MessageUtils {
        return this.org.script.logger;
    }

    get instanceUrl(): string {
        return this.org.instanceUrl;
    }

    get accessToken(): string {
        return this.org.accessToken;
    }

    get version(): string {
        return this.org.script.apiVersion;
    }

    get strOperation(): string {
        if ((typeof this.operation != "string") == true) {
            return OPERATION[this.operation].toString();
        }
        return this.operation.toString();
    }

    get sObjectName(): string {
        return this.task.sObjectName;
    }


    constructor(task: MigrationJobTask, isSource: boolean, operation: OPERATION, updateRecordId: boolean) {
        this.task = task;
        this.isSource = isSource;
        this.operation = operation;
        this.updateRecordId = updateRecordId;
    }

}