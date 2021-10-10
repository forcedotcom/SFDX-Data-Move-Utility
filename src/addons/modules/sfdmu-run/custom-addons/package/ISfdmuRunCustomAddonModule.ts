/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunCustomAddonContext, ISfdmuRunCustomAddonRuntime } from ".";


/**
 * The interface to be implemented in every custom Sfdmu Add-On module.
 * @example
 * Below is the example of the export.json file to run custom Add-On module by triggering ```beforeUpdate``` event :
 * <br/>
 * <br/>
     * ```json
     * {
            "objects": [
                {
                    "operation": "Upsert",
                    "externalId": "Name",
                    "deleteOldData" : true,
                    "query": "SELECT Id, Name, LongText__c, TEST__c, TEST1__c  FROM Account WHERE Name = 'ACC_10000'",			
                    "beforeUpdateAddons" : [
                        {
                                "description": "This test AddOn manipulates with the source Json string right before the target update. It extracts the Json value from the LongText__c, then stores the extracted string into the TEST1__c.",
                                "path" : "MY-CUSTOM-ADDONS-ABSOLUTE-LOCAL-DIRECTORY-PATH\\CustomSfdmuRunAddonTemplate",				
                                "args" : {
                                    "TEST__c": "Another manipulation with the data: putting this text to the field TEST__c of each record being processed"
                                }
                        }
                    ] 
                }
            ]
        }
     * ```
 * @export
 * @interface ISfdmuRunCustomAddonModule
 */
export default interface ISfdmuRunCustomAddonModule {


    /**
     * The instance of the Add-On runtime.
     * <br/>
     * Uses the public property {@link ISfdmuRunCustomAddonRuntime.service} 
     * to share the Add-On Api with the module instance. 
     *
     * @type {ISfdmuRunCustomAddonRuntime}
     * @memberof ISfdmuRunCustomAddonModule
     *  
     */
    runtime: ISfdmuRunCustomAddonRuntime;



    /**
     * The entry point to run the Add-On module when Add-On event is executed (for example, the 'beforeUpdate' event).  
     *
     * @param {ISfdmuRunCustomAddonContext} context The current Add-On runtime context.
     * @param {*} args The JS object passed into the function from the ```arg``` property defined in the ```object/[addons]``` section.  
     * <br/>
     * <br/>
     * By the the below portion of json, the parameter ```args``` will be assigned to the following JS object 
     * ```{ TEST__c : "Another test, assigning this text to the field TEST__c of each record being processed" }``` :
     * <br/>
     * ```json
     * "args" : {
            "TEST__c": "Another test, assigning this text to the field TEST__c of each record being processed"
        }
     * ```
     * @memberof ISfdmuRunCustomAddonModule
     */
    onExecute(context: ISfdmuRunCustomAddonContext, args: any): Promise<void>;

}