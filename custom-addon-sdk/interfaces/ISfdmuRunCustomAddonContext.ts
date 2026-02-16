/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * The Custom Add-On module runtime context.
 *
 * @export
 * @interface ISfdmuRunCustomAddonContext
 */
export default interface ISfdmuRunCustomAddonContext {
  /**
   * The name of the triggered Add-On event.
   * <br/>
   *
   * @example
   * ```ts
   * async onExecute(context: ISfdmuRunCustomAddonContext, args: any): Promise<ISfdmuRunCustomAddonResult> {
   *      console.log(context.eventName); // For the BeforeUpdate event, outputs 'onBeforeUpdate'
   * }
   * ```
   *
   * @type {string}
   * @memberof ISfdmuRunCustomAddonContext
   */
  eventName: string;

  /**
   * The name of the current Add-On module, including its type (core or custom).
   *
   * @example `custom:CustomSfdmuRunAddonTemplate`, `core:ExportFiles`
   *
   * @type {string}
   * @memberof ISfdmuRunCustomAddonContext
   */
  moduleDisplayName: string;

  /**
   * The API name of the Salesforce object currently processed by the plugin.
   *
   * @example ```AccountTeamMember```
   *
   * @type {string}
   * @memberof ISfdmuRunCustomAddonContext
   */
  objectName: string;

  /**
   * The display name of the processed Salesforce object (typically the object label).
   *
   * @example ```Account Team Member```
   *
   * @type {string}
   * @memberof ISfdmuRunCustomAddonContext
   */
  objectDisplayName: string;

  /**
   * Zero-based index of the current object set.
   *
   * @type {number | undefined}
   * @memberof ISfdmuRunCustomAddonContext
   */
  objectSetIndex?: number;

  /**
   * Zero-based pass number for events which can run multiple times in one object set.
   *
   * @type {number | undefined}
   * @memberof ISfdmuRunCustomAddonContext
   */
  passNumber?: number;

  /**
   * True only for the first pass invocation in the current object set.
   *
   * @type {boolean | undefined}
   * @memberof ISfdmuRunCustomAddonContext
   */
  isFirstPass?: boolean;

  /**
   * The description of the current Add-On module.
   * Defined in the `object/[addons]` section of the script, as in the example below:
   * <br/>
   *
   * @example
   * ```json
   * {
   *   "description": "This test AddOn manipulates the source JSON string before target update."
   * }
   * ```
   * @type {string}
   * @memberof ISfdmuRunCustomAddonContext
   */
  description: string;
}
