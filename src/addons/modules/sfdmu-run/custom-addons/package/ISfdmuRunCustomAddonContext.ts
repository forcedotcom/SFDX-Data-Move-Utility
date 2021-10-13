/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


/**
 * The Custom Add-On module runtime context.
 * @export
 * @interface ISfdmuRunCustomAddonContext
 */
export default interface ISfdmuRunCustomAddonContext {

    /**
     * The name of the triggered Add-On event.
     * <br/>
     * @example
     * ```ts
     * async onExecute(context: ISfdmuRunCustomAddonContext, args: any): Promise<ISfdmuRunCustomAddonResult> { 
     *      console.log(context.eventName); // For the BeforeUpdate event, outputs 'onBeforeUpdate'
     * }
     * ``` 
     *
     * @type {string}
     * @memberof ISfdmuRunCustomAddonContext
     */
    eventName: string;


    /**
     * The name of the current Add-On module, including it's type (core or custom)
     * @example ```custom:CustomSfdmuRunAddonTemplate```, ```core:ExportFile```
     * 
     * @type {string}
     * @memberof ISfdmuRunCustomAddonContext
     */
    moduleDisplayName: string;


    /**
     * The Api name of the SF object which is being currently processed by the Plugin.
     * @example ```AccountTeamMember```
     *
     * @type {string}
     * @memberof ISfdmuRunCustomAddonContext
     */
    objectName: string;


    /**
     * The display name of the processed SF object (typically it's the object label).
     * @example ```Account Team Member```
     *
     * @type {string}
     * @memberof ISfdmuRunCustomAddonContext
     */
    objectDisplayName: string;


    /**
     * The description of the current Add-On module.  
     *  Defined in the ```object/[addons]``` section of the Script, as in the example below:
     *  <br/>
     * @example
     * ```json
     *  {      
            "description": "This test AddOn manipulates with the source Json string right before the target update. It extracts the Json value from the LongText__c, then stores the extracted string into the TEST1__c." 
        }
     * ```
     * @see {@link ISfdmuRunCustomAddonModule | See the full example of export.json here}
     * @type {string}
     * @memberof ISfdmuRunCustomAddonContext
     */
    description: string;

}