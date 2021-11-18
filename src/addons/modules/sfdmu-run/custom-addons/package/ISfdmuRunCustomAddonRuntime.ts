/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunCustomAddonApiService, ISfdmuRunCustomAddonScript } from ".";


/**
 * The Custom Add-On runtime. 
 * <br/>
 * Besides other runtime information, This class exposes the instance of the Custom Add-On Api service 
 *  using the {@link ISfdmuRunCustomAddonRuntime.service} property.
 *
 * @export
 * @interface ISfdmuRunCustomAddonRuntime
 */
export default interface ISfdmuRunCustomAddonRuntime {

    /**
     * The instance of the Add-On Api service.
     * 
     * @type {ISfdmuRunCustomAddonApiService}
     * 
     * @memberof ISfdmuRunCustomAddonRuntime
     */
    service: ISfdmuRunCustomAddonApiService;

    /**
     * Returns the data of the currently running {@link ISfdmuRunCustomAddonScript | export.json script}. 
     *
     * @return {*}  {ISfdmuRunCustomAddonScript}
     * @memberof ISfdmuRunCustomAddonRuntime
     */
    getScript(): ISfdmuRunCustomAddonScript;

}