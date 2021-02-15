/**
 * This module implements the Salesforce Files export.
 * It can be included with any object within the export.json file. 
 */
import { IAddonModuleBase, IPluginExecutionContext, OPERATION } from "../../../../../modules/models/addons_models/addonSharedPackage";
import { ISfdmuRunPluginRuntime } from "../../../../../modules/models/addons_models/sfdmuRunAddonSharedPackage";

interface IExecuteArguments {
    deleteOldData: boolean;
    operation: OPERATION;
}

export default class ExportFiles implements IAddonModuleBase {

    runtime: ISfdmuRunPluginRuntime;

    constructor(runtime: ISfdmuRunPluginRuntime) {
        this.runtime = runtime;
    }

    async onExecute(context: IPluginExecutionContext, args: IExecuteArguments): Promise<void> {

        // Get the relevant parent task
        let task = this.runtime.pluginJob.tasks.find(task => task.sObjectName == context.objectName);
        args.operation = !args.operation ? task.operation : OPERATION[args.operation.toString()];

        if (!task) {
            return;
        }

        // Delete old target Files
        if (args.deleteOldData) {

        }

        // Move new files 
        // Query for the ContentDocumentLink records associated







    }

}