/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type SfdmuRunAddonRuntime from '../SfdmuRunAddonRuntime.js';
import type AddonModule from '../AddonModule.js';
import { ADDON_EVENTS, API_ENGINE, OPERATION } from '../../common/Enumerations.js';
import type ContentVersion from '../../models/sf/ContentVersion.js';
import type {
  ISfdmuRunCustomAddonApiService,
  ISfdmuRunCustomAddonModule,
  ISfdmuRunCustomAddonRuntime,
  ISfdmuRunCustomAddonScript,
} from '../../../../custom-addon-sdk/interfaces/index.js';
import BridgeApiServiceAdapter from './BridgeApiServiceAdapter.js';

/**
 * Bridge runtime adapter for custom add-ons.
 */
export default class BridgeRuntimeAdapter implements ISfdmuRunCustomAddonRuntime {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * API service adapter.
   */
  public service: ISfdmuRunCustomAddonApiService;

  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Underlying runtime instance.
   */
  private readonly _runtime: SfdmuRunAddonRuntime;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new Bridge runtime adapter.
   *
   * @param runtime - Runtime instance to wrap.
   */
  public constructor(runtime: SfdmuRunAddonRuntime) {
    this._runtime = runtime;
    this.service = new BridgeApiServiceAdapter(runtime);
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Returns the base directory for the current run.
   *
   * @returns Base directory path.
   */
  public get basePath(): string {
    return this._runtime.basePath;
  }

  /**
   * Returns the source CSV directory path.
   *
   * @returns Source directory path.
   */
  public get sourcePath(): string {
    return this._runtime.sourcePath;
  }

  /**
   * Returns the target CSV directory path.
   *
   * @returns Target directory path.
   */
  public get targetPath(): string {
    return this._runtime.targetPath;
  }

  /**
   * Returns the current script configuration.
   *
   * @returns Script configuration.
   */
  public getScript(): ISfdmuRunCustomAddonScript {
    return this._runtime.getScript();
  }

  /**
   * Logs a formatted info message.
   *
   * @param module - Add-on module instance.
   * @param message - Message template or text.
   * @param tokens - Format tokens.
   */
  public logFormattedInfo(module: ISfdmuRunCustomAddonModule, message: string, ...tokens: string[]): void {
    this._runtime.logFormattedInfo(module as unknown as AddonModule, message, ...tokens);
  }

  /**
   * Logs a formatted verbose info message.
   *
   * @param module - Add-on module instance.
   * @param message - Message template or text.
   * @param tokens - Format tokens.
   */
  public logFormattedInfoVerbose(module: ISfdmuRunCustomAddonModule, message: string, ...tokens: string[]): void {
    this._runtime.logFormattedInfoVerbose(module as unknown as AddonModule, message, ...tokens);
  }

  /**
   * Logs a formatted warning message.
   *
   * @param module - Add-on module instance.
   * @param message - Message template or text.
   * @param tokens - Format tokens.
   */
  public logFormattedWarning(module: ISfdmuRunCustomAddonModule, message: string, ...tokens: string[]): void {
    this._runtime.logFormattedWarning(module as unknown as AddonModule, message, ...tokens);
  }

  /**
   * Logs a formatted error message.
   *
   * @param module - Add-on module instance.
   * @param message - Message template or text.
   * @param tokens - Format tokens.
   */
  public logFormattedError(module: ISfdmuRunCustomAddonModule, message: string, ...tokens: string[]): void {
    this._runtime.logFormattedError(module as unknown as AddonModule, message, ...tokens);
  }

  /**
   * Logs a formatted message by type.
   *
   * @param module - Add-on module instance.
   * @param message - Message template or text.
   * @param messageType - Message type.
   * @param tokens - Format tokens.
   */
  public logFormatted(
    module: ISfdmuRunCustomAddonModule,
    message: string,
    messageType: 'INFO' | 'WARNING' | 'ERROR' = 'INFO',
    ...tokens: string[]
  ): void {
    this._runtime.logFormatted(module as unknown as AddonModule, message, messageType, ...tokens);
  }

  /**
   * Logs add-on execution start.
   *
   * @param module - Add-on module instance.
   */
  public logAddonExecutionStarted(module: ISfdmuRunCustomAddonModule): void {
    this._runtime.logAddonExecutionStarted(module as unknown as AddonModule);
  }

  /**
   * Logs add-on execution completion.
   *
   * @param module - Add-on module instance.
   */
  public logAddonExecutionFinished(module: ISfdmuRunCustomAddonModule): void {
    this._runtime.logAddonExecutionFinished(module as unknown as AddonModule);
  }

  /**
   * Validates whether the current event is supported.
   *
   * @param module - Add-on module instance.
   * @param supportedEvents - Supported event names.
   * @returns True when supported.
   */
  public validateSupportedEvents(module: ISfdmuRunCustomAddonModule, supportedEvents: string[]): boolean {
    return this._runtime.validateSupportedEvents(
      module as unknown as AddonModule,
      supportedEvents as unknown as ADDON_EVENTS[]
    );
  }

  /**
   * Executes multiple SOQL queries in sequence.
   *
   * @param isSource - True for source org.
   * @param soqls - SOQL query strings.
   * @param useBulkQueryApi - Use Bulk API when true.
   * @returns Query results.
   */
  public async queryMultiAsync(
    isSource: boolean,
    soqls: string[],
    useBulkQueryApi?: boolean
  ): Promise<Array<Record<string, unknown>>> {
    return this._runtime.queryMultiAsync(isSource, soqls, useBulkQueryApi);
  }

  /**
   * Builds SOQL IN queries for a list of values.
   *
   * @param selectFields - Fields to select.
   * @param fieldName - IN-clause field name.
   * @param sObjectName - Object name.
   * @param valuesIN - IN-clause values.
   * @param whereClause - Optional WHERE clause.
   * @param orderBy - Optional ORDER BY clause.
   * @returns SOQL query strings.
   */
  public createFieldInQueries(
    selectFields: string[],
    fieldName: string,
    sObjectName: string,
    valuesIN: string[],
    whereClause?: string,
    orderBy?: string
  ): string[] {
    return this._runtime.createFieldInQueries(selectFields, fieldName, sObjectName, valuesIN, whereClause, orderBy);
  }

  /**
   * Updates target records using API engines or CSV output.
   *
   * @param sObjectName - Target object name.
   * @param operation - CRUD operation identifier.
   * @param records - Records to process.
   * @param engine - Preferred engine.
   * @param updateRecordId - True to overwrite Ids from API.
   * @returns Updated records.
   */
  public async updateTargetRecordsAsync(
    sObjectName: string,
    operation: number,
    records: Array<Record<string, unknown>>,
    engine?: number,
    updateRecordId?: boolean
  ): Promise<Array<Record<string, unknown>>> {
    return this._runtime.updateTargetRecordsAsync(
      sObjectName,
      operation as OPERATION,
      records,
      typeof engine === 'number' ? (engine as API_ENGINE) : API_ENGINE.DEFAULT_ENGINE,
      updateRecordId
    );
  }

  /**
   * Transfers ContentVersion records from source to target org.
   *
   * @template T ContentVersion-like record type.
   * @param module - Add-on module instance.
   * @param sourceVersions - Source versions to transfer.
   * @param maxChunkSize - Max chunk size.
   * @returns Updated source versions.
   */
  public async transferContentVersions<T>(
    module: ISfdmuRunCustomAddonModule,
    sourceVersions: T[],
    maxChunkSize?: number
  ): Promise<T[]> {
    const updated = await this._runtime.transferContentVersions(
      module as unknown as AddonModule,
      sourceVersions as unknown as ContentVersion[],
      maxChunkSize
    );
    return updated as unknown as T[];
  }
}
