/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import { Common } from "../../../../modules/components/common_components/common";
import { CONSTANTS } from "../../../../modules/components/common_components/statics";
import { SYSTEM_MESSAGES } from "../../../messages/system";




import { API_ENGINE, OPERATION } from "../../../../modules/components/common_components/enumerations";
import SfdmuContentVersion from "../../../components/sfdmu-run/sfdmuContentVersion";
import SfdmuRunAddonModuleBase from "../../../components/sfdmu-run/sfdmuRunAddonModuleBase";
import IAddonContext from "../../../components/common/IAddonContext";




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
    version: SfdmuContentVersion; // only once => to update
    targetVersion: SfdmuContentVersion; // The target version if found
    recordsToBeLinked: ILinkedRecord[];
    isVersionChanged: boolean;
}

export default class ExportFiles extends SfdmuRunAddonModuleBase {

    async onExecute(context: IAddonContext, args: IOnExecuteArguments): Promise<void> {

        let _self = this;

        this.runtime.logStartAddonExecution(this);

        this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.Preparing);

        if (this.runtime.getOrgInfo(false).isFile || this.runtime.getOrgInfo(true).isFile) {
            // File target -> error
            this.runtime.logFormattedWarning(this, SYSTEM_MESSAGES.ExportFiles_TargetIsFileWarning);
            this.runtime.logFinishAddonExecution(this);
            return;
        }


        // Get the relevant parent task
        let task = this.runtime.pluginJob.tasks.find(task => task.sObjectName == context.objectName);

        // Set default parameters
        args.operation = !args.operation ? task.operation : OPERATION[args.operation.toString()];
        args.externalId = args.externalId || 'Title';

        if (!task) {
            // No task -> error
            this.runtime.logFormattedWarning(this, SYSTEM_MESSAGES.ExportFiles_CouldNotFindObjectToProcessWarning);
            this.runtime.logFinishAddonExecution(this);
            return;
        }

        if (args.operation == OPERATION.Readonly) {
            // Readonly -> error
            this.runtime.logFormattedWarning(this, SYSTEM_MESSAGES.ExportFiles_ReadonlyOperationWarning);
            this.runtime.logFinishAddonExecution(this);
            return;
        }

        let source: IDataToImport = {
            recIdToDocLinks: new Map<string, Array<any>>(),
            docIds: [],
            recordIds: [...task.sourceTaskData.idRecordsMap.keys()],
            docIdToDocVersion: new Map<string, any>()
        };


        let target: IDataToImport = {
            recIdToDocLinks: new Map<string, Array<any>>(),
            docIds: [],
            recordIds: [...task.targetTaskData.idRecordsMap.keys()],
            docIdToDocVersion: new Map<string, any>()
        };

        // Map: [Source ContentVersion] => IDataToExport
        let dataToExportMap = new Map<any, IDataToExport>();

        // ------------------ Read Target ------------------------------
        // -------------------------------------------------------------

        // Read  target ContentDocumentLinks
        if (args.operation != OPERATION.Insert && target.recordIds.length > 0) {
            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.ExportFiles_ReadTargetContentDocumentLinks);
            let queries = this.runtime.createFieldInQueries(
                ['Id', 'LinkedEntityId', 'ContentDocumentId', 'ShareType', 'Visibility'],
                'LinkedEntityId',
                'ContentDocumentLink',
                target.recordIds);

