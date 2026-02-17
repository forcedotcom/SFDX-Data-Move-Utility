/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * CSV issue report row structure.
 */
export type CsvIssueRowType = {
  /**
   * Reported time string.
   */
  'Date update': string;

  /**
   * Related sObject API name.
   */
  'sObject name': string | null;

  /**
   * Field API name.
   */
  'Field name': string | null;

  /**
   * Field value at the time of validation.
   */
  'Field value': string | null;

  /**
   * Parent sObject API name.
   */
  'Parent SObject name': string | null;

  /**
   * Parent field API name.
   */
  'Parent field name': string | null;

  /**
   * Parent field value at the time of validation.
   */
  'Parent field value': string | null;

  /**
   * Error description.
   */
  Error: string;
};
