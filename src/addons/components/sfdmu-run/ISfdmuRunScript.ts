
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import ScriptAddonManifestDefinition from "../../../modules/models/script_models/scriptAddonManifestDefinition";
import { ISfdmuRunCustomAddonScript } from "../../modules/sfdmu-run/custom-addons/package";
import ISfdmuRunScriptObject from "./ISfdmuRunScriptObject";



export default interface ISfdmuRunScript extends ISfdmuRunCustomAddonScript {

    getAllAddOns(): ScriptAddonManifestDefinition[];
    objects: ISfdmuRunScriptObject[]

}