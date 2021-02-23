
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IPluginExecutionContext } from "../../package/base";
import AddonModuleBase from "../../package/base/addonModuleBase";
import { ISfdmuRunPluginRuntime } from "../../package/modules/sfdmu-run";
import { ISfdmuRunPluginRuntimeSystem } from "./sfdmuRunPluginRuntime";


export default abstract class SfdmuRunAddonBase extends AddonModuleBase {
    
    runtime: ISfdmuRunPluginRuntime;

    get systemRuntime(): ISfdmuRunPluginRuntimeSystem {
        return <ISfdmuRunPluginRuntimeSystem>(<any>this.runtime);
    }

    abstract onExecute(context: IPluginExecutionContext, args: any): void;

    get displayName(): string {
        return "core:" + this.constructor.name;
    }
  
}