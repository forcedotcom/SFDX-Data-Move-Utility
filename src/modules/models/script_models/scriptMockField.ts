/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunCustomAddonScriptMockField } from "../../../addons/modules/sfdmu-run/custom-addons/package";

 
/**
 * Parsed MockField object 
 * from the script file
 *
 * @export
 * @class ScriptMockField
 */
export default class ScriptMockField implements ISfdmuRunCustomAddonScriptMockField {
    // ------------- JSON --------------
    name: string = "";
    pattern: string = "";
    excludedRegex: string = "";
    includedRegex: string = "";
}
