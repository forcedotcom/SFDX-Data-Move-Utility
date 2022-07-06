/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



/**
 * The mock item provided with the parent {@link ISfdmuRunCustomAddonScriptObject}.
 * @see {@link https://help.sfdmu.com/full-documentation/configuration-and-running/full-exportjson-format | Full export.json format} for the detailed information about the fields.
 *
 * @export
 * @interface ISfdmuRunCustomAddonScriptMockField
 */
export default interface ISfdmuRunCustomAddonScriptMockField {

    name: string;
    excludeNames: string[];
    pattern: string;
    excludedRegex: string;
    includedRegex: string;

}
