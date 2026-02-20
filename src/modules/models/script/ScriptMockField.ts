/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Mock field definition from export.json.
 */
export default class ScriptMockField {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Field API name.
   */
  public name = '';

  /**
   * Mock pattern value.
   */
  public pattern = '';

  /**
   * Optional casual locale for this field pattern (for example ru_RU).
   */
  public locale = '';

  /**
   * Optional exclusion regex used to skip mocking.
   */
  public excludedRegex = '';

  /**
   * Optional inclusion regex used to allow mocking.
   */
  public includedRegex = '';

  /**
   * Field names excluded from this mock definition.
   */
  public excludeNames: string[] = [];
}
