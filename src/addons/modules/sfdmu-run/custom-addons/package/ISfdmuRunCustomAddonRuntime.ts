/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunCustomAddonApiService } from ".";


/**
 * The Custom Add-On runtime. 
 * <br/>
 * This class exposes the instance of the Custom Add-On Api service 
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

}