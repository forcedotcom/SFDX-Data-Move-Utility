/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * The object returned from the {@link ISfdmuRunCustomAddonModule.onExecute} method.
 * The Add-On can interact with the parent process by returning this object to the caller.
 *
 * @export
 * @interface ISfdmuRunCustomAddonResult
 */
export default interface ISfdmuRunCustomAddonResult {
  /**
   * Set this property to `true` to abort the current plugin job.
   * Use this property if you want to interrupt the migration process after finishing the Add-On execution.
   *
   * @example
   * ```ts
   * async onExecute(context: ISfdmuRunCustomAddonContext, args: any): Promise<ISfdmuRunCustomAddonResult> {
   *      // Return cancel = true if you want to abort the current migration job.
   *      return { cancel: true };
   * }
   * ```
   *
   * @type {boolean}
   * @memberof ISfdmuRunCustomAddonResult
   */
  cancel: boolean;
}
