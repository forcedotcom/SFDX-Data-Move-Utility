/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import FieldMapping from './FieldMapping.js';

/**
 * Object-level mapping definition between source and target objects.
 */
export default class ObjectMapping {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Source object API name.
   */
  public sourceObjectName: string;

  /**
   * Target object API name.
   */
  public targetObjectName: string;

  /**
   * Field-level mapping for this object.
   */
  public fieldMapping: FieldMapping = new FieldMapping();

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new object mapping.
   *
   * @param sourceObjectName - Source object API name.
   * @param targetObjectName - Target object API name.
   */
  public constructor(sourceObjectName: string, targetObjectName?: string) {
    this.sourceObjectName = sourceObjectName;
    this.targetObjectName = targetObjectName ?? sourceObjectName;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Returns true when the mapping contains object or field changes.
   *
   * @returns True when any mapping is defined.
   */
  public hasChanges(): boolean {
    return this.sourceObjectName !== this.targetObjectName || this.fieldMapping.hasChanges();
  }
}
