/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunCustomAddonService } from ".";



/**
 * The base interface for the Add-On runtime.
 * The propery {@link ISfdmuRunCustomAddonRuntime.service} is used 
 * to expose the Add-On Api to the current module instance.
 *
 * @export
 * @interface ISfdmuRunCustomAddonRuntime
 */
export default interface ISfdmuRunCustomAddonRuntime {

    /**
     * The instance of the Add-On Api service.
     * 
     * @type {ISfdmuRunCustomAddonService}
     * 
     * @memberof ISfdmuRunCustomAddonRuntime
     */
    service: ISfdmuRunCustomAddonService;

}