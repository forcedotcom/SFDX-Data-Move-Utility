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
import { ADDON_EVENTS } from "../../../modules/components/common_components/enumerations";


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

  logFormattedInfoVerbose(module: AddonModule, message: SFDMU_RUN_ADDON_MESSAGES | string, ...tokens: string[]): void {
    this.log(this.createFormattedMessage(module, message, ...tokens), "INFO_VERBOSE");
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
        this.logFormattedError(module, String(message), ...tokens);
        break;

      case 'WARNING':
        this.logFormattedWarning(module, String(message), ...tokens);
        break;

      default:
        this.logFormattedInfo(module, message, ...tokens);
        break;
    }
  }


  log(message: string | object | ITableMessage, messageType?: "INFO" | "WARNING" | "ERROR" | "OBJECT" | "TABLE" | "JSON" | "INFO_VERBOSE", ...tokens: string[]): void {

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

      case "JSON":
        this.#logger.log(<string>message, LOG_MESSAGE_TYPE.JSON, LOG_MESSAGE_VERBOSITY.NORMAL, ...tokens);
        break;

      case "INFO_VERBOSE":
        this.#logger.infoVerbose(<string>message, ...tokens);
        break;

      default:
        this.#logger.infoNormal(<string>message, ...tokens);
        break;
    }
  }


  logAddonExecutionStarted(module: AddonModule): void {
    this.log(RESOURCES.startAddonExecution.toString(), "INFO", module.context.moduleDisplayName, module.context.objectDisplayName);
  }

  validateSupportedEvents(module: AddonModule, supportedEvents: ADDON_EVENTS[]) {
    const evt = ADDON_EVENTS[module.context.eventName];
    return supportedEvents.some((x: ADDON_EVENTS) => x == evt);
  }

  logAddonExecutionFinished(module: AddonModule) {
    this.log(RESOURCES.stopAddonExecution.toString(), "INFO", module.context.moduleDisplayName, module.context.objectDisplayName);
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
