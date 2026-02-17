/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Field mapping storage for a single object.
 */
export default class FieldMapping {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Source-to-target field name mapping.
   */
  public sourceToTarget = new Map<string, string>();

  /**
   * Target-to-source field name mapping.
   */
  public targetToSource = new Map<string, string>();

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Adds a field mapping pair.
   *
   * @param sourceField - Source field name.
   * @param targetField - Target field name.
   */
  public addMapping(sourceField: string, targetField: string): void {
    if (!sourceField || !targetField) {
      return;
    }
    this.sourceToTarget.set(sourceField, targetField);
    this.targetToSource.set(targetField, sourceField);
  }

  /**
   * Gets the mapped target field name.
   *
   * @param sourceField - Source field name.
   * @returns Target field name.
   */
  public getTargetField(sourceField: string): string {
    return this.sourceToTarget.get(sourceField) ?? sourceField;
  }

  /**
   * Gets the mapped source field name.
   *
   * @param targetField - Target field name.
   * @returns Source field name.
   */
  public getSourceField(targetField: string): string {
    return this.targetToSource.get(targetField) ?? targetField;
  }

  /**
   * Returns true when there is any mapping defined.
   *
   * @returns True when mapping exists.
   */
  public hasChanges(): boolean {
    return this.sourceToTarget.size > 0;
  }
}
