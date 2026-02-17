/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Minimal field description required by Common utilities.
 */
export type SFieldDescribeType = {
  /**
   * Field API name (may include dotted notation).
   */
  name: string;

  /**
   * True when the field is custom.
   */
  custom?: boolean;

  /**
   * True when the field is a relationship (__r) field.
   */
  is__r?: boolean;
};
