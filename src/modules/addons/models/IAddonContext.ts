/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Add-on execution context passed to modules.
 */
export type IAddonContext = {
  /**
   * Event identifier name.
   */
  eventName: string;

  /**
   * Object API name associated with the event.
   */
  objectName: string;

  /**
   * Description provided by the manifest.
   */
  description: string;

  /**
   * Object display name used in logs.
   */
  objectDisplayName: string;

  /**
   * Module display name used in logs.
   */
  moduleDisplayName: string;

  /**
   * True when the add-on is part of the core bundle.
   */
  isCore: boolean;

  /**
   * True when the current invocation belongs to the first update pass in the current object set.
   */
  isFirstPass?: boolean;

  /**
   * Zero-based pass number for events executed multiple times within an object set.
   */
  passNumber?: number;

  /**
   * Zero-based object set index currently being processed.
   */
  objectSetIndex?: number;
};
