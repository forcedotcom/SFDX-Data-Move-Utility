/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Common } from '../../common/Common.js';
import { API_ENGINE, OPERATION } from '../../common/Enumerations.js';
import { ERRORS_FIELD_NAME, POLL_TIMEOUT, SFORCE_API_CALL_HEADERS } from '../../constants/Constants.js';
import { CommandExecutionError } from '../../models/common/CommandExecutionError.js';
import ScriptObject from '../../models/script/ScriptObject.js';
import ApiEngineBase from '../ApiEngineBase.js';
import type { ApiEngineBaseOptionsType } from '../models/ApiEngineBaseOptionsType.js';
import type { ApiEngineRunOptionsType } from '../models/ApiEngineRunOptionsType.js';
import type { CrudResultType } from '../models/CrudResultType.js';
import type { IApiEngine } from '../models/IApiEngine.js';

type BulkV1BatchResultType = {
  numberRecordsProcessed?: number | string;
  numberRecordsFailed?: number | string;
  stateMessage?: string;
};

/**
 * Bulk API v1 engine wrapper.
 */
export default class BulkApiV1Engine extends ApiEngineBase implements IApiEngine {
  // ------------------------------------------------------//
  // -------------------- STATIC MEMBERS ----------------- //
  // ------------------------------------------------------//

  /**
   * Engine display name.
   */
  public static readonly ENGINE_NAME = 'BULK API V1';

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new Bulk API v1 engine.
   *
   * @param options - Base engine options.
   */
  public constructor(options: ApiEngineBaseOptionsType) {
    super({
      ...options,
      engineType: API_ENGINE.BULK_API_V1,
      engineName: BulkApiV1Engine.ENGINE_NAME,
    });
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Executes CRUD operations using Bulk API v1.
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
    await this._executeBulkV1Async(options, records);
    this._logApiOperationFinished(options);
    return records;
  }

  /**
   * Executes Bulk API v1 operations for a record chunk.
   *
   * @param options - Execution options.
   * @param records - Records to process.
   */
  private async _executeBulkV1Async(
    options: ApiEngineRunOptionsType,
    records: Array<Record<string, unknown>>
  ): Promise<void> {
    const bulk = this.getConnection().bulk;
    if (!bulk) {
      this._logApiOperationFailed(options, 'Bulk API v1 is not supported by the current connection.');
      throw new CommandExecutionError('Bulk API v1 is not supported by the current connection.');
    }

    bulk.pollInterval = options.script.pollingIntervalMs;
    bulk.pollTimeout = POLL_TIMEOUT;

    const operation = this._resolveBulkOperation(options.operation);
    const job = bulk.createJob(this.getSObjectName(), operation, {
      concurrencyMode: options.script.concurrencyMode,
    });
    const batchSize = this._resolveBulkV1BatchSize(options, records.length);
    const batches = Common.chunkArray(records, batchSize);
    let jobLogged = false;
    let processedTotal = 0;
    let failedTotal = 0;

    await Common.serialExecAsync(
      batches.map((batchRecords) => async () => {
        const result = await this._executeBulkV1BatchAsync(options, job, batchRecords, (batchId) => {
          if (!jobLogged) {
            this._logApiOperationJobCreated(options, job.id ?? 'UNKNOWN');
            jobLogged = true;
          }
          this._logApiOperationBatchCreated(options, batchId);
        });

        if (result === null) {
          this._logApiOperationFailed(options);
          throw new CommandExecutionError(
            options.logger.getResourceString(
              'apiOperationFailed',
              this.getSObjectName(),
              this._getOperationName(options.operation)
            )
          );
        }

        const batchStats = this._applyCrudResults(options, batchRecords, result, options.updateRecordId);
        processedTotal += batchStats.processedCount;
        failedTotal += batchStats.failedCount;
        this._logApiOperationCompleted(options, job.id ?? 'UNKNOWN', processedTotal, failedTotal);
        return undefined;
      })
    );
  }

