/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Logger, RESOURCES } from "../../components/common_components/logger";
import { IApiJobCreateResult, IApiEngineInitParameters, ICsvChunk } from "./helper_interfaces";
import { ApiInfo, IApiEngine } from ".";
import { Common } from "../../components/common_components/common";
import { CsvChunks, ScriptObject } from "..";
import { IOrgConnectionData, IFieldMapping, IFieldMappingResult } from "../common_models/helper_interfaces";
import { DATA_CACHE_TYPES, OPERATION } from "../../components/common_components/enumerations";
import { CONSTANTS } from "../../components/common_components/statics";


import * as fs from 'fs';
import * as path from 'path';



/**
 * Base class for all ApiProcess inherited classes
 *
 * @export
 * @class ApiProcessBase
 */
export default class ApiEngineBase implements IApiEngine, IFieldMapping, IApiEngineInitParameters {

  isChildJob: boolean;

  concurrencyMode: string;
  pollingIntervalMs: number
  bulkApiV1BatchSize: number;

  allOrNone: boolean;
  operation: OPERATION;
  updateRecordId: boolean;
  sObjectName: string;
  oldSObjectName: string;
  targetCSVFullFilename: string;
  createTargetCSVFiles: boolean;
  logger: Logger;
  simulationMode: boolean;

  connectionData: IOrgConnectionData;

  apiJobCreateResult: IApiJobCreateResult;

  numberJobRecordProcessed: number = 0;
  numberJobRecordsFailed: number = 0;
  numberJobTotalRecordsToProcess: number = 0;

  binaryDataCache: DATA_CACHE_TYPES = DATA_CACHE_TYPES.InMemory;
  restApiBatchSize: number;
  binaryCacheDirectory: string;

  fieldsNotToWriteInTargetCSVFile: Array<string> = new Array<string>();
  targetFieldMapping: IFieldMapping;

  get instanceUrl() {
    return this.connectionData.instanceUrl;
  }

  get accessToken() {
    return this.connectionData.accessToken;
  }

  get version() {
    return this.connectionData.apiVersion;
  }

  get proxyUrl() {
    return this.connectionData.proxyUrl;
  }

  get strOperation(): string {
    return ScriptObject.getStrOperation(this.operation);
  }

  constructor(init: IApiEngineInitParameters) {

    this.isChildJob = init.isChildJob;

    this.logger = init.logger;
    this.connectionData = init.connectionData;
    this.sObjectName = init.sObjectName;
    this.operation = init.operation;
    this.pollingIntervalMs = init.pollingIntervalMs;
    this.concurrencyMode = init.concurrencyMode;
    this.updateRecordId = init.updateRecordId;
    this.bulkApiV1BatchSize = init.bulkApiV1BatchSize;
    this.restApiBatchSize = init.restApiBatchSize;
    this.allOrNone = init.allOrNone;
    this.createTargetCSVFiles = init.createTargetCSVFiles;
    this.targetCSVFullFilename = init.targetCSVFullFilename;
    this.simulationMode = init.simulationMode;
    this.binaryDataCache = init.binaryDataCache;
    this.binaryCacheDirectory = init.binaryCacheDirectory;
    this.targetFieldMapping = init.targetFieldMapping;


    this.fieldsNotToWriteInTargetCSVFile = CONSTANTS.FELDS_NOT_TO_OUTPUT_TO_TARGET_CSV.get(this.sObjectName) || new Array<string>();

    if (init.targetFieldMapping) {
      Object.assign(this, init.targetFieldMapping);
    }
  }




  sourceQueryToTarget = (query: string, sourceObjectName: string) => <IFieldMappingResult>{ query, targetSObjectName: sourceObjectName };
  sourceRecordsToTarget = (records: any[], sourceObjectName: string) => <IFieldMappingResult>{ records, targetSObjectName: sourceObjectName };
  targetRecordsToSource = (records: any[], sourceObjectName: string) => <IFieldMappingResult>{ records, targetSObjectName: sourceObjectName };
  transformQuery: (query: string, sourceObjectName: string) => IFieldMappingResult;

  // ----------------------- Interface IApiProcess ----------------------------------
  getEngineName(): string {
    return "REST API";
  }

