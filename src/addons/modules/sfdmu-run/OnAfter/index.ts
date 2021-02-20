/**
 * This module executed AFTER all objects are executed  
 */

import AddonModuleBase from "../../../package/base/AddonModuleBase";
import IPluginExecutionContext from "../../../package/base/IPluginExecutionContext";
import { ISfdmuRunPluginRuntime } from "../../../package/modules/sfdmu-run";



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