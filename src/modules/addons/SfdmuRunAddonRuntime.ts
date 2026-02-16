/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Buffer } from 'node:buffer';
import type { Connection } from '@jsforce/jsforce-node';
import { Common } from '../common/Common.js';
import { API_ENGINE, OPERATION } from '../common/Enumerations.js';
import type { IApiEngine } from '../api/models/IApiEngine.js';
import ApiEngineExecutor from '../api/ApiEngineExecutor.js';
import ApiEngineFactory from '../api/ApiEngineFactory.js';
import BulkApiV1Engine from '../api/engines/BulkApiV1Engine.js';
import BulkApiV2Engine from '../api/engines/BulkApiV2Engine.js';
import RestApiEngine from '../api/engines/RestApiEngine.js';
import {
  ADDON_TEMP_RELATIVE_FOLDER,
  CSV_TARGET_FILE_SUFFIX,
  DEFAULT_MAX_CHUNK_SIZE,
  ERRORS_FIELD_NAME,
} from '../constants/Constants.js';
import { CommandExecutionError } from '../models/common/CommandExecutionError.js';
import type { BlobFieldType } from '../models/common/BlobFieldType.js';
import type Script from '../models/script/Script.js';
import ContentVersion from '../models/sf/ContentVersion.js';
import OrgDataService from '../org/OrgDataService.js';
import AddonRuntime from './AddonRuntime.js';
import type AddonModule from './AddonModule.js';