  getIsRestApiEngine(): boolean {
    return this.getEngineName() == 'REST API';
  }

  getEngineClassType(): typeof ApiEngineBase {
    return ApiEngineBase;
  }

  async executeCRUD(allRecords: Array<any>, progressCallback: (progress: ApiInfo) => void): Promise<Array<any>> {

    // Map source records
    this.oldSObjectName = this.sObjectName;
    let mappedRecords = this.sourceRecordsToTarget(allRecords, this.sObjectName);
    this.sObjectName = mappedRecords.targetSObjectName;
    allRecords = mappedRecords.records;
    this.numberJobTotalRecordsToProcess = allRecords.length;

    // Create CRUD job
    if (!this.simulationMode) {
      await this.createCRUDApiJobAsync(allRecords);
    } else {
      await this.createCRUDSimulationJobAsync(allRecords);
    }

    // Execute CRUD job
    let resultRecords = await this.processCRUDApiJobAsync(progressCallback);

    // Map target records
    this.sObjectName = this.oldSObjectName;
    resultRecords = this.targetRecordsToSource(resultRecords, this.sObjectName).records;

    // Return
    return resultRecords;
  }

  async executeCRUDMultithreaded(allRecords: any[], progressCallback: (progress: ApiInfo) => void, threadsCount: number): Promise<any[]> {

    if (!threadsCount || threadsCount <= 1) {
      return await this.executeCRUD(allRecords, progressCallback);
    }

    let chunks = Common.chunkArray(allRecords, allRecords.length / threadsCount);

    let taskQueue = chunks.map(chunk => {
      return async () => {
        let ApiEngine: typeof ApiEngineBase = this.getEngineClassType();
        let tempApiEngine = new ApiEngine(this);
        tempApiEngine.isChildJob = true;
        let result = await tempApiEngine.executeCRUD(chunk, progressCallback);
        return result || new Array<any>();
      }
    });

    let records = await Common.parallelExecAsync(taskQueue, this, threadsCount);
    let outputRecords = Common.flattenArrays(records);

    await this.writeToTargetCSVFileAsync(outputRecords, this.getTargetCsvColumns(outputRecords));

    return outputRecords;

  }

  async createCRUDApiJobAsync(allRecords: Array<any>): Promise<IApiJobCreateResult> {
    return null;
  }

  async createCRUDSimulationJobAsync(allRecords: Array<any>): Promise<IApiJobCreateResult> {
    let chunks = new CsvChunks().fromArray(this.getSourceRecordsArray(allRecords));
    this.apiJobCreateResult = {
      chunks,
      apiInfo: new ApiInfo({
        jobState: "Undefined",
        strOperation: this.strOperation,
        sObjectName: this.sObjectName,
        jobId: "SIMULATION",
        batchId: "SIMULATION"
      }),
      allRecords
    };
    return this.apiJobCreateResult;
  }

  async processCRUDApiJobAsync(progressCallback: (progress: ApiInfo) => void): Promise<Array<any>> {
    let allResultRecords = new Array<any>();
    for (let index = 0; index < this.apiJobCreateResult.chunks.chunks.length; index++) {
      const csvCunk = this.apiJobCreateResult.chunks.chunks[index];
      let resultRecords = new Array<any>();
      if (!this.simulationMode) {
        resultRecords = await this.processCRUDApiBatchAsync(csvCunk, progressCallback);
      } else {
        resultRecords = await this.processCRUDSimulationBatchAsync(csvCunk, progressCallback);
      }
      if (!resultRecords) {
        // ERROR RESULT
        if (!this.isChildJob) {
          await this.writeToTargetCSVFileAsync(new Array<any>());
        }
        return null;
      } else {
        allResultRecords = allResultRecords.concat(resultRecords);
      }
    }
    // SUCCESS RESULT
    if (!this.isChildJob) {
      await this.writeToTargetCSVFileAsync(allResultRecords, this.getTargetCsvColumns(allResultRecords));
    }
    return allResultRecords;
  }

  async processCRUDApiBatchAsync(csvChunk: ICsvChunk, progressCallback: (progress: ApiInfo) => void): Promise<Array<any>> {
    return null;
  }

