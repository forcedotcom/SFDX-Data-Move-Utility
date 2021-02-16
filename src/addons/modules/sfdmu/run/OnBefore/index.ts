/**
 * This module executed BEFORE all objects are executed  
 */
import { IAddonModuleBase, IPluginExecutionContext } from "../../../../components/sharedPackage/commonComponents";
import { ISfdmuRunPluginRuntime } from "../../../../components/sharedPackage/sfdmuRunAddonComponents";

export default class CoreOnBefore implements IAddonModuleBase {

    runtime: ISfdmuRunPluginRuntime;

    constructor(runtime: ISfdmuRunPluginRuntime) {
        this.runtime = runtime;
    }
    
    async onExecute(context: IPluginExecutionContext, args : any) : Promise<void>  {
        // TODO: Implement the core OnBefore functionality here     
    }

}