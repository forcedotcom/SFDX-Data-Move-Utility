/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * The manifest of the Add-On module defined for the whole {@link ISfdmuRunCustomAddonScript}
 * or for a specific {@link ISfdmuRunCustomAddonScriptObject}.
 *
 * @see {@link https://help.sfdmu.com/full-documentation/configuration-and-running/full-exportjson-format | Full export.json format} for the detailed information.
 *
 * @export
 * @interface ISfdmuRunCustomAddonScriptAddonManifestDefinition
 */
export default interface ISfdmuRunCustomAddonScriptAddonManifestDefinition {
  path?: string;
  module?: string;
  description: string;
  excluded: boolean;
  args: Record<string, unknown>;
}
