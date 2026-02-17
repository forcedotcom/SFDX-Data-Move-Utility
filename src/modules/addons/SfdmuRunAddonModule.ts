/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type AddonResult from './models/AddonResult.js';
import type { IAddonContext } from './models/IAddonContext.js';
import AddonModule from './AddonModule.js';
import type SfdmuRunAddonRuntime from './SfdmuRunAddonRuntime.js';

/**
 * Base class for SFDMU run add-ons.
 */
export default abstract class SfdmuRunAddonModule extends AddonModule {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Runtime instance specialized for the run command.
   */
  public override runtime: SfdmuRunAddonRuntime;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new run add-on module.
   *
   * @param runtime - Run add-on runtime instance.
   */
  public constructor(runtime: SfdmuRunAddonRuntime) {
    super(runtime);
    this.runtime = runtime;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Executes the add-on logic for the event.
   *
   * @param context - Execution context.
   * @param args - Manifest arguments.
   * @returns Add-on execution result.
   */
  public abstract override onExecuteAsync(
    context: IAddonContext,
    args: Record<string, unknown>
  ): Promise<AddonResult | void>;
}
