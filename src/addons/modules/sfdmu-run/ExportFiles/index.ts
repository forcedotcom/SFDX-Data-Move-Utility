/**
 * This module implements the Salesforce Files export.
 * It can be included with any object within the export.json file. 
 */




import { Common } from "../../../../modules/components/common_components/common";
import { CONSTANTS } from "../../../../modules/components/common_components/statics";
import { CORE_MESSAGES } from "../../../engine/messages/core";
import SfdmuContentVersion from "../../../engine/sfdmu-run/sfdmuContentVersion";
import SfdmuRunAddonBase from "../../../engine/sfdmu-run/sfdmuRunAddonBase";
import { API_ENGINE, OPERATION } from "../../../package/base/enumerations";
import IPluginExecutionContext from "../../../package/base/IPluginExecutionContext";



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
    recordsToBeLinked: ILinkedRecord[];
    isVersionChanged: boolean;
}

export default class ExportFiles extends SfdmuRunAddonBase {

    async onExecute(context: IPluginExecutionContext, args: IOnExecuteArguments): Promise<void> {

        this.runtime.writeStartMessage(this);

        this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.Preparing);


        if (this.runtime.getOrgInfo(false).isFile) {
            // File target -> error
            this.systemRuntime.$$writeCoreWarningMessage(this, CORE_MESSAGES.ExportFiles_TargetIsFileWarning);
            this.runtime.writeFinishMessage(this);
            return;
        }


        // Get the relevant parent task
        let task = this.runtime.pluginJob.tasks.find(task => task.sObjectName == context.objectName);

        // Set default parameters
        args.operation = !args.operation ? task.operation : OPERATION[args.operation.toString()];
        args.externalId = args.externalId || 'Title';

        if (!task) {
            // No task -> error
            this.systemRuntime.$$writeCoreWarningMessage(this, CORE_MESSAGES.ExportFiles_CouldNotFindObjectToProcessWarning);
            this.runtime.writeFinishMessage(this);
            return;
        }

