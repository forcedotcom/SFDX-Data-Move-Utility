/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { Common } from "../../../../modules/components/common_components/common";
import { CONSTANTS } from "../../../../modules/components/common_components/statics";
import { SFDMU_RUN_ADDON_MESSAGES } from "../../../messages/sfdmuRunAddonMessages";

import { API_ENGINE, OPERATION } from "../../../../modules/components/common_components/enumerations";
import ContentVersion from "../../../../modules/models/sf_models/contentVersion";
import SfdmuRunAddonModule from "../../../components/sfdmu-run/sfdmuRunAddonModule";

import AddonResult from "../../../components/common/addonResult";
import IAddonContext from "../../../components/common/IAddonContext";
import { composeQuery, parseQuery } from 'soql-parser-js';

interface IOnExecuteArguments {
  deleteOldData: boolean;
  operation: OPERATION;
  /**
   * ContentVersion external id (Title by default)
   */
  externalId: string;

  /**
   * Additional WHERE on the ContentVersion for the source records to define detaily, which files
   * we want to export
   * WHERE IsLatest = true AND [selectWhere].
   */
  sourceWhere: string;

  /**
   * Additional WHERE on the ContentVersion for the target records to compare against
   * the source records to find updates.
   * WHERE IsLatest = true AND [selectWhere].
   */
  targetWhere: string;


  /**
   *
   * For safe uploading binary data, the data is splitted into multiple chunks
   * to be uploaded sequentially.
   * This parameter defines the maximum size of each chunk (in bytes).
   * Default to 15M.
   */
  maxChunkSize: number;
}

interface IDataToImport {
  recIdToDocLinks: Map<string, Array<any>>;
  docIds: Array<string>;
  recordIds: Array<string>;
  docIdToDocVersion: Map<string, any>;
}

interface ILinkedRecord {
  Id: string;
  sourceDocLink: any;
}

interface IDataToExport {
  version: ContentVersion; // only once => to update
  targetVersion: ContentVersion; // The target version if found
  recordsToBeLinked: ILinkedRecord[];
  isVersionChanged: boolean;
}

export default class ExportFiles extends SfdmuRunAddonModule {


  async onInit(context: IAddonContext, args: IOnExecuteArguments): Promise<AddonResult> {

    // Add required fields into the query string
    let script = this.runtime.getScript();
    let object = script.objects.find(ob => ob.name == context.objectName);

    switch (context.objectName) {
      case 'FeedItem':
        const parsedQuery = parseQuery(object.query);
        Common.addOrRemoveQueryFields(parsedQuery, ['Type']);
        object.query = composeQuery(parsedQuery);
        break;

      default:
        // TODO: Something to do whe is a regular sObject type
        break;
    }

    return null;
  }

