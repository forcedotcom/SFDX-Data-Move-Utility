/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Error used to abort execution with a successful exit.
 */
export class SuccessExit extends Error {
  // ------------------------------------------------------//
  // -------------------- CONSTRUCTOR -------------------- //
  // ------------------------------------------------------//

  /**
   * Create a SuccessExit instance.
   *
   * @param message - Optional exit message.
   */
  public constructor(message?: string) {
    super(message);
  }
}
