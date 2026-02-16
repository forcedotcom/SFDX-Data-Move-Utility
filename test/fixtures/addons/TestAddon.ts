/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type {
  ISfdmuRunCustomAddonContext,
  ISfdmuRunCustomAddonModule,
  ISfdmuRunCustomAddonResult,
  ISfdmuRunCustomAddonRuntime,
} from '../../../custom-addon-sdk/interfaces/index.js';

declare global {
  // eslint-disable-next-line no-var
  var __addonCalls: string[] | undefined;
}

/**
 * Test add-on module used for addon manager tests.
 */
export default class TestAddon implements ISfdmuRunCustomAddonModule {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Runtime provided by the plugin.
   */
  public runtime: ISfdmuRunCustomAddonRuntime;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a test add-on instance.
   *
   * @param runtime - Runtime provided by the plugin.
   */
  public constructor(runtime: ISfdmuRunCustomAddonRuntime) {
    this.runtime = runtime;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Records execution events for verification.
   *
   * @param context - Execution context.
   * @param args - Manifest arguments.
   * @returns Add-on execution result.
   */
  public async onExecute(
    context: ISfdmuRunCustomAddonContext,
    args: Record<string, unknown>
  ): Promise<ISfdmuRunCustomAddonResult> {
    void this;
    const calls = globalThis.__addonCalls ?? [];
    const label = typeof args.label === 'string' ? args.label : '';
    calls.push(
      `${context.eventName}:${context.objectName}:${label}:set=${String(context.objectSetIndex ?? 0)}:pass=${String(
        context.passNumber ?? 0
      )}:first=${String(context.isFirstPass ?? true)}`
    );
    globalThis.__addonCalls = calls;

    if (args.cancel === true) {
      return { cancel: true };
    }
    return { cancel: false };
  }

  /**
   * Records initialization events for verification.
   *
   * @param context - Execution context.
   * @param args - Manifest arguments.
   * @returns Add-on initialization result.
   */
  public async onInit(
    context: ISfdmuRunCustomAddonContext,
    args: Record<string, unknown>
  ): Promise<ISfdmuRunCustomAddonResult> {
    void this;
    const calls = globalThis.__addonCalls ?? [];
    const label = typeof args.label === 'string' ? args.label : '';
    calls.push(`init:${context.moduleDisplayName}:${label}`);
    globalThis.__addonCalls = calls;
    return { cancel: false };
  }
}
