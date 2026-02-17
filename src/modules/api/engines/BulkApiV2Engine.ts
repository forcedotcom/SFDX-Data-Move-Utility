/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Common } from '../../common/Common.js';
import { API_ENGINE, OPERATION } from '../../common/Enumerations.js';
import { ERRORS_FIELD_NAME, POLL_TIMEOUT } from '../../constants/Constants.js';
import { CommandExecutionError } from '../../models/common/CommandExecutionError.js';
import ScriptObject from '../../models/script/ScriptObject.js';
import ApiEngineBase from '../ApiEngineBase.js';
import type { ApiEngineBaseOptionsType } from '../models/ApiEngineBaseOptionsType.js';
import type { ApiEngineRunOptionsType } from '../models/ApiEngineRunOptionsType.js';
import type { IApiEngine } from '../models/IApiEngine.js';

type BulkV2JobStateType = 'Open' | 'UploadComplete' | 'InProgress' | 'JobComplete' | 'Aborted' | 'Failed';

type BulkV2JobInfoType = {
  id?: string;
  state?: BulkV2JobStateType;
  errorMessage?: string;
  numberRecordsProcessed?: number;
  numberRecordsFailed?: number;
};

type BulkV2ResultsType = {
  successfulResults?: Array<Record<string, unknown>>;
  failedResults?: Array<Record<string, unknown>>;
  unprocessedRecords?: Array<Record<string, unknown>>;
};

type BulkV2JobType = {
  id?: string;
  open: () => Promise<BulkV2JobInfoType>;
  uploadData: (input: Array<Record<string, unknown>> | string) => Promise<void>;
  close: () => Promise<void>;
  check: () => Promise<BulkV2JobInfoType>;
  getAllResults: () => Promise<BulkV2ResultsType>;
};

/**
 * Bulk API v2 engine wrapper.
 */
export default class BulkApiV2Engine extends ApiEngineBase implements IApiEngine {
  // ------------------------------------------------------//
  // -------------------- STATIC MEMBERS ----------------- //
  // ------------------------------------------------------//

