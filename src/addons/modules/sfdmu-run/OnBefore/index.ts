/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * This module executed BEFORE all objects are executed  
 */
import AddonModuleBase from "../../../package/base/addonModuleBase";
import IPluginExecutionContext from "../../../package/base/IPluginExecutionContext";
import { ISfdmuRunPluginRuntime } from "../../../package/modules/sfdmu-run";


export default class CoreOnBefore extends AddonModuleBase {

    get displayName(): string {        
        return "core:OnBefore";
    }

    runtime: ISfdmuRunPluginRuntime;
  
    async onExecute(context: IPluginExecutionContext, args : any) : Promise<void>  {
        // TODO: Implement the core OnBefore functionality here   

        this.runtime.writeStartMessage(this);
        
        // let records2 = [{
        //     Id: null,           
        //     Origin: "Phone"
        // }];

        // let output2 = await this.runtime.updateTargetRecordsAsync("Case", OPERATION.Insert, records2);
        // console.log(output2);

        // let w = "ContentDocumentId = 'XXX'";
        //     let queries = this.runtime.createFieldInQueries(
        //                                 ['Id', 'LinkedEntityId', 'ContentDocumentId'],
        //                                 'LinkedEntityId', 'ContentDocumentLink',
        //                                 ['1','2'], w);

        this.runtime.writeFinishMessage(this);
    }

}