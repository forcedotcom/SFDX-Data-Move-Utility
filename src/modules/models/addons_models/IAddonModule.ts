/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


export interface IScriptRunInfo {
    sourceUsername: string,
    targetUsername: string,
    apiVersion: string
}


export interface IAddonModule {
    /*
        runtime : IPluginRuntime;
        constructor(runtime : IPluginRuntime){
            this.runtime = runtime;
        }
    */
    onScriptSetup?(runInfo: IScriptRunInfo): Promise<IScriptRunInfo>,
    onOrgsConnected?(): Promise<any>
}

