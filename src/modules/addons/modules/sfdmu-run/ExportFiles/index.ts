/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Common } from '../../../../common/Common.js';
import { API_ENGINE, OPERATION } from '../../../../common/Enumerations.js';
import { glob } from '../../../../dependencies/EsmDependencies.js';
import {
  DEFAULT_MAX_CHUNK_SIZE,
  DEFAULT_MAX_FILE_SIZE,
  ERRORS_FIELD_NAME,
  MAX_CHUNK_SIZE,
  MAX_FILE_SIZE,
} from '../../../../constants/Constants.js';
import CjsDependencyAdapters from '../../../../dependencies/CjsDependencyAdapters.js';
import ScriptObject from '../../../../models/script/ScriptObject.js';
import ContentVersion from '../../../../models/sf/ContentVersion.js';
import type {
  ISFdmuRunCustomAddonTask,
  ISfdmuRunCustomAddonContext,
  ISfdmuRunCustomAddonModule,
  ISfdmuRunCustomAddonResult,
  ISfdmuRunCustomAddonRuntime,
  ISfdmuRunCustomAddonScript,
} from '../../../../../../custom-addon-sdk/interfaces/index.js';
import AddonResult from '../../../models/AddonResult.js';

type RecordType = Record<string, unknown>;

type ExportFilesArgsType = {
  deleteOldData?: boolean;
  operation?: OPERATION | string;
  externalId?: string;
  baseBinaryFilePath?: string;
  sourceWhere?: string;
  targetWhere?: string;
  contentDocumentLinkOrderBy?: string;
  maxChunkSize?: number;
  maxFileSize?: number;
};

type DataToImportType = {
  recIdToDocLinks: Map<string, RecordType[]>;
  docIds: string[];
  recordIds: string[];
  docIdToDocVersion: Map<string, RecordType>;
};

type LinkedRecordType = {
  Id: string;
  sourceDocLink: RecordType;
};

type DataToExportType = {
  version: ContentVersion;
  targetVersion?: ContentVersion | null;
  recordsToBeLinked: LinkedRecordType[];
  isVersionChanged: boolean;
};

type AttachmentRowType = {
  Id?: string;
  ParentId?: string;
  Name?: string;
  Body?: string;
  ContentType?: string;
  Description?: string;
};

type NoteRowType = {
  Id?: string;
  ParentId?: string;
  Title?: string;
  Body?: string;
  IsPrivate?: boolean | string;
};

type DataLoaderPackageType = {
  contentVersions: RecordType[];
  contentDocumentLinks: RecordType[];
  attachments: RecordType[];
  notes: RecordType[];
};

type FileOperationPlanType = {
  versionRowsToInsert: RecordType[];
  versionRowsToUpdate: RecordType[];
  linksToInsert: RecordType[];
};

type ParentTransferCountersType = {
  downloadedFiles: number;
  uploadedFiles: number;
  downloadedAttachments: number;
  uploadedAttachments: number;
};

type TaskExecutionStateType = ISFdmuRunCustomAddonTask & {
  __exportFilesProcessedKeys?: Set<string>;
};

const DEFAULT_BINARY_BASE_PATH = 'files';
const CONTENT_VERSION_CSV_FILENAME = 'ContentVersion.csv';
const CONTENT_DOCUMENT_LINK_CSV_FILENAME = 'ContentDocumentLink.csv';
const ATTACHMENT_CSV_FILENAME = 'Attachment.csv';
const NOTE_CSV_FILENAME = 'Note.csv';

const { composeQuery, parseQuery } = CjsDependencyAdapters.getSoqlParser();

/**
 * Core ExportFiles add-on for file migration.
 */
export default class ExportFiles implements ISfdmuRunCustomAddonModule {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Execution context assigned by the add-on manager.
   */
  public context: ISfdmuRunCustomAddonContext;

