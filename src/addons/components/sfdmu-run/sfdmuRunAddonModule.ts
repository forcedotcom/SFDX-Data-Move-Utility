
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import AddonModule from "../common/addonModule";
import IAddonContext from "../common/IAddonContext";
import SfdmuRunAddonRuntime from "./sfdmuRunAddonRuntime";


export default abstract class SfdmuRunAddonModule extends AddonModule {  
    runtime: SfdmuRunAddonRuntime;
    abstract onExecute(context: IAddonContext, args: any): void;
}