/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AddonModuleBase, IScriptRunInfo } from "../../../modules/models/addons_models/AddonModuleBase";



/**
 * Example of addon module
 *
 * @export
 * @class SfdmuTestCoreAddon
 */
export default class SfdmuTestCoreAddon extends AddonModuleBase {
    
    async onScriptSetup(runInfo: IScriptRunInfo): Promise<IScriptRunInfo>{
        console.log("SfdmuTestCoreAddon : runInfo=" + runInfo);
        return runInfo;
    }

}