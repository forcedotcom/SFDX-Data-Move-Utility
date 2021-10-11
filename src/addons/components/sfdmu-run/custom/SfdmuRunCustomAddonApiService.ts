/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { ISfdmuRunCustomAddonCommandRunInfo, ISfdmuRunCustomAddonContext, ISFdmuRunCustomAddonJob, ISfdmuRunCustomAddonModule, ISfdmuRunCustomAddonProcessedData, ISFdmuRunCustomAddonTask } from "../../../modules/sfdmu-run/custom-addons/package";
import ISfdmuRunCustomAddonApiService from "../../../modules/sfdmu-run/custom-addons/package/ISfdmuRunCustomAddonApiService";
import SfdmuRunAddonJob from "../sfdmuRunAddonJob";
import SfdmuRunAddonRuntime from "../sfdmuRunAddonRuntime";
import SfdmuRunAddonTask from "../sfdmuRunAddonTask";


export default class SfdmuRunCustomAddonApiService implements ISfdmuRunCustomAddonApiService {

    runtime: SfdmuRunAddonRuntime;

    constructor(runtime: SfdmuRunAddonRuntime) {
        this.runtime = runtime;
    }


    getPluginRunInfo(): ISfdmuRunCustomAddonCommandRunInfo {
        return this.runtime.runInfo;
    }

    getProcessedData(context: ISfdmuRunCustomAddonContext): ISfdmuRunCustomAddonProcessedData {
        return this.#getPluginTask(context).processedData;
    }

    log(module: ISfdmuRunCustomAddonModule, message: string | object, messageType?: "INFO" | "WARNING" | "ERROR" | "JSON", ...tokens: string[]): void {
        if (typeof message === 'string') {
            (this.runtime as any).logFormatted(module, message, messageType, ...tokens);
        } else {
            (this.runtime as any).log(message, messageType == 'JSON' ? messageType : 'OBJECT', ...tokens);
        }
    }

    getPluginJob(): ISFdmuRunCustomAddonJob {
        return this.#pluginJob;
    }
    getPluginTask(context: ISfdmuRunCustomAddonContext): ISFdmuRunCustomAddonTask {
        return this.#getPluginTask(context);
    }


    // ------------- Helpers ------------- //
    get #pluginJob(): SfdmuRunAddonJob {
        return this.runtime.pluginJob;
    }

    #getPluginTask(context: ISfdmuRunCustomAddonContext): SfdmuRunAddonTask {
        return this.#pluginJob.tasks.find(task => task.sObjectName == context.objectName);
    }


}