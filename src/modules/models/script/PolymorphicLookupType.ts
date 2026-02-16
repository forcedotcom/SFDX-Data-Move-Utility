/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Describes a polymorphic lookup field definition declared in export.json.
 */
export type PolymorphicLookupType = {
  /**
   * Lookup field API name on the current object.
   */
  fieldName: string;

  /**
   * Optional explicit referenced object type (for example `Group` or `User`).
   * When omitted, both compatible targets may be considered.
   */
  referencedObjectType?: string;
};
