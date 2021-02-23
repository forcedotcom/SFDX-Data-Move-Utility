/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * This module executed BEFORE all objects are executed  
 */
import SfdmuRunAddonBase from "../../../engine/sfdmu-run/sfdmuRunAddonBase";
import IPluginExecutionContext from "../../../package/base/IPluginExecutionContext";

export default class CoreOnBefore extends SfdmuRunAddonBase {

    async onExecute(context: IPluginExecutionContext, args : any) : Promise<void>  {
        // TODO: Implement the core OnBefore functionality here   
    }

}