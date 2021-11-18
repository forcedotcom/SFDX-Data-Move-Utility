/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import AddonResult from "./addonResult";
import AddonRuntime from "./addonRuntime";
import IAddonContext from "./IAddonContext";


export default abstract class AddonModule {

    constructor(runtime: AddonRuntime) {
        this.runtime = runtime;
    }

    context: IAddonContext;
    runtime: AddonRuntime;

    abstract onExecute(context: IAddonContext, args: any): Promise<AddonResult>;
    abstract onInit(context: IAddonContext, args: any): Promise<AddonResult>;

}