        if (args.operation == OPERATION.Readonly) {
            // Readonly -> error
            this.systemRuntime.$$writeCoreWarningMessage(this, CORE_MESSAGES.ExportFiles_ReadonlyOperationWarning);
            this.runtime.writeFinishMessage(this);
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
        if (args.operation == OPERATION.Update || args.operation == OPERATION.Upsert) {
            if (target.recordIds.length > 0) {
                this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.ExportFiles_ReadTargetContentDocumentLinks);
                let queries = this.runtime.createFieldInQueries(
                    ['Id', 'LinkedEntityId', 'ContentDocumentId', 'ShareType', 'Visibility'],
                    'LinkedEntityId',
                    'ContentDocumentLink',
                    target.recordIds);

                let data = await this.runtime.queryMultiAsync(false, queries);
                target.recIdToDocLinks = Common.arrayToMapMulti(data, ['LinkedEntityId']);
                target.docIds = Common.distinctStringArray(Common.arrayToPropsArray(data, ['ContentDocumentId']));
                this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.RetrievedRecords, String(data.length));
            }
        }

        // Delete old target files          
        if (args.deleteOldData || args.operation == OPERATION.Delete) {
            if (target.docIds.length > 0) {
                this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.ExportFiles_DeleteTargetContentDocuments);
                let data = await this.runtime.updateTargetRecordsAsync('ContentDocument',
                    OPERATION.Delete,
                    target.docIds.map(item => {
                        return {
                            Id: item
                        };
                    }));
                this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.ProcessedRecords,
                    String(data.length),
                    String(data.filter(item => !!item[CONSTANTS.ERRORS_FIELD_NAME]).length));
            }
            if (args.operation == OPERATION.Delete) {
                // Only delete -> exit
                return;
            }
            args.operation = OPERATION.Insert;
        }

        if (source.recordIds.length == 0) {
            // No source records -> exit
            this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.ExportFiles_NoSourceRecords);
            return;
        }

        // Read target ContentVersions 
        if (args.operation != OPERATION.Insert && target.docIds.length > 0) {

            this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.ExportFiles_ReadTargetContentVersions);

            let fields = Common.distinctStringArray([
                'Id', args.externalId, 'ContentDocumentId',
                'ContentModifiedDate'
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

            this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.RetrievedRecords, String(data.length));

        }
        // -----------------------------------------------------------
        // -----------------------------------------------------------


        // ------ Read Source ----------------------------------------
        // -----------------------------------------------------------
        // Read source ContentDocumentLinks
        {
            this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.ExportFiles_ReadSourceContentDocumentLinks);
            let queries = this.runtime.createFieldInQueries(
                ['Id', 'LinkedEntityId', 'ContentDocumentId', 'ShareType', 'Visibility'],
                'LinkedEntityId',
                'ContentDocumentLink',
                [...task.sourceTaskData.idRecordsMap.keys()]);

            let data = await this.runtime.queryMultiAsync(true, queries);
            source.recIdToDocLinks = Common.arrayToMapMulti(data, ['LinkedEntityId']);
            source.docIds = Common.distinctStringArray(Common.arrayToPropsArray(data, ['ContentDocumentId']));

            this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.RetrievedRecords, String(data.length));
        }


        // Read source ContentVersions 
        if (source.docIds.length > 0) {
            this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.ExportFiles_ReadSourceContentVersions);
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

            this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.RetrievedRecords, String(data.length));

        }

        // ---------- Compare versions to detect changes -------------------
        // ----------- which files need to download and upload--------------
        // -----------------------------------------------------------------
        this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.Analysing);

        source.recIdToDocLinks.forEach((sourceDocLinks, recordId) => {
            sourceDocLinks.forEach(sourceDocLink => {
                let sourceContentVersion = source.docIdToDocVersion.get(sourceDocLink["ContentDocumentId"]);
                if (sourceContentVersion) {
                    let targetRecord = task.sourceToTargetRecordMap.get(task.sourceTaskData.idRecordsMap.get(recordId));
                    if (!dataToExportMap.has(sourceContentVersion)) {
                        dataToExportMap.set(sourceContentVersion, {
                            version: new SfdmuContentVersion(sourceContentVersion),
                            recordsToBeLinked: new Array<ILinkedRecord>(),
                            isVersionChanged: false
                        });
                    }
                    let dataToExport = dataToExportMap.get(sourceContentVersion);
                    if (targetRecord) {
                        let targetDocLinks = target.recIdToDocLinks.get(targetRecord["Id"]);
                        let found = false;
                        // File exists => check for the modifycation ******
                        (targetDocLinks || []).forEach(targetDocLink => {
                            let targetContentVersion = new SfdmuContentVersion(target.docIdToDocVersion.get(targetDocLink["ContentDocumentId"]));
                            if (dataToExport.version[args.externalId] == targetContentVersion[args.externalId]) {
                                // This the same file source <=> target
                                found = true;
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
                            dataToExport.isVersionChanged = true;
                        }
                    }
                }
            });

        });
        // -----------------------------------------------------------------
        // -----------------------------------------------------------------

        // ---------- Upload -----------------------------------------------
        // -----------------------------------------------------------------
        let versionsToProcess = [...dataToExportMap.values()].filter(exportItem => exportItem.isVersionChanged).map(exportItem => exportItem.version);

        if (versionsToProcess.length > 0) {
            this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.ExportFiles_ExportingContentVersions);
            this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.RecordsToBeProcessed, String(versionsToProcess.length));

            await this.runtime.transferContentVersions(this, versionsToProcess);

            this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.ProcessedRecords,
                String(versionsToProcess.length),
                String(versionsToProcess.filter(item => item.isError).length));
        }
        // -----------------------------------------------------------------
        // -----------------------------------------------------------------


        // -----------Create missing ContentDocumentLinks ---------------------------
        // -----------------------------------------------------------------
        let dataToProcess = [...dataToExportMap.values()].filter(exportItem => exportItem.recordsToBeLinked.length > 0);

        if (dataToProcess.length > 0) {
            this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.ExportFiles_ExportingContentDocumentLinks);

            let docLinks = Common.flattenArrays(dataToProcess.map(data => data.recordsToBeLinked.map(record => {
                return {
                    LinkedEntityID: record.Id,
                    ContentDocumentID: data.version.targetContentDocumentId,
                    ShareType: record.sourceDocLink.ShareType,
                    Visibility: record.sourceDocLink.Visibility
                };
            })));

            this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.RecordsToBeProcessed, String(docLinks.length));

            let data = await this.runtime.updateTargetRecordsAsync('ContentDocumentLink',
                OPERATION.Insert,
                docLinks,
                API_ENGINE.DEFAULT_ENGINE, true);

            this.systemRuntime.$$writeCoreInfoMessage(this, CORE_MESSAGES.ProcessedRecords,
                String(data.length),
                String(data.filter(item => !!item[CONSTANTS.ERRORS_FIELD_NAME]).length));
        }

        // ------------------------------------------------------------------
        // -----------------------------------------------------------------

        this.runtime.writeFinishMessage(this);



    }

}