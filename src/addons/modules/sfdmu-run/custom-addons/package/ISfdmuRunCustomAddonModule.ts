/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunCustomAddonContext, ISfdmuRunCustomAddonRuntime } from ".";


/**
 * The base interface to be implementted in every custom sfdmu Add-On module
 * @example Below is the example of the Script file to execute custom Add-On module using triggered ```beforeUpdate``` event :
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
                                "startupMessage": "Welcome to the custom SFDMU AddOn module !",
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
     * Provides the Add-On runtime functionality
     *
     * @type {ISfdmuRunCustomAddonRuntime}
     * @memberof ISfdmuRunCustomAddonModule
     *  
     */
    runtime: ISfdmuRunCustomAddonRuntime;



    /**
     * The Add-On entry point which executed when the Sfdmu Plugin
     * is triggering a runtime Add-On event (for example 'beforeUpdate').  
     *
     * @param {ISfdmuRunCustomAddonContext} context The current Add-On runtime context. Also can be accessed via ```this.context```.
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
    onExecute(context: ISfdmuRunCustomAddonContext, args: any): void;

}