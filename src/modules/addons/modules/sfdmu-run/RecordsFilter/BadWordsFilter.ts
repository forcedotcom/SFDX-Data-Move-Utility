/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ISfdmuRunCustomAddonModule } from '../../../../../../custom-addon-sdk/interfaces/index.js';
import type { IRecordsFilter, IRecordsFilterArgs } from './IRecordsFilter.js';

type BadwordFilterSettingsType = {
  badwordsFile?: string;
  detectFields?: string[];
  highlightWords?: boolean;
  outputMatches?: boolean;
};

type NormalizedBadwordFilterSettingsType = {
  badwordsFile?: string;
  detectFields: string[];
  highlightWords?: boolean;
  outputMatches?: boolean;
};

type BadwordFilterArgsType = IRecordsFilterArgs & {
  settings?: BadwordFilterSettingsType;
};

/**
 * Records filter that detects configured bad words.
 */
export default class BadWordsFilter implements IRecordsFilter {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * True when the filter is ready to run.
   */
  public isInitialized = false;

  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Filter arguments.
   */
  private _args: BadwordFilterArgsType;

  /**
   * Owning add-on module.
   */
  private _module: ISfdmuRunCustomAddonModule;

  /**
   * Fields inspected for bad words.
   */
  private _detectFields: string[] = [];

  /**
   * Badwords configuration file path.
   */
  private _badwordsFile = '';

  /**
   * True when highlighted output is enabled.
   */
  private _highlightWords = false;

  /**
   * True when matches should be logged.
   */
  private _outputMatches = false;

  /**
   * List of badwords.
   */
  private _badwords: string[] = [];

  /**
   * Compiled badwords regex.
   */
  private _badwordsRegex: RegExp = new RegExp('');

  /**
   * Number of filtered records.
   */
  private _filteredNumber = 0;

  /**
   * Number of kept records.
   */
  private _keptNumber = 0;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new badwords filter instance.
   *
   * @param args - Filter arguments.
   * @param module - Add-on module instance.
   */
  public constructor(args: IRecordsFilterArgs, module: ISfdmuRunCustomAddonModule) {
    this._args = args as BadwordFilterArgsType;
    this._module = module;

    const settings = this._normalizeSettings(this._args);
    if (!settings || settings.detectFields.length === 0) {
      this._module.runtime.logFormattedError(
        this._module,
        'General_MissingRequiredArguments',
        'args.settings.detectFields'
      );
      return;
    }

    this._detectFields = settings.detectFields;
    this._outputMatches = settings.outputMatches ?? false;
    this._highlightWords = settings.highlightWords ?? false;
    this._badwordsFile = this._resolveBadwordsFile(settings.badwordsFile);

    if (!fs.existsSync(this._badwordsFile)) {
      this._module.runtime.logFormattedError(this._module, 'BadwordFilter_badwordsDetectFileError', this._badwordsFile);
      return;
    }

    const badwordsConfig = this._readBadwordsConfig(this._badwordsFile);
    if (!badwordsConfig || badwordsConfig.badwords.length === 0) {
      this._module.runtime.logFormattedError(
        this._module,
        'BadwordFilter_badwordsDetectFileEmptyList',
        this._badwordsFile
      );
      return;
    }

    this._badwords = this._expandBadwords(badwordsConfig.badwords);
    const regexString = `\\b(${this._badwords.join('|')})\\b`;
    this._module.runtime.logFormattedInfoVerbose(this._module, 'BadwordFilter_badwordsDetectRegex', regexString);
    this._badwordsRegex = new RegExp(regexString, 'gmi');

    this.isInitialized = true;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Filters records by badwords.
   *
   * @param records - Records to filter.
   * @returns Filtered records.
   */
  public filterRecords(records: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
    this._module.runtime.logFormattedInfo(
      this._module,
      'BadwordFilter_badwordsDetectStart',
      this._badwordsFile,
      this._detectFields.length > 0 ? this._detectFields.join(',') : 'all fields'
    );

    let filteredRecords = records.filter((record) => this._checkRecord(record));
    if (this._highlightWords) {
      filteredRecords = filteredRecords.map((record) => this._highlightWordsInRecord(record));
    }

    this._module.runtime.logFormattedInfo(
      this._module,
      'FilteringEnd',
      this._filteredNumber.toString(),
      this._keptNumber.toString()
    );
    return Promise.resolve(filteredRecords);
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Reads and validates the badwords configuration file.
   *
   * @param filePath - Badwords file path.
   * @returns Parsed badwords config.
   */
  private _readBadwordsConfig(filePath: string): { badwords: string[] } | null {
    void this;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as { badwords?: unknown };
      if (Array.isArray(parsed.badwords)) {
        return {
          badwords: parsed.badwords.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0),
        };
      }
    } catch {
      return null;
    }
    return null;
  }

