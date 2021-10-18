/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunCustomAddonContext, ISfdmuRunCustomAddonResult, ISfdmuRunCustomAddonRuntime } from ".";


/**
 * The base interface to be implemented in every custom Sfdmu Add-On module.
 * @export
 * @interface ISfdmuRunCustomAddonModule
 */
export default interface ISfdmuRunCustomAddonModule {


    /**
     * The instance of the Custom Add-On module runtime.
     * <br/>
     * Uses the public property {@link ISfdmuRunCustomAddonRuntime.service} 
     * to share the Custom Add-On module Api with the current module instance. 
     *
     * @type {ISfdmuRunCustomAddonRuntime}
     * @memberof ISfdmuRunCustomAddonModule
     *  
     */
    runtime: ISfdmuRunCustomAddonRuntime;



    /**
     * The entry point which is executed by the Plugin when the Add-On event is triggered.  
     *
     * @param {ISfdmuRunCustomAddonContext} context The current Add-On runtime context.
     * @param {*} args The JS object passed into the function from the ```arg``` property 
     *                  defined in the ```object/[addons]``` section of the Script.  
     * <br/>
     * <br/>
     * For example, the portion of the json as below:
     * <br/>
     * ```json
     * "args" : {
            "TEST__c": "Another test, assigning this text to the field TEST__c of each record being processed"
        }
     * ```
        Will pass to the method the following args:
        ```ts
            args = { 
                TEST__c : "Another test, assigning this text to the field TEST__c of each record being processed" 
            }
        ```
     * @return {Promise<ISfdmuRunCustomAddonResult>}
     * @memberof ISfdmuRunCustomAddonModule
     */
    onExecute(context: ISfdmuRunCustomAddonContext, args: any): Promise<ISfdmuRunCustomAddonResult>;

}