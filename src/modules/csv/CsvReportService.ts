/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { CSV_ISSUE_REPORT_COLUMNS, CSV_ISSUES_ERRORS_FILENAME } from '../constants/Constants.js';
import { Common } from '../common/Common.js';
import type { CsvIssueRowType } from './models/CsvIssueRowType.js';

/**
 * CSV report writer for validation issues.
 */
export default class CsvReportService {
  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Writes CSV issues report to the reports directory.
   *
   * @param reportsDirectory - Directory path for reports.
   * @param issues - CSV issues.
   * @param createEmptyFile - Create empty file when no issues.
   * @returns Report file path.
   */
  public static async writeCsvIssuesReportAsync(
    reportsDirectory: string,
    issues: CsvIssueRowType[],
    createEmptyFile = true
  ): Promise<string> {
    const reportPath = path.join(reportsDirectory, CSV_ISSUES_ERRORS_FILENAME);
    if (!issues || issues.length === 0) {
      if (createEmptyFile) {
        await Common.writeCsvFileAsync(reportPath, [], true, undefined, false, true);
      }
      return reportPath;
    }

    const columns: string[] = [...CSV_ISSUE_REPORT_COLUMNS];
    await Common.writeCsvFileAsync(reportPath, issues as Array<Record<string, unknown>>, true, columns, true, true);
    return reportPath;
  }
}
