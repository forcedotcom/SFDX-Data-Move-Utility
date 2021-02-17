/**
 * This module executed BEFORE all objects are executed  
 */
import { AddonModuleBase, IPluginExecutionContext, OPERATION } from "../../../../components/shared_packages/commonComponents";
import { ISfdmuRunPluginRuntime } from "../../../../components/shared_packages/sfdmuRunAddonComponents";

export default class CoreOnBefore extends AddonModuleBase {

    get displayName(): string {        
        return "core:OnBefore";
    }

    runtime: ISfdmuRunPluginRuntime;

    constructor(runtime: ISfdmuRunPluginRuntime) {
        super();
        this.runtime = runtime;
    }
    
    async onExecute(context: IPluginExecutionContext, args : any) : Promise<void>  {
        // TODO: Implement the core OnBefore functionality here   

        this.runtime.writeStartMessage(this);
        
        let records2 = [{
            Id: null,           
            Origin: "Phone"
        }];

        let output2 = await this.runtime.updateTargetRecordsAsync("Case", OPERATION.Insert, records2);
        console.log(output2);
    }

}