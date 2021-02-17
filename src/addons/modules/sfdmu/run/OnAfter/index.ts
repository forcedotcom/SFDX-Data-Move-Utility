/**
 * This module executed AFTER all objects are executed  
 */
import { AddonModuleBase, IPluginExecutionContext } from "../../../../components/shared_packages/commonComponents";
import { ISfdmuRunPluginRuntime } from "../../../../components/shared_packages/sfdmuRunAddonComponents";


export default class CoreOnAfter extends AddonModuleBase {

    get displayName(): string {
        return "core:OnAfter";
    }

    runtime: ISfdmuRunPluginRuntime;

    constructor(runtime: ISfdmuRunPluginRuntime) {
        super();
        this.runtime = runtime;
    }
    
    async onExecute(context: IPluginExecutionContext, args : any) : Promise<void>  {
       // TODO: Implement the core OnAfter functionality here
    }

}