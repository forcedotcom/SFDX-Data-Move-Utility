/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Common } from '../common/Common.js';
import { ADDON_EVENTS } from '../common/Enumerations.js';
import type { LoggerType } from '../logging/LoggerType.js';
import type { ICommandRunInfo } from '../models/common/ICommandRunInfo.js';
import type AddonModule from './AddonModule.js';
import AddonMessageResolver from './messages/AddonMessageResolver.js';

type AddonMessageType = 'INFO' | 'WARNING' | 'ERROR' | 'OBJECT' | 'TABLE' | 'JSON' | 'INFO_VERBOSE';

type LoggerAdapterType = {
  info: (message: string, ...tokens: string[]) => void;
  warn: (message: string, ...tokens: string[]) => void;
  error: (message: string, ...tokens: string[]) => void;
  log: (message: string, ...tokens: string[]) => void;
  getResourceString: (message: string, ...tokens: string[]) => string;
};

/**
 * Base runtime implementation shared by add-on modules.
 */
export default class AddonRuntime {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Optional command run info for add-ons.
   */
  public runInfo?: ICommandRunInfo;

  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Logger adapter for consistent logging.
   */
  private readonly _logger: LoggerAdapterType;

  /**
   * Add-on message resolver.
   */
  private readonly _messageResolver: AddonMessageResolver;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new add-on runtime.
   *
   * @param logger - Logger instance.
   * @param runInfo - Optional run metadata.
   */
  public constructor(logger: LoggerType, runInfo?: ICommandRunInfo) {
    this.runInfo = runInfo;
    this._logger = this._createLoggerAdapter(logger);
    this._messageResolver = new AddonMessageResolver(this._logger);
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Builds a formatted add-on message using the legacy template.
   *
   * @param module - Add-on module instance.
   * @param message - Message template or text.
   * @param tokens - Optional format tokens.
   * @returns Formatted message string.
   */
  public createFormattedMessage(module: AddonModule, message: string, ...tokens: string[]): string {
    const resolvedMessage = this._messageResolver.resolveMessage(module, message);
    const formatted = Common.formatStringLog(resolvedMessage, ...tokens);
    return this._logger.getResourceString(
      'coreAddonMessageTemplate',
      module.context.moduleDisplayName,
      module.context.objectDisplayName,
      formatted
    );
  }

  /**
   * Registers custom message resources for an add-on module.
   *
   * @param module - Add-on module instance.
   * @param messagesPath - Optional path to messages.md file.
   */
  public async registerAddonMessagesAsync(module: object, messagesPath?: string): Promise<void> {
    await this._messageResolver.registerAddonMessagesAsync(module, messagesPath);
  }

  /**
   * Logs an info-level add-on message.
   *
   * @param module - Add-on module instance.
   * @param message - Message template or text.
   * @param tokens - Optional format tokens.
   */
  public logFormattedInfo(module: AddonModule, message: string, ...tokens: string[]): void {
    this.log(this.createFormattedMessage(module, message, ...tokens), 'INFO');
  }

  /**
   * Logs a verbose info-level add-on message.
   *
   * @param module - Add-on module instance.
   * @param message - Message template or text.
   * @param tokens - Optional format tokens.
   */
  public logFormattedInfoVerbose(module: AddonModule, message: string, ...tokens: string[]): void {
    this.log(this.createFormattedMessage(module, message, ...tokens), 'INFO_VERBOSE');
  }

  /**
   * Logs a warning add-on message.
   *
   * @param module - Add-on module instance.
   * @param message - Message template or text.
   * @param tokens - Optional format tokens.
   */
  public logFormattedWarning(module: AddonModule, message: string, ...tokens: string[]): void {
    this.log(this.createFormattedMessage(module, message, ...tokens), 'WARNING');
  }

  /**
   * Logs an error add-on message.
   *
   * @param module - Add-on module instance.
   * @param message - Message template or text.
   * @param tokens - Optional format tokens.
   */
  public logFormattedError(module: AddonModule, message: string, ...tokens: string[]): void {
    this.log(this.createFormattedMessage(module, message, ...tokens), 'ERROR');
  }

  /**
   * Logs a formatted add-on message by type.
   *
   * @param module - Add-on module instance.
   * @param message - Message template or text.
   * @param messageType - Optional message type.
   * @param tokens - Optional format tokens.
   */
  public logFormatted(
    module: AddonModule,
    message: string,
    messageType: 'INFO' | 'WARNING' | 'ERROR' = 'INFO',
    ...tokens: string[]
  ): void {
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

  /**
   * Logs a raw message with a specific type.
   *
   * @param message - Message payload.
   * @param messageType - Optional log level.
   * @param tokens - Optional token values.
   */
  public log(message: string, messageType: AddonMessageType = 'INFO', ...tokens: string[]): void {
    switch (messageType) {
      case 'WARNING':
        this._logger.warn(message, ...tokens);
        break;
      case 'ERROR':
        this._logger.error(message, ...tokens);
        break;
      case 'INFO_VERBOSE':
        this._logger.info(message, ...tokens);
        break;
      default:
        this._logger.info(message, ...tokens);
        break;
    }
  }

  /**
   * Logs the start of add-on execution.
   *
   * @param module - Add-on module instance.
   */
  public logAddonExecutionStarted(module: AddonModule): void {
    this.log(
      this._logger.getResourceString(
        'startAddonExecution',
        module.context.moduleDisplayName,
        module.context.objectDisplayName
      )
    );
  }

  /**
   * Logs the completion of add-on execution.
   *
   * @param module - Add-on module instance.
   */
  public logAddonExecutionFinished(module: AddonModule): void {
    this.log(
      this._logger.getResourceString(
        'stopAddonExecution',
        module.context.moduleDisplayName,
        module.context.objectDisplayName
      )
    );
  }

  /**
   * Checks whether the add-on supports the current event.
   *
   * @param module - Add-on module instance.
   * @param supportedEvents - List of supported events.
   * @returns True when the current event is supported.
   */
  public validateSupportedEvents(module: AddonModule, supportedEvents: ADDON_EVENTS[]): boolean {
    void this;
    const eventName = module.context.eventName;
    const resolvedEvent = (Object.values(ADDON_EVENTS) as string[]).find((event) => event === eventName);
    if (!resolvedEvent) {
      return false;
    }
    return supportedEvents.includes(resolvedEvent as ADDON_EVENTS);
  }

  /**
   * Executes async functions in parallel.
   *
   * @param fns - Async functions.
   * @param thisArg - Optional this binding.
   * @param maxParallelTasks - Maximum parallelism.
   * @returns Execution results.
   */
  public async parallelExecAsync<T>(
    fns: Array<() => Promise<T>>,
    thisArg?: unknown,
    maxParallelTasks?: number
  ): Promise<T[]> {
    void this;
    return Common.parallelExecAsync(fns, thisArg, maxParallelTasks);
  }

  /**
   * Executes async functions in series.
   *
   * @param fns - Async functions.
   * @param thisArg - Optional this binding.
   * @returns Execution results.
   */
  public async serialExecAsync<T>(fns: Array<() => Promise<T>>, thisArg?: unknown): Promise<T[]> {
    void this;
    return Common.serialExecAsync(fns, thisArg);
  }

  /**
   * Removes a directory and its contents.
   *
   * @param targetPath - Directory to delete.
   * @param throwIOErrors - Throw IO errors when true.
   */
  public deleteFolderRecursive(targetPath: string, throwIOErrors?: boolean): void {
    void this;
    Common.deleteFolderRecursive(targetPath, throwIOErrors);
  }

  /**
   * Reads a CSV file into records.
   *
   * @param filePath - CSV file path.
   * @param linesToRead - Optional line count.
   * @param columnDataTypeMap - Optional column type map.
   * @returns CSV records.
   */
  public async readCsvFileAsync(
    filePath: string,
    linesToRead?: number,
    columnDataTypeMap?: Map<string, string>
  ): Promise<Array<Record<string, unknown>>> {
    void this;
    return Common.readCsvFileAsync(filePath, linesToRead, columnDataTypeMap);
  }

  /**
   * Writes records to a CSV file.
   *
   * @param filePath - CSV file path.
   * @param records - Record list.
   * @param createEmptyFileOnEmptyArray - Create empty file when true.
   */
  public async writeCsvFileAsync(
    filePath: string,
    records: Array<Record<string, unknown>>,
    createEmptyFileOnEmptyArray?: boolean
  ): Promise<void> {
    void this;
    await Common.writeCsvFileAsync(filePath, records, createEmptyFileOnEmptyArray);
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Creates a logger adapter with uniform methods.
   *
   * @param logger - Logger implementation.
   * @returns Logger adapter instance.
   */
  private _createLoggerAdapter(logger: LoggerType): LoggerAdapterType {
    void this;
    const candidate = logger as LoggerType & {
      info?: (message: string, ...tokens: string[]) => void;
      error?: (message: string, ...tokens: string[]) => void;
    };
    const info = typeof candidate.info === 'function' ? candidate.info.bind(logger) : logger.log.bind(logger);
    const warn = logger.warn.bind(logger);
    const error = typeof candidate.error === 'function' ? candidate.error.bind(logger) : logger.warn.bind(logger);
    return {
      info,
      warn,
      error,
      log: logger.log.bind(logger),
      getResourceString: logger.getResourceString.bind(logger),
    };
  }
}
