
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunCustomAddonSFieldDescribe } from ".";


/**
 * Contains necessary information about the records are being processed within the current update step.
 *
 * @export
 * @interface ISfdmuRunCustomAddonProcessedData
 */
export default interface ISfdmuRunCustomAddonProcessedData {

    /**
     * The list of api names of the SF object fields are about to be updated in the Target.
     *
     * @type {Array<string>}
     * @memberof ISfdmuRunCustomAddonProcessedData
     */
    readonly fieldNames: Array<string>;


    /**
     * The records to be updated in the Target.
     *
     * @type {Array<any>}
     * @memberof ISfdmuRunCustomAddonProcessedData
     */
    recordsToUpdate: Array<any>;

    
    
    /**
     * The records to be inserted in the Target. 
     *
     * @type {Array<any>}
     * @memberof ISfdmuRunCustomAddonProcessedData
     */
    recordsToInsert: Array<any>;



    /**
     * The list of descriptions of SF object fields are about to be updated in the Target.
     * The {@link ISfdmuRunCustomAddonProcessedData.fieldNames} property contains only the Api names of the same fields.
     *
     * @type {Array<ISfdmuRunCustomAddonSFieldDescribe>}
     * @memberof ISfdmuRunCustomAddonProcessedData
     */
    fields: Array<ISfdmuRunCustomAddonSFieldDescribe>;

}