  /**
   * Executes a Bulk API v1 batch and returns CRUD results.
   *
   * @param options - Execution options.
   * @param job - Bulk API job instance.
   * @param records - Records to process.
   * @param onQueue - Callback invoked when batch is queued.
   * @returns CRUD results or null when failed.
   */
  private async _executeBulkV1BatchAsync(
    options: ApiEngineRunOptionsType,
    job: {
      id?: string | null;
      createBatch: () => {
        id?: string | null;
        execute: (records: Array<Record<string, unknown>>, options?: Record<string, unknown>) => void;
        poll: (pollInterval: number, pollTimeout: number) => void;
        on: (event: 'queue' | 'response' | 'error', callback: (arg: unknown) => void) => void;
      };
    },
    records: Array<Record<string, unknown>>,
    onQueue: (batchId: string) => void
  ): Promise<CrudResultType[] | null> {
    return new Promise<CrudResultType[] | null>((resolve) => {
      const batch = job.createBatch();
      let batchId: string | null = batch.id ?? null;
      let lastProcessed = 0;
      let uploadLogged = false;
      const startedAt = Date.now();
      let isCompleted = false;

      const finish = (result: CrudResultType[] | null): void => {
        if (isCompleted) {
          return;
        }
        isCompleted = true;
        resolve(result);
      };

      const handleError = (error: unknown): void => {
        const message = error instanceof Error ? error.message : String(error ?? '');
        this._logApiOperationFailed(options, message);
        finish(null);
      };

      const pollAsync = async (): Promise<void> => {
        if (isCompleted) {
          return;
        }
        if (Date.now() - startedAt > POLL_TIMEOUT) {
          handleError(new Error('Bulk API v1 poll timeout.'));
          return;
        }

        try {
          const resolvedBatchId = batchId ?? batch.id ?? null;
          if (!resolvedBatchId) {
            handleError(new Error('Bulk API v1 batch id is not available.'));
            return;
          }

          const result = (await this.getConnection()
            .bulk.job(job.id ?? '')
            .batch(resolvedBatchId)
            .check()) as unknown as BulkV1BatchResultType;
          const processed = Number(result.numberRecordsProcessed ?? 0);
          const failed = Number(result.numberRecordsFailed ?? 0);
          if (processed !== lastProcessed) {
            if (!uploadLogged && processed > 0) {
              this._logApiOperationDataUploaded(options, resolvedBatchId);
              uploadLogged = true;
            }
            lastProcessed = processed;
            this._logApiOperationInProgress(options, resolvedBatchId, processed, failed);
          }
        } catch (error) {
          handleError(error);
          return;
        }

        await Common.delayAsync(options.script.pollingIntervalMs);
        return pollAsync();
      };

      batch.on('error', handleError);
      batch.on('queue', () => {
        const resolvedBatchId = batch.id ?? null;
        if (!resolvedBatchId) {
          handleError(new Error('Bulk API v1 batch id is not available.'));
          return;
        }
        batchId = resolvedBatchId;
        onQueue(resolvedBatchId);
        batch.poll(options.script.pollingIntervalMs, POLL_TIMEOUT);
        void pollAsync();
      });

      batch.on('response', (resultRecords: unknown) => {
        finish(this._normalizeCrudResults(resultRecords));
      });

      batch.execute(records, { headers: SFORCE_API_CALL_HEADERS });
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
    const scriptValue = options.script.parallelBulkJobs;
    const objectValue = options.scriptObject ? options.scriptObject.parallelBulkJobs : undefined;
    const resolved = objectValue && objectValue > 0 ? objectValue : scriptValue;
    return Math.max(1, resolved);
  }

  /**
   * Resolves Bulk API v1 batch size.
   *
   * @param options - Execution options.
   * @param fallbackSize - Fallback size when not configured.
   * @returns Batch size.
   */
  private _resolveBulkV1BatchSize(options: ApiEngineRunOptionsType, fallbackSize: number): number {
    void this;
    const bulkBatchSize = options.scriptObject?.batchSizes.bulkV1BatchSize ?? options.script.bulkApiV1BatchSize;
    if (!bulkBatchSize || bulkBatchSize <= 0) {
      return fallbackSize;
    }
    return bulkBatchSize;
  }

  /**
   * Resolves bulk operation string.
   *
   * @param operation - CRUD operation.
   * @returns Bulk operation string.
   */
  private _resolveBulkOperation(operation: OPERATION): 'insert' | 'update' | 'upsert' | 'delete' | 'hardDelete' {
    switch (operation) {
      case OPERATION.HardDelete:
        return 'hardDelete';
      case OPERATION.Delete:
      case OPERATION.DeleteHierarchy:
      case OPERATION.DeleteSource:
        return 'delete';
      case OPERATION.Insert:
        return 'insert';
      case OPERATION.Update:
        return 'update';
      case OPERATION.Upsert:
        return 'upsert';
      default:
        return this._getOperationName(operation).toLowerCase() as
          | 'insert'
          | 'update'
          | 'upsert'
          | 'delete'
          | 'hardDelete';
    }
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
   * Logs API data uploaded message.
   *
   * @param options - Execution options.
   * @param batchId - Batch identifier.
   */
  private _logApiOperationDataUploaded(options: ApiEngineRunOptionsType, batchId: string): void {
    options.logger.log(
      'apiOperationDataUploaded',
      batchId,
      this._getOperationName(options.operation),
      this.getSObjectName()
    );
  }

  /**
   * Logs API in-progress message.
   *
   * @param options - Execution options.
   * @param batchId - Batch identifier.
   * @param processed - Processed records count.
   * @param failed - Failed records count.
   */
  private _logApiOperationInProgress(
    options: ApiEngineRunOptionsType,
    batchId: string,
    processed: number,
    failed: number
  ): void {
    options.logger.log(
      'apiOperationInProgress',
      batchId,
      this._getOperationName(options.operation),
      this.getSObjectName(),
      String(processed),
      String(failed)
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

  /**
   * Logs API failure message.
   *
   * @param options - Execution options.
   * @param message - Optional error message.
   */
  private _logApiOperationFailed(options: ApiEngineRunOptionsType, message?: string): void {
    if (message) {
      options.logger.warn(
        'apiOperationFailedWithMessage',
        this.getSObjectName(),
        this._getOperationName(options.operation),
        message
      );
      return;
    }
    options.logger.warn('apiOperationFailed', this.getSObjectName(), this._getOperationName(options.operation));
  }
}
