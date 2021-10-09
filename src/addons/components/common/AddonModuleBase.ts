/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import IAddonModuleBase from "./IAddonModuleBase";
import AddonRuntimeBase from "./addonRuntimeBase";
import IAddonContext from "./IAddonContext";
import { CONSTANTS } from "../../../modules/components/common_components/statics";





/**
  * The base class for the custom Addon modules
 */
export default abstract class AddonModuleBase implements IAddonModuleBase {
    constructor(runtime: AddonRuntimeBase) {
        this.runtime = runtime;
    }
    context: IAddonContext;
    runtime: AddonRuntimeBase;
    abstract onExecute(context: IAddonContext, args: any): void;
    get moduleDisplayName(): string {
        return `${this.context.isCore
            ? CONSTANTS.CORE_ADDON_MODULES_NAME_PREFIX
            : CONSTANTS.CUSTOM_ADDON_MODULES_NAME_PREFIX}${this.constructor.name}`;
    }
}