  /**
   * Runtime instance provided by the add-on manager.
   */
  public runtime: ISfdmuRunCustomAddonRuntime;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new ExportFiles add-on.
   *
   * @param runtime - Runtime instance provided by the plugin.
   */
  public constructor(runtime: ISfdmuRunCustomAddonRuntime) {
    this.runtime = runtime;
    this.context = {
      eventName: '',
      moduleDisplayName: '',
      objectName: '',
      objectDisplayName: '',
      description: '',
    };
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Ensures required query fields are included.
   *
   * @param context - Add-on context.
   * @param args - Add-on arguments.
   * @returns Add-on result.
   */
  public onInit(
    context: ISfdmuRunCustomAddonContext,
    args: Record<string, unknown>
  ): Promise<ISfdmuRunCustomAddonResult> {
    const script = this.runtime.getScript();
    const targetObject = script.getAllObjects().find((object) => object.name === context.objectName);
    if (targetObject && context.objectName === 'FeedItem' && targetObject.query) {
      const parsedQuery = parseQuery(targetObject.query);
      Common.addOrRemoveQueryFields(parsedQuery, ['Type']);
      targetObject.query = composeQuery(parsedQuery);
    }
    void args;
    return Promise.resolve(new AddonResult());
  }

  /**
   * Executes the ExportFiles add-on logic.
   *
   * @param context - Add-on context.
   * @param args - Add-on arguments.
   * @returns Add-on result.
   */
  public async onExecute(
    context: ISfdmuRunCustomAddonContext,
    args: Record<string, unknown>
  ): Promise<ISfdmuRunCustomAddonResult> {
    this.runtime.logAddonExecutionStarted(this);
    this.runtime.logFormattedInfo(this, 'ExportFiles_Initializing');

    const script = this.runtime.getScript();
    this._synchronizeCsvDelimitersFromScript();
    const normalizedArgs = this._normalizeArgs(args);
    const job = script.job;
    if (!job) {
      this.runtime.logFormattedWarning(this, 'General_AddOnRuntimeError', context.moduleDisplayName);
      this.runtime.logAddonExecutionFinished(this);
      return new AddonResult();
    }

    const task = job.tasks.find((candidate) => candidate.sObjectName === context.objectName);
    if (!task) {
      this.runtime.logFormattedWarning(this, 'ExportFiles_CouldNotFindObjectToProcessWarning');
      this.runtime.logAddonExecutionFinished(this);
      return new AddonResult();
    }

    const executionKey = `${context.eventName}:${context.objectName}`;
    const taskState = task as TaskExecutionStateType;
    taskState.__exportFilesProcessedKeys ??= new Set<string>();
    if (taskState.__exportFilesProcessedKeys.has(executionKey)) {
      this.runtime.logAddonExecutionFinished(this);
      return new AddonResult();
    }
    taskState.__exportFilesProcessedKeys.add(executionKey);

    const requestedOperation = normalizedArgs.operation
      ? ScriptObject.getOperation(normalizedArgs.operation)
      : task.scriptObject.operation;
    let operation: OPERATION = requestedOperation ?? OPERATION.Insert;
    const deleteOldData =
      typeof normalizedArgs.deleteOldData === 'boolean'
        ? normalizedArgs.deleteOldData
        : task.scriptObject.deleteOldData ?? false;
    const externalId = normalizedArgs.externalId ?? 'Title';
    const maxFileSize = this._resolveMaxFileSize(normalizedArgs.maxFileSize);
    const maxChunkSize = this._resolveMaxChunkSize(normalizedArgs.maxChunkSize);

    if (operation === OPERATION.Readonly) {
      this.runtime.logFormattedWarning(this, 'ExportFiles_ReadonlyOperationWarning');
      this.runtime.logAddonExecutionFinished(this);
      return new AddonResult();
    }

    const sourceIsFile = this._isFileMedia(script, true);
    const targetIsFile = this._isFileMedia(script, false);
    if (sourceIsFile || targetIsFile) {
      await this._executeFileMediaModeAsync(
        task,
        normalizedArgs,
        operation,
        deleteOldData,
        externalId,
        maxChunkSize,
        maxFileSize
      );
      this.runtime.logAddonExecutionFinished(this);
      return new AddonResult();
    }

    const sourceFiles: DataToImportType = {
      recIdToDocLinks: new Map(),
      docIds: [],
      recordIds: this._filterRecordIds(task, context.objectName, true),
      docIdToDocVersion: new Map(),
    };

    const targetFiles: DataToImportType = {
      recIdToDocLinks: new Map(),
      docIds: [],
      recordIds: this._filterRecordIds(task, context.objectName, false),
      docIdToDocVersion: new Map(),
    };

    const exportedFilesMap = new Map<RecordType, DataToExportType>();
    const parentMap = this._createSourceToTargetParentIdMap(task);
    const parentTransferCounters = this._createParentTransferCounters(parentMap);
    let isDeleted = false;

    const readFileSourceRecordsAsync = async (): Promise<void> => {
      if ((operation !== OPERATION.Insert || deleteOldData) && targetFiles.recordIds.length > 0) {
        this.runtime.logFormattedInfo(this, 'ExportFiles_ReadTargetContentDocumentLinks');
        const queries = this.runtime.createFieldInQueries(
          ['Id', 'LinkedEntityId', 'ContentDocumentId', 'ShareType', 'Visibility'],
          'LinkedEntityId',
          'ContentDocumentLink',
          targetFiles.recordIds
        );

        const contentDocLinks = await this.runtime.queryMultiAsync(false, queries);
        targetFiles.recIdToDocLinks = Common.arrayToMapMulti<RecordType>(contentDocLinks, ['LinkedEntityId']) as Map<
          string,
          RecordType[]
        >;
        targetFiles.docIds = Common.distinctStringArray(
          Common.arrayToPropsArray<RecordType>(contentDocLinks, ['ContentDocumentId'])
        );
        this.runtime.logFormattedInfo(this, 'ExportFiles_RetrievedRecords', String(contentDocLinks.length));
      }

      await readTargetContentVersionsAsync('ContentDocumentId');

      if (await deleteTargetFilesAsync(targetFiles.docIds)) {
        return;
      }

      if (sourceFiles.recordIds.length === 0) {
        this.runtime.logFormattedInfo(this, 'ExportFiles_NoSourceRecords');
        return;
      }

      if (operation === OPERATION.Update && isDeleted) {
        this.runtime.logFormattedInfo(this, 'ExportFiles_NothingToUpdate');
        return;
      }

      if (operation === OPERATION.Upsert && isDeleted) {
        operation = OPERATION.Insert;
      }

      this.runtime.logFormattedInfo(this, 'ExportFiles_ReadSourceContentDocumentLinks');
      {
        const queries = this.runtime.createFieldInQueries(
          ['Id', 'LinkedEntityId', 'ContentDocumentId', 'ShareType', 'Visibility'],
          'LinkedEntityId',
          'ContentDocumentLink',
          [...task.sourceData.idRecordsMap.keys()],
          '',
          normalizedArgs.contentDocumentLinkOrderBy
        );

        const contentDocLinks = await this.runtime.queryMultiAsync(true, queries);
        sourceFiles.recIdToDocLinks = Common.arrayToMapMulti<RecordType>(contentDocLinks, ['LinkedEntityId']) as Map<
          string,
          RecordType[]
        >;
        sourceFiles.docIds = Common.distinctStringArray(
          Common.arrayToPropsArray<RecordType>(contentDocLinks, ['ContentDocumentId'])
        );
        this.runtime.logFormattedInfo(this, 'ExportFiles_RetrievedRecords', String(contentDocLinks.length));
      }

      await readSourceContentVersionsAsync('ContentDocumentId');
      this._addDownloadedFileCountersFromDocLinks(
        sourceFiles.recIdToDocLinks,
        sourceFiles.docIdToDocVersion,
        parentTransferCounters
      );

      this.runtime.logFormattedInfo(this, 'ExportFiles_Comparing');
      compareContentVersionsAsync('ContentDocumentId');
    };

    const readFeedAttachmentSourceRecordsAsync = async (): Promise<void> => {
      if ((operation !== OPERATION.Insert || deleteOldData) && targetFiles.recordIds.length > 0) {
        this.runtime.logFormattedInfo(this, 'ExportFiles_ReadTargetFeedAttachments');
        const queries = this.runtime.createFieldInQueries(
          ['Id', 'RecordId', 'FeedEntityId'],
          'FeedEntityId',
          'FeedAttachment',
          targetFiles.recordIds,
          "Type = 'Content'"
        );

        const feedAttachments = await this.runtime.queryMultiAsync(false, queries);
        targetFiles.recIdToDocLinks = Common.arrayToMapMulti<RecordType>(feedAttachments, ['FeedEntityId']) as Map<
          string,
          RecordType[]
        >;
        targetFiles.docIds = Common.distinctStringArray(
          Common.arrayToPropsArray<RecordType>(feedAttachments, ['RecordId'])
        );
        this.runtime.logFormattedInfo(this, 'ExportFiles_RetrievedRecords', String(feedAttachments.length));
      }

      await readTargetContentVersionsAsync('Id');

      if (await deleteTargetFilesAsync(targetFiles.docIds)) {
        return;
      }

      if (sourceFiles.recordIds.length === 0) {
        this.runtime.logFormattedInfo(this, 'ExportFiles_NoSourceRecords');
        return;
      }

      if (operation === OPERATION.Update && isDeleted) {
        this.runtime.logFormattedInfo(this, 'ExportFiles_NothingToUpdate');
        return;
      }

      if (operation === OPERATION.Upsert && isDeleted) {
        operation = OPERATION.Insert;
      }

      this.runtime.logFormattedInfo(this, 'ExportFiles_ReadSourceFeedAttachments');
      {
        const queries = this.runtime.createFieldInQueries(
          ['Id', 'RecordId', 'FeedEntityId'],
          'FeedEntityId',
          'FeedAttachment',
          sourceFiles.recordIds,
          "Type = 'Content'"
        );

        const feedAttachments = await this.runtime.queryMultiAsync(true, queries);
        sourceFiles.recIdToDocLinks = Common.arrayToMapMulti<RecordType>(feedAttachments, ['FeedEntityId']) as Map<
          string,
          RecordType[]
        >;
        sourceFiles.docIds = Common.distinctStringArray(
          Common.arrayToPropsArray<RecordType>(feedAttachments, ['RecordId'])
        );
        this.runtime.logFormattedInfo(this, 'ExportFiles_RetrievedRecords', String(feedAttachments.length));
      }

      await readSourceContentVersionsAsync('Id');
      this._addDownloadedFileCountersFromDocLinks(
        sourceFiles.recIdToDocLinks,
        sourceFiles.docIdToDocVersion,
        parentTransferCounters
      );

      this.runtime.logFormattedInfo(this, 'ExportFiles_Comparing');
      compareContentVersionsAsync('RecordId');
    };

    const readSourceContentVersionsAsync = async (filteredByDocIdsByField: string): Promise<void> => {
      if (sourceFiles.docIds.length === 0) {
        return;
      }
      this.runtime.logFormattedInfo(this, 'ExportFiles_ReadSourceContentVersions');
      const fields = Common.distinctStringArray([
        'Id',
        externalId,
        'ContentDocumentId',
        'Title',
        'Description',
        'PathOnClient',
        'VersionData',
        'ContentModifiedDate',
        'ContentSize',
        'Checksum',
        'ContentUrl',
        'ContentBodyId',
      ]);
      let queries = this.runtime.createFieldInQueries(
        fields,
        filteredByDocIdsByField,
        'ContentVersion',
        sourceFiles.docIds,
        `(IsLatest = true) AND (ContentDocument.ContentSize <= ${maxFileSize})`
      );
      const sourceWhereClause = normalizedArgs.sourceWhere ?? '';
      if (sourceWhereClause) {
        queries = queries.map((query) => query.replace('WHERE', `WHERE (${sourceWhereClause}) AND (`) + ')');
      }

      const contentVersions = await this.runtime.queryMultiAsync(true, queries);
      sourceFiles.docIdToDocVersion = Common.arrayToMap<RecordType>(contentVersions, [filteredByDocIdsByField]) as Map<
        string,
        RecordType
      >;
      sourceFiles.docIds = [...sourceFiles.docIdToDocVersion.keys()];
      this.runtime.logFormattedInfo(this, 'ExportFiles_RetrievedRecords', String(contentVersions.length));
    };

    const readTargetContentVersionsAsync = async (filteredByDocIdsByField: string): Promise<void> => {
      if (operation === OPERATION.Insert || targetFiles.docIds.length === 0) {
        return;
      }
      this.runtime.logFormattedInfo(this, 'ExportFiles_ReadTargetContentVersions');

      const fields = Common.distinctStringArray([
        'Id',
        externalId,
        'ContentDocumentId',
        'ContentModifiedDate',
        'Title',
        'Checksum',
        'ContentUrl',
      ]);

      let queries = this.runtime.createFieldInQueries(
        fields,
        filteredByDocIdsByField,
        'ContentVersion',
        targetFiles.docIds,
        'IsLatest = true'
      );
      const targetWhereClause = normalizedArgs.targetWhere ?? '';
      if (targetWhereClause) {
        queries = queries.map((query) => query.replace('WHERE', `WHERE (${targetWhereClause}) AND (`) + ')');
      }

      const contentVersions = await this.runtime.queryMultiAsync(false, queries);
      targetFiles.docIdToDocVersion = Common.arrayToMap<RecordType>(contentVersions, [filteredByDocIdsByField]) as Map<
        string,
        RecordType
      >;
      targetFiles.docIds = [...targetFiles.docIdToDocVersion.keys()];
      this.runtime.logFormattedInfo(this, 'ExportFiles_RetrievedRecords', String(contentVersions.length));
    };

    const compareContentVersionsAsync = (compareByDocIdsByField: string): void => {
      sourceFiles.recIdToDocLinks.forEach((sourceDocLinks, recordId) => {
        sourceDocLinks.forEach((sourceDocLink) => {
          const sourceContentVersion = sourceFiles.docIdToDocVersion.get(String(sourceDocLink[compareByDocIdsByField]));
          if (!sourceContentVersion) {
            return;
          }
          const sourceRecord = task.sourceData.idRecordsMap.get(recordId);
          const targetRecord = sourceRecord ? task.sourceToTargetRecordMap.get(sourceRecord) : undefined;
          if (!exportedFilesMap.has(sourceContentVersion)) {
            exportedFilesMap.set(sourceContentVersion, {
              version: new ContentVersion(sourceContentVersion),
              recordsToBeLinked: [],
              isVersionChanged: false,
              targetVersion: null,
            });
          }
          const exportedFiles = exportedFilesMap.get(sourceContentVersion);
          if (!exportedFiles || !targetRecord) {
            return;
          }

          const targetDocLinks = targetFiles.recIdToDocLinks.get(String(targetRecord['Id'] ?? '')) ?? [];
          let found = false;

          targetDocLinks.forEach((targetDocLink) => {
            const targetDocId = String(targetDocLink[compareByDocIdsByField] ?? '');
            const targetContentVersionRecord = targetFiles.docIdToDocVersion.get(targetDocId);
            if (!targetContentVersionRecord) {
              return;
            }
            const targetContentVersion = exportedFiles.targetVersion ?? new ContentVersion(targetContentVersionRecord);
            const sourceExternalValue = String(sourceContentVersion[externalId] ?? '');
            const targetExternalValue = String(targetContentVersionRecord[externalId] ?? '');
            if (sourceExternalValue && sourceExternalValue === targetExternalValue) {
              found = true;
              exportedFiles.targetVersion = targetContentVersion;
              if (!exportedFiles.version.targetContentDocumentId) {
                exportedFiles.version.targetContentDocumentId = targetDocId;
              }
              if (exportedFiles.version.isNewer(targetContentVersion)) {
                exportedFiles.isVersionChanged = true;
              }
            }
          });

          if (!found && operation !== OPERATION.Update) {
            exportedFiles.recordsToBeLinked.push({
              Id: String(targetRecord['Id'] ?? ''),
              sourceDocLink,
            });
          }
        });
      });

      exportedFilesMap.forEach((exportedFile) => {
        const updatedFile = exportedFile;
        if (!updatedFile.targetVersion) {
          updatedFile.isVersionChanged = true;
        }
      });
    };

    const writeFileTargetRecordsAsync = async (): Promise<void> => {
      if (exportedFiles.length === 0) {
        return;
      }
      this.runtime.logFormattedInfo(this, 'ExportFiles_ExportingContentDocumentLinks');
      const docLinks = Common.flattenArrays(
        exportedFiles.map((fileToExport) =>
          fileToExport.recordsToBeLinked.map((record) => ({
            LinkedEntityID: record.Id,
            ContentDocumentID: fileToExport.version.targetContentDocumentId,
            ShareType: record.sourceDocLink['ShareType'],
            Visibility: record.sourceDocLink['Visibility'],
          }))
        )
      );

      this.runtime.logFormattedInfo(this, 'ExportFiles_RecordsToBeProcessed', String(docLinks.length));
      const data = await this.runtime.updateTargetRecordsAsync(
        'ContentDocumentLink',
        OPERATION.Insert,
        docLinks,
        API_ENGINE.DEFAULT_ENGINE,
        true
      );
      this.runtime.logFormattedInfo(
        this,
        'ExportFiles_ProcessedRecords',
        String(data.length),
        String(data.filter((item) => Boolean(item[ERRORS_FIELD_NAME])).length)
      );
      this._addUploadedFileCountersFromDmlResults(data, docLinks, parentMap, parentTransferCounters, 'LinkedEntityID');
    };

    const writeFeedAttachmentTargetRecordsAsync = async (): Promise<void> => {
      if (exportedFiles.length === 0) {
        return;
      }
      this.runtime.logFormattedInfo(this, 'ExportFiles_ExportingFeedAttachments');
      const docLinks = Common.flattenArrays(
        exportedFiles.map((fileToExport) =>
          fileToExport.recordsToBeLinked.map((record) => ({
            FeedEntityId: record.Id,
            RecordId: fileToExport.version.targetId,
            Type: 'Content',
            Title: fileToExport.version.Title,
          }))
        )
      );

      this.runtime.logFormattedInfo(this, 'ExportFiles_RecordsToBeProcessed', String(docLinks.length));
      const data = await this.runtime.updateTargetRecordsAsync(
        'FeedAttachment',
        OPERATION.Insert,
        docLinks,
        API_ENGINE.DEFAULT_ENGINE,
        true
      );
      this.runtime.logFormattedInfo(
        this,
        'ExportFiles_ProcessedRecords',
        String(data.length),
        String(data.filter((item) => Boolean(item[ERRORS_FIELD_NAME])).length)
      );
      this._addUploadedFileCountersFromDmlResults(data, docLinks, parentMap, parentTransferCounters, 'FeedEntityId');
    };

    const deleteTargetFilesAsync = async (docIdsToDelete: string[]): Promise<boolean> => {
      if (!deleteOldData && operation !== OPERATION.Delete) {
        return false;
      }
      isDeleted = true;
      if (docIdsToDelete.length > 0) {
        this.runtime.logFormattedInfo(this, 'ExportFiles_DeleteTargetContentDocuments');
        const data = await this.runtime.updateTargetRecordsAsync(
          'ContentDocument',
          OPERATION.Delete,
          docIdsToDelete.map((item) => ({ Id: item }))
        );
        this.runtime.logFormattedInfo(
          this,
          'ExportFiles_ProcessedRecords',
          String(data.length),
          String(data.filter((item) => Boolean(item[ERRORS_FIELD_NAME])).length)
        );
      }
      if (operation === OPERATION.Delete) {
        return true;
      }
      return false;
    };

    const exportedFiles: DataToExportType[] = [];

    if (task.sObjectName === 'FeedItem') {
      await readFeedAttachmentSourceRecordsAsync();
    } else {
      await readFileSourceRecordsAsync();
    }

    const versionsToProcess = [...exportedFilesMap.values()]
      .filter((exportItem) => exportItem.isVersionChanged)
      .map((exportItem) => exportItem.version);

    if (versionsToProcess.length > 0) {
      this.runtime.logFormattedInfo(this, 'ExportFiles_ExportingContentVersions');
      this.runtime.logFormattedInfo(this, 'ExportFiles_RecordsToBeProcessed', String(versionsToProcess.length));

      await this.runtime.transferContentVersions(this, versionsToProcess, maxChunkSize);

      const failedRecordsCount = versionsToProcess.filter((item) => item.isError).length;
      this.runtime.logFormattedInfo(
        this,
        'ExportFiles_ProcessedRecords',
        String(versionsToProcess.length),
        String(failedRecordsCount)
      );

      if (failedRecordsCount === versionsToProcess.length) {
        exportedFilesMap.clear();
      }
    }

    exportedFiles.push(...[...exportedFilesMap.values()].filter((item) => item.recordsToBeLinked.length > 0));

    if (task.sObjectName === 'FeedItem') {
      await writeFeedAttachmentTargetRecordsAsync();
    } else {
      await writeFileTargetRecordsAsync();
    }

    const additionalProcessed = await this._processAttachmentsAndNotesAsync(
      task,
      normalizedArgs,
      operation,
      deleteOldData,
      false,
      parentMap,
      parentTransferCounters
    );

    if (exportedFiles.length === 0 && versionsToProcess.length === 0 && additionalProcessed === 0) {
      this.runtime.logFormattedInfo(this, 'ExportFiles_NothingToProceed');
    }
    this._logParentTransferCounters(parentMap, parentTransferCounters);

    this.runtime.logAddonExecutionFinished(this);
    return new AddonResult();
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Normalizes raw add-on arguments.
   *
   * @param args - Raw arguments.
   * @returns Normalized args.
   */
  private _normalizeArgs(args: Record<string, unknown>): ExportFilesArgsType {
    void this;
    return {
      deleteOldData: typeof args['deleteOldData'] === 'boolean' ? args['deleteOldData'] : undefined,
      operation:
        typeof args['operation'] === 'string' || typeof args['operation'] === 'number'
          ? (args['operation'] as OPERATION | string)
          : undefined,
      externalId: typeof args['externalId'] === 'string' ? args['externalId'] : undefined,
      baseBinaryFilePath: typeof args['baseBinaryFilePath'] === 'string' ? args['baseBinaryFilePath'] : undefined,
      sourceWhere: typeof args['sourceWhere'] === 'string' ? args['sourceWhere'] : undefined,
      targetWhere: typeof args['targetWhere'] === 'string' ? args['targetWhere'] : undefined,
      contentDocumentLinkOrderBy:
        typeof args['contentDocumentLinkOrderBy'] === 'string' ? args['contentDocumentLinkOrderBy'] : undefined,
      maxChunkSize: typeof args['maxChunkSize'] === 'number' ? args['maxChunkSize'] : undefined,
      maxFileSize: typeof args['maxFileSize'] === 'number' ? args['maxFileSize'] : undefined,
    };
  }

  /**
   * Resolves max file size for the run.
   *
   * @param maxFileSize - Optional max file size.
   * @returns Resolved max file size.
   */
  private _resolveMaxFileSize(maxFileSize?: number): number {
    void this;
    const resolved = maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    if (resolved > MAX_FILE_SIZE) {
      return MAX_FILE_SIZE;
    }
    return resolved;
  }

  /**
   * Resolves max chunk size for uploads.
   *
   * @param maxChunkSize - Optional max chunk size.
   * @returns Resolved max chunk size.
   */
  private _resolveMaxChunkSize(maxChunkSize?: number): number {
    void this;
    const resolved = maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
    if (resolved > MAX_CHUNK_SIZE) {
      return MAX_CHUNK_SIZE;
    }
    return resolved;
  }

  /**
   * Executes Data Loader-compatible flow for file media source/target.
   *
   * @param task - Current parent task.
   * @param args - Normalized add-on args.
   * @param operation - Requested operation.
   * @param deleteOldData - Delete old data flag.
   * @param externalId - External id field for file compare.
   * @param maxChunkSize - Max chunk size.
   * @param maxFileSize - Max file size.
   */
  private async _executeFileMediaModeAsync(
    task: ISFdmuRunCustomAddonTask,
    args: ExportFilesArgsType,
    operation: OPERATION,
    deleteOldData: boolean,
    externalId: string,
    maxChunkSize: number,
    maxFileSize: number
  ): Promise<void> {
    const parentMap = this._createSourceToTargetParentIdMap(task);
    const parentTransferCounters = this._createParentTransferCounters(parentMap);
    const script = this.runtime.getScript();
    const sourceIsFile = this._isFileMedia(script, true);
    const targetIsFile = this._isFileMedia(script, false);
    const packageData = sourceIsFile
      ? await this._readDataLoaderPackageFromCsvAsync(task, args)
      : await this._readDataLoaderPackageFromOrgAsync(task, args, externalId, maxFileSize);
    this._addDownloadedFileCountersFromPackage(packageData, parentTransferCounters);
    this._addDownloadedAttachmentCountersFromPackage(packageData, parentTransferCounters);

    if (targetIsFile) {
      await this._writeDataLoaderPackageToCsvAsync(packageData, args);
      this._logParentTransferCounters(parentMap, parentTransferCounters);
      return;
    }

    await this._applyDataLoaderPackageToTargetOrgAsync(
      task,
      packageData,
      operation,
      deleteOldData,
      maxChunkSize,
      args,
      parentTransferCounters,
      parentMap
    );
    this._logParentTransferCounters(parentMap, parentTransferCounters);
  }

  /**
   * Processes Attachment and Note records using parent record mappings.
   *
   * @param task - Current parent task.
   * @param args - Normalized add-on args.
   * @param operation - Requested operation.
   * @param deleteOldData - Delete old data flag.
   * @param skipContentVersion - True when file-media mode already handled all records.
   * @returns Processed record count.
   */
  private async _processAttachmentsAndNotesAsync(
    task: ISFdmuRunCustomAddonTask,
    args: ExportFilesArgsType,
    operation: OPERATION,
    deleteOldData: boolean,
    skipContentVersion: boolean,
    sourceToTargetParentMap?: Map<string, string>,
    parentTransferCounters?: Map<string, ParentTransferCountersType>
  ): Promise<number> {
    void skipContentVersion;
    const script = this.runtime.getScript();
    const sourceIsFile = this._isFileMedia(script, true);
    const targetIsFile = this._isFileMedia(script, false);
    const packageData = sourceIsFile
      ? await this._readDataLoaderPackageFromCsvAsync(task, args, true)
      : await this._readDataLoaderPackageFromOrgAsync(
          task,
          args,
          args.externalId ?? 'Title',
          DEFAULT_MAX_FILE_SIZE,
          true
        );
    if (parentTransferCounters) {
      this._addDownloadedAttachmentCountersFromPackage(packageData, parentTransferCounters);
    }

    if (targetIsFile) {
      await this._writeDataLoaderPackageToCsvAsync(
        {
          contentVersions: [],
          contentDocumentLinks: [],
          attachments: packageData.attachments,
          notes: packageData.notes,
        },
        args,
        true
      );
      return packageData.attachments.length + packageData.notes.length;
    }

    const parentMap = sourceToTargetParentMap ?? this._createSourceToTargetParentIdMap(task);
    const targetParentIds = [...new Set([...parentMap.values()])];
    let processed = 0;
    if ((deleteOldData || operation === OPERATION.Delete) && targetParentIds.length > 0) {
      processed += await this._deleteTargetRowsByParentIdsAsync('Attachment', targetParentIds);
      processed += await this._deleteTargetRowsByParentIdsAsync('Note', targetParentIds);
    }
    if (operation === OPERATION.Delete) {
      return processed;
    }

    const attachmentPayload = await this._mapAttachmentRowsToTargetAsync(packageData.attachments, parentMap, args);
    if (attachmentPayload.length > 0) {
      const written = await this.runtime.updateTargetRecordsAsync(
        'Attachment',
        OPERATION.Insert,
        attachmentPayload,
        API_ENGINE.REST_API,
        true
      );
      processed += written.length;
      if (parentTransferCounters) {
        this._addUploadedAttachmentCountersFromDmlResults(
          written,
          attachmentPayload,
          parentMap,
          parentTransferCounters
        );
      }
    }

    const notePayload = this._mapNoteRowsToTarget(packageData.notes, parentMap, args);
    if (notePayload.length > 0) {
      const written = await this.runtime.updateTargetRecordsAsync('Note', OPERATION.Insert, notePayload);
      processed += written.length;
    }
    return processed;
  }

  /**
   * Creates source-to-target parent id mapping.
   *
   * @param task - Current parent task.
   * @returns Mapping by source parent Id.
   */
  private _createSourceToTargetParentIdMap(task: ISFdmuRunCustomAddonTask): Map<string, string> {
    void this;
    const map = new Map<string, string>();
    task.sourceToTargetRecordMap.forEach((targetRecord, sourceRecord) => {
      const sourceId = String(sourceRecord['Id'] ?? '').trim();
      const targetId = String(targetRecord['Id'] ?? '').trim();
      if (sourceId && targetId) {
        map.set(sourceId, targetId);
      }
    });
    return map;
  }

  /**
   * Reads Data Loader-style file package from org.
   *
   * @param task - Current parent task.
   * @param args - Normalized add-on args.
   * @param externalId - External id used for ContentVersion compare.
   * @param maxFileSize - Max source file size.
   * @param attachmentsOnly - True to load only Attachment/Note records.
   * @returns Package payload.
   */
  private async _readDataLoaderPackageFromOrgAsync(
    task: ISFdmuRunCustomAddonTask,
    args: ExportFilesArgsType,
    externalId: string,
    maxFileSize: number,
    attachmentsOnly = false
  ): Promise<DataLoaderPackageType> {
    const sourceParentIds = this._filterRecordIds(task, this.context.objectName, true);
    const packageData: DataLoaderPackageType = {
      contentVersions: [],
      contentDocumentLinks: [],
      attachments: [],
      notes: [],
    };

    if (!attachmentsOnly && sourceParentIds.length > 0 && task.sObjectName !== 'FeedItem') {
      const linkQueries = this.runtime.createFieldInQueries(
        ['Id', 'LinkedEntityId', 'ContentDocumentId', 'ShareType', 'Visibility'],
        'LinkedEntityId',
        'ContentDocumentLink',
        sourceParentIds,
        '',
        args.contentDocumentLinkOrderBy
      );
      const sourceLinks = await this.runtime.queryMultiAsync(true, linkQueries);
      packageData.contentDocumentLinks = sourceLinks;
      const docIds = Common.distinctStringArray(Common.arrayToPropsArray(sourceLinks, ['ContentDocumentId']));
      if (docIds.length > 0) {
        const fields = Common.distinctStringArray([
          'Id',
          externalId,
          'ContentDocumentId',
          'Title',
          'Description',
          'PathOnClient',
          'VersionData',
          'ContentModifiedDate',
          'ContentSize',
          'Checksum',
          'ContentUrl',
          'ContentBodyId',
        ]);
        let versionQueries = this.runtime.createFieldInQueries(
          fields,
          'ContentDocumentId',
          'ContentVersion',
          docIds,
          `(IsLatest = true) AND (ContentDocument.ContentSize <= ${maxFileSize})`
        );
        const sourceWhereClause = args.sourceWhere ?? '';
        if (sourceWhereClause) {
          versionQueries = versionQueries.map(
            (query) => query.replace('WHERE', `WHERE (${sourceWhereClause}) AND (`) + ')'
          );
        }
        packageData.contentVersions = await this.runtime.queryMultiAsync(true, versionQueries);
      }
    }

    if (sourceParentIds.length > 0) {
      const attachmentQueries = this.runtime.createFieldInQueries(
        ['Id', 'ParentId', 'Name', 'Body', 'ContentType', 'Description'],
        'ParentId',
        'Attachment',
        sourceParentIds
      );
      packageData.attachments = await this.runtime.queryMultiAsync(true, attachmentQueries);

      const noteQueries = this.runtime.createFieldInQueries(
        ['Id', 'ParentId', 'Title', 'Body', 'IsPrivate'],
        'ParentId',
        'Note',
        sourceParentIds
      );
      packageData.notes = await this.runtime.queryMultiAsync(true, noteQueries);
    }

    return packageData;
  }

  /**
   * Reads Data Loader-style file package from CSV files.
   *
   * @param task - Current parent task.
   * @param args - Normalized add-on args.
   * @param attachmentsOnly - True to load only Attachment/Note records.
   * @returns Package payload.
   */
  private async _readDataLoaderPackageFromCsvAsync(
    task: ISFdmuRunCustomAddonTask,
    args: ExportFilesArgsType,
    attachmentsOnly = false
  ): Promise<DataLoaderPackageType> {
    void args;
    const sourceParentIds = new Set(this._filterRecordIds(task, this.context.objectName, true));
    const packageData: DataLoaderPackageType = {
      contentVersions: [],
      contentDocumentLinks: [],
      attachments: [],
      notes: [],
    };

    if (!attachmentsOnly) {
      const contentLinks = await this._readFirstExistingCsvFileAsync(
        this._getCsvInputFileCandidates(CONTENT_DOCUMENT_LINK_CSV_FILENAME)
      );
      packageData.contentDocumentLinks = contentLinks.filter((row: RecordType) =>
        sourceParentIds.has(String(row['LinkedEntityId'] ?? '').trim())
      );

      const sourceDocIds = new Set(
        packageData.contentDocumentLinks
          .map((row) => String(row['ContentDocumentId'] ?? '').trim())
          .filter((value) => Boolean(value))
      );
      const contentVersions = await this._readFirstExistingCsvFileAsync(
        this._getCsvInputFileCandidates(CONTENT_VERSION_CSV_FILENAME)
      );
      packageData.contentVersions = contentVersions.filter((row: RecordType) => {
        const docId = String(row['ContentDocumentId'] ?? '').trim();
        return !docId || sourceDocIds.size === 0 || sourceDocIds.has(docId);
      });
    }

    const attachments = await this._readFirstExistingCsvFileAsync(
      this._getCsvInputFileCandidates(ATTACHMENT_CSV_FILENAME)
    );
    packageData.attachments = attachments.filter((row: RecordType) =>
      sourceParentIds.has(String(row['ParentId'] ?? '').trim())
    );

    const notes = await this._readFirstExistingCsvFileAsync(this._getCsvInputFileCandidates(NOTE_CSV_FILENAME));
    packageData.notes = notes.filter((row: RecordType) => sourceParentIds.has(String(row['ParentId'] ?? '').trim()));

    return packageData;
  }

  /**
   * Writes Data Loader-compatible CSV and binary package.
   *
   * @param packageData - Package payload.
   * @param args - Normalized add-on args.
   * @param attachmentsOnly - True to write only Attachment/Note files.
   */
  private async _writeDataLoaderPackageToCsvAsync(
    packageData: DataLoaderPackageType,
    args: ExportFilesArgsType,
    attachmentsOnly = false
  ): Promise<void> {
    const csvDirectoryPath = this._resolveDataLoaderCsvDirectoryPath();
    const binaryBasePath = this._resolveBinaryBasePath(args, 'output');
    fs.mkdirSync(csvDirectoryPath, { recursive: true });
    fs.mkdirSync(binaryBasePath, { recursive: true });

    const versionCounters = new Map<string, number>();
    const attachmentCounters = new Map<string, number>();

    if (!attachmentsOnly) {
      const contentVersions = await Promise.all(
        packageData.contentVersions.map(async (row) =>
          this._createContentVersionCsvRowAsync(row, args, binaryBasePath, versionCounters)
        )
      );
      await Common.writeCsvFileAsync(
        path.join(csvDirectoryPath, CONTENT_VERSION_CSV_FILENAME),
        contentVersions,
        true,
        ['Id', 'ContentDocumentId', 'Title', 'Description', 'PathOnClient', 'VersionData', 'ContentUrl'],
        true
      );

      const contentLinks = packageData.contentDocumentLinks.map((row) => ({
        LinkedEntityId: String(row['LinkedEntityId'] ?? ''),
        ContentDocumentId: String(row['ContentDocumentId'] ?? ''),
        ShareType: String(row['ShareType'] ?? ''),
        Visibility: String(row['Visibility'] ?? ''),
      }));
      await Common.writeCsvFileAsync(
        path.join(csvDirectoryPath, CONTENT_DOCUMENT_LINK_CSV_FILENAME),
        contentLinks,
        true,
        ['LinkedEntityId', 'ContentDocumentId', 'ShareType', 'Visibility'],
        true
      );
    }

    const attachments = await Promise.all(
      packageData.attachments.map(async (row) =>
        this._createAttachmentCsvRowAsync(row, args, binaryBasePath, attachmentCounters)
      )
    );
    await Common.writeCsvFileAsync(
      path.join(csvDirectoryPath, ATTACHMENT_CSV_FILENAME),
      attachments,
      true,
      ['Id', 'ParentId', 'Name', 'Body', 'ContentType', 'Description'],
      true
    );

    const notes: NoteRowType[] = packageData.notes.map((row) => ({
      Id: String(row['Id'] ?? ''),
      ParentId: String(row['ParentId'] ?? ''),
      Title: String(row['Title'] ?? ''),
      Body: String(row['Body'] ?? ''),
      IsPrivate: String(row['IsPrivate'] ?? ''),
    }));
    await Common.writeCsvFileAsync(
      path.join(csvDirectoryPath, NOTE_CSV_FILENAME),
      notes,
      true,
      ['Id', 'ParentId', 'Title', 'Body', 'IsPrivate'],
      true
    );
  }

  /**
   * Applies Data Loader-style package to target org.
   *
   * @param task - Current parent task.
   * @param packageData - Input package.
   * @param operation - Requested operation.
   * @param deleteOldData - Delete old data flag.
   * @param maxChunkSize - Max chunk size.
   * @param args - Normalized add-on args.
   */
  private async _applyDataLoaderPackageToTargetOrgAsync(
    task: ISFdmuRunCustomAddonTask,
    packageData: DataLoaderPackageType,
    operation: OPERATION,
    deleteOldData: boolean,
    maxChunkSize: number,
    args: ExportFilesArgsType,
    parentTransferCounters?: Map<string, ParentTransferCountersType>,
    sourceToTargetParentMap?: Map<string, string>
  ): Promise<void> {
    const parentMap = sourceToTargetParentMap ?? this._createSourceToTargetParentIdMap(task);
    const targetParentIds = [...new Set([...parentMap.values()])];

    if ((deleteOldData || operation === OPERATION.Delete) && targetParentIds.length > 0) {
      await this._deleteTargetContentDocumentsByParentIdsAsync(targetParentIds);
      await this._deleteTargetRowsByParentIdsAsync('Attachment', targetParentIds);
      await this._deleteTargetRowsByParentIdsAsync('Note', targetParentIds);
    }
    if (operation === OPERATION.Delete) {
      return;
    }

    const fileOperationPlan = await this._buildFileOperationPlanAsync(
      packageData,
      parentMap,
      targetParentIds,
      operation,
      args.externalId ?? 'Title'
    );

    if (fileOperationPlan.versionRowsToUpdate.length > 0) {
      await this._insertContentVersionsAndBuildDocIdMapAsync(
        fileOperationPlan.versionRowsToUpdate,
        maxChunkSize,
        args,
        true
      );
    }

    const docIdMap = await this._insertContentVersionsAndBuildDocIdMapAsync(
      fileOperationPlan.versionRowsToInsert,
      maxChunkSize,
      args,
      false
    );
    const linkedPayload = await this._insertContentDocumentLinksAsync(
      fileOperationPlan.linksToInsert,
      parentMap,
      docIdMap
    );
    if (parentTransferCounters) {
      this._addUploadedFileCountersFromDmlResults(
        linkedPayload.results,
        linkedPayload.payload,
        parentMap,
        parentTransferCounters,
        'LinkedEntityId'
      );
    }

    const attachmentPayload = await this._mapAttachmentRowsToTargetAsync(packageData.attachments, parentMap, args);
    if (attachmentPayload.length > 0) {
      const written = await this.runtime.updateTargetRecordsAsync(
        'Attachment',
        OPERATION.Insert,
        attachmentPayload,
        API_ENGINE.REST_API,
        true
      );
      if (parentTransferCounters) {
        this._addUploadedAttachmentCountersFromDmlResults(
          written,
          attachmentPayload,
          parentMap,
          parentTransferCounters
        );
      }
    }

    const notePayload = this._mapNoteRowsToTarget(packageData.notes, parentMap, args);
    if (notePayload.length > 0) {
      await this.runtime.updateTargetRecordsAsync('Note', OPERATION.Insert, notePayload);
    }
  }

  /**
   * Builds a file-operation plan for insert/update/upsert content processing.
   *
   * @param packageData - Input package.
   * @param parentMap - Source parent id -> target parent id map.
   * @param targetParentIds - Target parent ids.
   * @param operation - Requested operation.
   * @param externalIdField - External id field used to match existing files.
   * @returns Planned version/link rows.
   */
  private async _buildFileOperationPlanAsync(
    packageData: DataLoaderPackageType,
    parentMap: Map<string, string>,
    targetParentIds: string[],
    operation: OPERATION,
    externalIdField: string
  ): Promise<FileOperationPlanType> {
    const versionRowsToInsert = new Map<string, RecordType>();
    const versionRowsToUpdate = new Map<string, RecordType>();
    const linksToInsert: RecordType[] = [];
    const sourceVersionByDocId = new Map<string, RecordType>();

    packageData.contentVersions.forEach((row) => {
      const sourceDocId = String(this._getRowValueCaseInsensitive(row, 'ContentDocumentId') ?? row['Id'] ?? '').trim();
      if (!sourceDocId) {
        return;
      }
      sourceVersionByDocId.set(sourceDocId, row);
    });

    if (operation !== OPERATION.Update && operation !== OPERATION.Upsert) {
      packageData.contentVersions.forEach((row) => {
        const sourceDocId = String(
          this._getRowValueCaseInsensitive(row, 'ContentDocumentId') ?? row['Id'] ?? ''
        ).trim();
        if (!sourceDocId || versionRowsToInsert.has(sourceDocId)) {
          return;
        }
        versionRowsToInsert.set(sourceDocId, row);
      });
      linksToInsert.push(...packageData.contentDocumentLinks);
      return {
        versionRowsToInsert: [...versionRowsToInsert.values()],
        versionRowsToUpdate: [],
        linksToInsert,
      };
    }

    const targetDocByParentAndExternal = await this._loadTargetDocByParentAndExternalValueAsync(
      targetParentIds,
      externalIdField
    );

    packageData.contentDocumentLinks.forEach((linkRow) => {
      const sourceParentId = String(this._getRowValueCaseInsensitive(linkRow, 'LinkedEntityId') ?? '').trim();
      const sourceDocId = String(this._getRowValueCaseInsensitive(linkRow, 'ContentDocumentId') ?? '').trim();
      const targetParentId = parentMap.get(sourceParentId);
      const sourceVersion = sourceVersionByDocId.get(sourceDocId);
      if (!targetParentId || !sourceVersion) {
        return;
      }

      const sourceExternalValue = this._normalizeExternalMatchValue(
        this._getRowValueCaseInsensitive(sourceVersion, externalIdField) ??
          this._getRowValueCaseInsensitive(sourceVersion, 'Title')
      );
      if (!sourceExternalValue) {
        return;
      }

      const targetDocId = targetDocByParentAndExternal.get(`${targetParentId}|${sourceExternalValue}`);
      if (targetDocId) {
        if (!versionRowsToUpdate.has(targetDocId)) {
          versionRowsToUpdate.set(targetDocId, {
            ...sourceVersion,
            ContentDocumentId: targetDocId,
          });
        }
        return;
      }

      if (operation === OPERATION.Upsert) {
        if (!versionRowsToInsert.has(sourceDocId)) {
          versionRowsToInsert.set(sourceDocId, sourceVersion);
        }
        linksToInsert.push(linkRow);
      }
    });

    return {
      versionRowsToInsert: [...versionRowsToInsert.values()],
      versionRowsToUpdate: [...versionRowsToUpdate.values()],
      linksToInsert,
    };
  }

  /**
   * Loads target ContentDocument ids keyed by parent and external value.
   *
   * @param targetParentIds - Target parent ids.
   * @param externalIdField - External id field used for matching.
   * @returns Mapping key `${targetParentId}|${externalValue}` -> ContentDocumentId.
   */
  private async _loadTargetDocByParentAndExternalValueAsync(
    targetParentIds: string[],
    externalIdField: string
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (targetParentIds.length === 0) {
      return map;
    }

    const linkQueries = this.runtime.createFieldInQueries(
      ['Id', 'LinkedEntityId', 'ContentDocumentId'],
      'LinkedEntityId',
      'ContentDocumentLink',
      targetParentIds
    );
    const targetLinks = await this.runtime.queryMultiAsync(false, linkQueries);
    const targetDocIds = Common.distinctStringArray(
      targetLinks.map((row) => String(this._getRowValueCaseInsensitive(row, 'ContentDocumentId') ?? '').trim())
    );
    if (targetDocIds.length === 0) {
      return map;
    }

    const versionFields = Common.distinctStringArray(['Id', 'ContentDocumentId', 'Title', externalIdField]);
    const versionQueries = this.runtime.createFieldInQueries(
      versionFields,
      'ContentDocumentId',
      'ContentVersion',
      targetDocIds,
      'IsLatest = true'
    );
    const targetVersions = await this.runtime.queryMultiAsync(false, versionQueries);
    const targetVersionByDocId = new Map<string, RecordType>();
    targetVersions.forEach((row) => {
      const docId = String(this._getRowValueCaseInsensitive(row, 'ContentDocumentId') ?? '').trim();
      if (!docId) {
        return;
      }
      targetVersionByDocId.set(docId, row);
    });

    targetLinks.forEach((linkRow) => {
      const targetParentId = String(this._getRowValueCaseInsensitive(linkRow, 'LinkedEntityId') ?? '').trim();
      const targetDocId = String(this._getRowValueCaseInsensitive(linkRow, 'ContentDocumentId') ?? '').trim();
      const targetVersion = targetVersionByDocId.get(targetDocId);
      if (!targetParentId || !targetVersion) {
        return;
      }
      const externalValue = this._normalizeExternalMatchValue(
        this._getRowValueCaseInsensitive(targetVersion, externalIdField) ??
          this._getRowValueCaseInsensitive(targetVersion, 'Title')
      );
      if (!externalValue) {
        return;
      }
      const key = `${targetParentId}|${externalValue}`;
      if (!map.has(key)) {
        map.set(key, targetDocId);
      }
    });

    return map;
  }

  /**
   * Inserts content versions and returns source->target ContentDocumentId map.
   *
   * @param sourceRows - Source content version rows.
   * @param maxChunkSize - Max chunk size.
   * @param args - Normalized add-on args.
   * @param allowExistingContentDocumentId - True to pass ContentDocumentId to target payload.
   * @returns ContentDocumentId map.
   */
  private async _insertContentVersionsAndBuildDocIdMapAsync(
    sourceRows: RecordType[],
    maxChunkSize: number,
    args: ExportFilesArgsType,
    allowExistingContentDocumentId = false
  ): Promise<Map<string, string>> {
    const sourceDocIdByVersion = new Map<ContentVersion, string>();
    const preparedRows = await Promise.all(
      sourceRows.map(async (row) => {
        const sourceDocId = String(
          this._getRowValueCaseInsensitive(row, 'ContentDocumentId') ?? row['Id'] ?? ''
        ).trim();
        const next = new ContentVersion({
          ContentDocumentId: allowExistingContentDocumentId
            ? String(this._getRowValueCaseInsensitive(row, 'ContentDocumentId') ?? '').trim()
            : '',
          Title: String(this._getRowValueCaseInsensitive(row, 'Title') ?? '').trim(),
          Description: String(this._getRowValueCaseInsensitive(row, 'Description') ?? '').trim(),
          PathOnClient: String(this._getRowValueCaseInsensitive(row, 'PathOnClient') ?? '').trim(),
          ContentUrl: String(this._getRowValueCaseInsensitive(row, 'ContentUrl') ?? '').trim(),
        });
        if (next.ContentUrl) {
          return { version: next, sourceDocId: sourceDocId || next.Title };
        }

        const versionDataRef = String(this._getRowValueCaseInsensitive(row, 'VersionData') ?? '').trim();
        const resolvedVersionData = await this._resolveBinaryDataToBase64Async(versionDataRef, args);
        if (!resolvedVersionData) {
          return null;
        }
        next.VersionData = resolvedVersionData;
        const contentSizeRaw = Number(this._getRowValueCaseInsensitive(row, 'ContentSize') ?? 0);
        next.ContentSize =
          Number.isFinite(contentSizeRaw) && contentSizeRaw > 0
            ? contentSizeRaw
            : Buffer.byteLength(resolvedVersionData, 'base64');
        return { version: next, sourceDocId: sourceDocId || next.Title };
      })
    );

    const versions: ContentVersion[] = [];
    preparedRows.forEach((entry) => {
      if (!entry) {
        return;
      }
      versions.push(entry.version);
      sourceDocIdByVersion.set(entry.version, entry.sourceDocId);
    });

    if (versions.length === 0) {
      return new Map();
    }

    const sourceIsFile = this._isFileMedia(this.runtime.getScript(), true);
    if (sourceIsFile) {
      const payloadToSourceDocId = new Map<Record<string, unknown>, string>();
      const payload = versions.map((version) => {
        const record: Record<string, unknown> = {
          Title: version.Title,
          Description: version.Description,
          PathOnClient: version.PathOnClient,
        };
        if (allowExistingContentDocumentId && version.ContentDocumentId) {
          record['ContentDocumentId'] = version.ContentDocumentId;
        }
        if (version.ContentUrl) {
          record['ContentUrl'] = version.ContentUrl;
        } else {
          record['VersionData'] = version.VersionData;
        }
        payloadToSourceDocId.set(record, sourceDocIdByVersion.get(version) ?? version.Title);
        return record;
      });

      const inserted = await this.runtime.updateTargetRecordsAsync(
        'ContentVersion',
        OPERATION.Insert,
        payload,
        API_ENGINE.REST_API,
        true
      );
      const insertedIds = inserted.map((row) => String(row['Id'] ?? '').trim()).filter((id) => Boolean(id));
      if (insertedIds.length === 0) {
        return new Map();
      }

      const queries = this.runtime.createFieldInQueries(
        ['Id', 'ContentDocumentId'],
        'Id',
        'ContentVersion',
        insertedIds
      );
      const targetRows = await this.runtime.queryMultiAsync(false, queries);
      const targetDocIdByVersionId = new Map<string, string>();
      targetRows.forEach((row) => {
        const id = String(row['Id'] ?? '').trim();
        const contentDocumentId = String(row['ContentDocumentId'] ?? '').trim();
        if (!id || !contentDocumentId) {
          return;
        }
        targetDocIdByVersionId.set(id, contentDocumentId);
      });

      const map = new Map<string, string>();
      inserted.forEach((row) => {
        const targetVersionId = String(row['Id'] ?? '').trim();
        const targetDocId = targetDocIdByVersionId.get(targetVersionId);
        const sourceDocId = payloadToSourceDocId.get(row);
        if (!sourceDocId || !targetDocId) {
          return;
        }
        map.set(sourceDocId, targetDocId);
      });
      return map;
    }

    await this.runtime.transferContentVersions(this, versions, maxChunkSize);
    const map = new Map<string, string>();
    versions.forEach((version) => {
      const sourceDocId = sourceDocIdByVersion.get(version);
      if (!sourceDocId || !version.targetContentDocumentId || version.isError) {
        return;
      }
      map.set(sourceDocId, version.targetContentDocumentId);
    });
    return map;
  }

  /**
   * Inserts content document links after ContentVersion transfer.
   *
   * @param sourceLinks - Source link rows.
   * @param parentIdMap - Source parent id -> target parent id.
   * @param docIdMap - Source doc id -> target doc id.
   */
  private async _insertContentDocumentLinksAsync(
    sourceLinks: RecordType[],
    parentIdMap: Map<string, string>,
    docIdMap: Map<string, string>
  ): Promise<{ payload: Array<Record<string, unknown>>; results: Array<Record<string, unknown>> }> {
    if (sourceLinks.length === 0 || docIdMap.size === 0) {
      return { payload: [], results: [] };
    }
    const payload: Array<Record<string, unknown>> = [];
    sourceLinks.forEach((row) => {
      const sourceParentId = String(row['LinkedEntityId'] ?? '').trim();
      const sourceDocId = String(row['ContentDocumentId'] ?? '').trim();
      const targetParentId = parentIdMap.get(sourceParentId);
      const targetDocId = docIdMap.get(sourceDocId);
      if (!targetParentId || !targetDocId) {
        return;
      }
      payload.push({
        LinkedEntityId: targetParentId,
        ContentDocumentId: targetDocId,
        ShareType: row['ShareType'] ?? undefined,
        Visibility: row['Visibility'] ?? undefined,
      });
    });

    if (payload.length === 0) {
      return { payload: [], results: [] };
    }
    const results = await this.runtime.updateTargetRecordsAsync(
      'ContentDocumentLink',
      OPERATION.Insert,
      payload,
      API_ENGINE.DEFAULT_ENGINE,
      true
    );
    return { payload, results };
  }

  /**
   * Deletes target ContentDocument records linked to provided parent ids.
   *
   * @param targetParentIds - Target parent ids.
   */
  private async _deleteTargetContentDocumentsByParentIdsAsync(targetParentIds: string[]): Promise<void> {
    const queries = this.runtime.createFieldInQueries(
      ['Id', 'LinkedEntityId', 'ContentDocumentId'],
      'LinkedEntityId',
      'ContentDocumentLink',
      targetParentIds
    );
    const links = await this.runtime.queryMultiAsync(false, queries);
    const docIds = Common.distinctStringArray(Common.arrayToPropsArray(links, ['ContentDocumentId']));
    if (docIds.length === 0) {
      return;
    }
    await this.runtime.updateTargetRecordsAsync(
      'ContentDocument',
      OPERATION.Delete,
      docIds.map((id) => ({ Id: id }))
    );
  }

  /**
   * Deletes target rows by parent ids.
   *
   * @param sObjectName - Target sObject name.
   * @param targetParentIds - Parent ids.
   * @returns Deleted row count.
   */
  private async _deleteTargetRowsByParentIdsAsync(sObjectName: string, targetParentIds: string[]): Promise<number> {
    if (targetParentIds.length === 0) {
      return 0;
    }
    const queries = this.runtime.createFieldInQueries(['Id', 'ParentId'], 'ParentId', sObjectName, targetParentIds);
    const rows = await this.runtime.queryMultiAsync(false, queries);
    const idRows = rows.map((row) => ({ Id: String(row['Id'] ?? '').trim() })).filter((row) => Boolean(row.Id));
    if (idRows.length === 0) {
      return 0;
    }
    const deleted = await this.runtime.updateTargetRecordsAsync(sObjectName, OPERATION.Delete, idRows);
    return deleted.length;
  }

  /**
   * Creates parent transfer counters initialized from source-to-target map.
   *
   * @param sourceToTargetParentMap - Source parent id to target parent id map.
   * @returns Counters by source parent id.
   */
  private _createParentTransferCounters(
    sourceToTargetParentMap: Map<string, string>
  ): Map<string, ParentTransferCountersType> {
    void this;
    const counters = new Map<string, ParentTransferCountersType>();
    sourceToTargetParentMap.forEach((_targetParentId, sourceParentId) => {
      counters.set(sourceParentId, {
        downloadedFiles: 0,
        uploadedFiles: 0,
        downloadedAttachments: 0,
        uploadedAttachments: 0,
      });
    });
    return counters;
  }

  /**
   * Adds downloaded file counters from source doc-link/doc-version maps.
   *
   * @param recordIdToDocLinks - Source parent id to linked rows map.
   * @param docIdToVersion - Source doc id to version map.
   * @param counters - Parent counters map.
   */
  private _addDownloadedFileCountersFromDocLinks(
    recordIdToDocLinks: Map<string, RecordType[]>,
    docIdToVersion: Map<string, RecordType>,
    counters: Map<string, ParentTransferCountersType>
  ): void {
    recordIdToDocLinks.forEach((docLinks, sourceParentId) => {
      docLinks.forEach((docLink) => {
        const docId = String(docLink['ContentDocumentId'] ?? docLink['RecordId'] ?? '').trim();
        if (!docId || !docIdToVersion.has(docId)) {
          return;
        }
        this._incrementParentCounter(counters, sourceParentId, 'downloadedFiles');
      });
    });
  }

  /**
   * Adds downloaded file counters from Data Loader package payload.
   *
   * @param packageData - Data Loader package.
   * @param counters - Parent counters map.
   */
  private _addDownloadedFileCountersFromPackage(
    packageData: DataLoaderPackageType,
    counters: Map<string, ParentTransferCountersType>
  ): void {
    const sourceDocIds = new Set(
      packageData.contentVersions
        .map((row) =>
          String(
            this._getRowValueCaseInsensitive(row, 'ContentDocumentId') ??
              this._getRowValueCaseInsensitive(row, 'Id') ??
              ''
          ).trim()
        )
        .filter((value) => Boolean(value))
    );
    if (sourceDocIds.size === 0) {
      return;
    }
    packageData.contentDocumentLinks.forEach((row) => {
      const sourceParentId = String(this._getRowValueCaseInsensitive(row, 'LinkedEntityId') ?? '').trim();
      const sourceDocId = String(this._getRowValueCaseInsensitive(row, 'ContentDocumentId') ?? '').trim();
      if (!sourceParentId || !sourceDocId || !sourceDocIds.has(sourceDocId)) {
        return;
      }
      this._incrementParentCounter(counters, sourceParentId, 'downloadedFiles');
    });
  }

  /**
   * Adds downloaded attachment counters from Data Loader package payload.
   *
   * @param packageData - Data Loader package.
   * @param counters - Parent counters map.
   */
  private _addDownloadedAttachmentCountersFromPackage(
    packageData: DataLoaderPackageType,
    counters: Map<string, ParentTransferCountersType>
  ): void {
    packageData.attachments.forEach((row) => {
      const sourceParentId = String(this._getRowValueCaseInsensitive(row, 'ParentId') ?? '').trim();
      if (!sourceParentId) {
        return;
      }
      this._incrementParentCounter(counters, sourceParentId, 'downloadedAttachments');
    });
  }

  /**
   * Adds uploaded file counters using DML results and payload rows.
   *
   * @param results - DML results.
   * @param payload - Submitted payload rows.
   * @param sourceToTargetParentMap - Source parent id to target parent id map.
   * @param counters - Parent counters map.
   * @param parentFieldName - Parent id field name in payload.
   */
  private _addUploadedFileCountersFromDmlResults(
    results: Array<Record<string, unknown>>,
    payload: Array<Record<string, unknown>>,
    sourceToTargetParentMap: Map<string, string>,
    counters: Map<string, ParentTransferCountersType>,
    parentFieldName: string
  ): void {
    const targetToSourceParentMap = this._createTargetToSourceParentIdMap(sourceToTargetParentMap);
    payload.forEach((row, index) => {
      const result = results[index];
      if (!this._isSuccessfulDmlResult(result)) {
        return;
      }
      const targetParentId = String(row[parentFieldName] ?? '').trim();
      if (!targetParentId) {
        return;
      }
      const sourceParentId = targetToSourceParentMap.get(targetParentId);
      if (!sourceParentId) {
        return;
      }
      this._incrementParentCounter(counters, sourceParentId, 'uploadedFiles');
    });
  }

  /**
   * Adds uploaded attachment counters using DML results and payload rows.
   *
   * @param results - DML results.
   * @param payload - Submitted payload rows.
   * @param sourceToTargetParentMap - Source parent id to target parent id map.
   * @param counters - Parent counters map.
   */
  private _addUploadedAttachmentCountersFromDmlResults(
    results: Array<Record<string, unknown>>,
    payload: Array<Record<string, unknown>>,
    sourceToTargetParentMap: Map<string, string>,
    counters: Map<string, ParentTransferCountersType>
  ): void {
    const targetToSourceParentMap = this._createTargetToSourceParentIdMap(sourceToTargetParentMap);
    payload.forEach((row, index) => {
      const result = results[index];
      if (!this._isSuccessfulDmlResult(result)) {
        return;
      }
      const targetParentId = String(row['ParentId'] ?? '').trim();
      if (!targetParentId) {
        return;
      }
      const sourceParentId = targetToSourceParentMap.get(targetParentId);
      if (!sourceParentId) {
        return;
      }
      this._incrementParentCounter(counters, sourceParentId, 'uploadedAttachments');
    });
  }

  /**
   * Logs transfer counters by parent and total summary.
   *
   * @param sourceToTargetParentMap - Source parent id to target parent id map.
   * @param counters - Parent counters map.
   */
  private _logParentTransferCounters(
    sourceToTargetParentMap: Map<string, string>,
    counters: Map<string, ParentTransferCountersType>
  ): void {
    const activeItems = [...counters.entries()].filter(
      ([, value]) =>
        value.downloadedFiles > 0 ||
        value.uploadedFiles > 0 ||
        value.downloadedAttachments > 0 ||
        value.uploadedAttachments > 0
    );
    if (activeItems.length === 0) {
      return;
    }

    const totals = {
      downloadedFiles: 0,
      uploadedFiles: 0,
      downloadedAttachments: 0,
      uploadedAttachments: 0,
    };
    activeItems.forEach(([, value]) => {
      totals.downloadedFiles += value.downloadedFiles;
      totals.uploadedFiles += value.uploadedFiles;
      totals.downloadedAttachments += value.downloadedAttachments;
      totals.uploadedAttachments += value.uploadedAttachments;
    });

    this.runtime.logFormattedInfo(
      this,
      'ExportFiles_ParentTransferSummary',
      this.context.objectName,
      String(totals.downloadedFiles),
      String(totals.uploadedFiles),
      String(totals.downloadedAttachments),
      String(totals.uploadedAttachments)
    );

    activeItems
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
      .forEach(([sourceParentId, value]) => {
        this.runtime.logFormattedInfo(
          this,
          'ExportFiles_ParentTransferByParent',
          this.context.objectName,
          sourceParentId,
          sourceToTargetParentMap.get(sourceParentId) ?? '',
          String(value.downloadedFiles),
          String(value.uploadedFiles),
          String(value.downloadedAttachments),
          String(value.uploadedAttachments)
        );
      });
  }

  /**
   * Increments parent counter field.
   *
   * @param counters - Parent counters map.
   * @param sourceParentId - Source parent id key.
   * @param fieldName - Counter field.
   */
  private _incrementParentCounter(
    counters: Map<string, ParentTransferCountersType>,
    sourceParentId: string,
    fieldName: keyof ParentTransferCountersType
  ): void {
    void this;
    const normalizedParentId = sourceParentId.trim();
    if (!normalizedParentId) {
      return;
    }
    const existing = counters.get(normalizedParentId) ?? {
      downloadedFiles: 0,
      uploadedFiles: 0,
      downloadedAttachments: 0,
      uploadedAttachments: 0,
    };
    existing[fieldName] += 1;
    counters.set(normalizedParentId, existing);
  }

  /**
   * Creates target-to-source parent map for counter resolution.
   *
   * @param sourceToTargetParentMap - Source parent id to target parent id map.
   * @returns Target parent id to source parent id map.
   */
  private _createTargetToSourceParentIdMap(sourceToTargetParentMap: Map<string, string>): Map<string, string> {
    void this;
    const map = new Map<string, string>();
    sourceToTargetParentMap.forEach((targetParentId, sourceParentId) => {
      const normalizedTargetParentId = targetParentId.trim();
      if (!normalizedTargetParentId) {
        return;
      }
      map.set(normalizedTargetParentId, sourceParentId);
    });
    return map;
  }

  /**
   * Determines if a DML result row has no error payload.
   *
   * @param result - DML result row.
   * @returns True when successful.
   */
  private _isSuccessfulDmlResult(result: Record<string, unknown> | undefined): boolean {
    void this;
    if (!result) {
      return false;
    }
    const errors = result[ERRORS_FIELD_NAME];
    if (Array.isArray(errors)) {
      return errors.length === 0;
    }
    if (typeof errors === 'string') {
      return errors.trim().length === 0;
    }
    return !errors;
  }

  /**
   * Reads first existing CSV file from candidate list.
   *
   * @param candidates - Full file path candidates.
   * @returns Parsed CSV rows.
   */
  private async _readFirstExistingCsvFileAsync(candidates: string[]): Promise<RecordType[]> {
    void this;
    const existingCandidate = candidates.find((candidate) => fs.existsSync(candidate));
    if (existingCandidate) {
      const rows = await Common.readCsvFileAsync(existingCandidate);
      return rows;
    }
    return [];
  }

  /**
   * Returns possible CSV input paths for Data Loader files.
   *
   * @param fileName - CSV file name.
   * @returns Candidate list.
   */
  private _getCsvInputFileCandidates(fileName: string): string[] {
    const candidates = new Set<string>();
    const sourcePath = path.normalize(this.runtime.sourcePath);
    const rawSourceDirectoryPath = this._getRawSourceDirectoryPathOrDefault();
    const rawSourcePath = path.normalize(rawSourceDirectoryPath);
    const basePath = path.normalize(this.runtime.basePath);
    const objectSetNumber = this._getCurrentObjectSetNumber();
    const useSeparatedCSVFiles = this._isUseSeparatedCSVFilesEnabled();

    if (useSeparatedCSVFiles) {
      candidates.add(path.join(rawSourcePath, fileName));
      candidates.add(path.join(sourcePath, fileName));
      if (objectSetNumber > 1) {
        candidates.add(path.join(basePath, `object-set-${objectSetNumber}`, fileName));
      }
    } else {
      candidates.add(path.join(basePath, fileName));
      candidates.add(path.join(rawSourcePath, fileName));
      candidates.add(path.join(sourcePath, fileName));
    }

    candidates.add(path.join(basePath, fileName));

    return [...candidates];
  }

  /**
   * Resolves output CSV directory for Data Loader package.
   *
   * @returns Directory path.
   */
  private _resolveDataLoaderCsvDirectoryPath(): string {
    if (this._isUseSeparatedCSVFilesEnabled()) {
      return path.normalize(this.runtime.targetPath || path.join(this.runtime.basePath, 'target'));
    }
    return path.normalize(this.runtime.basePath);
  }

  /**
   * Resolves input CSV directory for Data Loader package.
   *
   * @returns Input directory path.
   */
  private _resolveDataLoaderCsvInputDirectoryPath(): string {
    if (this._isUseSeparatedCSVFilesEnabled()) {
      return path.normalize(this._getRawSourceDirectoryPathOrDefault());
    }
    return path.normalize(this.runtime.basePath);
  }

  /**
   * Resolves binary base path with useSeparatedCSVFiles rules.
   *
   * @param args - Normalized add-on args.
   * @param scope - Input or output path scope.
   * @returns Absolute base path.
   */
  private _resolveBinaryBasePath(args: ExportFilesArgsType, scope: 'input' | 'output'): string {
    const normalizedBase = (args.baseBinaryFilePath ?? DEFAULT_BINARY_BASE_PATH).trim() || DEFAULT_BINARY_BASE_PATH;
    const normalizedBasePath = this._normalizePathSyntax(normalizedBase);
    const absoluteBasePath = path.normalize(normalizedBasePath);
    if (!this._isUseSeparatedCSVFilesEnabled()) {
      if (path.isAbsolute(absoluteBasePath)) {
        return absoluteBasePath;
      }
      return path.normalize(path.join(this.runtime.basePath, normalizedBasePath));
    }

    if (path.isAbsolute(absoluteBasePath)) {
      return `${absoluteBasePath}-${this._getCurrentObjectSetNumber()}`;
    }

    const csvBasePath =
      scope === 'output' ? this._resolveDataLoaderCsvDirectoryPath() : this._resolveDataLoaderCsvInputDirectoryPath();
    return path.normalize(path.join(csvBasePath, normalizedBasePath));
  }

  /**
   * Converts CSV/URL/blob reference to base64 data.
   *
   * @param value - Raw CSV value.
   * @param args - Normalized add-on args.
   * @returns Base64 data or empty string.
   */
  private async _resolveBinaryDataToBase64Async(value: string, args: ExportFilesArgsType): Promise<string> {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return '';
    }

    if (/^https?:\/\//i.test(trimmedValue) || trimmedValue.startsWith('/services/')) {
      const downloaded = await this._downloadSourceOrgBlobAsBase64Async(trimmedValue);
      return downloaded || '';
    }

    const binaryPath = await this._resolveBinaryInputFilePathAsync(trimmedValue, args);
    if (binaryPath && fs.existsSync(binaryPath)) {
      const buffer = await fs.promises.readFile(binaryPath);
      return buffer.toString('base64');
    }

    if (this._isLikelyBase64Value(trimmedValue)) {
      return trimmedValue;
    }

    return '';
  }

  /**
   * Resolves a binary input file path from CSV value.
   *
   * @param binaryRef - Value from CSV cell.
   * @param args - Normalized add-on args.
   * @returns Full path or empty string.
   */
  private async _resolveBinaryInputFilePathAsync(binaryRef: string, args: ExportFilesArgsType): Promise<string> {
    if (!binaryRef) {
      return '';
    }
    const normalizedRef = binaryRef.trim();
    if (!normalizedRef) {
      return '';
    }
    const normalizedPathRef = this._normalizePathSyntax(normalizedRef);
    const hasGlobPattern = this._isGlobPattern(normalizedRef);

    const absoluteCandidate = path.normalize(normalizedPathRef);
    if (!hasGlobPattern && path.isAbsolute(absoluteCandidate) && fs.existsSync(absoluteCandidate)) {
      return absoluteCandidate;
    }

    if (!this._isLikelyAbsoluteOrRelativeFilePath(normalizedRef)) {
      return '';
    }

    const candidateBasePaths = [this._resolveBinaryBasePath(args, 'input')];

    if (this._isUseSeparatedCSVFilesEnabled()) {
      candidateBasePaths.push(this.runtime.sourcePath);
      candidateBasePaths.push(path.join(this.runtime.basePath, `object-set-${this._getCurrentObjectSetNumber()}`));
    }
    candidateBasePaths.push(this.runtime.basePath);

    if (hasGlobPattern) {
      const globMatches = await Promise.all(
        candidateBasePaths.map(async (basePath) => {
          if (!basePath) {
            return '';
          }
          return this._resolveGlobBinaryInputFilePathAsync(basePath, normalizedRef);
        })
      );
      const firstMatch = globMatches.find((candidate) => Boolean(candidate));
      return firstMatch ?? '';
    }

    for (const basePath of candidateBasePaths) {
      if (!basePath) {
        continue;
      }
      const relativeCandidate = path.normalize(path.join(basePath, normalizedPathRef));
      if (fs.existsSync(relativeCandidate)) {
        return relativeCandidate;
      }
    }

    return '';
  }

  /**
   * Resolves binary file path by a glob pattern.
   *
   * @param basePath - Candidate base path.
   * @param pattern - Glob pattern from CSV.
   * @returns First matched file path.
   */
  private async _resolveGlobBinaryInputFilePathAsync(basePath: string, pattern: string): Promise<string> {
    const normalizedPattern = this._normalizePathSyntax(pattern);
    const patternToResolve = path.isAbsolute(normalizedPattern)
      ? normalizedPattern
      : path.join(basePath, normalizedPattern);
    const globPattern = this._convertPathToGlobPattern(patternToResolve);
    const matches = await glob(globPattern, {
      nodir: true,
      windowsPathsNoEscape: true,
    });

    const normalizedMatches = matches
      .map((candidate) => path.normalize(candidate))
      .filter((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      .sort((left, right) => left.localeCompare(right));
    return normalizedMatches[0] ?? '';
  }

  /**
   * Returns current object set number (1-based).
   *
   * @returns Object set number.
   */
  private _getCurrentObjectSetNumber(): number {
    const nextNumber = this._getObjectSetIndex() + 1;
    if (!Number.isFinite(nextNumber) || nextNumber <= 0) {
      return 1;
    }
    return nextNumber;
  }

  /**
   * Returns whether separated CSV files mode is enabled.
   *
   * @returns True when enabled.
   */
  private _isUseSeparatedCSVFilesEnabled(): boolean {
    return this._getScriptPropertyValue('useSeparatedCSVFiles') === true;
  }

  /**
   * Returns raw source directory path from script when available.
   *
   * @returns Raw source directory path.
   */
  private _getRawSourceDirectoryPathOrDefault(): string {
    const rawSourceDirectoryPath = this._getScriptPropertyValue('rawSourceDirectoryPath');
    if (typeof rawSourceDirectoryPath === 'string' && rawSourceDirectoryPath) {
      return rawSourceDirectoryPath;
    }
    return this.runtime.sourcePath || this.runtime.basePath;
  }

  /**
   * Returns object set index from runtime script.
   *
   * @returns Zero-based object set index.
   */
  private _getObjectSetIndex(): number {
    const objectSetIndex = this._getScriptPropertyValue('objectSetIndex');
    const normalizedIndex =
      typeof objectSetIndex === 'number'
        ? objectSetIndex
        : Number(typeof objectSetIndex === 'string' ? objectSetIndex : 0);
    if (!Number.isFinite(normalizedIndex) || normalizedIndex < 0) {
      return 0;
    }
    return normalizedIndex;
  }

  /**
   * Returns a script property value by name.
   *
   * @param propertyName - Property name.
   * @returns Property value.
   */
  private _getScriptPropertyValue(propertyName: string): unknown {
    const script = this.runtime.getScript() as unknown;
    if (!script || typeof script !== 'object') {
      return undefined;
    }
    return (script as Record<string, unknown>)[propertyName];
  }

  /**
   * Checks whether the original export.json payload contains a property.
   *
   * @param propertyName - Property name.
   * @returns True when present in workingJson.
   */
  private _hasScriptWorkingJsonProperty(propertyName: string): boolean {
    const script = this.runtime.getScript() as unknown;
    if (!script || typeof script !== 'object') {
      return false;
    }
    const workingJson = (script as Record<string, unknown>)['workingJson'];
    if (!workingJson || typeof workingJson !== 'object' || Array.isArray(workingJson)) {
      return false;
    }
    return Object.hasOwn(workingJson as Record<string, unknown>, propertyName);
  }

  /**
   * Synchronizes Common CSV delimiters from the current script.
   */
  private _synchronizeCsvDelimitersFromScript(): void {
    const commonDelimiter = this._hasScriptWorkingJsonProperty('csvFileDelimiter')
      ? this._resolveCsvDelimiterFromScript('csvFileDelimiter')
      : undefined;
    const readDelimiter = commonDelimiter ?? this._resolveCsvDelimiterFromScript('csvReadFileDelimiter');
    const writeDelimiter = commonDelimiter ?? this._resolveCsvDelimiterFromScript('csvWriteFileDelimiter');
    if (readDelimiter) {
      Common.csvReadFileDelimiter = readDelimiter;
    }
    if (writeDelimiter) {
      Common.csvWriteFileDelimiter = writeDelimiter;
    }
    const csvFileEncoding = this._resolveCsvEncodingFromScript();
    if (csvFileEncoding) {
      Common.csvFileEncoding = csvFileEncoding;
    }

    const csvInsertNulls = this._getScriptPropertyValue('csvInsertNulls');
    Common.csvInsertNulls = Boolean(csvInsertNulls);

    const csvUseEuropeanDateFormat = this._getScriptPropertyValue('csvUseEuropeanDateFormat');
    Common.csvUseEuropeanDateFormat = Boolean(csvUseEuropeanDateFormat);

    const csvWriteUpperCaseHeaders = this._getScriptPropertyValue('csvWriteUpperCaseHeaders');
    Common.csvWriteUpperCaseHeaders = Boolean(csvWriteUpperCaseHeaders);

    const csvAlwaysQuoted = this._getScriptPropertyValue('csvAlwaysQuoted');
    Common.csvAlwaysQuoted = Boolean(csvAlwaysQuoted);
  }

  /**
   * Resolves a CSV delimiter from script settings.
   *
   * @param propertyName - Script property name.
   * @returns CSV delimiter when valid.
   */
  private _resolveCsvDelimiterFromScript(
    propertyName: 'csvFileDelimiter' | 'csvReadFileDelimiter' | 'csvWriteFileDelimiter'
  ): string | undefined {
    const delimiter = this._getScriptPropertyValue(propertyName);
    if (typeof delimiter !== 'string') {
      return undefined;
    }
    const normalized = delimiter.trim();
    if (!normalized) {
      return undefined;
    }
    const keyword = normalized.toLowerCase();
    if (keyword === 'comma') {
      return ',';
    }
    if (keyword === 'semicolon') {
      return ';';
    }
    if (keyword === 'tab' || normalized === '\\t') {
      return '\t';
    }
    return normalized;
  }

  /**
   * Resolves CSV encoding from script settings.
   *
   * @returns CSV encoding when valid.
   */
  private _resolveCsvEncodingFromScript(): BufferEncoding | undefined {
    const value = this._getScriptPropertyValue('csvFileEncoding');
    if (typeof value !== 'string') {
      return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    const allowedEncodings: BufferEncoding[] = [
      'ascii',
      'base64',
      'base64url',
      'binary',
      'hex',
      'latin1',
      'ucs2',
      'ucs-2',
      'utf16le',
      'utf-16le',
      'utf8',
      'utf-8',
    ];
    if ((allowedEncodings as string[]).includes(normalized)) {
      return normalized as BufferEncoding;
    }
    return undefined;
  }

  /**
   * Normalizes path separators in a platform-independent way.
   *
   * @param value - Raw path value.
   * @returns Normalized path with current platform separator.
   */
  private _normalizePathSyntax(value: string): string {
    void this;
    if (!value) {
      return '';
    }
    return value.replace(/[\\/]+/g, path.sep);
  }

  /**
   * Converts path to POSIX-like syntax for glob matching.
   *
   * @param value - Path value.
   * @returns Glob-compatible path.
   */
  private _convertPathToGlobPattern(value: string): string {
    void this;
    return value.replace(/\\/g, '/');
  }

  /**
   * Creates a Data Loader-compatible ContentVersion CSV row.
   *
   * @param row - Source row.
   * @param args - Normalized add-on args.
   * @param binaryBasePath - Absolute output binary base path.
   * @param counters - Filename counters.
   * @returns CSV row.
   */
  private async _createContentVersionCsvRowAsync(
    row: RecordType,
    args: ExportFilesArgsType,
    binaryBasePath: string,
    counters: Map<string, number>
  ): Promise<Record<string, unknown>> {
    const title = String(this._getRowValueCaseInsensitive(row, 'Title') ?? '');
    const pathOnClient = String(this._getRowValueCaseInsensitive(row, 'PathOnClient') ?? '');
    const contentUrl = String(this._getRowValueCaseInsensitive(row, 'ContentUrl') ?? '');
    let versionDataCsvValue = '';
    if (!contentUrl) {
      const rawVersionData = String(this._getRowValueCaseInsensitive(row, 'VersionData') ?? '');
      const resolvedBase64 = await this._resolveBinaryDataToBase64Async(rawVersionData, args);
      if (resolvedBase64) {
        const filename = this._buildBinaryFilename('ContentVersion', title, pathOnClient, counters);
        const outputPath = path.join(binaryBasePath, filename);
        await fs.promises.writeFile(outputPath, Buffer.from(resolvedBase64, 'base64'));
        versionDataCsvValue = filename.replace(/[\\]+/g, '/');
      }
    }

    return {
      Id: String(this._getRowValueCaseInsensitive(row, 'Id') ?? ''),
      ContentDocumentId: String(this._getRowValueCaseInsensitive(row, 'ContentDocumentId') ?? ''),
      Title: title,
      Description: String(this._getRowValueCaseInsensitive(row, 'Description') ?? ''),
      PathOnClient: pathOnClient,
      VersionData: versionDataCsvValue,
      ContentUrl: contentUrl,
    };
  }

  /**
   * Creates a Data Loader-compatible Attachment CSV row.
   *
   * @param row - Source row.
   * @param args - Normalized add-on args.
   * @param binaryBasePath - Absolute output binary base path.
   * @param counters - Filename counters.
   * @returns CSV row.
   */
  private async _createAttachmentCsvRowAsync(
    row: RecordType,
    args: ExportFilesArgsType,
    binaryBasePath: string,
    counters: Map<string, number>
  ): Promise<AttachmentRowType> {
    const name = String(this._getRowValueCaseInsensitive(row, 'Name') ?? '');
    const bodySource = String(this._getRowValueCaseInsensitive(row, 'Body') ?? '');
    let bodyCsvValue = '';
    const resolvedBase64 = await this._resolveBinaryDataToBase64Async(bodySource, args);
    if (resolvedBase64) {
      const filename = this._buildBinaryFilename('Attachment', name, name, counters);
      const outputPath = path.join(binaryBasePath, filename);
      await fs.promises.writeFile(outputPath, Buffer.from(resolvedBase64, 'base64'));
      bodyCsvValue = filename.replace(/[\\]+/g, '/');
    }

    return {
      Id: String(this._getRowValueCaseInsensitive(row, 'Id') ?? ''),
      ParentId: String(this._getRowValueCaseInsensitive(row, 'ParentId') ?? ''),
      Name: name,
      Body: bodyCsvValue,
      ContentType: String(this._getRowValueCaseInsensitive(row, 'ContentType') ?? ''),
      Description: String(this._getRowValueCaseInsensitive(row, 'Description') ?? ''),
    };
  }

  /**
   * Maps Attachment rows to target parent ids and resolves body payload.
   *
   * @param rows - Source rows.
   * @param parentIdMap - Source-to-target parent id map.
   * @param args - Normalized add-on args.
   * @returns Target payload.
   */
  private async _mapAttachmentRowsToTargetAsync(
    rows: RecordType[],
    parentIdMap: Map<string, string>,
    args: ExportFilesArgsType
  ): Promise<Array<Record<string, unknown>>> {
    const mappedRows = await Promise.all(
      rows.map(async (row) => {
        const sourceParentId = String(this._getRowValueCaseInsensitive(row, 'ParentId') ?? '').trim();
        const targetParentId = parentIdMap.get(sourceParentId);
        if (!targetParentId) {
          return null;
        }

        const rawBodyValue = String(this._getRowValueCaseInsensitive(row, 'Body') ?? '');
        const resolvedBody = await this._resolveBinaryDataToBase64Async(rawBodyValue, args);
        if (!resolvedBody) {
          return null;
        }

        return {
          ParentId: targetParentId,
          Name: String(this._getRowValueCaseInsensitive(row, 'Name') ?? ''),
          Body: resolvedBody,
          ContentType: String(this._getRowValueCaseInsensitive(row, 'ContentType') ?? ''),
          Description: String(this._getRowValueCaseInsensitive(row, 'Description') ?? ''),
        } as Record<string, unknown>;
      })
    );

    return mappedRows.filter((row): row is Record<string, unknown> => Boolean(row));
  }

  /**
   * Maps Note rows to target parent ids.
   *
   * @param rows - Source rows.
   * @param parentIdMap - Source-to-target parent id map.
   * @param args - Normalized add-on args.
   * @returns Target payload.
   */
  private _mapNoteRowsToTarget(
    rows: RecordType[],
    parentIdMap: Map<string, string>,
    args: ExportFilesArgsType
  ): Array<Record<string, unknown>> {
    void args;
    const payload: Array<Record<string, unknown>> = [];
    rows.forEach((row) => {
      const sourceParentId = String(this._getRowValueCaseInsensitive(row, 'ParentId') ?? '').trim();
      const targetParentId = parentIdMap.get(sourceParentId);
      if (!targetParentId) {
        return;
      }
      payload.push({
        ParentId: targetParentId,
        Title: String(this._getRowValueCaseInsensitive(row, 'Title') ?? ''),
        Body: String(this._getRowValueCaseInsensitive(row, 'Body') ?? ''),
        IsPrivate: this._toBooleanOrUndefined(this._getRowValueCaseInsensitive(row, 'IsPrivate')),
      });
    });
    return payload;
  }

  /**
   * Downloads blob data from source org and returns base64 payload.
   *
   * @param urlValue - Absolute or relative Salesforce blob URL.
   * @returns Base64 content.
   */
  private async _downloadSourceOrgBlobAsBase64Async(urlValue: string): Promise<string> {
    const script = this.runtime.getScript();
    const sourceOrg = script.sourceOrg;
    if (!sourceOrg?.instanceUrl || !sourceOrg.accessToken) {
      return '';
    }
    const fullUrl = /^https?:\/\//i.test(urlValue) ? urlValue : `${sourceOrg.instanceUrl}${urlValue}`;
    const response = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${sourceOrg.accessToken}`,
      },
    });
    if (!response.ok) {
      return '';
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.toString('base64');
  }

  /**
   * Builds a deterministic binary file name.
   *
   * @param objectName - Source object name.
   * @param title - Title-like value.
   * @param pathOnClient - Path-like value.
   * @param counters - Counters by key.
   * @returns Binary file name.
   */
  private _buildBinaryFilename(
    objectName: string,
    title: string,
    pathOnClient: string,
    counters: Map<string, number>
  ): string {
    const fileBase = this._sanitizeBinaryFileName(title || path.parse(pathOnClient).name || objectName);
    const extension = path.extname(pathOnClient) || '.bin';
    const counterKey = `${objectName}:${fileBase}`;
    const index = (counters.get(counterKey) ?? 0) + 1;
    counters.set(counterKey, index);
    return `${fileBase}-${String(index).padStart(4, '0')}${extension}`;
  }

  /**
   * Sanitizes input string for file name usage.
   *
   * @param input - Raw file name part.
   * @returns Safe file name part.
   */
  private _sanitizeBinaryFileName(input: string): string {
    void this;
    const normalized = input.trim().replace(/[<>:"/\\|?*]/g, '_');
    return normalized || 'file';
  }

  /**
   * Reads a row value by key using case-insensitive fallback.
   *
   * @param row - Record object.
   * @param key - Field key.
   * @returns Field value.
   */
  private _getRowValueCaseInsensitive(row: RecordType, key: string): unknown {
    void this;
    if (key in row) {
      return row[key];
    }
    const lowerKey = key.toLowerCase();
    const entry = Object.entries(row).find(([rowKey]) => rowKey.toLowerCase() === lowerKey);
    return entry?.[1];
  }

  /**
   * Normalizes external-id matching value.
   *
   * @param value - Raw external value.
   * @returns Normalized value.
   */
  private _normalizeExternalMatchValue(value: unknown): string {
    void this;
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim().toLowerCase();
  }

  /**
   * Converts raw value to boolean or undefined.
   *
   * @param value - Raw value.
   * @returns Boolean or undefined.
   */
  private _toBooleanOrUndefined(value: unknown): boolean | undefined {
    void this;
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      if (value === 1) {
        return true;
      }
      if (value === 0) {
        return false;
      }
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === '1' || normalized === 'true') {
        return true;
      }
      if (normalized === '0' || normalized === 'false') {
        return false;
      }
    }
    return undefined;
  }

  /**
   * Checks whether value looks like file path rather than base64.
   *
   * @param value - Raw value.
   * @returns True when looks like path.
   */
  private _isLikelyAbsoluteOrRelativeFilePath(value: string): boolean {
    void this;
    if (!value) {
      return false;
    }
    if (this._isGlobPattern(value)) {
      return true;
    }
    if (/[\\/]/.test(value)) {
      return true;
    }
    if (/^[a-zA-Z]:/.test(value)) {
      return true;
    }
    return /\.[a-zA-Z0-9]{1,8}$/.test(value);
  }

  /**
   * Checks whether value contains a glob pattern.
   *
   * @param value - Raw value.
   * @returns True when glob symbols are found.
   */
  private _isGlobPattern(value: string): boolean {
    void this;
    if (!value) {
      return false;
    }
    return /[*?[\]{}()!]/.test(value);
  }

  /**
   * Checks whether value looks like base64 string.
   *
   * @param value - Raw value.
   * @returns True when value resembles base64.
   */
  private _isLikelyBase64Value(value: string): boolean {
    void this;
    if (!value || value.length < 16 || value.length % 4 !== 0) {
      return false;
    }
    return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
  }

  /**
   * Returns record ids for the task based on object type.
   *
   * @param task - Migration task.
   * @param objectName - Object name.
   * @param isSource - True when using source ids.
   * @returns Record ids.
   */
  private _filterRecordIds(task: ISFdmuRunCustomAddonTask, objectName: string, isSource: boolean): string[] {
    void this;
    const idRecordsMap = isSource ? task.sourceData.idRecordsMap : task.targetData.idRecordsMap;
    if (objectName === 'FeedItem') {
      return [...idRecordsMap].filter((entry) => entry[1]['Type'] === 'ContentPost').map((entry) => entry[0]);
    }
    return [...idRecordsMap.keys()];
  }

  /**
   * Returns true when org media is file-based.
   *
   * @param script - Script instance.
   * @param isSource - True for source org.
   * @returns True when file-based.
   */
  private _isFileMedia(script: ISfdmuRunCustomAddonScript, isSource: boolean): boolean {
    void this;
    return isSource ? Boolean(script.sourceOrg?.isFileMedia) : Boolean(script.targetOrg?.isFileMedia);
  }
}