  async onExecute(context: IAddonContext, args: IOnExecuteArguments): Promise<AddonResult> {

    const _self = this;

    // ---------- Preprocessing --------------------------------------
    // -----------------------------------------------------------------
    this.runtime.logAddonExecutionStarted(this);

    this.runtime.logFormattedInfo(this, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_Preparing);

    if (this.runtime.getOrgInfo(false).isFile || this.runtime.getOrgInfo(true).isFile) {
      // File target -> error
      this.runtime.logFormattedWarning(this, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_TargetIsFileWarning);
      this.runtime.logAddonExecutionFinished(this);
      return;
    }

    // Get the relevant parent task
    let task = this.runtime.pluginJob.tasks.find(task => task.sObjectName == context.objectName);

    // Set default parameters
    args.operation = !args.operation ? task.operation : OPERATION[args.operation.toString()];
    args.externalId = args.externalId || 'Title';

    if (!task) {
      // No task -> error
      this.runtime.logFormattedWarning(this, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_CouldNotFindObjectToProcessWarning);
      this.runtime.logAddonExecutionFinished(this);
      return;
    }

    if (args.operation == OPERATION.Readonly) {
      // Readonly -> error
      this.runtime.logFormattedWarning(this, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ReadonlyOperationWarning);
      this.runtime.logAddonExecutionFinished(this);
      return;
    }

    let sourceFiles: IDataToImport = {
      recIdToDocLinks: new Map<string, Array<any>>(),
      docIds: [],
      recordIds: [...task.sourceTaskData.idRecordsMap.keys()],
      docIdToDocVersion: new Map<string, any>()
    };


    let targetFiles: IDataToImport = {
      recIdToDocLinks: new Map<string, Array<any>>(),
      docIds: [],
      recordIds: [...task.targetTaskData.idRecordsMap.keys()],
      docIdToDocVersion: new Map<string, any>()
    };

    // Map: [Source ContentVersion] => IDataToExport
    let exportedFilesMap = new Map<any, IDataToExport>();
    let isDeleted = false;


    // ---------- Read Source Records --------------------------------------
    // -----------------------------------------------------------------
    switch (task.sObjectName) {

      case 'FeedItem':
        await ___readFeedAttachmentSourceRecordsAsync();
        break;

      default:
        await ___readFileSourceRecordsAsync();
        break;

    }


    // ---------- Upload Binary Data -----------------------------------
    // -----------------------------------------------------------------
    let versionsToProcess = [...exportedFilesMap.values()].filter(exportItem => exportItem.isVersionChanged).map(exportItem => exportItem.version);

    if (versionsToProcess.length > 0) {
      this.runtime.logFormattedInfo(this, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ExportingContentVersions);
      this.runtime.logFormattedInfo(this, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_RecordsToBeProcessed, String(versionsToProcess.length));

      await this.runtime.transferContentVersions(this, versionsToProcess, args.maxChunkSize);

      this.runtime.logFormattedInfo(this, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ProcessedRecords,
        String(versionsToProcess.length),
        String(versionsToProcess.filter(item => item.isError).length));
    }



    // -----------Create Target Records --------------------------
    // -----------------------------------------------------------------
    let exportedFiles = [...exportedFilesMap.values()].filter(exportedFile => exportedFile.recordsToBeLinked.length > 0);

    switch (task.sObjectName) {

      case 'FeedItem':
        await __writeFeedAttachmentTargetRecordsAsync();
        break;

      default:
        await __writeFileTargetRecordsAsync();
        break;

    }


    // ----------------Finishing ----------------------------
    // -------------------------------------------------------
    if (exportedFiles.length == 0 && versionsToProcess.length == 0) {
      this.runtime.logFormattedInfo(this, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_NothingToProcess);
    }

    this.runtime.logAddonExecutionFinished(this);




    // **************** Helper Functions *******************************
    // -----------------------------------------------------------------
    // -----------------------------------------------------------------
    // -----------------------------------------------------------------
    async function ___readFileSourceRecordsAsync() {

      // ------------------ Read Target ------------------------------
      // -------------------------------------------------------------
      // ====== Read  target ContentDocumentLinks =====
      if ((args.operation != OPERATION.Insert || args.deleteOldData) && targetFiles.recordIds.length > 0) {
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ReadTargetContentDocumentLinks);
        let queries = _self.runtime.createFieldInQueries(
          ['Id', 'LinkedEntityId', 'ContentDocumentId', 'ShareType', 'Visibility'],
          'LinkedEntityId',
          'ContentDocumentLink',
          targetFiles.recordIds);

        let contentDocLinks = await _self.runtime.queryMultiAsync(false, queries);
        targetFiles.recIdToDocLinks = Common.arrayToMapMulti(contentDocLinks, ['LinkedEntityId']);
        targetFiles.docIds = Common.distinctStringArray(Common.arrayToPropsArray(contentDocLinks, ['ContentDocumentId']));
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_RetrievedRecords, String(contentDocLinks.length));
      }

      // ===== Read target ContentVersions =====
      await __readTargetContentVersionsAsync();

      // ===== Delete target ContentDocuments =====
      if (await ___deleteTargetFilesAsync(targetFiles.docIds)) {
        return;
      }

