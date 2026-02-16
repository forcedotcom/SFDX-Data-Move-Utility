/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { CsvIssueRowType } from './CsvIssueRowType.js';
import type { CsvLookupFieldPairType } from './CsvLookupFieldPairType.js';

/**
 * Options used for CSV validation.
 */
export type CsvValidationOptionsType = {
  /**
   * Full path to the source CSV file.
   */
  sourceCsvFilename: string;

  /**
   * sObject API name for the CSV file.
   */
  sObjectName: string;

  /**
   * Required field names to be present in the CSV header.
   */
  requiredFields: string[];

  /**
   * Optional fields that can be skipped when ids are excluded.
   */
  skipMissingFieldsWhenIdsExcluded?: string[];

  /**
   * Optional lookup field pairs used to validate missing __r/id columns.
   */
  lookupFieldPairs?: CsvLookupFieldPairType[];

  /**
   * Flag to ignore missing Id-based fields.
   */
  excludeIdsFromCsvFiles?: boolean;

  /**
   * Message used when a CSV file is missing.
   */
  missingCsvFileErrorMessage: string;

  /**
   * Message used when a required column is missing.
   */
  missingColumnErrorMessage: string;

  /**
   * Date provider for deterministic tests.
   */
  dateProvider?: () => Date;

  /**
   * Optional issue hook to customize created rows.
   */
  onIssueCreated?: (issue: CsvIssueRowType) => CsvIssueRowType;
};
