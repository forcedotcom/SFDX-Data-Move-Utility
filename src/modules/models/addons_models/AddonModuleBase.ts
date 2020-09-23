import { IPluginRuntime } from "./IPluginRuntime";
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


export interface IScriptRunInfo {
    sourceUsername: string,
    targetUsername: string,
    basePath: string,
    apiVersion: string
}


export abstract class AddonModuleBase {
    runtime : IPluginRuntime;
    constructor(runtime : IPluginRuntime){
        this.runtime = runtime;
    }
    abstract onScriptSetup?(runInfo: IScriptRunInfo): Promise<IScriptRunInfo>;
}

