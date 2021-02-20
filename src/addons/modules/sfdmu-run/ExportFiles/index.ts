/**
 * This module implements the Salesforce Files export.
 * It can be included with any object within the export.json file. 
 */


import AddonModuleBase from "../../../package/base/AddonModuleBase";
import { OPERATION } from "../../../package/base/enumerations";
import IPluginExecutionContext from "../../../package/base/IPluginExecutionContext";
import { ISfdmuRunPluginRuntime } from "../../../package/modules/sfdmu-run";


interface IOnExecuteArguments {
    deleteOldData: boolean;
    operation: OPERATION;
    contentDocumentExternalId: string;
}

export default class ExportFiles extends AddonModuleBase {

    get displayName(): string {
        return "core:ExportFiles";
    }

    runtime: ISfdmuRunPluginRuntime;

    async onExecute(context: IPluginExecutionContext, args: IOnExecuteArguments): Promise<void> {

        this.runtime.writeStartMessage(this);

        if (this.runtime.getOrgInfo(false).isFile) {
            // File target - error
            this.runtime.writeFinishMessage(this);
            return;
        }

        // Get the relevant parent task
        let task = this.runtime.pluginJob.tasks.find(task => task.sObjectName == context.objectName);

        // Set default parameters
        args.operation = !args.operation ? task.operation : OPERATION[args.operation.toString()];
        args.contentDocumentExternalId = args.contentDocumentExternalId || 'Title';

        if (!task) {
            // No task - error
            this.runtime.writeFinishMessage(this);
            return;
        }

        if (args.operation == OPERATION.Readonly) {
            // Readonly - error
            this.runtime.writeFinishMessage(this);
            return;
        }


        let targetContentDocuments = [];
        let targetContentDocumentLinks = [];
        let targetKeys = [...task.targetTaskData.idRecordsMap.keys()];
        let targetContentDocumentIds = [];

        // Read  target ContentDocumentLinks
        if (args.operation == OPERATION.Update || args.operation == OPERATION.Upsert) {
            let queries = this.runtime.createFieldInQueries(
                ['Id', 'LinkedEntityId', 'ContentDocumentId'],
                'LinkedEntityId',
                'ContentDocumentLink',
                targetKeys);

            targetContentDocumentLinks = await this.runtime.queryMultiAsync(false, queries);
        }

        // Delete old target files
        if (args.deleteOldData || args.operation == OPERATION.Delete) {
            if (targetContentDocumentLinks.length > 0) {
                targetContentDocumentIds = [...new Set<string>(targetContentDocumentLinks.map(record => String(record['ContentDocumentId'])))];
                await this.runtime.updateTargetRecordsAsync('ContentDocument',
                    OPERATION.Delete,
                    targetContentDocumentIds);
            }
            if (args.operation == OPERATION.Delete) {
                return;
            }
            args.operation = OPERATION.Insert;
        }

        // Read target ContentDocuments
        if (args.operation != OPERATION.Insert) {
            
        }






        // Export new Files ----------------------------
        // ---------------------------------------------
        // Query for the ContentDocumentLink records associated

        // TEST:
        // let records = await this.runtime.queryAsync(false, "SELECT Id, Name FROM Account LIMIT 1");
        // let ids = records.map(record => record["Id"]);
        // let query = this.runtime.createFieldInQueries(["Id", "Name"], "Id", "Account", ids);
        // query[0] = query[0].replace("IN", "NOT IN") + " LIMIT 1";
        // records = records.concat(await this.runtime.queryMultiAsync(false, query));
        // let output = await this.runtime.updateTargetRecordsAsync("Account", OPERATION.Delete, records);
        // console.log(output);

        // let records2 = [{           
        //     Origin: "Phone"
        // }];

        // let output2 = await this.runtime.updateTargetRecordsAsync("Case", OPERATION.Insert, records2);




        this.runtime.writeFinishMessage(this);



    }

}