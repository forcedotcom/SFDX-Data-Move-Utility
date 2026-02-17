/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Connection } from '@jsforce/jsforce-node';
import { Common } from '../common/Common.js';
import { DATA_CACHE_TYPES } from '../common/Enumerations.js';
import {
  DEFAULT_GROUP_WHERE_CLAUSE,
  GROUP_OBJECT_NAME,
  MAX_FETCH_SIZE,
  QUERY_PROGRESS_MESSAGE_PER_RECORDS,
  SOURCE_RECORDS_CACHE_SUB_DIRECTORY,
  SOURCE_RECORDS_FILE_CACHE_TEMPLATE,
  USER_AND_GROUP_COMMON_FIELDS,
  USER_OBJECT_NAME,
} from '../constants/Constants.js';
import type { BlobFieldType } from '../models/common/BlobFieldType.js';
import { CommandExecutionError } from '../models/common/CommandExecutionError.js';
import type Script from '../models/script/Script.js';
import type ScriptOrg from '../models/script/ScriptOrg.js';

type QueryResultType<T> = {
  records: T[];
  done: boolean;
  nextRecordsUrl?: string;
};

type CachedRecordsType = {
  query: string;
  records: Array<Record<string, unknown>>;
};

type BulkQueryType = {
  on(event: 'record', listener: (record: Record<string, unknown>) => void): BulkQueryType;
  on(event: 'end', listener: () => void): BulkQueryType;
  on(event: 'error', listener: (error: Error) => void): BulkQueryType;
};

type BulkConnectionType = {
  pollInterval: number;
  pollTimeout: number;
  query: (soql: string) => BulkQueryType;
};

type OrgConnectionType = Omit<Connection, 'bulk'> & {
  queryMore: <T>(url: string) => Promise<QueryResultType<T>>;
  bulk?: BulkConnectionType;
  queryAll?: <T>(query: string) => Promise<QueryResultType<T>>;
  request?: <T>(request: { method: string; url: string }) => Promise<T>;
  getApiVersion?: () => string;
};

type OrgQueryOptionsType = {
  useBulk?: boolean;
  useQueryAll?: boolean;
  csvColumnDataTypeMap?: Map<string, string>;
  useInternalCsvFormat?: boolean;
};

type ProgressStateType = {
  nextAt: number;
  lastLogged: number;
  step: number;
};

/**
 * Builds a User query with legacy fields and a derived WHERE clause.
 *
 * @param userQuery - User query string.
 * @returns User query string.
 */
const buildUserQuery = (userQuery: string): string => {
  const fields = USER_AND_GROUP_COMMON_FIELDS.join(', ');
  const whereClause = extractWhereClause(userQuery);
  return composeSimpleQuery(USER_OBJECT_NAME, fields, whereClause);
};

/**
 * Builds a Group query with legacy fields and optional overrides.
 *
 * @param groupQuery - Optional Group query or WHERE clause override.
 * @returns Group query string.
 */
const buildGroupQuery = (groupQuery?: string): string => {
  const fields = USER_AND_GROUP_COMMON_FIELDS.join(', ');
  const whereClause = resolveGroupFilter(groupQuery);
  return composeSimpleQuery(GROUP_OBJECT_NAME, fields, whereClause);
};

/**
 * Resolves Group WHERE clause from override or default.
 *
 * @param groupQuery - Optional Group query or WHERE clause override.
 * @returns WHERE clause string when defined.
 */
const resolveGroupFilter = (groupQuery?: string): string | undefined => {
  const trimmed = groupQuery?.trim();
  if (!trimmed) {
    return DEFAULT_GROUP_WHERE_CLAUSE;
  }

  const isSelect = /\bselect\b/i.test(trimmed) && /\bfrom\b/i.test(trimmed);
  if (isSelect) {
    const isGroupQuery = /\bfrom\s+group\b/i.test(trimmed);
    if (!isGroupQuery) {
      return DEFAULT_GROUP_WHERE_CLAUSE;
    }
    return extractWhereClause(trimmed);
  }

  const normalized = trimmed.replace(/^where\s+/i, '').trim();
  return normalized.length > 0 ? normalized : undefined;
};

