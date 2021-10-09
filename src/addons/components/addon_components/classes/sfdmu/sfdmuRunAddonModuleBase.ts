
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import { IPluginRuntimeSystemBase } from "../../../../../modules/models/common_models/helper_interfaces";
import IPluginExecutionContext from "../../interfaces/IPluginExecutionContext";
import AddonModuleBase from "../AddonModuleBase";
import SfdmuRunPluginRuntime from "../sfdmuRunPluginRuntime";


export default abstract class SfdmuRunAddonModuleBase extends AddonModuleBase {

    /**
    * Provides the base Api methods and properties
    * to use in the AddOn module
    */
    runtime: SfdmuRunPluginRuntime;

    get systemRuntime(): IPluginRuntimeSystemBase {
        return <IPluginRuntimeSystemBase>(<any>this.runtime);
    }

    abstract onExecute(context: IPluginExecutionContext, args: any): void;

    get displayName(): string {
        return "core:" + this.constructor.name;
    }

}