/**
 * This module implements the Salesforce Files export.
 * It can be included with any object within the export.json file. 
 */
import { IAddonModule, IPluginExecutionContext, IPluginRuntime } from "../../../../../modules/models/addons_models/addonSharedPackage";


export default class ExportFiles implements IAddonModule {

    runtime: IPluginRuntime;

    constructor(runtime: IPluginRuntime) {
        this.runtime = runtime;
    }
    
    async onExecute(context: IPluginExecutionContext, args : any) : Promise<void>  {
       // TODO: Implement the core ExportFiles functionality here
    }

}