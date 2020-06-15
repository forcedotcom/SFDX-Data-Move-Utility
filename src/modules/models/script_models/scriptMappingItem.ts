/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


 /**
 * Parsed FieldMapping object of the script.
 * Represents field mapping
 *
 * @export
 * @class ScriptMapping
 */
export default class ScriptMappingItem {
    targetObject: string;
    sourceField: string;
    targetField: string;
}