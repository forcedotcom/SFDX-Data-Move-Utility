/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Org } from '@salesforce/core';

/**
 * Resolved orgs for the run command.
 */
export type OrgConnectionPairType = {
  /**
   * Source org resolved from the CLI flags.
   */
  sourceOrg?: Org;

  /**
   * Target org resolved from the CLI flags.
   */
  targetOrg?: Org;
};
