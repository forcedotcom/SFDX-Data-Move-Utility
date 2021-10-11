/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunCustomAddonPluginInfo } from ".";


/**
 * The information about currently running SFDMU command.
 * Contains the CLI command flags which were used 
 * to run the Sfdmu job and the common information about the Plugin.
 */
export default interface ISfdmuRunCustomAddonCommandRunInfo {
    /**
    * The --sourceusername command flag.
    */
    sourceUsername: string,

    /**
     * The --targetusername command flag.
     */
    targetUsername: string,

    /**
     * The --apiversion command flag.
     */
    apiVersion: string,

    /**
     * The directory location where the Plugin was started.
     */
    readonly basePath: string,

    /**
     * The information about the Plugin and the framework.
     */
    readonly pinfo: ISfdmuRunCustomAddonPluginInfo
}