/**
 * Extracts the WHERE clause from a SOQL query string.
 *
 * @param query - SOQL query string.
 * @returns WHERE clause or undefined.
 */
const extractWhereClause = (query: string): string | undefined => {
  const whereClause = Common.extractWhereClause(query);
  return whereClause && whereClause.length > 0 ? whereClause : undefined;
};

/**
 * Composes a basic SELECT query from the inputs.
 *
 * @param objectName - Target sObject name.
 * @param fields - Comma separated field list.
 * @param whereClause - Optional WHERE clause.
 * @returns SOQL query string.
 */
const composeSimpleQuery = (objectName: string, fields: string, whereClause?: string): string => {
  const whereSegment = whereClause ? ` WHERE ${whereClause}` : '';
  return `SELECT ${fields} FROM ${objectName}${whereSegment}`;
};

/**
 * Extracts the object name from a SOQL query.
 *
 * @param query - SOQL query string.
 * @returns sObject name or empty string.
 */
const extractObjectName = (query: string): string => {
  const match = /\bfrom\s+([^\s]+)\b/i.exec(query ?? '');
  return match?.[1] ?? '';
};

/**
 * Creates progress tracking state.
 *
 * @param step - Logging step size.
 * @returns Progress state instance.
 */
const createProgressState = (step: number): ProgressStateType => ({
  nextAt: step,
  lastLogged: 0,
  step,
});

/**
 * Formats progress output.
 *
 * @param count - Current progress count.
 * @param total - Optional total count.
 * @returns Formatted progress string.
 */
const formatProgress = (count: number, total?: number): string =>
  typeof total === 'number' ? `${count}/${total}` : String(count);

/**
 * Org data query and blob download helpers.
 */
export default class OrgDataService {
  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Script configuration for org operations.
   */
  private readonly _script: Script;

