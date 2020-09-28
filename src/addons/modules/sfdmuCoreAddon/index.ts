/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IAddonModule, IPluginRuntime, ICommandRunInfo } from "../../../modules/models/addons_models/addonSharedPackage";




/**
 * Example of addon module
 *
 * @export
 * @class SfdmuTestCoreAddon
 */
export default class SfdmuCoreAddon implements IAddonModule {

    runtime: IPluginRuntime;
    constructor(runtime: IPluginRuntime) {
        this.runtime = runtime;
    }

    async onScriptSetup(runInfo: ICommandRunInfo): Promise<ICommandRunInfo> {
        this.runtime.writeLogConsoleMessage("The Plugin root folder: " + runInfo.pinfo.path);
        return runInfo;
    }

}