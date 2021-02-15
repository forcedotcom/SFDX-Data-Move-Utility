/**
 * This module implements the Salesforce Files export.
 * It can be included with any object within the export.json file. 
 */
import { IAddonModule, IPluginExecutionContext, IPluginRuntime } from "../../../../../modules/models/addons_models/addonSharedPackage";

interface IExecuteArguments {
    removeOldFiles: boolean;
}

export default class ExportFiles implements IAddonModule {

    runtime: IPluginRuntime;

    constructor(runtime: IPluginRuntime) {
        this.runtime = runtime;
    }

    async onExecute(context: IPluginExecutionContext, args: IExecuteArguments): Promise<void> {

        // Get the relevant parent task
        let task = this.runtime.pluginJob.tasks.find(task => task.sObjectName == context.objectName);

        if (!task) {
            return;
        }

        // Delete old target Files
        if (args.removeOldFiles) {

        }

        // Move new files 
        // Query for the ContentDocumentLink records associated







    }

}