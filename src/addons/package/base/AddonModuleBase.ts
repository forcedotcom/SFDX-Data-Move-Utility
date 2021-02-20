/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IAddonModuleBase, IPluginExecutionContext, IPluginRuntimeBase } from ".";


/**
 * The base class for all addon modules
 *
 * @export
 * @abstract
 * @class AddonModuleBase
 * @implements {IAddonModuleBase}
 */
export default abstract class AddonModuleBase implements IAddonModuleBase {
    constructor(runtime : IPluginRuntimeBase){
        this.runtime = runtime;
    }
    context: IPluginExecutionContext;
    runtime: IPluginRuntimeBase;
    abstract onExecute(context: IPluginExecutionContext, args: any): void;
    abstract displayName: string;
}
