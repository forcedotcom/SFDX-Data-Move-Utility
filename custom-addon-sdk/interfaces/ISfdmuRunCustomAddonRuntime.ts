/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type ISfdmuRunCustomAddonApiService from './ISfdmuRunCustomAddonApiService.js';
import type ISfdmuRunCustomAddonModule from './ISfdmuRunCustomAddonModule.js';
import type ISfdmuRunCustomAddonScript from './ISfdmuRunCustomAddonScript.js';
/**
 * The Custom Add-On runtime.
 * <br/>
 * Besides other runtime information, this interface exposes the instance of the Custom Add-On API service
 * using the {@link ISfdmuRunCustomAddonRuntime.service} property.
 *
 * @export
 * @interface ISfdmuRunCustomAddonRuntime
 */
export default interface ISfdmuRunCustomAddonRuntime {
  /**
   * Base directory for the current run.
   *
   * @type {string}
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  basePath: string;

  /**
   * Service source directory path for the current object set.
   * This is the runtime `source` folder used by the engine.
   *
   * @type {string}
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  sourcePath: string;

  /**
   * Service target directory path for the current object set.
   * This is the runtime `target` folder used by the engine.
   *
   * @type {string}
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  targetPath: string;

  /**
   * The instance of the Add-On API service.
   *
   * @type {ISfdmuRunCustomAddonApiService}
   *
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  service: ISfdmuRunCustomAddonApiService;

  /**
   * Returns data of the currently running {@link ISfdmuRunCustomAddonScript | export.json script}.
   *
   * @return {*}  {ISfdmuRunCustomAddonScript}
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  getScript(): ISfdmuRunCustomAddonScript;

  /**
   * Logs a formatted info message.
   *
   * @param {ISfdmuRunCustomAddonModule} module The current module instance.
   * @param {string} message The message template or text.
   * @param {...string[]} tokens Format tokens.
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  logFormattedInfo(module: ISfdmuRunCustomAddonModule, message: string, ...tokens: string[]): void;

  /**
   * Logs a formatted verbose info message.
   *
   * @param {ISfdmuRunCustomAddonModule} module The current module instance.
   * @param {string} message The message template or text.
   * @param {...string[]} tokens Format tokens.
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  logFormattedInfoVerbose(module: ISfdmuRunCustomAddonModule, message: string, ...tokens: string[]): void;

  /**
   * Logs a formatted warning message.
   *
   * @param {ISfdmuRunCustomAddonModule} module The current module instance.
   * @param {string} message The message template or text.
   * @param {...string[]} tokens Format tokens.
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  logFormattedWarning(module: ISfdmuRunCustomAddonModule, message: string, ...tokens: string[]): void;

  /**
   * Logs a formatted error message.
   *
   * @param {ISfdmuRunCustomAddonModule} module The current module instance.
   * @param {string} message The message template or text.
   * @param {...string[]} tokens Format tokens.
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  logFormattedError(module: ISfdmuRunCustomAddonModule, message: string, ...tokens: string[]): void;

  /**
   * Logs a formatted message using an explicit type.
   *
   * @param {ISfdmuRunCustomAddonModule} module The current module instance.
   * @param {string} message The message template or text.
   * @param {('INFO' | 'WARNING' | 'ERROR')} [messageType] Message type.
   * @param {...string[]} tokens Format tokens.
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  logFormatted(
    module: ISfdmuRunCustomAddonModule,
    message: string,
    messageType?: 'INFO' | 'WARNING' | 'ERROR',
    ...tokens: string[]
  ): void;

  /**
   * Logs an add-on execution start message.
   *
   * @param {ISfdmuRunCustomAddonModule} module The current module instance.
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  logAddonExecutionStarted(module: ISfdmuRunCustomAddonModule): void;

  /**
   * Logs an add-on execution completion message.
   *
   * @param {ISfdmuRunCustomAddonModule} module The current module instance.
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  logAddonExecutionFinished(module: ISfdmuRunCustomAddonModule): void;

  /**
   * Validates whether the current event is supported.
   *
   * @param {ISfdmuRunCustomAddonModule} module The current module instance.
   * @param {string[]} supportedEvents List of supported event names.
   * @returns {boolean} True when supported.
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  validateSupportedEvents(module: ISfdmuRunCustomAddonModule, supportedEvents: string[]): boolean;

  /**
   * Executes multiple SOQL queries in sequence.
   *
   * @param {boolean} isSource True for source org.
   * @param {string[]} soqls SOQL query strings.
   * @param {boolean} [useBulkQueryApi] Use Bulk API when true.
   * @returns {Promise<Array<Record<string, unknown>>>} Query results.
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  queryMultiAsync(
    isSource: boolean,
    soqls: string[],
    useBulkQueryApi?: boolean
  ): Promise<Array<Record<string, unknown>>>;

  /**
   * Builds SOQL IN queries for a list of values.
   *
   * @param {string[]} selectFields Fields to select.
   * @param {string} fieldName IN-clause field name.
   * @param {string} sObjectName Object name.
   * @param {string[]} valuesIN IN-clause values.
   * @param {string} [whereClause] Optional WHERE clause.
   * @param {string} [orderBy] Optional ORDER BY clause.
   * @returns {string[]} SOQL query strings.
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  createFieldInQueries(
    selectFields: string[],
    fieldName: string,
    sObjectName: string,
    valuesIN: string[],
    whereClause?: string,
    orderBy?: string
  ): string[];

  /**
   * Updates target records using API engines or CSV output.
   *
   * @param {string} sObjectName Target object name.
   * @param {number} operation CRUD operation identifier.
   * @param {Array<Record<string, unknown>>} records Records to process.
   * @param {number} [engine] Preferred engine.
   * @param {boolean} [updateRecordId] True to overwrite Ids from API.
   * @returns {Promise<Array<Record<string, unknown>>>} Updated records.
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  updateTargetRecordsAsync(
    sObjectName: string,
    operation: number,
    records: Array<Record<string, unknown>>,
    engine?: number,
    updateRecordId?: boolean
  ): Promise<Array<Record<string, unknown>>>;

  /**
   * Transfers ContentVersion records from source to target org.
   *
   * @template T ContentVersion-like record type.
   * @param {ISfdmuRunCustomAddonModule} module The current module instance.
   * @param {T[]} sourceVersions Source versions to transfer.
   * @param {number} [maxChunkSize] Max chunk size.
   * @returns {Promise<T[]>} Updated source versions.
   * @memberof ISfdmuRunCustomAddonRuntime
   */
  transferContentVersions<T>(
    module: ISfdmuRunCustomAddonModule,
    sourceVersions: T[],
    maxChunkSize?: number
  ): Promise<T[]>;
}
