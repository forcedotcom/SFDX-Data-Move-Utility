/**
 * This module executed AFTER all objects are executed  
 */
import { IAddonModule, IPluginExecutionContext, IPluginRuntime } from "../../../../../modules/models/addons_models/addonSharedPackage";


export default class CoreOnAfter implements IAddonModule {

    runtime: IPluginRuntime;

    constructor(runtime: IPluginRuntime) {
        this.runtime = runtime;
    }
    
    async onExecute(context: IPluginExecutionContext, args : any) : Promise<void>  {
       // TODO: Implement the core OnAfter functionality here
    }

}