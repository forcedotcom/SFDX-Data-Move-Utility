/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { CsvChunkType } from './CsvChunkType.js';

/**
 * Container for CSV chunk payloads and headers.
 *
 * @template T - Record type stored in the chunks.
 */
export class CsvChunks<T = Record<string, unknown>> {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Chunked CSV payloads.
   */
  public chunks: Array<CsvChunkType<T>> = [];

  /**
   * Header field names for the CSV output.
   */
  public header: string[] = [];

  // ------------------------------------------------------//
  // -------------------- CONSTRUCTOR -------------------- //
  // ------------------------------------------------------//

  /**
   * Create a CsvChunks container.
   *
   * @param init - Optional initial values.
   */
  public constructor(init?: Partial<CsvChunks<T>>) {
    Object.assign(this, init);
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Populate chunks from pre-split arrays.
   *
   * @param arrayChunks - Record chunks.
   * @returns Current CsvChunks instance.
   */
  public fromArrayChunks(arrayChunks: T[][]): CsvChunks<T> {
    if (arrayChunks.length === 0) {
      return this;
    }

    this.chunks = arrayChunks.map((records) => ({
      csvString: '',
      records,
    }));
    this.header = Object.keys(arrayChunks[0][0] ?? {});

    return this;
  }

  /**
   * Populate chunks from a single array of records.
   *
   * @param array - Records to wrap.
   * @returns Current CsvChunks instance.
   */
  public fromArray(array: T[]): CsvChunks<T> {
    return this.fromArrayChunks([array]);
  }
}
