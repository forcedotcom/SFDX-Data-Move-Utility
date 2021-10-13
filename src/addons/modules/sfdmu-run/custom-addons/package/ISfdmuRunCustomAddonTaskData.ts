/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DATA_MEDIA_TYPE } from ".";


/**
 * The data associated with the given migration task (the Source or the Target data)
 *
 * @export
 * @interface ISfdmuRunCustomAddonTaskData
 */
export default interface ISfdmuRunCustomAddonTaskData {


    /**
     * The type of media. 
     * <br/>
     * For example the data source can be of the {@link DATA_MEDIA_TYPE.Org} media type 
     * and the Target is of the {@link DATA_MEDIA_TYPE.File} media type.
     *
     * @type {DATA_MEDIA_TYPE}
     * @memberof ISfdmuRunCustomAddonTaskData
     */
    readonly mediaType: DATA_MEDIA_TYPE;


    /**
     * Returns true if this object contains the data retireved from the Source 
     * and false if it's the data retireved from the Target.
     *
     * @type {boolean}
     * @memberof ISfdmuRunCustomAddonTaskData
     */
    readonly isSource: boolean;


    /**
     * The mapping between the record Id to the record object.
     *
     * @type {Map<string, any>}
     * @memberof ISfdmuRunCustomAddonTaskData
     */
    readonly idRecordsMap: Map<string, any>;


    /**
     * The mapping between the externalId value to the record Id value.
     *
     * @type {Map<string, string>}
     * @memberof ISfdmuRunCustomAddonTaskData
     */
    readonly extIdRecordsMap: Map<string, string>;


    /**
     * The array of the records (the source or the target).
     *
     * @type {any[]}
     * @memberof ISfdmuRunCustomAddonTaskData
     */
    readonly records: any[];

}