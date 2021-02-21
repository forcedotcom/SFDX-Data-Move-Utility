/**
 * This module implements the Salesforce Files export.
 * It can be included with any object within the export.json file. 
 */



import { Common } from "../../../../modules/components/common_components/common";
import AddonModuleBase from "../../../package/base/AddonModuleBase";
import { OPERATION } from "../../../package/base/enumerations";
import IPluginExecutionContext from "../../../package/base/IPluginExecutionContext";
import { ISfdmuRunPluginRuntime } from "../../../package/modules/sfdmu-run";


interface IOnExecuteArguments {
    deleteOldData: boolean;
    operation: OPERATION;
    contentDocumentExternalId: string;
}

interface IDataToImport {
    recIdToDocLinks: Map<string, Array<any>>;
    docIds: Array<string>;
    recordIds: Array<string>;
    docIdToDocVersion: Map<string, any>;
}

interface IDataToExport {
    /**
     * The source content version 
     * to update the target content document version
     * (including VersionData as Blob)
     *
     * @type {*}
     * @memberof IExportData
     */
    sourceContentVersion: any; // only once => to update

    /**
    * true if the blob data is already downloaded for this version
    * (the VersionData field contains base64 file data instead of the link to the content version
    * retireved by the initial query)
    *
    * @type {boolean}
    * @memberof IExportData
    */
    blobIsDownloaded: boolean;

    /**
     * true if this version is already uploaded to the target
     *
     * @type {boolean}
     * @memberof IExportData
     */
    versionIsUploaded: boolean;

    /**
     * All ONLY NEW target records need to attach this record to, 
     * need to create new content link records.
     * No records if only need to update the content version data.
     * Once the ContentDocumentLink is created the entry is removed from this array
     * until it will be empty.
     *
     * @type {string[]}
     * @memberof IExportData
     */
    targetRecordIds: string[];

    /**
     * The target content document 
     * to update the version from the source content version
     */
    targetDocId: string;

    /**
     * true when need to insert/update the target content version 
     *
     * @type {boolean}
     * @memberof IDataToExport
     */
    mustUpdateContentVersion: boolean;
}

export default class ExportFiles extends AddonModuleBase {

    get displayName(): string {
        return "core:ExportFiles";
    }

    runtime: ISfdmuRunPluginRuntime;

    async onExecute(context: IPluginExecutionContext, args: IOnExecuteArguments): Promise<void> {

        this.runtime.writeStartMessage(this);

        if (this.runtime.getOrgInfo(false).isFile) {
            // File target -> error
            this.runtime.writeFinishMessage(this);
            return;
        }

        // Get the relevant parent task
        let task = this.runtime.pluginJob.tasks.find(task => task.sObjectName == context.objectName);

        // Set default parameters
        args.operation = !args.operation ? task.operation : OPERATION[args.operation.toString()];
        args.contentDocumentExternalId = args.contentDocumentExternalId || 'Title';

        if (!task) {
            // No task -> error
            this.runtime.writeFinishMessage(this);
            return;
        }

        if (args.operation == OPERATION.Readonly) {
            // Readonly -> error
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
                let queries = this.runtime.createFieldInQueries(
                    ['Id', 'LinkedEntityId', 'ContentDocumentId', 'ShareType', 'Visibility'],
                    'LinkedEntityId',
                    'ContentDocumentLink',
                    target.recordIds);

                let data = await this.runtime.queryMultiAsync(false, queries);
                target.recIdToDocLinks = Common.arrayToMapMulti(data, ['LinkedEntityId']);
                target.docIds = Common.distinctStringArray(Common.arrayToPropsArray(data, ['ContentDocumentId']));
            }
        }

        // Delete old target files       
        if (args.deleteOldData || args.operation == OPERATION.Delete) {
            if (target.docIds.length > 0) {
                await this.runtime.updateTargetRecordsAsync('ContentDocument',
                    OPERATION.Delete,
                    target.docIds);
            }
            if (args.operation == OPERATION.Delete) {
                // Only delete -> exit
                return;
            }
            args.operation = OPERATION.Insert;
        }

        if (source.recordIds.length == 0) {
            // No source records -> exit
            return;
        }