  /**
   * Engine display name.
   */
  public static readonly ENGINE_NAME = 'BULK API V2';

  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * True when native jsforce Bulk API v2 is available.
   */
  private _useNativeBulkApi = false;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new Bulk API v2 engine.
   *
   * @param options - Base engine options.
   */
  public constructor(options: ApiEngineBaseOptionsType) {
    super({
      ...options,
      engineType: API_ENGINE.BULK_API_V2,
      engineName: BulkApiV2Engine.ENGINE_NAME,
    });
    this._useNativeBulkApi = this._supportsBulkApiV2(options.connection);
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Returns true when native jsforce Bulk API v2 is used.
   *
   * @returns True when native API is used.
   */
  public getUseNativeBulkApi(): boolean {
    return this._useNativeBulkApi;
  }

  /**
   * Executes CRUD operations using Bulk API v2.
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
    await this._executeBulkV2Async(options, records);
    this._logApiOperationFinished(options);
    return records;
  }

  /**
   * Executes Bulk API v2 operations for a record chunk.
   *
   * @param options - Execution options.
   * @param records - Records to process.
   */
  private async _executeBulkV2Async(
    options: ApiEngineRunOptionsType,
    records: Array<Record<string, unknown>>
  ): Promise<void> {
    if (!this._useNativeBulkApi || !this.getConnection().bulk2) {
      this._logApiOperationFailed(options, 'Bulk API v2 is not supported by the current connection.');
      throw new CommandExecutionError('Bulk API v2 is not supported by the current connection.');
    }

    const bulk2 = this.getConnection().bulk2;
    const operation = this._resolveBulkOperation(options.operation);
    const externalIdFieldName = options.operation === OPERATION.Upsert ? 'Id' : undefined;
    const job = bulk2.createJob({
      object: this.getSObjectName(),
      operation,
      externalIdFieldName,
      lineEnding: 'LF',
    }) as BulkV2JobType;
    const jobInfo = await job.open();
    const jobId = job.id ?? jobInfo.id ?? 'UNKNOWN';

    this._logApiOperationJobCreated(options, jobId);
    this._logApiOperationBatchCreated(options, jobId);

    await job.uploadData(records);
    await job.close();
    this._logApiOperationDataUploaded(options, jobId);

    const finalInfo = await this._pollBulkV2JobAsync(options, job, jobId);
    if (finalInfo.state !== 'JobComplete') {
      this._logApiOperationFailed(options, finalInfo.errorMessage);
      throw new CommandExecutionError(
        options.logger.getResourceString(
          'apiOperationFailed',
          this.getSObjectName(),
          this._getOperationName(options.operation)
        )
      );
    }

    const results = await job.getAllResults();
    this._applyBulkV2Results(options, records, results);

    const processedCount = Number(finalInfo.numberRecordsProcessed ?? 0);
    const failedCount = Number(finalInfo.numberRecordsFailed ?? 0);
    this._logApiOperationCompleted(options, jobId, processedCount, failedCount);
  }

  /**
   * Returns true when jsforce Bulk API v2 is available.
   *
   * @param connection - Jsforce connection instance.
   * @returns True when native Bulk API v2 is supported.
   */
  private _supportsBulkApiV2(connection: ApiEngineBaseOptionsType['connection']): boolean {
    void this;
    return Boolean((connection as { bulk2?: unknown }).bulk2);
  }

  /**
   * Polls Bulk API v2 job for completion with progress logging.
   *
   * @param options - Execution options.
   * @param job - Bulk API v2 job instance.
   * @param jobId - Job identifier for logging.
   * @returns Job info after completion.
   */
  private async _pollBulkV2JobAsync(
    options: ApiEngineRunOptionsType,
    job: BulkV2JobType,
    jobId: string
  ): Promise<BulkV2JobInfoType> {
    let lastProcessed = 0;
    let lastFailed = 0;
    const startedAt = Date.now();

    const pollAsync = async (): Promise<BulkV2JobInfoType> => {
      const info = await job.check();
      const processed = Number(info.numberRecordsProcessed ?? 0);
      const failed = Number(info.numberRecordsFailed ?? 0);
      if (processed !== lastProcessed || failed !== lastFailed) {
        lastProcessed = processed;
        lastFailed = failed;
        this._logApiOperationInProgress(options, jobId, processed, failed);
      }

      if (info.state === 'JobComplete' || info.state === 'Failed' || info.state === 'Aborted') {
        return {
          id: info.id,
          state: info.state,
          errorMessage: info.errorMessage,
          numberRecordsProcessed: processed,
          numberRecordsFailed: failed,
        };
      }

      if (Date.now() - startedAt > POLL_TIMEOUT) {
        return {
          id: info.id,
          state: 'Failed',
          errorMessage: 'Bulk API v2 poll timeout.',
          numberRecordsProcessed: processed,
          numberRecordsFailed: failed,
        };
      }

      await Common.delayAsync(options.script.pollingIntervalMs);
      return pollAsync();
    };

    return pollAsync();
  }

  /**
   * Applies Bulk API v2 results to source records.
   *
   * @param options - Execution options.
   * @param records - Source records.
   * @param results - Bulk API v2 results.
   */
  private _applyBulkV2Results(
    options: ApiEngineRunOptionsType,
    records: Array<Record<string, unknown>>,
    results: BulkV2ResultsType
  ): void {
    const successRecords = this._normalizeBulkV2Records(results?.successfulResults);
    const failedRecords = this._normalizeBulkV2Records(results?.failedResults);
    const unprocessedRecords = this._normalizeBulkV2Records(results?.unprocessedRecords);

    unprocessedRecords.forEach((record) => {
      // eslint-disable-next-line no-param-reassign
      record['sf__Unprocessed'] = true;
    });

    const allResults = successRecords.concat(failedRecords, unprocessedRecords);
    const invalidRecordMessage = options.logger.getResourceString('invalidRecordHashcode');
    const unprocessedMessage = options.logger.getResourceString('unprocessedRecord');
    const useIdMapping = this._shouldUseIdMapping(options.operation, records);
    const propsToExclude = ['sf__Created', 'sf__Id', 'sf__Error', 'sf__Unprocessed'];

    const mapping = useIdMapping
      ? Common.compareArraysByProperty(records, allResults, 'Id')
      : Common.compareArraysByHashcode(records, allResults, propsToExclude);

    mapping.forEach((resultRecord, sourceRecord) => {
      if (!resultRecord) {
        // eslint-disable-next-line no-param-reassign
        sourceRecord[ERRORS_FIELD_NAME] = invalidRecordMessage;
        return;
      }

      const resultError = this._extractBulkV2Error(resultRecord, unprocessedMessage);
      if (resultError) {
        // eslint-disable-next-line no-param-reassign
        sourceRecord[ERRORS_FIELD_NAME] = resultError;
      } else {
        // eslint-disable-next-line no-param-reassign
        sourceRecord[ERRORS_FIELD_NAME] = null;
      }

      if (options.operation === OPERATION.Insert && options.updateRecordId) {
        const resultId = this._resolveBulkV2ResultId(resultRecord);
        if (resultId) {
          // eslint-disable-next-line no-param-reassign
          sourceRecord['Id'] = resultId;
        }
      }
    });
  }

  /**
   * Normalizes Bulk API v2 record lists.
   *
   * @param records - Candidate records list.
   * @returns Normalized record list.
   */
  private _normalizeBulkV2Records(records?: unknown): Array<Record<string, unknown>> {
    void this;
    if (!Array.isArray(records)) {
      return [];
    }
    return records.filter((record): record is Record<string, unknown> => typeof record === 'object' && record !== null);
  }

  /**
   * Determines if Id-based mapping should be used for Bulk v2 results.
   *
   * @param operation - CRUD operation.
   * @param records - Source records.
   * @returns True when Id mapping should be used.
   */
  private _shouldUseIdMapping(operation: OPERATION, records: Array<Record<string, unknown>>): boolean {
    void this;
    if (operation === OPERATION.Insert) {
      return false;
    }
    return records.every((record) => Boolean(record['Id']));
  }

  /**
   * Extracts error messages from Bulk API v2 result record.
   *
   * @param record - Result record.
   * @param unprocessedMessage - Fallback message for unprocessed records.
   * @returns Error message or undefined.
   */
  private _extractBulkV2Error(record: Record<string, unknown>, unprocessedMessage: string): string | undefined {
    void this;
    const errorValue = record['sf__Error'];
    if (typeof errorValue === 'string' && errorValue) {
      return errorValue;
    }
    if (record['sf__Unprocessed']) {
      return unprocessedMessage;
    }
    return undefined;
  }

  /**
   * Resolves Bulk API v2 record Id from result record.
   *
   * @param record - Result record.
   * @returns Record Id or empty string.
   */
  private _resolveBulkV2ResultId(record: Record<string, unknown>): string {
    void this;
    const candidate = record['sf__Id'] ?? record['Id'];
    if (!candidate) {
      return '';
    }
    return String(candidate);
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
