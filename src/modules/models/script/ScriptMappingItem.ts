/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Field mapping definition for script object mapping.
 */
export default class ScriptMappingItem {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Optional target object API name for cross-object mapping.
   */
  public targetObject = '';

  /**
   * Source field API name.
   */
  public sourceField = '';

  /**
   * Target field API name.
   */
  public targetField = '';
}