        // Read target ContentVersions       
        if (args.operation != OPERATION.Insert && target.docIds.length > 0) {
            let fields = Common.distinctStringArray([
                'Id', args.contentDocumentExternalId, 'ContentDocumentId',
                'ContentModifiedDate'
            ]);

            let queries = this.runtime.createFieldInQueries(
                fields,
                'ContentDocumentId',
                'ContentVersion',
                target.docIds,
                'IsLatest = true');

            let data = await this.runtime.queryMultiAsync(false, queries);
            target.docIdToDocVersion = Common.arrayToMap(data, ['ContentDocumentId']);

        }
        // -----------------------------------------------------------
        // -----------------------------------------------------------


        // ------ Read Source ----------------------------------------
        // -----------------------------------------------------------
        // Read source ContentDocumentLinks
        {
            let queries = this.runtime.createFieldInQueries(
                ['Id', 'LinkedEntityId', 'ContentDocumentId', 'ShareType', 'Visibility'],
                'LinkedEntityId',
                'ContentDocumentLink',
                [...task.sourceTaskData.idRecordsMap.keys()]);

            let data = await this.runtime.queryMultiAsync(true, queries);
            source.recIdToDocLinks = Common.arrayToMapMulti(data, ['LinkedEntityId']);
            source.docIds = Common.distinctStringArray(Common.arrayToPropsArray(data, ['ContentDocumentId']));
        }


        // Read source ContentVersions 
        if (source.docIds.length > 0) {

            let fields = Common.distinctStringArray([
                'Id', args.contentDocumentExternalId, 'ContentDocumentId',
                'Title', 'Description', 'PathOnClient', 'VersionData', 'ContentModifiedDate'
            ]);

            let queries = this.runtime.createFieldInQueries(
                fields,
                'ContentDocumentId',
                'ContentVersion',
                source.docIds,
                'IsLatest = true');

            let data = await this.runtime.queryMultiAsync(true, queries);
            source.docIdToDocVersion = Common.arrayToMap(data, ['ContentDocumentId']);

        }

        // ---------- Compare versions to detect changes -------------------
        // ----------- which files need to download and upload--------------
        // -----------------------------------------------------------------
        source.recIdToDocLinks.forEach((sourceDocLinks, recordId) => {
            sourceDocLinks.forEach(sourceDocLink => {
                let sourceContentVersion = source.docIdToDocVersion.get(sourceDocLink["ContentDocumentId"]);
                if (sourceContentVersion) {
                    let targetRecord = task.sourceToTargetRecordMap.get(task.sourceTaskData.idRecordsMap.get(recordId));
                    if (!dataToExportMap.has(sourceContentVersion)) {
                        dataToExportMap.set(sourceContentVersion, <IDataToExport>{
                            blobIsDownloaded: false,
                            versionIsUploaded: false,
                            sourceContentVersion,
                            targetDocId: null,
                            targetRecordIds: [],
                            mustUpdateContentVersion: false
                        });
                    }
                    let dataToExport = dataToExportMap.get(sourceContentVersion);
                    if (targetRecord) {
                        let targetDocLinks = target.recIdToDocLinks.get(targetRecord["Id"]);
                        let found = false;
                        // File exists => check for the modifycation ******
                        targetDocLinks.forEach(targetDocLink => {
                            let targetContentVersion = target.docIdToDocVersion.get(targetDocLink["ContentDocumentId"]);
                            if (sourceContentVersion[args.contentDocumentExternalId] == targetContentVersion[args.contentDocumentExternalId]) {
                                // This the same file source <=> target
                                found = true;
                                if (!dataToExport.targetDocId) {
                                    dataToExport.targetDocId = String(targetContentVersion['ContentDocumentId']);
                                }
                                let sourceDate = new Date(String(sourceContentVersion['ContentModifiedDate']));
                                let targetDate = new Date(String(targetContentVersion['ContentModifiedDate']));
                                if (sourceDate > targetDate) {
                                    // The file was modified ****************
                                    // Add this item to the export array ///////////
                                    dataToExport.mustUpdateContentVersion = true;
                                }
                            }
                        });
                        if (!found) {
                            // File was not found in the Target => Create new file and attach it to the target
                            dataToExport.targetRecordIds.push(targetRecord["Id"]);
                            dataToExport.mustUpdateContentVersion = true;
                            dataToExport.targetDocId = null;
                        }
                    }
                }
            });

        });
        // -----------------------------------------------------------------
        // -----------------------------------------------------------------



        // ---------- Process data -----------------------------------------
        // -----------Download ---------------------------------------------

        // -----------------------------------------------------------------



        // -----------Upload -----------------------------------------------

        // -----------------------------------------------------------------



        // -----------Create ContentDocumentLinks ---------------------------

        // ------------------------------------------------------------------

        this.runtime.writeFinishMessage(this);



    }

}