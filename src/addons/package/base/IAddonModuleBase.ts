
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IPluginExecutionContext, IPluginRuntimeBase } from ".";


export default interface IAddonModuleBase {

    context: IPluginExecutionContext;

    /**
     * The Plugin will share with the Addon its public
     *   methods and runtime data using this property
     */
    runtime: IPluginRuntimeBase;

    /**
     * The main method which is executed by the Plugin
     * when the Addon is running.
     */
    onExecute(context: IPluginExecutionContext, args: any): void;

    /**
     * The display name of the current Plugin 
     */
    readonly displayName: string;

}