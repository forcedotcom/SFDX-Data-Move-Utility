/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Basic org info gathered from a live connection.
 */
export type OrgConnectionInfoType = {
  /**
   * The alias or username used to resolve the org.
   */
  aliasOrUsername: string;

  /**
   * Resolved username for the org.
   */
  username: string;

  /**
   * Organization Id.
   */
  orgId: string;

  /**
   * Instance URL for the org.
   */
  instanceUrl: string;

  /**
   * API version used for the connection.
   */
  apiVersion: string;
};