type SObjectCrudType = {
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

type ConnectionWithSObjectType = Connection & {
  sobject?: (sObjectName: string) => SObjectCrudType;
};

/**
 * Add-on runtime implementation for the run command.
 */
export default class SfdmuRunAddonRuntime extends AddonRuntime {
  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Script configuration for this run.
   */
  private readonly _script: Script;

  /**
   * Org data service for query operations.
   */
  private readonly _dataService: OrgDataService;

  /**
   * Cached org connections.
   */
  private readonly _connectionCache: Map<string, Connection> = new Map();

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new run add-on runtime.
   *
   * @param script - Script configuration.
   */
  public constructor(script: Script) {
    super(script.logger ?? Common.logger, script.runInfo);
    this._script = script;
    this._dataService = new OrgDataService(script);
  }

  // ------------------------------------------------------//
  // -------------------- GETTERS/SETTERS ---------------- //
  // ------------------------------------------------------//

  /**
   * Returns the base directory for the run.
   *
   * @returns Base directory path.
   */
  public get basePath(): string {
    return this._script.basePath;
  }

  /**
   * Returns the source CSV directory path.
   *
   * @returns Source directory path.
   */
  public get sourcePath(): string {
    return this._script.sourceDirectoryPath;
  }

  /**
   * Returns the target CSV directory path.
   *
   * @returns Target directory path.
   */
  public get targetPath(): string {
    return this._script.targetDirectoryPath;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Returns the script bound to this runtime.
   *
   * @returns Script configuration.
   */
  public getScript(): Script {
    return this._script;
  }

  /**
   * Queries source or target org records.
   *
   * @param isSource - True for source org.
   * @param soql - SOQL query string.
   * @param useBulkQueryApi - Use Bulk API when true.
   * @returns Query results.
   */
  public async queryAsync(
    isSource: boolean,
    soql: string,
    useBulkQueryApi = false
  ): Promise<Array<Record<string, unknown>>> {
    const org = this._getOrg(isSource);
    if (!org) {
      return [];
    }
    return this._dataService.queryOrgAsync(soql, org, { useBulk: useBulkQueryApi });
  }

  /**
   * Executes multiple queries in sequence.
   *
   * @param isSource - True for source org.
   * @param soqls - List of SOQL strings.
   * @param useBulkQueryApi - Use Bulk API when true.
   * @returns Combined query results.
   */
  public async queryMultiAsync(
    isSource: boolean,
    soqls: string[],
    useBulkQueryApi = false
  ): Promise<Array<Record<string, unknown>>> {
    const tasks = soqls.map((soql) => async () => this.queryAsync(isSource, soql, useBulkQueryApi));
    const batchResults = await Common.serialExecAsync(tasks);
    return batchResults.flat();
  }

  /**
   * Constructs SOQL IN queries for the provided values.
   *
   * @param selectFields - Fields to select.
   * @param fieldName - IN-clause field name.
   * @param sObjectName - Object name.
   * @param valuesIN - IN-clause values.
   * @param whereClause - Optional WHERE clause.
   * @param orderBy - Optional ORDER BY clause.
   * @returns Array of SOQL query strings.
   */
  public createFieldInQueries(
    selectFields: string[],
    fieldName = 'Id',
    sObjectName: string,
    valuesIN: string[],
    whereClause?: string,
    orderBy?: string
  ): string[] {
    void this;
    return Common.createFieldInQueries(selectFields, fieldName, sObjectName, valuesIN, whereClause, orderBy);
  }

  /**
   * Updates target records using REST API or CSV output.
   *
   * @param sObjectName - Target object name.
   * @param operation - CRUD operation.
   * @param records - Records to process.
   * @param engine - Preferred API engine.
   * @param updateRecordId - True to overwrite Ids from API.
   * @returns Updated records.
   */
  public async updateTargetRecordsAsync(
    sObjectName: string,
    operation: OPERATION,
    records: Array<Record<string, unknown>>,
    engine: API_ENGINE = API_ENGINE.DEFAULT_ENGINE,
    updateRecordId = true
  ): Promise<Array<Record<string, unknown>>> {
    if (!records || records.length === 0) {
      return [];
    }

    await this._writeTargetCsvAsync(sObjectName, operation, records);

    if (this._shouldSkipDml()) {
      return records;
    }

    const connection = await this._getConnectionAsync(false);
    const engineInstance = this._createApiEngine(connection, sObjectName, records.length, engine);
    const executor = new ApiEngineExecutor({
      engine: engineInstance,
      operation,
      records,
      updateRecordId,
      logger: this._script.logger ?? Common.logger,
      script: this._script,
    });
    await executor.executeCrudAsync();
    return records;
  }

  /**
   * Transfers ContentVersion records from source to target org.
   *
   * @param module - Add-on module instance.
   * @param sourceVersions - Source ContentVersion records.
   * @param maxChunkSize - Optional max chunk size.
   * @returns Updated source ContentVersion records.
   */
  public async transferContentVersions(
    module: AddonModule,
    sourceVersions: ContentVersion[],
    maxChunkSize?: number
  ): Promise<ContentVersion[]> {
    const chunkSize = maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
    const urlUploadJobs: ContentVersion[] = [];
    let totalSize = 0;
    let totalCount = 0;
    let totalUrls = 0;

    const fileUploadJobs = this._chunkContentVersions(sourceVersions, chunkSize, (version) => {
      if (version.isUrlContent) {
        totalUrls += 1;
        urlUploadJobs.push(version);
        return false;
      }
      totalCount += 1;
      totalSize += version.ContentSize;
      return true;
    });

    if (fileUploadJobs.length > 0) {
      this.logFormattedInfo(
        module,
        'ExportFiles_TotalDataVolume',
        String(totalCount + totalUrls),
        String((totalSize / 1_000_000).toFixed(2))
      );
      this.logFormattedInfo(
        module,
        'ExportFiles_DataWillBeProcessedInChunksOfSize',
        String(fileUploadJobs.length),
        String((chunkSize / 1_000_000).toFixed(2))
      );
    }

    const uploadTasks = fileUploadJobs.map((fileJob, index) => async () => {
      const idToContentVersionMap = new Map<string, ContentVersion>();
      fileJob.forEach((version) => {
        if (version.Id) {
          idToContentVersionMap.set(version.Id, version);
        }
      });
      this.logFormattedInfo(
        module,
        'ExportFiles_ProcessingChunk',
        String(index + 1),
        String(idToContentVersionMap.size)
      );

      const idToContentVersionBlobMap = await this._downloadBlobDataAsync(true, [...idToContentVersionMap.keys()], {
        fieldName: 'VersionData',
        objectName: 'ContentVersion',
        dataType: 'base64',
      });

      const newToSourceVersionMap = new Map<Record<string, unknown>, ContentVersion>();
      const versionsToUpload = [...idToContentVersionBlobMap.keys()].map((versionId) => {
        const blobData = idToContentVersionBlobMap.get(versionId);
        const sourceContentVersion = idToContentVersionMap.get(versionId);
        if (!sourceContentVersion || typeof blobData === 'undefined') {
          return null;
        }
        const sourceRecord = sourceContentVersion as unknown as Record<string, unknown>;
        const newContentVersion = Common.cloneObjectIncludeProps(
          sourceRecord,
          'Title',
          'Description',
          'PathOnClient'
        ) as Record<string, unknown>;
        newContentVersion['VersionData'] = blobData;
        newContentVersion['ReasonForChange'] = sourceContentVersion.reasonForChange;
        newContentVersion['ContentDocumentId'] = sourceContentVersion.targetContentDocumentId;
        newToSourceVersionMap.set(newContentVersion, sourceContentVersion);
        return newContentVersion;
      });

      const uploadPayload = versionsToUpload.filter((version): version is Record<string, unknown> => Boolean(version));

      await this._uploadContentVersionsAsync(uploadPayload, newToSourceVersionMap, false);
    });

    await Common.serialExecAsync(uploadTasks);

    if (urlUploadJobs.length > 0) {
      const newToSourceVersionMap = new Map<Record<string, unknown>, ContentVersion>();
      const versionsToUpload = urlUploadJobs.map((sourceContentVersion) => {
        const sourceRecord = sourceContentVersion as unknown as Record<string, unknown>;
        const newContentVersion = Common.cloneObjectIncludeProps(
          sourceRecord,
          'Title',
          'Description',
          'ContentUrl'
        ) as Record<string, unknown>;
        newContentVersion['ReasonForChange'] = sourceContentVersion.reasonForChange;
        newContentVersion['ContentDocumentId'] = sourceContentVersion.targetContentDocumentId;
        newToSourceVersionMap.set(newContentVersion, sourceContentVersion);
        return newContentVersion;
      });

      await this._uploadContentVersionsAsync(versionsToUpload, newToSourceVersionMap, true);
    }

    return sourceVersions;
  }

  /**
   * Returns or creates a temporary folder for the add-on.
   *
   * @param module - Add-on module instance.
   * @returns Temp folder path.
   */
  public getOrCreateTempPath(module: AddonModule): string {
    const safeName = module.context.moduleDisplayName.replace(/[^\w\d]/g, '-');
    const tempFolder = path.normalize(
      path.join(this.basePath, Common.formatStringLog(ADDON_TEMP_RELATIVE_FOLDER, safeName))
    );
    if (!fs.existsSync(tempFolder)) {
      fs.mkdirSync(tempFolder, { recursive: true });
    }
    return tempFolder;
  }

  /**
   * Removes the temporary folder created for the add-on.
   *
   * @param module - Add-on module instance.
   * @param removeParentFolder - Remove parent folder when true.
   */
  public destroyTempPath(module: AddonModule, removeParentFolder?: boolean): void {
    const tempFolder = this.getOrCreateTempPath(module);
    Common.deleteFolderRecursive(tempFolder, false, Boolean(removeParentFolder));
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Resolves source or target org.
   *
   * @param isSource - True for source org.
   * @returns Script org definition or undefined.
   */
  private _getOrg(isSource: boolean): Script['sourceOrg'] | undefined {
    return isSource ? this._script.sourceOrg : this._script.targetOrg;
  }

  /**
   * Determines if DML should be skipped.
   *
   * @returns True when DML should be skipped.
   */
  private _shouldSkipDml(): boolean {
    return Boolean(this._script.simulationMode || this._script.targetOrg?.isFileMedia);
  }

  /**
   * Writes records to the target CSV file if enabled.
   *
   * @param sObjectName - Target object name.
   * @param operation - Operation being executed.
   * @param records - Records to write.
   */
  private async _writeTargetCsvAsync(
    sObjectName: string,
    operation: OPERATION,
    records: Array<Record<string, unknown>>
  ): Promise<void> {
    if (!this._script.createTargetCSVFiles) {
      return;
    }
    const directory = this._script.targetDirectoryPath;
    fs.mkdirSync(directory, { recursive: true });
    const targetFile = this._getTargetCsvFilename(sObjectName, operation);
    const columns = records.length > 0 ? Common.orderCsvColumnsWithIdFirstAndErrorsLast(Object.keys(records[0])) : [];
    await Common.writeCsvFileAsync(targetFile, records, true, columns.length > 0 ? columns : undefined, true, true);
  }

  /**
   * Resolves the target CSV filename for an operation.
   *
   * @param sObjectName - Object name.
   * @param operation - Operation identifier.
   * @returns Target CSV filename.
   */
  private _getTargetCsvFilename(sObjectName: string, operation: OPERATION): string {
    const operationName = typeof operation === 'string' ? operation : OPERATION[operation] ?? String(operation);
    const suffix = `_${String(operationName).toLowerCase()}${CSV_TARGET_FILE_SUFFIX}`;
    return Common.getCSVFilename(this._script.targetDirectoryPath, sObjectName, suffix);
  }

  /**
   * Creates an API engine instance for add-on updates.
   *
   * @param connection - Org connection.
   * @param sObjectName - Target object name.
   * @param recordCount - Number of records.
   * @param engine - Preferred engine.
   * @returns API engine instance.
   */
  private _createApiEngine(
    connection: Connection,
    sObjectName: string,
    recordCount: number,
    engine: API_ENGINE
  ): IApiEngine {
    if (engine === API_ENGINE.DEFAULT_ENGINE) {
      return ApiEngineFactory.createEngine({
        connection,
        sObjectName,
        amountToProcess: recordCount,
        bulkThreshold: this._script.bulkThreshold,
        alwaysUseRest: this._script.alwaysUseRestApiToUpdateRecords,
        bulkApiVersion: this._script.bulkApiVersion,
      });
    }

    switch (engine) {
      case API_ENGINE.BULK_API_V2:
        return new BulkApiV2Engine({ connection, sObjectName });
      case API_ENGINE.BULK_API_V1:
        return new BulkApiV1Engine({ connection, sObjectName });
      case API_ENGINE.REST_API:
      default:
        return new RestApiEngine({ connection, sObjectName });
    }
  }

  /**
   * Resolves a cached connection for source or target org.
   *
   * @param isSource - True for source org.
   * @returns Connection instance.
   */
  private async _getConnectionAsync(isSource: boolean): Promise<Connection> {
    const org = this._getOrg(isSource);
    if (!org?.name) {
      throw new CommandExecutionError('Missing org name for connection.');
    }
    const cacheKey = `${org.name}:${this._script.apiVersion ?? ''}`;
    const cached = this._connectionCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const connection = await org.getConnectionAsync();
    this._connectionCache.set(cacheKey, connection);
    return connection;
  }

  /**
   * Returns the sObject CRUD connection if supported.
   *
   * @param connection - Org connection.
   * @param sObjectName - Object name.
   * @returns CRUD connection or undefined.
   */
  private _getSObjectConnection(connection: Connection, sObjectName: string): SObjectCrudType | undefined {
    void this;
    const candidate = connection as ConnectionWithSObjectType;
    if (typeof candidate.sobject !== 'function') {
      return undefined;
    }
    const sobject = candidate.sobject(sObjectName);
    if (!sobject) {
      return undefined;
    }
    return sobject as unknown as SObjectCrudType;
  }

  /**
   * Downloads blob data for a list of record Ids.
   *
   * @param isSource - True for source org.
   * @param recordIds - Record Ids to download.
   * @param blobField - Blob field descriptor.
   * @returns Map of record Id to blob content.
   */
  private async _downloadBlobDataAsync(
    isSource: boolean,
    recordIds: string[],
    blobField: BlobFieldType
  ): Promise<Map<string, string>> {
    if (recordIds.length === 0) {
      return new Map();
    }
    const connection = await this._getConnectionAsync(isSource);
    const sobject = this._getSObjectConnection(connection, blobField.objectName);
    if (!sobject || typeof (sobject as { record?: unknown }).record !== 'function') {
      throw new CommandExecutionError('Connection does not support blob downloads.');
    }

    const downloader = sobject as unknown as {
      record: (id: string) => {
        blob: (fieldName: string) => { on: (event: string, cb: (arg: unknown) => void) => void };
      };
    };

    const tasks = recordIds.map((recordId) => async () => {
      const data = await new Promise<string>((resolve, reject) => {
        const buffers: Buffer[] = [];
        const request = downloader.record(recordId).blob(blobField.fieldName);
        request.on('data', (chunk) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
          buffers.push(buffer);
        });
        request.on('end', () => {
          resolve(Buffer.concat(buffers).toString(blobField.dataType));
        });
        request.on('error', (error) => reject(error));
      });
      return [recordId, data] as const;
    });

    const results = await Common.parallelTasksAsync(tasks, this._script.parallelBinaryDownloads);
    return new Map(results);
  }

  /**
   * Splits ContentVersion records into size-limited chunks.
   *
   * @param versions - Source ContentVersion records.
   * @param chunkSize - Max chunk size in bytes.
   * @param onInclude - Callback invoked for included records.
   * @returns Chunked record list.
   */
  private _chunkContentVersions(
    versions: ContentVersion[],
    chunkSize: number,
    onInclude: (version: ContentVersion) => boolean
  ): ContentVersion[][] {
    void this;
    const chunks: ContentVersion[][] = [];
    let current: ContentVersion[] = [];
    let size = 0;

    for (const version of versions) {
      if (!onInclude(version)) {
        continue;
      }
      const versionSize = version.ContentSize;
      if (size + versionSize > chunkSize && current.length > 0) {
        chunks.push(current);
        current = [];
        size = 0;
      }
      current.push(version);
      size += versionSize;
    }
    if (current.length > 0) {
      chunks.push(current);
    }
    return chunks;
  }

  /**
   * Uploads ContentVersion records and updates source references.
   *
   * @param versionsToUpload - ContentVersion records to upload.
   * @param newToSourceVersionMap - Mapping of upload record to source version.
   * @param isUrl - True when using URL content.
   */
  private async _uploadContentVersionsAsync(
    versionsToUpload: Array<Record<string, unknown>>,
    newToSourceVersionMap: Map<Record<string, unknown>, ContentVersion>,
    isUrl: boolean
  ): Promise<void> {
    const records = await this.updateTargetRecordsAsync(
      'ContentVersion',
      OPERATION.Insert,
      versionsToUpload,
      isUrl ? API_ENGINE.DEFAULT_ENGINE : API_ENGINE.REST_API,
      true
    );

    const newRecordIdToSourceVersionMap = new Map<string, ContentVersion>();

    records.forEach((record) => {
      const sourceVersion = newToSourceVersionMap.get(record);
      if (!sourceVersion) {
        return;
      }
      sourceVersion.targetId = String(record['Id'] ?? '');
      if (record[ERRORS_FIELD_NAME]) {
        sourceVersion.isError = true;
      }
      if (!sourceVersion.targetContentDocumentId && sourceVersion.targetId) {
        newRecordIdToSourceVersionMap.set(sourceVersion.targetId, sourceVersion);
      }
    });

    if (newRecordIdToSourceVersionMap.size === 0) {
      return;
    }

    const queries = this.createFieldInQueries(['Id', 'ContentDocumentId'], 'Id', 'ContentVersion', [
      ...newRecordIdToSourceVersionMap.keys(),
    ]);
    const queried = await this.queryMultiAsync(false, queries);

    queried.forEach((record) => {
      const sourceVersion = newRecordIdToSourceVersionMap.get(String(record['Id'] ?? ''));
      if (!sourceVersion) {
        return;
      }
      sourceVersion.targetContentDocumentId = String(record['ContentDocumentId'] ?? '');
      if (record[ERRORS_FIELD_NAME]) {
        sourceVersion.isError = true;
      }
    });
  }
}
