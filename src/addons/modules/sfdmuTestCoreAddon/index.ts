/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IAddonModule, IScriptRunInfo } from "../../../modules/models/addons_models/IAddonModule";
import { IPluginRuntime } from "../../../modules/models/addons_models/IPluginRuntime";



/**
 * Example of addon module
 *
 * @export
 * @class SfdmuTestCoreAddon
 */
export default class SfdmuTestCoreAddon implements IAddonModule {

    runtime : IPluginRuntime;
    constructor(runtime : IPluginRuntime){
        this.runtime = runtime;
    }
    
    async onScriptSetup(runInfo: IScriptRunInfo): Promise<IScriptRunInfo>{
        console.log("SfdmuTestCoreAddon : runInfo=" + runInfo);
        return runInfo;
    }

}