/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type SFieldDescribe from './SFieldDescribe.js';

/**
 * Description of a Salesforce object.
 */
export default class SObjectDescribe {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Object API name.
   */
  public name = '';

  /**
   * Object label.
   */
  public label = '';

  /**
   * True when object is updateable.
   */
  public updateable = false;

  /**
   * True when object is createable.
   */
  public createable = false;

  /**
   * True when object is deletable.
   */
  public deletable = false;

  /**
   * True when object is custom.
   */
  public custom = false;

  /**
   * Field metadata keyed by field API name.
   */
  public fieldsMap: Map<string, SFieldDescribe> = new Map();

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new object describe instance.
   *
   * @param init - Initial values.
   */
  public constructor(init?: Partial<SObjectDescribe>) {
    if (init) {
      Object.assign(this, init);
    }
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Adds or replaces a field description entry.
   *
   * @param field - Field description to add.
   */
  public addField(field: SFieldDescribe): void {
    const updatedField = field;
    updatedField.objectName = updatedField.objectName || this.name;
    this.fieldsMap.set(updatedField.name, updatedField);
  }
}
