/**
 * This module executed BEFORE all objects are executed  
 */
import AddonModuleBase from "../../../../package/base/AddonModuleBase";
import { OPERATION } from "../../../../package/base/enumerations";
import IPluginExecutionContext from "../../../../package/base/IPluginExecutionContext";
import { ISfdmuRunPluginRuntime } from "../../../../package/modules/sfdmuRun";

export default class CoreOnBefore extends AddonModuleBase {

    get displayName(): string {        
        return "core:OnBefore";
    }

    runtime: ISfdmuRunPluginRuntime;
  
    async onExecute(context: IPluginExecutionContext, args : any) : Promise<void>  {
        // TODO: Implement the core OnBefore functionality here   

        this.runtime.writeStartMessage(this);
        
        let records2 = [{
            Id: null,           
            Origin: "Phone"
        }];

        let output2 = await this.runtime.updateTargetRecordsAsync("Case", OPERATION.Insert, records2);
        console.log(output2);

        this.runtime.writeFinishMessage(this);
    }

}