  /**
   * Cached org connections keyed by name and API version.
   */
  private readonly _connectionCache: Map<string, OrgConnectionType> = new Map();

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new org data service.
   *
   * @param script - Script configuration.
   */
  public constructor(script: Script) {
    this._script = script;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Queries an org using REST or Bulk API.
   *
   * @param query - SOQL query string.
   * @param org - Org definition.
   * @param options - Optional query overrides.
   * @returns Query records.
   */
  public async queryOrgAsync(
    query: string,
    org: ScriptOrg,
    options: OrgQueryOptionsType = {}
  ): Promise<Array<Record<string, unknown>>> {
    if (!org || org.isFileMedia) {
      return [];
    }

    const cachedRecords = this._readSourceRecordsCache(query, org);
    if (cachedRecords !== null) {
      return cachedRecords;
    }

    const connection = await this._getConnectionAsync(org);
    const useQueryAll = Boolean(options.useQueryAll);
    const useBulk = Boolean(options.useBulk && connection.bulk && !useQueryAll);
    const sObjectName = extractObjectName(query);
    if (sObjectName) {
      const apiVersion = this._resolveApiVersion(connection);
      this._script.logger?.info(useBulk ? 'usingBulkAPIQuery' : 'usingRestApi', sObjectName, apiVersion);
      this._logQueryApiVersionDiagnostics(sObjectName, apiVersion, useBulk);
    }
    const records = useBulk
      ? await this._queryBulkAsync(connection, query)
      : await this._queryRestAsync(connection, query, useQueryAll);
    this._writeSourceRecordsCache(query, org, records);
    return records;
  }

  /**
   * Queries an org or CSV file based on media settings.
   *
   * @param query - SOQL query string.
   * @param org - Org definition.
   * @param csvFilePath - Path to the CSV file.
   * @param useSourceCsvFile - True to prefer CSV input.
   * @param options - Optional query overrides.
   * @returns Query records.
   */
  public async queryOrgOrCsvAsync(
    query: string,
    org: ScriptOrg,
    csvFilePath: string,
    useSourceCsvFile: boolean,
    options: OrgQueryOptionsType = {}
  ): Promise<Array<Record<string, unknown>>> {
    if (org.isFileMedia || useSourceCsvFile) {
      if (!csvFilePath) {
        throw new CommandExecutionError('CSV file path is required for file-based queries.');
      }
      return Common.readCsvFileAsync(
        csvFilePath,
        0,
        options.csvColumnDataTypeMap,
        false,
        Boolean(options.useInternalCsvFormat)
      );
    }

    return this.queryOrgAsync(query, org, options);
  }

  /**
   * Queries User and Group objects and returns a combined result set.
   *
   * @param userQuery - User query string.
   * @param org - Org definition.
   * @param groupQuery - Optional Group query override.
   * @param options - Optional query overrides.
   * @returns Combined User and Group records.
   */
  public async queryUserGroupAsync(
    userQuery: string,
    org: ScriptOrg,
    groupQuery?: string,
    options: OrgQueryOptionsType = {}
  ): Promise<Array<Record<string, unknown>>> {
    const resolvedUserQuery = buildUserQuery(userQuery);
    const resolvedGroupQuery = buildGroupQuery(groupQuery ?? this._script.groupQuery);
    const [userRecords, groupRecords] = await Promise.all([
      this.queryOrgAsync(resolvedUserQuery, org, options),
      this.queryOrgAsync(resolvedGroupQuery, org, options),
    ]);
    return [...userRecords, ...groupRecords];
  }

  /**
   * Downloads blob fields for the provided records and updates field values.
   *
   * @param org - Org definition.
   * @param objectName - Object API name.
   * @param records - Records to update.
   * @param blobFields - Optional blob field list.
   * @returns Updated records.
   */
  public async downloadBlobFieldsAsync(
    org: ScriptOrg,
    objectName: string,
    records: Array<Record<string, unknown>>,
    blobFields: BlobFieldType[] = []
  ): Promise<Array<Record<string, unknown>>> {
    void this._script;
    void org;
    void objectName;
    void blobFields;
    await Promise.resolve();
    return records;
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Resolves a cached org connection.
   *
   * @param org - Org definition.
   * @returns Connection instance.
   */
  private async _getConnectionAsync(org: ScriptOrg): Promise<OrgConnectionType> {
    if (!org?.name) {
      throw new CommandExecutionError('Missing org name for connection.');
    }
    const cacheKey = `${org.name}:${this._script.apiVersion ?? ''}`;
    const cached = this._connectionCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const connection = (await org.getConnectionAsync()) as unknown as OrgConnectionType;
    this._connectionCache.set(cacheKey, connection);
    return connection;
  }

  /**
   * Resolves the API version used by the provided connection.
   *
   * @param connection - Org connection.
   * @returns API version string.
   */
  private _resolveApiVersion(connection: OrgConnectionType): string {
    const apiVersion = connection.getApiVersion?.();
    return apiVersion?.trim() ? apiVersion : this._script.apiVersion;
  }

  /**
   * Writes diagnostic information about query API usage.
   *
   * @param objectName - Queried object name.
   * @param apiVersion - API version string.
   * @param useBulk - True when using Bulk API query.
   */
  private _logQueryApiVersionDiagnostics(objectName: string, apiVersion: string, useBulk: boolean): void {
    const mode = useBulk ? 'Bulk API Query' : 'REST API';
    Common.logDiagnostics(
      `[diagnostic] query api version: object=${objectName} apiVersion=${apiVersion} mode=${mode}`,
      this._script.logger ?? Common.logger
    );
  }

  /**
   * Determines if source record caching should be used.
   *
   * @param org - Org definition.
   * @returns True when caching is enabled.
   */
  private _shouldUseSourceRecordsCache(org: ScriptOrg): boolean {
    if (!org.isSource) {
      return false;
    }
    const cacheMode = this._script.sourceRecordsCache;
    return cacheMode === DATA_CACHE_TYPES.FileCache || cacheMode === DATA_CACHE_TYPES.CleanFileCache;
  }

  /**
   * Builds cache file paths for the provided query.
   *
   * @param query - SOQL query string.
   * @returns Cache path info or null when query is empty.
   */
  private _getSourceRecordsCacheInfo(
    query: string
  ): { cacheFullPath: string; cacheDisplayPath: string; cacheFilename: string } | null {
    if (!query) {
      return null;
    }
    const hash = String(Common.getString32FNV1AHashcode(query, true));
    const cacheFilename = SOURCE_RECORDS_FILE_CACHE_TEMPLATE(hash);
    return {
      cacheFullPath: path.join(this._script.sourceRecordsCacheDirectoryPath, cacheFilename),
      cacheDisplayPath: path.join(`./${SOURCE_RECORDS_CACHE_SUB_DIRECTORY}`, cacheFilename),
      cacheFilename,
    };
  }

  /**
   * Reads cached source records for a query when available.
   *
   * @param query - SOQL query string.
   * @param org - Org definition.
   * @returns Cached records or null when cache is missing.
   */
  private _readSourceRecordsCache(query: string, org: ScriptOrg): Array<Record<string, unknown>> | null {
    if (!this._shouldUseSourceRecordsCache(org)) {
      return null;
    }
    const cacheInfo = this._getSourceRecordsCacheInfo(query);
    if (!cacheInfo || !fs.existsSync(cacheInfo.cacheFullPath)) {
      return null;
    }
    try {
      const data = fs.readFileSync(cacheInfo.cacheFullPath, 'utf8');
      const parsed = JSON.parse(data) as CachedRecordsType;
      const sObjectName = extractObjectName(query);
      if (sObjectName) {
        this._script.logger?.info('readingFromCacheFile', sObjectName, cacheInfo.cacheDisplayPath);
      }
      return Array.isArray(parsed.records) ? parsed.records : [];
    } catch {
      return null;
    }
  }

  /**
   * Writes source records to cache when enabled.
   *
   * @param query - SOQL query string.
   * @param org - Org definition.
   * @param records - Records to cache.
   */
  private _writeSourceRecordsCache(query: string, org: ScriptOrg, records: Array<Record<string, unknown>>): void {
    if (!this._shouldUseSourceRecordsCache(org)) {
      return;
    }
    const cacheInfo = this._getSourceRecordsCacheInfo(query);
    if (!cacheInfo) {
      return;
    }
    try {
      fs.mkdirSync(path.dirname(cacheInfo.cacheFullPath), { recursive: true });
      const sObjectName = extractObjectName(query);
      if (sObjectName) {
        this._script.logger?.info('writingToCacheFile', sObjectName, cacheInfo.cacheDisplayPath);
      }
      const payload: CachedRecordsType = {
        query,
        records,
      };
      fs.writeFileSync(cacheInfo.cacheFullPath, JSON.stringify(payload), 'utf8');
    } catch {
      // Ignore cache write errors.
    }
  }

  /**
   * Executes a REST API query and returns all records.
   *
   * @param connection - Org connection.
   * @param query - SOQL query string.
   * @returns Query records.
   */
  private async _queryRestAsync(
    connection: OrgConnectionType,
    query: string,
    useQueryAll: boolean
  ): Promise<Array<Record<string, unknown>>> {
    const result =
      useQueryAll && connection.queryAll
        ? await connection.queryAll<Record<string, unknown>>(query)
        : useQueryAll
        ? await this._queryAllByEndpointAsync(connection, query)
        : await connection.query<Record<string, unknown>>(query);
    let records: Array<Record<string, unknown>> = [...(result.records ?? [])];
    let progress = createProgressState(QUERY_PROGRESS_MESSAGE_PER_RECORDS);
    progress = this._logProgress(records.length, progress);

    const fetchNextAsync = async (currentResult: QueryResultType<Record<string, unknown>>): Promise<void> => {
      if (currentResult.done || !currentResult.nextRecordsUrl) {
        return;
      }
      if (records.length >= MAX_FETCH_SIZE) {
        return;
      }
      const nextResult = await connection.queryMore<Record<string, unknown>>(currentResult.nextRecordsUrl);
      records = records.concat(nextResult.records ?? []);
      progress = this._logProgress(records.length, progress);
      await fetchNextAsync(nextResult);
    };

    await fetchNextAsync(result);
    this._logFinalProgress(records.length, progress);

    return records;
  }

  /**
   * Executes a queryAll request via REST endpoint when jsforce queryAll is unavailable.
   *
   * @param connection - Org connection.
   * @param query - SOQL query string.
   * @returns Query result payload.
   */
  private async _queryAllByEndpointAsync(
    connection: OrgConnectionType,
    query: string
  ): Promise<QueryResultType<Record<string, unknown>>> {
    if (!connection.request) {
      return connection.query<Record<string, unknown>>(query);
    }

    const apiVersion = this._resolveApiVersion(connection);
    const records: Array<Record<string, unknown>> = [];
    const queryAllUrl = `/services/data/v${apiVersion}/queryAll?q=${encodeURIComponent(query)}`;

    const fetchPageAsync = async (url: string): Promise<void> => {
      if (!url) {
        return;
      }

      const result = await connection.request<QueryResultType<Record<string, unknown>>>({
        method: 'GET',
        url,
      });

      records.push(...(result.records ?? []));
      if (!result.done && result.nextRecordsUrl) {
        await fetchPageAsync(result.nextRecordsUrl);
      }
    };

    await fetchPageAsync(queryAllUrl);

    return {
      records,
      done: true,
    };
  }

  /**
   * Executes a Bulk API query and returns all records.
   *
   * @param connection - Org connection.
   * @param query - SOQL query string.
   * @returns Query records.
   */
  private async _queryBulkAsync(connection: OrgConnectionType, query: string): Promise<Array<Record<string, unknown>>> {
    const bulk = connection.bulk;
    if (!bulk) {
      return this._queryRestAsync(connection, query, false);
    }

    bulk.pollInterval = this._script.pollingIntervalMs;
    bulk.pollTimeout = this._script.pollingQueryTimeoutMs;

    return new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      const records: Array<Record<string, unknown>> = [];
      let progress = createProgressState(QUERY_PROGRESS_MESSAGE_PER_RECORDS);
      const bulkQuery = bulk.query(query);

      bulkQuery.on('record', (record) => {
        records.push(record);
        progress = this._logProgress(records.length, progress);
      });
      bulkQuery.on('end', () => {
        this._logFinalProgress(records.length, progress);
        resolve(records);
      });
      bulkQuery.on('error', (error) => reject(error));
    });
  }

  /**
   * Logs progress when passing the configured threshold.
   *
   * @param count - Current progress count.
   * @param progress - Progress state.
   * @param total - Optional total count.
   */
  private _logProgress(count: number, progress: ProgressStateType, total?: number): ProgressStateType {
    if (!this._script.logger || count < progress.nextAt) {
      return progress;
    }
    const updated: ProgressStateType = {
      nextAt: progress.nextAt + progress.step,
      lastLogged: count,
      step: progress.step,
    };
    this._script.logger.info('apiCallProgress', formatProgress(count, total));
    return updated;
  }

  /**
   * Logs final progress if not logged already.
   *
   * @param count - Final progress count.
   * @param progress - Progress state.
   * @param total - Optional total count.
   */
  private _logFinalProgress(count: number, progress: ProgressStateType, total?: number): void {
    if (!this._script.logger) {
      return;
    }
    if (count >= progress.step && progress.lastLogged !== count) {
      this._script.logger.info('apiCallProgress', formatProgress(count, total));
    }
  }
}
