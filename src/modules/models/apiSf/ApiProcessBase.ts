/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MigrationJobTask, ScriptOrg } from "..";
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

    get org(): ScriptOrg {
        return this.isSource ? this.task.sourceOrg : this.task.targetOrg;
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

    get strOperation(): string {
        if ((typeof this.operation != "string") == true) {
            return OPERATION[this.operation].toString();
        }
        return this.operation.toString();
    }

    constructor(task: MigrationJobTask, isSource: boolean, operation: OPERATION) {
        this.task = task;
        this.operation = operation;
    }

}