            let data = await this.runtime.queryMultiAsync(false, queries);
            target.recIdToDocLinks = Common.arrayToMapMulti(data, ['LinkedEntityId']);
            target.docIds = Common.distinctStringArray(Common.arrayToPropsArray(data, ['ContentDocumentId']));
            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.RetrievedRecords, String(data.length));
        }

        // Delete all old target files (if no targetWhere was defined)  
        let isDeleted = false;

        if (!args.targetWhere) {
            if (await ___deleteTargetFiles(target.docIds)) {
                return;
            }
        }

        // Read target ContentVersions 
        if (args.operation != OPERATION.Insert && target.docIds.length > 0) {

            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.ExportFiles_ReadTargetContentVersions);

            let fields = Common.distinctStringArray([
                'Id', args.externalId, 'ContentDocumentId',
                'ContentModifiedDate', 'Title',
                'Checksum', 'ContentUrl'
            ]);

            let queries = this.runtime.createFieldInQueries(
                fields,
                'ContentDocumentId',
                'ContentVersion',
                target.docIds,
                'IsLatest = true');
            if (args.targetWhere) {
                queries = queries.map(query => query.replace('WHERE', 'WHERE (' + args.targetWhere + ') AND (') + ')')
            }
            let data = await this.runtime.queryMultiAsync(false, queries);
            target.docIdToDocVersion = Common.arrayToMap(data, ['ContentDocumentId']);

            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.RetrievedRecords, String(data.length));

        }

        // Delete selective old target files (if targetWhere was defined)    
        if (args.targetWhere) {
            if (await ___deleteTargetFiles([...target.docIdToDocVersion.keys()])) {
                return;
            }
        }

        if (source.recordIds.length == 0) {
            // No source records -> exit
            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.ExportFiles_NoSourceRecords);
            return;
        }

        if (args.operation == OPERATION.Update && isDeleted) {
            // Update + Delete => exit
            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.ExportFiles_NothingToUpdate);
            return;
        }

        if (args.operation == OPERATION.Upsert && isDeleted) {
            args.operation = OPERATION.Insert;
        }



        // -----------------------------------------------------------
        // -----------------------------------------------------------


        // ------ Read Source ----------------------------------------
        // -----------------------------------------------------------
        // Read source ContentDocumentLinks
        {
            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.ExportFiles_ReadSourceContentDocumentLinks);
            let queries = this.runtime.createFieldInQueries(
                ['Id', 'LinkedEntityId', 'ContentDocumentId', 'ShareType', 'Visibility'],
                'LinkedEntityId',
                'ContentDocumentLink',
                [...task.sourceTaskData.idRecordsMap.keys()]);

            let data = await this.runtime.queryMultiAsync(true, queries);
            source.recIdToDocLinks = Common.arrayToMapMulti(data, ['LinkedEntityId']);
            source.docIds = Common.distinctStringArray(Common.arrayToPropsArray(data, ['ContentDocumentId']));

            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.RetrievedRecords, String(data.length));
        }


        // Read source ContentVersions 
        if (source.docIds.length > 0) {
            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.ExportFiles_ReadSourceContentVersions);
            let fields = Common.distinctStringArray([
                'Id', args.externalId, 'ContentDocumentId',
                'Title', 'Description', 'PathOnClient', 'VersionData',
                'ContentModifiedDate', 'ContentSize', 'Checksum',
                'ContentUrl', 'ContentBodyId'
            ]);

            let queries = this.runtime.createFieldInQueries(
                fields,
                'ContentDocumentId',
                'ContentVersion',
                source.docIds,
                'IsLatest = true');
            if (args.sourceWhere) {
                queries = queries.map(query => query.replace('WHERE', 'WHERE (' + args.sourceWhere + ') AND (') + ')')
            }
            let data = await this.runtime.queryMultiAsync(true, queries);
            source.docIdToDocVersion = Common.arrayToMap(data, ['ContentDocumentId']);

            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.RetrievedRecords, String(data.length));

        }

        // ---------- Compare versions to detect changes -------------------
        // ----------- which files need to download and upload--------------
        // -----------------------------------------------------------------
        this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.Analysing);

        source.recIdToDocLinks.forEach((sourceDocLinks, recordId) => {
            sourceDocLinks.forEach(sourceDocLink => {
                let sourceContentVersion = source.docIdToDocVersion.get(sourceDocLink["ContentDocumentId"]);
                if (sourceContentVersion) {
                    let targetRecord = task.sourceToTargetRecordMap.get(task.sourceTaskData.idRecordsMap.get(recordId));
                    if (!dataToExportMap.has(sourceContentVersion)) {
                        dataToExportMap.set(sourceContentVersion, {
                            version: new SfdmuContentVersion(sourceContentVersion),
                            recordsToBeLinked: new Array<ILinkedRecord>(),
                            isVersionChanged: false,
                            targetVersion: null
                        });
                    }
                    let dataToExport = dataToExportMap.get(sourceContentVersion);
                    if (targetRecord) {
                        let targetDocLinks = target.recIdToDocLinks.get(targetRecord["Id"]);
                        let found = false;
                        // File exists => check for the modification ******
                        (targetDocLinks || []).forEach(targetDocLink => {
                            let targetContentVersion = dataToExport.targetVersion || new SfdmuContentVersion(target.docIdToDocVersion.get(targetDocLink["ContentDocumentId"]));
                            if (dataToExport.version[args.externalId] == targetContentVersion[args.externalId]) {
                                // The same version found in the Target
                                found = true;
                                dataToExport.targetVersion = targetContentVersion;
                                if (!dataToExport.version.targetContentDocumentId) {
                                    dataToExport.version.targetContentDocumentId = String(targetContentVersion['ContentDocumentId']);
                                }
                                if (dataToExport.version.isNewer(targetContentVersion)) {
                                    // The file was modified ****************
                                    // Add this item to the export array ///////////
                                    dataToExport.isVersionChanged = true;
                                }
                            }
                        });
                        if (!found && args.operation != OPERATION.Update) {
                            // File was not found in the Target => Create new file and attach it to the target
                            // Only for upsert / insert, excluded update
                            dataToExport.recordsToBeLinked.push({
                                Id: targetRecord["Id"],
                                sourceDocLink
                            });
                        }
                    }
                }
            });

        });
        dataToExportMap.forEach((dataToExport) => {
            if (!dataToExport.targetVersion) {
                dataToExport.isVersionChanged = true;
            }
        });

        // -----------------------------------------------------------------
        // -----------------------------------------------------------------

        // ---------- Upload -----------------------------------------------
        // -----------------------------------------------------------------
        let versionsToProcess = [...dataToExportMap.values()].filter(exportItem => exportItem.isVersionChanged).map(exportItem => exportItem.version);

        if (versionsToProcess.length > 0) {
            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.ExportFiles_ExportingContentVersions);
            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.RecordsToBeProcessed, String(versionsToProcess.length));

            await this.runtime.transferContentVersions(this, versionsToProcess);

            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.ProcessedRecords,
                String(versionsToProcess.length),
                String(versionsToProcess.filter(item => item.isError).length));
        }
        // -----------------------------------------------------------------
        // -----------------------------------------------------------------


        // -----------Create missing ContentDocumentLinks ---------------------------
        // -----------------------------------------------------------------
        let dataToProcess = [...dataToExportMap.values()].filter(exportItem => exportItem.recordsToBeLinked.length > 0);

        if (dataToProcess.length > 0) {
            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.ExportFiles_ExportingContentDocumentLinks);

            let docLinks = Common.flattenArrays(dataToProcess.map(data => data.recordsToBeLinked.map(record => {
                return {
                    LinkedEntityID: record.Id,
                    ContentDocumentID: data.version.targetContentDocumentId,
                    ShareType: record.sourceDocLink.ShareType,
                    Visibility: record.sourceDocLink.Visibility
                };
            })));

            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.RecordsToBeProcessed, String(docLinks.length));

            let data = await this.runtime.updateTargetRecordsAsync('ContentDocumentLink',
                OPERATION.Insert,
                docLinks,
                API_ENGINE.DEFAULT_ENGINE, true);

            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.ProcessedRecords,
                String(data.length),
                String(data.filter(item => !!item[CONSTANTS.ERRORS_FIELD_NAME]).length));
        }

        if (dataToProcess.length == 0 && versionsToProcess.length == 0) {
            this.runtime.logFormattedInfo(this, SYSTEM_MESSAGES.ExportFiles_NothingToProcess);
        }

        // ------------------------------------------------------------------
        // -----------------------------------------------------------------

        this.runtime.logFinishAddonExecution(this);



        // ---------------- Helper Functions --------------------------- //
        async function ___deleteTargetFiles(docIdsToDelete: Array<string>): Promise<boolean> {
            if (args.deleteOldData || args.operation == OPERATION.Delete) {
                isDeleted = true;
                // -------- //
                if (docIdsToDelete.length > 0) {
                    _self.runtime.logFormattedInfo(_self, SYSTEM_MESSAGES.ExportFiles_DeleteTargetContentDocuments);
                    let data = await _self.runtime.updateTargetRecordsAsync('ContentDocument',
                        OPERATION.Delete,
                        docIdsToDelete.map(item => {
                            return {
                                Id: item
                            };
                        }));
                    _self.runtime.logFormattedInfo(_self, SYSTEM_MESSAGES.ProcessedRecords,
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
    }

}