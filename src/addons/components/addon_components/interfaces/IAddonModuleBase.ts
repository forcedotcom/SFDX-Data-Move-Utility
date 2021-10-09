
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import PluginRuntimeBase from "../classes/pluginRuntimeBase";
import IPluginExecutionContext from "./IPluginExecutionContext";







/**
 * The base interface for the custom Addon modules
 */
export default interface IAddonModuleBase {

    /**
     * Holds information about the runtime context 
     * where the Addon event is currently executed
     */
    context: IPluginExecutionContext;

    /**
     * Used by the Plugin to share the runtime data and methods with the Addon module
     */
    runtime: PluginRuntimeBase;

    /**
     * The main method which is executed when the Addon event is running.
     */
    onExecute(context: IPluginExecutionContext, args: any): void;

    /**
     * The custom display name of the current Addon module
     */
    readonly displayName: string;

}