/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { Common } from "../../../modules/components/common_components/common";
import { Logger, LOG_MESSAGE_TYPE, LOG_MESSAGE_VERBOSITY, RESOURCES } from "../../../modules/components/common_components/logger";
import { SFDMU_RUN_ADDON_MESSAGES } from "../../messages/sfdmuRunAddonMessages";
import ICommandRunInfo from "../../../modules/models/common_models/ICommandRunInfo";
import { ITableMessage } from "../../../modules/models/common_models/helper_interfaces";
import AddonModule from "./addonModule";
import { BUILTIN_MESSAGES } from "../../../modules/components/common_components/bulitinMessages";


export default class AddonRuntime {

    runInfo: ICommandRunInfo;
    #logger: Logger;

    /**
     * Creates an instance of AddonRuntime.
     * @param logger - The logger
     * @param runInfo - The run info
     */
    constructor(logger: Logger, runInfo: ICommandRunInfo) {
        this.#logger = logger;
        this.runInfo = runInfo;
    }

    createFormattedMessage(module: AddonModule, message: SFDMU_RUN_ADDON_MESSAGES | BUILTIN_MESSAGES | string, ...tokens: string[]): string {
        switch (message) {
            case BUILTIN_MESSAGES.Break:
                return '';
        }
        let mess = Common.formatStringLog((message || '').toString(), ...tokens);
        return this.#logger.getResourceString(RESOURCES.coreAddonMessageTemplate,
            module.context.moduleDisplayName,
            module.context.objectDisplayName,
            mess);
    }

    logFormattedInfo(module: AddonModule, message: SFDMU_RUN_ADDON_MESSAGES | string, ...tokens: string[]): void {
        this.log(this.createFormattedMessage(module, message, ...tokens), "INFO");
    }

    logFormattedWarning(module: AddonModule, message: SFDMU_RUN_ADDON_MESSAGES | string, ...tokens: string[]): void {
        this.log(this.createFormattedMessage(module, message, ...tokens), "WARNING");
    }

    logFormattedError(module: AddonModule, message: SFDMU_RUN_ADDON_MESSAGES | string, ...tokens: string[]): void {
        this.log(this.createFormattedMessage(module, message, ...tokens), "ERROR");
    }

    
    logFormatted(module: AddonModule, message: BUILTIN_MESSAGES | string, messageType?: "INFO" | "WARNING" | "ERROR", ...tokens: string[]): void {
        switch (messageType) {
            case 'ERROR':
                this.logFormattedError(module, message, ...tokens);
                break;

            case 'WARNING':
                this.logFormattedWarning(module, message, ...tokens);
                break;

            default:
                this.logFormattedInfo(module, message, ...tokens);
                break;
        }
    }


    log(message: string | object | ITableMessage, messageType?: "INFO" | "WARNING" | "ERROR" | "OBJECT" | "TABLE" | "JSON", ...tokens: string[]): void {
        switch (messageType) {
            case "WARNING":
                this.#logger.warn(<string>message, ...tokens);
                break;

            case "ERROR":
                this.#logger.error(<string>message, ...tokens);
                break;

            case "OBJECT":
                this.#logger.objectNormal(<object>message);
                break;

            case "TABLE":
                this.#logger.log(<ITableMessage>message, LOG_MESSAGE_TYPE.TABLE, LOG_MESSAGE_VERBOSITY.NORMAL, ...tokens);
                break;

            default:
                this.#logger.infoNormal(<string>message, ...tokens);
                break;
        }
    }


    logAddonExecutionStarted(module: AddonModule): void {
        this.log(RESOURCES.startAddonExecute.toString(), "INFO", module.context.moduleDisplayName, module.context.objectDisplayName);
    }


    logAddonExecutionFinished(module: AddonModule) {
        this.log(RESOURCES.finishAddonExecute.toString(), "INFO", module.context.moduleDisplayName, module.context.objectDisplayName);
    }


    async parallelExecAsync(fns: ((...args: any[]) => Promise<any>)[], thisArg?: any, maxParallelTasks?: number): Promise<any[]> {
        return await Common.parallelExecAsync(fns, thisArg, maxParallelTasks);
    }


    async serialExecAsync(fns: ((...args: any[]) => Promise<any>)[], thisArg?: any): Promise<any[]> {
        return await Common.serialExecAsync(fns, thisArg);
    }


    deleteFolderRecursive(path: string, throwIOErrors?: boolean): void {
        Common.deleteFolderRecursive(path, throwIOErrors);
    }

    async readCsvFileAsync(filePath: string, linesToRead?: number, columnDataTypeMap?: Map<string, string>): Promise<any[]> {
        return await Common.readCsvFileAsync(filePath, linesToRead, columnDataTypeMap);
    }


    async writeCsvFileAsync(filePath: string, records: any[], createEmptyFileOnEmptyArray?: boolean): Promise<void> {
        return await Common.writeCsvFileAsync(filePath, records, createEmptyFileOnEmptyArray);
    }


}