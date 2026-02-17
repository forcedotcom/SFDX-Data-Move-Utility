/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Represents a CSV payload chunk with its related records.
 *
 * @template T - Record type stored in the chunk.
 */
export type CsvChunkType<T = Record<string, unknown>> = {
  /**
   * Records included in the chunk.
   */
  records: T[];

  /**
   * CSV string representation of the chunk.
   */
  csvString: string;
};