      if (sourceFiles.recordIds.length == 0) {
        // No source records -> exit
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_NoSourceRecords);
        return;
      }

      if (args.operation == OPERATION.Update && isDeleted) {
        // Update + Delete => exit
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_NothingToUpdate);
        return;
      }

      if (args.operation == OPERATION.Upsert && isDeleted) {
        args.operation = OPERATION.Insert;
      }


      // ------ Read Source ----------------------------------------
      // -----------------------------------------------------------
      // ===== Read source ContentDocumentLinks =====
      {
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ReadSourceContentDocumentLinks);
        let queries = _self.runtime.createFieldInQueries(
          ['Id', 'LinkedEntityId', 'ContentDocumentId', 'ShareType', 'Visibility'],
          'LinkedEntityId',
          'ContentDocumentLink',
          [...task.sourceTaskData.idRecordsMap.keys()]);

        let contentDocLinks = await _self.runtime.queryMultiAsync(true, queries);
        sourceFiles.recIdToDocLinks = Common.arrayToMapMulti(contentDocLinks, ['LinkedEntityId']);
        sourceFiles.docIds = Common.distinctStringArray(Common.arrayToPropsArray(contentDocLinks, ['ContentDocumentId']));

        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_RetrievedRecords, String(contentDocLinks.length));
      }

      // ===== Read source ContentVersions =====
      await ___readSourceContentVersionsAsync();


      // ---------- Compare versions to detect changes -------------------
      // -----------which files need to download and upload---------------
      // -----------------------------------------------------------------
      _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_Analysing);

      await __compareContentVersionsAsync();

    }

    async function ___readFeedAttachmentSourceRecordsAsync() {

      // ------------------ Read Target ------------------------------
      // -------------------------------------------------------------
      // ====== Read  target FeedAttachments =====
      if ((args.operation != OPERATION.Insert || args.deleteOldData) && targetFiles.recordIds.length > 0) {
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ReadTargetFeedAttachments);
        let queries = _self.runtime.createFieldInQueries(
          ['Id', 'RecordId', 'FeedEntityId'],
          'FeedEntityId',
          'FeedAttachment',
          targetFiles.recordIds,
          "Type = 'Content'");

        let contentDocLinks = await _self.runtime.queryMultiAsync(false, queries);
        targetFiles.recIdToDocLinks = Common.arrayToMapMulti(contentDocLinks, ['FeedEntityId']);
        targetFiles.docIds = Common.distinctStringArray(Common.arrayToPropsArray(contentDocLinks, ['RecordId']));
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_RetrievedRecords, String(contentDocLinks.length));
      }

      // ===== Read target ContentVersions =========
      await __readTargetContentVersionsAsync('Id');

      // ===== Delete target ContentDocuments =====
      if (await ___deleteTargetFilesAsync(targetFiles.docIds)) {
        return;
      }

      if (sourceFiles.recordIds.length == 0) {
        // No source records -> exit
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_NoSourceRecords);
        return;
      }

      if (args.operation == OPERATION.Update && isDeleted) {
        // Update + Delete => exit
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_NothingToUpdate);
        return;
      }

      if (args.operation == OPERATION.Upsert && isDeleted) {
        args.operation = OPERATION.Insert;
      }


      // ------------------ Read Source ------------------------------
      // -------------------------------------------------------------
      // ====== Read  source FeedAttachments =====
      {
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ReadSourceFeedAttachments);
        let queries = _self.runtime.createFieldInQueries(
          ['Id', 'RecordId', 'FeedEntityId'],
          'FeedEntityId',
          'FeedAttachment',
          sourceFiles.recordIds,
          "Type = 'Content'");

        let feedAttachments = await _self.runtime.queryMultiAsync(true, queries);
        sourceFiles.recIdToDocLinks = Common.arrayToMapMulti(feedAttachments, ['FeedEntityId']);
        sourceFiles.docIds = Common.distinctStringArray(Common.arrayToPropsArray(feedAttachments, ['RecordId']));
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_RetrievedRecords, String(feedAttachments.length));
      }

      // ===== Read source ContentVersions =========
      await ___readSourceContentVersionsAsync('Id');



      // ---------- Compare versions to detect changes -------------------
      // -----------which files need to download and upload---------------
      // -----------------------------------------------------------------
      _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_Analysing);

      await __compareContentVersionsAsync('RecordId');


    }

    async function ___readSourceContentVersionsAsync(filteredByDocIdsByField = "ContentDocumentId") {
      if (sourceFiles.docIds.length > 0) {
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ReadSourceContentVersions);
        let fields = Common.distinctStringArray([
          'Id', args.externalId, 'ContentDocumentId',
          'Title', 'Description', 'PathOnClient', 'VersionData',
          'ContentModifiedDate', 'ContentSize', 'Checksum',
          'ContentUrl', 'ContentBodyId'
        ]);

        let queries = _self.runtime.createFieldInQueries(
          fields,
          filteredByDocIdsByField,
          'ContentVersion',
          sourceFiles.docIds,
          'IsLatest = true');
        if (args.sourceWhere) {
          queries = queries.map(query => query.replace('WHERE', 'WHERE (' + args.sourceWhere + ') AND (') + ')')
        }
        let contentVersions = await _self.runtime.queryMultiAsync(true, queries);
        sourceFiles.docIdToDocVersion = Common.arrayToMap(contentVersions, [filteredByDocIdsByField]);
        sourceFiles.docIds = [...sourceFiles.docIdToDocVersion.keys()];

        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_RetrievedRecords, String(contentVersions.length));

      }
    }

    async function __readTargetContentVersionsAsync(filteredByDocIdsByField = "ContentDocumentId") {
      if (args.operation != OPERATION.Insert && targetFiles.docIds.length > 0) {

        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ReadTargetContentVersions);

        let fields = Common.distinctStringArray([
          'Id', args.externalId, 'ContentDocumentId',
          'ContentModifiedDate', 'Title',
          'Checksum', 'ContentUrl'
        ]);

        let queries = _self.runtime.createFieldInQueries(
          fields,
          filteredByDocIdsByField,
          'ContentVersion',
          targetFiles.docIds,
          'IsLatest = true');
        if (args.targetWhere) {
          queries = queries.map(query => query.replace('WHERE', 'WHERE (' + args.targetWhere + ') AND (') + ')')
        }
        let contentVersions = await _self.runtime.queryMultiAsync(false, queries);
        targetFiles.docIdToDocVersion = Common.arrayToMap(contentVersions, [filteredByDocIdsByField]);
        targetFiles.docIds = [...targetFiles.docIdToDocVersion.keys()];

        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_RetrievedRecords, String(contentVersions.length));

      }
    }

    async function __compareContentVersionsAsync(compareByDocIdsByField = "ContentDocumentId") {
      sourceFiles.recIdToDocLinks.forEach((sourceDocLinks, recordId) => {
        sourceDocLinks.forEach(sourceDocLink => {
          let sourceContentVersion = sourceFiles.docIdToDocVersion.get(sourceDocLink[compareByDocIdsByField]);
          if (sourceContentVersion) {
            let targetRecord = task.sourceToTargetRecordMap.get(task.sourceTaskData.idRecordsMap.get(recordId));
            if (!exportedFilesMap.has(sourceContentVersion)) {
              exportedFilesMap.set(sourceContentVersion, {
                version: new ContentVersion(sourceContentVersion),
                recordsToBeLinked: new Array<ILinkedRecord>(),
                isVersionChanged: false,
                targetVersion: null
              });
            }
            let exportedFiles = exportedFilesMap.get(sourceContentVersion);
            if (targetRecord) {
              let targetDocLinks = targetFiles.recIdToDocLinks.get(targetRecord["Id"]);
              let found = false;
              // File exists => check for the modification ******
              (targetDocLinks || []).forEach(targetDocLink => {
                let targetContentVersion = exportedFiles.targetVersion || new ContentVersion(targetFiles.docIdToDocVersion.get(targetDocLink[compareByDocIdsByField]));
                if (exportedFiles.version[args.externalId] == targetContentVersion[args.externalId]) {
                  // The same version found in the Target
                  found = true;
                  exportedFiles.targetVersion = targetContentVersion;
                  if (!exportedFiles.version.targetContentDocumentId) {
                    exportedFiles.version.targetContentDocumentId = String(targetContentVersion[compareByDocIdsByField]);
                  }
                  if (exportedFiles.version.isNewer(targetContentVersion)) {
                    // The file was modified ****************
                    // Add _self item to the export array ///////////
                    exportedFiles.isVersionChanged = true;
                  }
                }
              });
              if (!found && args.operation != OPERATION.Update) {
                // File was not found in the Target => Create new file and attach it to the target
                // Only for upsert / insert, excluded update
                exportedFiles.recordsToBeLinked.push({
                  Id: targetRecord["Id"],
                  sourceDocLink
                });
              }
            }
          }
        });

      });

      exportedFilesMap.forEach((exportedFile) => {
        if (!exportedFile.targetVersion) {
          exportedFile.isVersionChanged = true;
        }
      });
    }

    async function __writeFileTargetRecordsAsync() {

      if (exportedFiles.length > 0) {
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ExportingContentDocumentLinks);

        let docLinks = Common.flattenArrays(exportedFiles.map(fileToExport => fileToExport.recordsToBeLinked.map(record => {
          return {
            LinkedEntityID: record.Id,
            ContentDocumentID: fileToExport.version.targetContentDocumentId,
            ShareType: record.sourceDocLink.ShareType,
            Visibility: record.sourceDocLink.Visibility
          };
        })));

        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_RecordsToBeProcessed, String(docLinks.length));

        let data = await _self.runtime.updateTargetRecordsAsync('ContentDocumentLink',
          OPERATION.Insert,
          docLinks,
          API_ENGINE.DEFAULT_ENGINE, true);

        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ProcessedRecords,
          String(data.length),
          String(data.filter(item => !!item[CONSTANTS.ERRORS_FIELD_NAME]).length));
      }

    }

    async function __writeFeedAttachmentTargetRecordsAsync() {

      if (exportedFiles.length > 0) {
        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ExportingFeedAttachments);

        let docLinks = Common.flattenArrays(exportedFiles.map(fileToExport => fileToExport.recordsToBeLinked.map(record => {
          return {
            FeedEntityId: record.Id,
            RecordId: fileToExport.version.targetId,
            Type: 'Content',
            Title: fileToExport.version.Title
          };
        })));

        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_RecordsToBeProcessed, String(docLinks.length));

        let data = await _self.runtime.updateTargetRecordsAsync('FeedAttachment',
          OPERATION.Insert,
          docLinks,
          API_ENGINE.DEFAULT_ENGINE, true);

        _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ProcessedRecords,
          String(data.length),
          String(data.filter(item => !!item[CONSTANTS.ERRORS_FIELD_NAME]).length));
      }

    }

    async function ___deleteTargetFilesAsync(docIdsToDelete: Array<string>): Promise<boolean> {

      if (args.deleteOldData || args.operation == OPERATION.Delete) {

        isDeleted = true;
        // -------- //
        if (docIdsToDelete.length > 0) {
          _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_DeleteTargetContentDocuments);
          let data = await _self.runtime.updateTargetRecordsAsync('ContentDocument',
            OPERATION.Delete,
            docIdsToDelete.map(item => {
              return {
                Id: item
              };
            }));
          _self.runtime.logFormattedInfo(_self, SFDMU_RUN_ADDON_MESSAGES.ExportFiles_ProcessedRecords,
            String(data.length),
            String(data.filter(item => !!item[CONSTANTS.ERRORS_FIELD_NAME]).length));

        }
        // ------- //
        if (args.operation == OPERATION.Delete) {
          // Only delete -> exit
          return true;
        }
      }
      return false;
    }



    return null;

  }

}
