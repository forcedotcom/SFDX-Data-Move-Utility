/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Result object returned from add-on execution hooks.
 */
export default class AddonResult {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Indicates the add-on requested the command to cancel.
   */
  public cancel = false;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new add-on result.
   *
   * @param init - Optional initialization values.
   */
  public constructor(init?: Partial<AddonResult>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
