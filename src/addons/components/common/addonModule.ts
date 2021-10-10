/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import AddonRuntime from "./addonRuntime";
import IAddonContext from "./IAddonContext";
import { CONSTANTS } from "../../../modules/components/common_components/statics";


export default abstract class AddonModule {

    constructor(runtime: AddonRuntime) {
        this.runtime = runtime;
    }

    context: IAddonContext;
    runtime: AddonRuntime;

    async execute(context: IAddonContext, args: any): Promise<void> {
        if (context.startupMessage) {
            this.runtime.logFormatted(this, context.startupMessage);
        }
        await this.onExecute(context, args);
    }

    get moduleDisplayName(): string {
        return `${this.context.isCore
            ? CONSTANTS.CORE_ADDON_MODULES_NAME_PREFIX
            : CONSTANTS.CUSTOM_ADDON_MODULES_NAME_PREFIX}${this.constructor.name}`;
    }

    abstract onExecute(context: IAddonContext, args: any): void;

}