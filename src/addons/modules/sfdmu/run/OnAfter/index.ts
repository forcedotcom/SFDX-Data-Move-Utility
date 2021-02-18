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

    async onExecute(context: IPluginExecutionContext, args : any) : Promise<void>  {
        this.runtime.writeStartMessage(this);
       // TODO: Implement the core OnAfter functionality here
       this.runtime.writeFinishMessage(this);
    }

}