  async processCRUDSimulationBatchAsync(csvChunk: ICsvChunk, progressCallback: (progress: ApiInfo) => void): Promise<Array<any>> {

    // Progress message: operation started ---------
    if (progressCallback) {
      progressCallback(new ApiInfo({
        jobState: "OperationStarted"
      }));
    }

    // Simulation -----------------------------------
    if (this.operation == OPERATION.Insert && this.updateRecordId) {
      csvChunk.records.forEach(record => {
        record["Id"] = Common.makeId(18);
      });
    }


    // Progress message: operation finished ---------
    if (progressCallback) {
      progressCallback(new ApiInfo({
        jobState: "OperationFinished"
      }));
    }

    // Create result records
    return this.getResultRecordsArray(csvChunk.records);

  }

  getStrOperation(): string {
    return this.strOperation;
  }


  // ----------------------- ---------------- -------------------------------------------


  // ----------------------- Protected members -------------------------------------------
  /**
   * Writes target records to csv file during CRUD api operation
   *
   * @param {Array<any>} records
   * @returns {Promise<void>}
   * @memberof ApiEngineBase
   */
  protected async writeToTargetCSVFileAsync(records: Array<any>, columns?: Array<string>): Promise<void> {

    // Filter records to write to CSV file
    if (this.fieldsNotToWriteInTargetCSVFile.length > 0) {
      records.forEach(record => {
        this.fieldsNotToWriteInTargetCSVFile.forEach(fieldName => {
          record[fieldName] = !!record[fieldName] ? record[fieldName] = `[${fieldName}]` : record[fieldName];
        });
      });
    }

    if (this.createTargetCSVFiles) {
      await Common.writeCsvFileAsync(this.targetCSVFullFilename, records, true, columns);
    }
  }

  protected getSourceRecordsArray(records: Array<any>): Array<any> {
    if (this.operation == OPERATION.Delete && !this.simulationMode) {
      return records.map(x => x["Id"]);
    } else {
      return records;
    }
  }

  protected getResultRecordsArray(records: Array<any>): Array<any> {
    if (this.operation == OPERATION.Delete) {
      return records.map(record => {
        if (!this.simulationMode) {
          return {
            Id: record
          };
        } else {
          delete record[CONSTANTS.__ID_FIELD_NAME];
          return record;
        }
      });
    } else {
      return records;
    }
  }

  protected loadBinaryDataFromCache(records: Array<any>): Array<any> {

    if (records.length == 0) {
      return records;
    }

    // Load from cache
    if (this.binaryDataCache == DATA_CACHE_TYPES.FileCache
      || this.binaryDataCache == DATA_CACHE_TYPES.CleanFileCache) {
      let binaryFields = Object.keys(records[0]).filter(key => (String(records[0][key]) || '').startsWith(CONSTANTS.BINARY_FILE_CACHE_RECORD_PLACEHOLDER_PREFIX));
      // Check from cache
      if (binaryFields.length > 0) {
        records.forEach(record => {
          binaryFields.forEach(field => {
            let binaryId = CONSTANTS.BINARY_FILE_CACHE_RECORD_PLACEHOLDER_ID(record[field]);
            if (binaryId) {
              let cacheFilename = CONSTANTS.BINARY_FILE_CACHE_TEMPLATE(binaryId);
              let fullCacheFilename = path.join(this.binaryCacheDirectory, cacheFilename);
              if (fs.existsSync(fullCacheFilename)) {
                this.logger.infoNormal(RESOURCES.readingFromCacheFile, this.sObjectName, path.join('./', CONSTANTS.BINARY_CACHE_SUB_DIRECTORY, cacheFilename));
                let blob = fs.readFileSync(fullCacheFilename, 'utf-8');
                record[field] = blob;
              }
            }
          });
        });
      }
    }

  }

  protected getTargetCsvColumns(records: Array<any>): Array<string> {

    const LAST_COLS = [
      "Id",
      CONSTANTS.ERRORS_FIELD_NAME
    ];

    if (!records || records.length == 0) {
      return new Array<string>();
    }

    let cols = Object.keys(records[0]).filter(key => LAST_COLS.indexOf(key) < 0);
    let lastCols = Object.keys(records[0]).filter(key => LAST_COLS.indexOf(key) >= 0);

    return cols.concat(lastCols);

  }

}
