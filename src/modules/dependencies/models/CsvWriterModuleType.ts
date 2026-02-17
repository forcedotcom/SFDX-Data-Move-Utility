/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Typed subset of the csv-writer module API.
 */
export type CsvWriterModuleType = {
  /**
   * Creates an object CSV stringifier.
   *
   * @param options - Stringifier options.
   * @returns Stringifier instance.
   */
  createObjectCsvStringifier: <TRecord>(options: {
    /**
     * Header definitions for output columns.
     */
    header: Array<{
      /**
       * Column id.
       */
      id: string;
      /**
       * Column title.
       */
      title: string;
    }>;
    /**
     * Column delimiter.
     */
    fieldDelimiter?: string;
    /**
     * Record delimiter.
     */
    recordDelimiter?: string;
    /**
     * Always quote values.
     */
    alwaysQuote?: boolean;
  }) => {
    /**
     * Gets the header string.
     *
     * @returns Header string.
     */
    getHeaderString(): string;
    /**
     * Stringifies records into CSV.
     *
     * @param records - Records to stringify.
     * @returns CSV string.
     */
    stringifyRecords(records: TRecord[]): string;
  };
  /**
   * Creates a CSV writer.
   *
   * @param options - Writer options.
   * @returns Writer instance.
   */
  createObjectCsvWriter: <TRecord>(options: {
    /**
     * Output file path.
     */
    path?: string;
    /**
     * Header definitions for output columns.
     */
    header: Array<{
      /**
       * Column id.
       */
      id: string;
      /**
       * Column title.
       */
      title: string;
    }>;
    /**
     * Column delimiter.
     */
    fieldDelimiter?: string;
    /**
     * Record delimiter.
     */
    recordDelimiter?: string;
    /**
     * Always quote values.
     */
    alwaysQuote?: boolean;
    /**
     * Append to an existing file.
     */
    append?: boolean;
    /**
     * Output encoding.
     */
    encoding?: BufferEncoding;
  }) => {
    /**
     * Writes records into a CSV.
     *
     * @param records - Records to write.
     * @returns Promise when done.
     */
    writeRecords(records: TRecord[]): Promise<void>;
  };
};
