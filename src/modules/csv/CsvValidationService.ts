/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import { Common } from '../common/Common.js';
import { COMPLEX_FIELDS_SEPARATOR } from '../constants/Constants.js';
import type { CsvIssueRowType } from './models/CsvIssueRowType.js';
import type { CsvLookupFieldPairType } from './models/CsvLookupFieldPairType.js';
import type { CsvValidationOptionsType } from './models/CsvValidationOptionsType.js';

/**
 * CSV validation service (validation-only).
 */
export default class CsvValidationService {
  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Validates CSV file structure and required columns.
   *
   * @param options - Validation options.
   * @returns CSV issues list.
   */
  public static async validateCsvAsync(options: CsvValidationOptionsType): Promise<CsvIssueRowType[]> {
    const issues: CsvIssueRowType[] = [];
    const shouldIgnoreMissingFile = Boolean(options.excludeIdsFromCsvFiles);

    if (!fs.existsSync(options.sourceCsvFilename)) {
      if (!shouldIgnoreMissingFile) {
        issues.push(this._createIssue(options, null, null, options.missingCsvFileErrorMessage));
      }
      return this._finalizeIssues(issues, options);
    }

    const csvColumnsRow = await Common.readCsvFileAsync(options.sourceCsvFilename, 1);
    if (csvColumnsRow.length === 0) {
      return this._finalizeIssues(issues, options);
    }

    const headerColumns = Object.keys(csvColumnsRow[0]).map((columnName) => this._normalizeColumnName(columnName));
    const reportedMissingFields = new Set<string>();
    const skipMissingFields = new Set<string>(options.skipMissingFieldsWhenIdsExcluded ?? []);
    const excludeIds = Boolean(options.excludeIdsFromCsvFiles);

    options.requiredFields.forEach((fieldName) => {
      const columnExists = headerColumns.some((columnName) => this._matchesColumn(fieldName, columnName));
      if (columnExists) {
        return;
      }

      if (excludeIds && skipMissingFields.has(fieldName)) {
        return;
      }

      this._reportMissingColumnIssue(issues, reportedMissingFields, options, fieldName);
    });

    const lookupFieldPairs = this._normalizeLookupFieldPairs(options.lookupFieldPairs as unknown);
    lookupFieldPairs.forEach((pair) => {
      const referenceFieldName = this._resolveReferenceFieldName(pair);
      if (!referenceFieldName) {
        return;
      }
      const hasIdColumn = headerColumns.some((columnName) => this._matchesColumn(pair.idFieldName, columnName));
      const hasReferenceColumn = headerColumns.some((columnName) =>
        this._matchesColumn(referenceFieldName, columnName)
      );

      if (hasReferenceColumn && !hasIdColumn) {
        if (excludeIds && skipMissingFields.has(pair.idFieldName)) {
          return;
        }
        this._reportMissingColumnIssue(issues, reportedMissingFields, options, pair.idFieldName);
      }
    });

    return this._finalizeIssues(issues, options);
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Creates an issue row.
   *
   * @param options - Validation options.
   * @param fieldName - Field name.
   * @param fieldValue - Field value.
   * @param errorMessage - Error message.
   * @returns Issue row.
   */
  private static _createIssue(
    options: CsvValidationOptionsType,
    fieldName: string | null,
    fieldValue: string | null,
    errorMessage: string
  ): CsvIssueRowType {
    const dateProvider = options.dateProvider ?? ((): Date => new Date());
    const issue: CsvIssueRowType = {
      'Date update': Common.formatDateTime(dateProvider()),
      'sObject name': options.sObjectName,
      'Field name': fieldName,
      'Field value': fieldValue,
      'Parent SObject name': null,
      'Parent field name': null,
      'Parent field value': null,
      Error: errorMessage,
    };
    return options.onIssueCreated ? options.onIssueCreated(issue) : issue;
  }

  /**
   * Adds a missing column issue once per field name.
   *
   * @param issues - Issues list.
   * @param reportedMissingFields - Set of missing field names already reported.
   * @param options - Validation options.
   * @param fieldName - Missing field name.
   */
  private static _reportMissingColumnIssue(
    issues: CsvIssueRowType[],
    reportedMissingFields: Set<string>,
    options: CsvValidationOptionsType,
    fieldName: string
  ): void {
    if (reportedMissingFields.has(fieldName)) {
      return;
    }
    issues.push(this._createIssue(options, fieldName, null, options.missingColumnErrorMessage));
    reportedMissingFields.add(fieldName);
  }

  /**
   * Normalizes lookup field pairs to a strict typed array.
   *
   * @param lookupFieldPairs - Raw lookup field pairs.
   * @returns Valid lookup field pairs.
   */
  private static _normalizeLookupFieldPairs(lookupFieldPairs: unknown): CsvLookupFieldPairType[] {
    if (!Array.isArray(lookupFieldPairs)) {
      return [];
    }
    const pairs = lookupFieldPairs as unknown[];
    return pairs.filter((pair): pair is CsvLookupFieldPairType => this._isLookupFieldPair(pair));
  }

  /**
   * Checks if a value matches lookup field pair shape.
   *
   * @param value - Value to check.
   * @returns True when the value is a lookup field pair.
   */
  private static _isLookupFieldPair(value: unknown): value is CsvLookupFieldPairType {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const candidate = value as {
      idFieldName?: unknown;
      referenceFieldName?: unknown;
      externalIdFieldName?: unknown;
    };
    return (
      typeof candidate.idFieldName === 'string' &&
      (typeof candidate.referenceFieldName === 'string' || typeof candidate.referenceFieldName === 'undefined') &&
      (typeof candidate.externalIdFieldName === 'string' || typeof candidate.externalIdFieldName === 'undefined')
    );
  }

  /**
   * Returns true when a header column matches the field name.
   *
   * @param fieldName - Field API name.
   * @param columnName - Column header name.
   * @returns True when matching.
   */
  private static _matchesColumn(fieldName: string, columnName: string): boolean {
    const normalizedField = this._normalizeColumnName(fieldName);
    const normalizedColumn = this._normalizeColumnName(columnName);
    if (!normalizedField || !normalizedColumn) {
      return false;
    }
    if (normalizedColumn === normalizedField) {
      return true;
    }
    const nameParts = normalizedColumn
      .split('.')
      .map((part) => this._normalizeColumnName(part))
      .filter((part) => part.length > 0);
    if (nameParts.some((part) => part === normalizedField)) {
      return true;
    }
    if (Common.isContainsComplexField(fieldName)) {
      const plain = Common.getFieldFromComplexField(fieldName);
      const parts = plain
        .split(COMPLEX_FIELDS_SEPARATOR)
        .map((part) => this._normalizeColumnName(part))
        .filter((part) => part.length > 0);
      return parts.includes(normalizedColumn);
    }
    return false;
  }

  /**
   * Normalizes CSV header/field token for case-insensitive comparison.
   *
   * @param value - Raw header or field token.
   * @returns Normalized token.
   */
  private static _normalizeColumnName(value: string): string {
    return value
      .trim()
      .replace(/^['"`]+|['"`]+$/g, '')
      .toLowerCase();
  }

  /**
   * Resolves the relationship field name from lookup metadata.
   *
   * @param pair - Lookup field pair.
   * @returns Reference field name or null.
   */
  private static _resolveReferenceFieldName(pair: CsvLookupFieldPairType): string | null {
    if (pair.externalIdFieldName) {
      const relationshipName = Common.getFieldName__r(undefined, pair.idFieldName);
      if (!relationshipName) {
        return null;
      }
      const externalIdName = Common.getComplexField(pair.externalIdFieldName);
      return `${relationshipName}.${externalIdName}`;
    }
    return pair.referenceFieldName ?? null;
  }

  /**
   * Applies the optional issue hook.
   *
   * @param issues - Issues list.
   * @param options - Validation options.
   * @returns Finalized issues list.
   */
  private static _finalizeIssues(issues: CsvIssueRowType[], options: CsvValidationOptionsType): CsvIssueRowType[] {
    const issueHandler = options.onIssueCreated;
    if (!issueHandler) {
      return issues;
    }
    return issues.map((issue) => issueHandler(issue));
  }
}
