/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * The authentication data provided with the currently running {@link ISfdmuRunCustomAddonScript}.
 *
 * @see {@link https://help.sfdmu.com/full-documentation/configuration-and-running/full-exportjson-format | Full export.json format} for the detailed information about the fields.
 *
 * @export
 * @interface ISfdmuRunCustomAddonScriptOrg
 */
export default interface ISfdmuRunCustomAddonScriptOrg {
  name: string;
  orgUserName: string;
  instanceUrl: string;
  accessToken: string;

  /**
   * True when this org represents file-based media.
   */
  isFileMedia?: boolean;

  /**
   * True when this org represents Salesforce org media.
   */
  isOrgMedia?: boolean;
}
