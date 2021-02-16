/**
 * This module implements the Salesforce Files export.
 * It can be included with any object within the export.json file. 
 */
import { RESOURCES } from "../../../../../modules/components/common_components/logger";
import { IAddonModuleBase, IPluginExecutionContext, OPERATION } from "../../../../components/shared_packages/commonComponents";
import { ISfdmuRunPluginRuntime } from "../../../../components/shared_packages/sfdmuRunAddonComponents";

interface IOnExecuteArguments {
    deleteOldData: boolean;
    operation: OPERATION;
}

export default class ExportFiles implements IAddonModuleBase {

    runtime: ISfdmuRunPluginRuntime;

    constructor(runtime: ISfdmuRunPluginRuntime) {
        this.runtime = runtime;
    }

    async onExecute(context: IPluginExecutionContext, args: IOnExecuteArguments): Promise<void> {

        this.runtime.writeLogConsoleMessage(RESOURCES.executingAddon.toString(), "INFO", context.objectName, "ExportFiles");

        // Get the relevant parent task
        let task = this.runtime.pluginJob.tasks.find(task => task.sObjectName == context.objectName);
        args.operation = !args.operation ? task.operation : OPERATION[args.operation.toString()];

        if (!task) {
            return;
        }

        // Delete old target Files ---------------------
        // ---------------------------------------------
        if (args.deleteOldData || args.operation == OPERATION.Delete) {


        }

        if (args.operation == OPERATION.Delete){
            return;
        }


        // Export new Files ----------------------------
        // ---------------------------------------------
        // Query for the ContentDocumentLink records associated







    }

}