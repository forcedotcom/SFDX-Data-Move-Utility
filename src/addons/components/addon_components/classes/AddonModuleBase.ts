/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import IAddonModuleBase from "../interfaces/IAddonModuleBase";
import IPluginExecutionContext from "../interfaces/IPluginExecutionContext";
import PluginRuntimeBase from "./pluginRuntimeBase";



/**
  * The base class for the custom Addon modules
 */
export default abstract class AddonModuleBase implements IAddonModuleBase {
    constructor(runtime : PluginRuntimeBase){
        this.runtime = runtime;
    }
    context: IPluginExecutionContext;
    runtime: PluginRuntimeBase;
    abstract onExecute(context: IPluginExecutionContext, args: any): void;
    abstract displayName: string;
}
