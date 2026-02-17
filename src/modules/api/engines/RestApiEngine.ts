/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@jsforce/jsforce-node';
import { Common } from '../../common/Common.js';
import { API_ENGINE, OPERATION } from '../../common/Enumerations.js';
import { ERRORS_FIELD_NAME, REST_API_JOB_ID, SFORCE_API_CALL_HEADERS } from '../../constants/Constants.js';
import { CommandExecutionError } from '../../models/common/CommandExecutionError.js';
import ScriptObject from '../../models/script/ScriptObject.js';
import ApiEngineBase from '../ApiEngineBase.js';
import type { ApiEngineBaseOptionsType } from '../models/ApiEngineBaseOptionsType.js';
import type { ApiEngineRunOptionsType } from '../models/ApiEngineRunOptionsType.js';
import type { CrudResultType } from '../models/CrudResultType.js';
import type { IApiEngine } from '../models/IApiEngine.js';

/**
 * REST API engine wrapper.
 */
export default class RestApiEngine extends ApiEngineBase implements IApiEngine {
  // ------------------------------------------------------//
  // -------------------- STATIC MEMBERS ----------------- //
  // ------------------------------------------------------//

  /**
   * Engine display name.
   */
  public static readonly ENGINE_NAME = 'REST API';

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new REST API engine.
   *
   * @param options - Base engine options.
   */
  public constructor(options: ApiEngineBaseOptionsType) {
    super({
      ...options,
      engineType: API_ENGINE.REST_API,
      engineName: RestApiEngine.ENGINE_NAME,
    });
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Executes CRUD operations using REST API.
   *
   * @param options - Execution options.
   * @returns Processed records.
   */
  public async executeCrudAsync(options: ApiEngineRunOptionsType): Promise<Array<Record<string, unknown>>> {
    if (options.records.length === 0) {
      return [];
    }

    const parallelJobs = this._resolveParallelJobs(options);
    if (parallelJobs <= 1 || options.records.length <= 1) {
      return this._executeChunkAsync(options, options.records);
    }

    const chunkSize = Math.max(1, Math.ceil(options.records.length / parallelJobs));
    const chunks = Common.chunkArray(options.records, chunkSize);
    const results = await Common.parallelExecAsync(
      chunks.map((chunk) => async () => this._executeChunkAsync(options, chunk)),
      this,
      parallelJobs
    );
    return results.flat();
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Executes the operation for a record chunk.
   *
   * @param options - Execution options.
   * @param records - Records to process.
   * @returns Processed records.
   */
  private async _executeChunkAsync(
    options: ApiEngineRunOptionsType,
    records: Array<Record<string, unknown>>
  ): Promise<Array<Record<string, unknown>>> {
    if (records.length === 0) {
      return [];
    }

    this._logApiOperationStarted(options);

    if (options.script.simulationMode) {
      this._applySimulationIds(options, records);
      this._logApiOperationFinished(options);
      return records;
    }

    this._fixRecords(records);
    await this._executeRestApiAsync(options, records);
    this._logApiOperationFinished(options);
    return records;
  }

  /**
   * Executes REST API operations for a record chunk.
   *
   * @param options - Execution options.
   * @param records - Records to process.
   */
  private async _executeRestApiAsync(
    options: ApiEngineRunOptionsType,
    records: Array<Record<string, unknown>>
  ): Promise<void> {
    const batchSize = this._resolveRestBatchSize(options, records.length);
    const batches = Common.chunkArray(records, batchSize);
    const connection = this.getConnection();
    const sobject = this._getSObjectConnection(connection, this.getSObjectName());

    if (!sobject) {
      throw new CommandExecutionError(`Connection does not support sobject operations for ${this.getSObjectName()}.`);
    }

    this._logApiOperationJobCreated(options, REST_API_JOB_ID);

    let processedTotal = 0;
    let failedTotal = 0;

    await Common.serialExecAsync(
      batches.map((batch) => async () => {
        const batchId = REST_API_JOB_ID;
        this._logApiOperationBatchCreated(options, batchId);

        const results = await this._executeRestBatchAsync(options, connection, sobject, batch);
        const batchStats = this._applyCrudResults(options, batch, results, options.updateRecordId);
        processedTotal += batchStats.processedCount;
        failedTotal += batchStats.failedCount;

        this._logApiOperationCompleted(options, batchId, processedTotal, failedTotal);
        return undefined;
      })
    );
  }

  /**
   * Executes a REST batch and returns CRUD results.
   *
   * @param options - Execution options.
   * @param connection - Connection instance.
   * @param sobject - CRUD connection.
   * @param records - Records to process.
   * @returns CRUD results.
   */
  private async _executeRestBatchAsync(
    options: ApiEngineRunOptionsType,
    connection: Connection,
    sobject: {
      create: (records: Array<Record<string, unknown>>, options?: Record<string, unknown>) => Promise<unknown>;
      update: (records: Array<Record<string, unknown>>, options?: Record<string, unknown>) => Promise<unknown>;
      upsert: (
        records: Array<Record<string, unknown>>,
        externalIdField: string,
        options?: Record<string, unknown>
      ) => Promise<unknown>;
      destroy?: (ids: string[] | string, options?: Record<string, unknown>) => Promise<unknown>;
      del?: (ids: string[] | string, options?: Record<string, unknown>) => Promise<unknown>;
    },
    records: Array<Record<string, unknown>>
  ): Promise<CrudResultType[]> {
    const requestOptions: Record<string, unknown> = {
      allOrNone: options.script.allOrNone,
      allowRecursive: true,
      headers: SFORCE_API_CALL_HEADERS,
    };
    if (options.operation === OPERATION.HardDelete) {
      requestOptions.hardDelete = true;
    }

    switch (options.operation) {
      case OPERATION.Insert:
        return this._normalizeCrudResults(await sobject.create(records, requestOptions));
      case OPERATION.Update:
        return this._normalizeCrudResults(await sobject.update(records, requestOptions));
      case OPERATION.Upsert:
        return this._normalizeCrudResults(await sobject.upsert(records, 'Id', requestOptions));
      case OPERATION.Delete:
      case OPERATION.DeleteHierarchy:
      case OPERATION.DeleteSource:
      case OPERATION.HardDelete: {
        const ids = records.map((record) => String(record['Id'] ?? '')).filter((id) => id.length > 0);
        if (typeof connection.destroy !== 'function') {
          throw new CommandExecutionError(
            `Connection does not support delete operations for ${this.getSObjectName()}.`
          );
        }
        const deleteResults = this._normalizeCrudResults(
          await connection.destroy(this.getSObjectName(), ids, requestOptions)
        );

        if (options.operation !== OPERATION.HardDelete) {
          return deleteResults;
        }

        const purgeResults = await this._emptyRecycleBinAsync(connection, ids);
        if (purgeResults.length === 0) {
          return deleteResults;
        }

        return this._mergePurgeResults(deleteResults, purgeResults);
      }
      default:
        throw new CommandExecutionError('Invalid API operation.');
    }
  }

  /**
   * Purges records from recycle bin when supported by the connection.
   *
   * @param connection - Connection instance.
   * @param ids - Record ids to purge.
   * @returns Purge results.
   */
  private async _emptyRecycleBinAsync(connection: Connection, ids: string[]): Promise<CrudResultType[]> {
    if (ids.length === 0) {
      return [];
    }

    const recycleBinConnection = connection as Connection & {
      emptyRecycleBin?: (ids: string[] | string) => Promise<unknown>;
    };

    if (typeof recycleBinConnection.emptyRecycleBin !== 'function') {
      return [];
    }

    return this._normalizeCrudResults(await recycleBinConnection.emptyRecycleBin(ids));
  }

  /**
   * Merges purge results into delete results by record id.
   *
   * @param deleteResults - Delete operation results.
   * @param purgeResults - Purge operation results.
   * @returns Merged results preserving delete order.
   */
  private _mergePurgeResults(deleteResults: CrudResultType[], purgeResults: CrudResultType[]): CrudResultType[] {
    void this;
    const purgeById = new Map<string, CrudResultType>();
    purgeResults.forEach((result) => {
      if (result.id) {
        purgeById.set(result.id, result);
      }
    });

    return deleteResults.map((result) => {
      if (!result.id) {
        return result;
      }
      return purgeById.get(result.id) ?? result;
    });
  }

  /**
   * Applies CRUD results to records.
   *
   * @param options - Execution options.
   * @param records - Records being processed.
   * @param results - CRUD results.
   * @param updateRecordId - True to overwrite Ids.
   * @returns Processed and failed counts.
   */
  private _applyCrudResults(
    options: ApiEngineRunOptionsType,
    records: Array<Record<string, unknown>>,
    results: CrudResultType[],
    updateRecordId: boolean
  ): { processedCount: number; failedCount: number } {
    const invalidMessage = options.logger.getResourceString('invalidRecordHashcode');
    let failedCount = 0;

    for (const [index, record] of records.entries()) {
      const result = results[index];
      if (!result) {
        // eslint-disable-next-line no-param-reassign
        record[ERRORS_FIELD_NAME] = invalidMessage;
        failedCount += 1;
        continue;
      }

      if (updateRecordId && result.id) {
        // eslint-disable-next-line no-param-reassign
        record['Id'] = result.id;
      }

      const errorMessage = this._formatCrudErrors(result.errors);
      if (errorMessage) {
        // eslint-disable-next-line no-param-reassign
        record[ERRORS_FIELD_NAME] = errorMessage;
        failedCount += 1;
      } else {
        // eslint-disable-next-line no-param-reassign
        record[ERRORS_FIELD_NAME] = null;
      }
    }

    return {
      processedCount: records.length,
      failedCount,
    };
  }

  /**
   * Normalizes CRUD results into an array.
   *
   * @param result - Raw CRUD result.
   * @returns Normalized results.
   */
  private _normalizeCrudResults(result: unknown): CrudResultType[] {
    void this;
    if (Array.isArray(result)) {
      return result.filter((entry): entry is CrudResultType => typeof entry === 'object' && entry !== null);
    }
    if (typeof result === 'object' && result !== null) {
      return [result as CrudResultType];
    }
    return [];
  }

  /**
   * Formats CRUD errors.
   *
   * @param errors - Error list.
   * @returns Error string or undefined.
   */
  private _formatCrudErrors(errors?: CrudResultType['errors']): string | undefined {
    void this;
    if (!errors || errors.length === 0) {
      return undefined;
    }
    return errors
      .map((error) => (typeof error === 'string' ? error : error?.message ?? 'Unknown error'))
      .filter((message) => message.length > 0)
      .join('; ');
  }

  /**
   * Resolves a REST-capable sObject connection.
   *
   * @param connection - Connection instance.
   * @param sObjectName - Target object name.
   * @returns CRUD connection or undefined.
   */
  private _getSObjectConnection(
    connection: ReturnType<IApiEngine['getConnection']>,
    sObjectName: string
  ):
    | {
        create: (records: Array<Record<string, unknown>>, options?: Record<string, unknown>) => Promise<unknown>;
        update: (records: Array<Record<string, unknown>>, options?: Record<string, unknown>) => Promise<unknown>;
        upsert: (
          records: Array<Record<string, unknown>>,
          externalIdField: string,
          options?: Record<string, unknown>
        ) => Promise<unknown>;
        destroy?: (ids: string[] | string, options?: Record<string, unknown>) => Promise<unknown>;
        del?: (ids: string[] | string, options?: Record<string, unknown>) => Promise<unknown>;
      }
    | undefined {
    void this;
    const candidate = connection as unknown as {
      sobject?: (name: string) => {
        create: (records: Array<Record<string, unknown>>, options?: Record<string, unknown>) => Promise<unknown>;
        update: (records: Array<Record<string, unknown>>, options?: Record<string, unknown>) => Promise<unknown>;
        upsert: (
          records: Array<Record<string, unknown>>,
          externalIdField: string,
          options?: Record<string, unknown>
        ) => Promise<unknown>;
        destroy?: (ids: string[] | string, options?: Record<string, unknown>) => Promise<unknown>;
        del?: (ids: string[] | string, options?: Record<string, unknown>) => Promise<unknown>;
      };
    };
    if (typeof candidate.sobject !== 'function') {
      return undefined;
    }
    return candidate.sobject(sObjectName);
  }

  /**
   * Returns operation display name.
   *
   * @param operation - CRUD operation.
   * @returns Operation display name.
   */
  private _getOperationName(operation: OPERATION): string {
    void this;
    return ScriptObject.getStrOperation(operation);
  }

  /**
   * Resolves parallel job count.
   *
   * @param options - Execution options.
   * @returns Parallel job count.
   */
  private _resolveParallelJobs(options: ApiEngineRunOptionsType): number {
    void this;
    const scriptValue = options.script.parallelRestJobs;
    const objectValue = options.scriptObject ? options.scriptObject.parallelRestJobs : undefined;
    const resolved = objectValue && objectValue > 0 ? objectValue : scriptValue;
    return Math.max(1, resolved);
  }

  /**
   * Resolves REST API batch size.
   *
   * @param options - Execution options.
   * @param fallbackSize - Fallback size when not configured.
   * @returns Batch size.
   */
  private _resolveRestBatchSize(options: ApiEngineRunOptionsType, fallbackSize: number): number {
    void this;
    const restBatchSize = options.scriptObject?.batchSizes.restBatchSize ?? options.script.restApiBatchSize;
    if (!restBatchSize || restBatchSize <= 0) {
      return fallbackSize;
    }
    return restBatchSize;
  }

  /**
   * Fixes legacy placeholder values in records.
   *
   * @param records - Records to inspect.
   */
  private _fixRecords(records: Array<Record<string, unknown>>): void {
    void this;
    records.forEach((record) => {
      Object.keys(record).forEach((key) => {
        if (record[key] === '#N/A') {
          // eslint-disable-next-line no-param-reassign
          record[key] = null;
        }
      });
    });
  }

  /**
   * Applies simulation Ids for insert operations.
   *
   * @param options - Execution options.
   * @param records - Records to update.
   */
  private _applySimulationIds(options: ApiEngineRunOptionsType, records: Array<Record<string, unknown>>): void {
    void this;
    if (options.operation !== OPERATION.Insert || !options.updateRecordId) {
      return;
    }
    records.forEach((record) => {
      if (!record['Id']) {
        // eslint-disable-next-line no-param-reassign
        record['Id'] = Common.makeId(18);
      }
    });
  }

  /**
   * Logs API operation start.
   *
   * @param options - Execution options.
   */
  private _logApiOperationStarted(options: ApiEngineRunOptionsType): void {
    const simulationSuffix = options.script.simulationMode ? options.logger.getResourceString('simulationMode') : '';
    options.logger.log(
      'apiOperationStarted',
      this.getSObjectName(),
      this._getOperationName(options.operation),
      this.getEngineName(),
      simulationSuffix
    );
  }

  /**
   * Logs API operation finish.
   *
   * @param options - Execution options.
   */
  private _logApiOperationFinished(options: ApiEngineRunOptionsType): void {
    options.logger.log('apiOperationFinished', this.getSObjectName(), this._getOperationName(options.operation));
  }

  /**
   * Logs API job creation.
   *
   * @param options - Execution options.
   * @param jobId - Job identifier.
   */
  private _logApiOperationJobCreated(options: ApiEngineRunOptionsType, jobId: string): void {
    options.logger.log(
      'apiOperationJobCreated',
      jobId,
      this._getOperationName(options.operation),
      this.getSObjectName()
    );
  }

  /**
   * Logs API batch creation.
   *
   * @param options - Execution options.
   * @param batchId - Batch identifier.
   */
  private _logApiOperationBatchCreated(options: ApiEngineRunOptionsType, batchId: string): void {
    options.logger.log(
      'apiOperationBatchCreated',
      batchId,
      this._getOperationName(options.operation),
      this.getSObjectName()
    );
  }

  /**
   * Logs API completion message.
   *
   * @param options - Execution options.
   * @param batchId - Batch identifier.
   * @param processed - Processed records count.
   * @param failed - Failed records count.
   */
  private _logApiOperationCompleted(
    options: ApiEngineRunOptionsType,
    batchId: string,
    processed: number,
    failed: number
  ): void {
    const operationName = this._getOperationName(options.operation);
    if (failed > 0) {
      options.logger.warn(
        'apiOperationCompleted',
        batchId,
        operationName,
        this.getSObjectName(),
        String(processed),
        String(failed)
      );
      return;
    }
    options.logger.log(
      'apiOperationCompleted',
      batchId,
      operationName,
      this.getSObjectName(),
      String(processed),
      String(failed)
    );
  }
}
