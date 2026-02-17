/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type SObjectDescribe from '../sf/SObjectDescribe.js';

/**
 * Provides metadata for script objects.
 */
export type IMetadataProvider = {
  /**
   * Describes an sObject by name.
   *
   * @param objectName - Object API name.
   * @param isSource - True when describing source org metadata.
   * @returns Object description.
   */
  describeSObjectAsync(objectName: string, isSource: boolean): Promise<SObjectDescribe>;

  /**
   * Returns polymorphic field names for the given object when available.
   *
   * @param objectName - Object API name.
   * @returns List of polymorphic field API names.
   */
  getPolymorphicObjectFieldsAsync?(objectName: string): Promise<string[]>;
};
