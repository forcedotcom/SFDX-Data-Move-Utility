/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DATA_MEDIA_TYPE } from './common.js';

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
  orgId: string;
  instanceUrl: string;
  accessToken: string;
  media?: DATA_MEDIA_TYPE;
  isSource?: boolean;
  orgDescribe?: Map<string, unknown>;
  isPersonAccountEnabled?: boolean;
  organizationType?: string;
  isSandbox?: boolean;
  isScratch?: boolean;
  connectionData?: {
    instanceUrl: string;
    accessToken: string;
    apiVersion: string;
    proxyUrl: string;
  };
  isConnected?: boolean;
  isDescribed?: boolean;
  objectNamesList?: string[];
  isProduction?: boolean;
  isDeveloper?: boolean;
  instanceDomain?: string;

  /**
   * True when this org represents file-based media.
   */
  isFileMedia?: boolean;

  /**
   * True when this org represents Salesforce org media.
   */
  isOrgMedia?: boolean;
}
