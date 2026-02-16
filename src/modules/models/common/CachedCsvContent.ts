/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Common } from '../../common/Common.js';

/**
 * Cached CSV content tracker for repair operations.
 */
export default class CachedCsvContent {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Cached CSV data per file path.
   */
  public csvDataCacheMap: Map<string, Map<string, Record<string, unknown>>> = new Map();

  /**
   * Set of CSV files updated during repair.
   */
  public updatedFilenames: Set<string> = new Set();

  /**
   * Counter for generated Id values.
   */
  public idCounter = 1;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a CSV cache instance.
   */
  public constructor() {
    this.clear();
  }

  // ------------------------------------------------------//
  // -------------------- GETTERS/SETTERS ---------------- //
  // ------------------------------------------------------//

  /**
   * Returns the next generated Id placeholder.
   *
   * @returns Generated Id string.
   */
  public get nextId(): string {
    return `ID${Common.addLeadnigZeros(this.idCounter++, 16)}`;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Clears cached CSV data.
   */
  public clear(): void {
    this.csvDataCacheMap = new Map<string, Map<string, Record<string, unknown>>>();
    this.updatedFilenames = new Set<string>();
    this.idCounter = 1;
  }
}