  /**
   * Expands the badwords list with normalized variants.
   *
   * @param badwords - Raw badwords list.
   * @returns Expanded list.
   */
  private _expandBadwords(badwords: string[]): string[] {
    void this;
    const result = [...badwords];
    for (const word of badwords) {
      const normalized = word.normalize('NFD').replace(/\p{Diacritic}/gu, '');
      if (normalized && !result.includes(normalized)) {
        result.push(normalized);
      }
    }
    return result;
  }

  /**
   * Resolves the badwords file path.
   *
   * @param badwordsFile - Optional badwords file argument.
   * @returns Absolute path.
   */
  private _resolveBadwordsFile(badwordsFile?: string): string {
    const resolved = badwordsFile && badwordsFile.length > 0 ? badwordsFile : 'badwords.json';
    if (path.isAbsolute(resolved)) {
      return resolved;
    }
    return path.join(this._module.runtime.basePath, path.normalize(resolved));
  }

  /**
   * Normalizes settings from raw args.
   *
   * @param args - Raw arguments.
   * @returns Normalized settings.
   */
  private _normalizeSettings(args: BadwordFilterArgsType): NormalizedBadwordFilterSettingsType | null {
    void this;
    const settings = args.settings;
    if (!settings || typeof settings !== 'object') {
      return null;
    }
    const detectFields = Array.isArray(settings.detectFields)
      ? settings.detectFields.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : [];
    return {
      badwordsFile: typeof settings.badwordsFile === 'string' ? settings.badwordsFile : undefined,
      detectFields,
      highlightWords: typeof settings.highlightWords === 'boolean' ? settings.highlightWords : undefined,
      outputMatches: typeof settings.outputMatches === 'boolean' ? settings.outputMatches : undefined,
    };
  }

  /**
   * Checks a single record for bad words.
   *
   * @param record - Record to inspect.
   * @returns True when the record should be kept.
   */
  private _checkRecord(record: Record<string, unknown>): boolean {
    const fieldsValues = this._getFieldsValues(record);
    const found: Array<[string, string]> = [];
    for (const [field, value] of fieldsValues) {
      const textValue = value === null || typeof value === 'undefined' ? '' : String(value);
      if (this._badwordsRegex.test(textValue)) {
        found.push([field, textValue]);
      }
    }
    if (found.length > 0) {
      if (this._outputMatches) {
        const foundStr = found
          .map(([field, value]) => `${field}: ${value}${value.includes('\n') ? '\n' : ''}`)
          .join(',');
        const recordName = typeof record['Name'] === 'string' ? record['Name'] : '';
        this._module.runtime.logFormattedInfo(this._module, 'BadwordFilter_badwordsDetected', recordName, foundStr);
      }
      this._keptNumber += 1;
      return true;
    }
    this._filteredNumber += 1;
    return false;
  }

  /**
   * Highlights bad words in matching fields.
   *
   * @param record - Record to mutate.
   * @returns Updated record.
   */
  private _highlightWordsInRecord(record: Record<string, unknown>): Record<string, unknown> {
    const fieldsValues = this._getFieldsValues(record);
    for (const [field, value] of fieldsValues) {
      if (typeof record[field] === 'string') {
        // eslint-disable-next-line no-param-reassign
        record[field] = String(value ?? '').replace(this._badwordsRegex, '***$1***');
      }
    }
    return record;
  }

  /**
   * Collects field/value pairs for the record.
   *
   * @param record - Record to inspect.
   * @returns Field/value pairs.
   */
  private _getFieldsValues(record: Record<string, unknown>): Array<[string, unknown]> {
    if (this._detectFields.length > 0) {
      return Object.keys(record)
        .filter((field) => this._detectFields.includes(field))
        .map((field) => [field, record[field]]);
    }
    return Object.keys(record).map((field) => [field, record[field]]);
  }
}
