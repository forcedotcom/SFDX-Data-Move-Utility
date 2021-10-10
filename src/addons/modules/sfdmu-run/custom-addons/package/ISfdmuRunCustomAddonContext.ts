/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


/**
 * The Custom Add-On module runtime context.
 * Exposes the information about the current runtime context, 
 * including information about the running Sfdmu plugin and the triggered Add-On event.
 *
 * @export
 * @interface ISfdmuRunCustomAddonContext
 */
export default interface ISfdmuRunCustomAddonContext {

    /**
     * The name of the triggered Add-On event.
     * @example ```CustomSfdmuRunAddonTemplate```
     *
     * @type {string}
     * @memberof ISfdmuRunCustomAddonContext
     */
    eventName: string;

    /**
     * The full name of the current Add-On module.
     * @example ```custom:CustomSfdmuRunAddonTemplate```
     * 
     * @type {string}
     * @memberof ISfdmuRunCustomAddonContext
     */
    moduleDisplayName: string;

    /**
     * The Api name of the SF object being currently processed.
     * @example ```AccountTeamMember```
     *
     * @type {string}
     * @memberof ISfdmuRunCustomAddonContext
     */
    objectName: string;


    /**
     * The user-friendly name of the SF object being currently processed
     * (typically it's the object label).
     * @example ```Account Team Member```
     *
     * @type {string}
     * @memberof ISfdmuRunCustomAddonContext
     */
    objectDisplayName: string;


    /**
     * The description of the current Add-On module.  
     *  Defined in the Script file within Add-On event declaration, as in the example below:
     *  <br/>
     * ```json
     *  {      
            "description": "This test AddOn manipulates with the source Json string right before the target update. It extracts the Json value from the LongText__c, then stores the extracted string into the TEST1__c." 
        }
     * ```
     * @see {@link ISfdmuRunCustomAddonModule | The the full export.json here}
     * @type {string}
     * @memberof ISfdmuRunCustomAddonContext
     */
    description: string;

}