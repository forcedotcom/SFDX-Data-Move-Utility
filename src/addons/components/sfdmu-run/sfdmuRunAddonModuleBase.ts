
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import AddonModuleBase from "../common/addonModuleBase";
import IAddonContext from "../common/IAddonContext";
import { ISfdmuRunAddonRuntimeSystem } from "./ISfdmuRunAddonRuntimeSystem";
import SfdmuRunPluginRuntime from "./sfdmuRunPluginRuntime";


export default abstract class SfdmuRunAddonModuleBase extends AddonModuleBase {

    /**
    * Provides the base Api methods and properties
    * to use in the Add-On module
    */
    runtime: SfdmuRunPluginRuntime;

    get systemRuntime(): ISfdmuRunAddonRuntimeSystem {
        return <ISfdmuRunAddonRuntimeSystem>(<any>this.runtime);
    }

    abstract onExecute(context: IAddonContext, args: any): void;
}