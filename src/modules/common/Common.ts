/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { Buffer } from 'node:buffer';
import * as fs from 'node:fs';
import * as readline from 'node:readline';
import { parse as parseCsvSync } from 'csv-parse/sync';
import type { CastingContext } from 'csv-parse/sync';
import type {
  Condition,
  Field as SoqlField,
  FieldType,
  LiteralType,
  LogicalOperator,
  Operator,
  Query,
  WhereClause,
} from 'soql-parser-js';
import type { PluginInfoType } from '../models/common/PluginInfoType.js';
import type { PluginPackageJsonType } from '../models/common/PluginPackageJsonType.js';
import type { SfdmuAddonInfoType } from '../models/common/SfdmuAddonInfoType.js';
import type { SfdmuCommandType } from '../models/common/SfdmuCommandType.js';
import type { SfdmuStaticsType } from '../models/common/SfdmuStaticsType.js';
import type { LoggerType } from '../logging/LoggerType.js';
import type { SFieldDescribeType } from '../models/common/SFieldDescribeType.js';
import CjsDependencyAdapters from '../dependencies/CjsDependencyAdapters.js';
import { glob, throttleAll } from '../dependencies/EsmDependencies.js';
import { CommandAbortedByUserError } from '../models/common/CommandAbortedByUserError.js';
import { CommandExecutionError } from '../models/common/CommandExecutionError.js';
import { CsvChunks } from '../models/common/CsvChunks.js';
import { CONSTANTS } from './Statics.js';

const soqlParser = CjsDependencyAdapters.getSoqlParser();
const { composeQuery, parseQuery, getComposedField } = soqlParser;
const { createObjectCsvStringifier } = CjsDependencyAdapters.getCsvWriter();

type ThrottleTask<T> = () => Promise<T>;

type SafeWhereClause = {
  left: ParenthesizedCondition;
  right?: SafeWhereClause;
  operator?: LogicalOperator;
};

type ParenthesizedCondition = Condition & {
  openParen?: number;
  closeParen?: number;
};

type NestedArray<T> = Array<T | NestedArray<T>>;

/**
 * Common utilities.
 */
export class Common {
  // ------------------------------------------------------//
  // -------------------- STATIC MEMBERS ----------------- //
  // ------------------------------------------------------//

  /**
   * Shared logger instance used by utility methods.
   */
  public static logger: LoggerType = {
    log: () => undefined,
    logColored: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    verboseFile: () => undefined,
    yesNoPromptAsync: () => Promise.resolve(true),
    textPromptAsync: () => Promise.resolve(''),
    getResourceString: () => '',
  };

  /**
   * CSV delimiter used when reading files.
   */
  public static csvReadFileDelimiter = ',';

  /**
   * CSV delimiter used when writing files.
   */
  public static csvWriteFileDelimiter = ',';

  /**
   * CSV file encoding used for read and write operations.
   */
  public static csvFileEncoding: BufferEncoding = 'utf8';

  /**
   * Internal CSV delimiter for service files (`*_source.csv`, `*_target.csv`).
   */
  public static readonly INTERNAL_CSV_FILE_DELIMITER = ',';

  /**
   * Internal CSV encoding for service files (`*_source.csv`, `*_target.csv`).
   */
  public static readonly INTERNAL_CSV_FILE_ENCODING: BufferEncoding = 'utf8';

  /**
   * CSV null insertion behavior (Data Loader-like).
   */
  public static csvInsertNulls = true;

  /**
   * Enables European date/datetime parsing for CSV input.
   */
  public static csvUseEuropeanDateFormat = false;

  /**
   * Writes uppercase CSV headers when enabled.
   */
  public static csvWriteUpperCaseHeaders = false;

  /**
   * Controls UTF-8 BOM handling for CSV read/write when encoding is UTF-8.
   * For non-UTF-8 encodings this option is ignored.
   */
  public static csvUseUtf8Bom = true;

  /**
   * Writes all non-service CSV values in quotes.
   */
  public static csvAlwaysQuoted = true;

  /**
   * CSV numeric field types.
   */
  private static readonly _CSV_NUMERIC_FIELD_TYPES = new Set([
    'int',
    'integer',
    'double',
    'currency',
    'percent',
    'long',
    'number',
    'decimal',
  ]);

  /**
   * CSV boolean true tokens.
   */
  private static readonly _CSV_BOOLEAN_TRUE_TOKENS = new Set(['1', 'true', 'yes', 'y', 'on']);

  /**
   * CSV boolean false tokens.
   */
  private static readonly _CSV_BOOLEAN_FALSE_TOKENS = new Set(['0', 'false', 'no', 'n', 'off']);

  /**
   * Always-quoted mode for internal CSV service files.
   */
  private static readonly _INTERNAL_CSV_ALWAYS_QUOTE = true;

  /**
   * CSV date field types.
   */
  private static readonly _CSV_DATE_FIELD_TYPES = new Set(['date']);

  /**
   * CSV datetime field types.
   */
  private static readonly _CSV_DATETIME_FIELD_TYPES = new Set(['datetime']);

  /**
   * CSV values that represent null.
   */
  private static readonly _CSV_NULL_TOKENS = new Set(['#n/a', 'n/a', 'null', 'undefined', '#error!', '#value!']);

  /**
   * Polyfill of flatMap for legacy usage.
   */
  public static flatMap = <T, R>(arr: T[], fn: (value: T) => R[]): R[] =>
    arr.reduce<R[]>((accumulator, value) => accumulator.concat(fn(value)), []);

  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Splits array to multiple chunks by max chunk size.
   *
   * @param array - Array to split.
   * @param chunkMaxSize - Max size of each chunk.
   * @returns Chunked array.
   */
  public static chunkArray<T>(array: T[], chunkMaxSize: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < array.length; index += chunkMaxSize) {
      chunks.push(array.slice(index, index + chunkMaxSize));
    }
    return chunks;
  }

  /**
   * Formats date to string [HH:mm:dd.mmm] using 24h-format.
   *
   * @param date - Date to format.
   * @param addMilliseconds - Set to true to add milliseconds.
   * @returns Formatted string.
   */
  public static formatDateTimeShort(date: Date, addMilliseconds = true): string {
    const time = date.toLocaleTimeString(undefined, { hour12: false });
    return addMilliseconds ? `${time}.${date.getMilliseconds()}` : time;
  }

  /**
   * Formats date to string [d_MM_yyyy_HH_mm_ss] to use with fs.
   *
   * @param date - Date to format.
   * @returns Formatted string.
   */
  public static formatFileDate(date: Date): string {
    return this.formatDateTime(date, false).replace(/[:]/g, '_').replace(/\s/g, '_').replace(/[/]/g, '_');
  }

  /**
   * Returns the plugin info.
   *
   * @param command - Command instance.
   * @returns Plugin info.
   */
  public static getPluginInfo(command: SfdmuCommandType): PluginInfoType {
    const safeCommand = Common._normalizeCommand(command);
    const statics = safeCommand.statics;
    const pluginRoot = statics.plugin.root;
    const pjson = Common._readPluginPackageJson(pluginRoot);
    const runAddOnApiInfo = pjson.addons?.run;
    const info: PluginInfoType = {
      commandName: statics.name.toLowerCase(),
      pluginName: statics.plugin.name,
      version: pjson.version,
      path: statics.plugin.root,
      runAddOnApiInfo,
      commandString: '',
      argv: safeCommand.argv,
    };
    info.commandString = `sfdx ${info.pluginName}:${info.commandName} ${safeCommand.argv.join(' ')}`;
    return info;
  }

  /**
   * Formats date to string [yyyy-MM-dd HH:mm:ss:mmm].
   *
   * @param date - Date to format.
   * @param addMilliseconds - Set to true to add milliseconds.
   * @returns Formatted string.
   */
  public static formatDateTime(date: Date, addMilliseconds = true): string {
    const hours = date.getHours() % 24;
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();
    const milliseconds = date.getMilliseconds();
    const strTime =
      `${this.addLeadnigZeros(hours, 2)}` +
      `:${this.addLeadnigZeros(minutes, 2)}` +
      `:${this.addLeadnigZeros(seconds, 2)}` +
      (addMilliseconds ? `.${this.addLeadnigZeros(milliseconds, 3)}` : '');
    return (
      `${date.getFullYear()}` +
      `-${this.addLeadnigZeros(date.getMonth() + 1, 2)}` +
      `-${this.addLeadnigZeros(date.getDate(), 2)}` +
      `  ${strTime}`
    );
  }

  /**
   * Returns a difference between two dates in format [HH:mm:ss.mmm].
   *
   * @param dateStart - Start date.
   * @param dateEnd - End date.
   * @returns Diff string.
   */
  public static timeDiffString(dateStart: Date, dateEnd: Date): string {
    const duration = Math.abs(dateEnd.getTime() - dateStart.getTime());
    const milliseconds = duration % 1000;
    const seconds = (duration / 1000) % 60;
    const minutes = (duration / (1000 * 60)) % 60;
    const hours = (duration / (1000 * 60 * 60)) % 24;
    return (
      `${this.addLeadnigZeros(Math.floor(hours), 2)}h ` +
      `${this.addLeadnigZeros(Math.floor(minutes), 2)}m ` +
      `${this.addLeadnigZeros(Math.floor(seconds), 2)}s ` +
      `${this.addLeadnigZeros(Math.floor(milliseconds), 3)}ms `
    );
  }

  /**
   * Returns the full command line string used to start the CLI.
   *
   * @returns Full command string.
   */
  public static getFullCommandLine(): string {
    if (process.argv.length >= 3) {
      return `sfdx ${process.argv.slice(2).join(' ')}`;
    }
    return process.argv.join(' ');
  }

  /**
   * Converts given UTC date to the local date.
   *
   * @param date - UTC date.
   * @returns Local date.
   */
  public static convertUTCDateToLocalDate(date: Date): Date {
    const newDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    const offset = date.getTimezoneOffset() / 60;
    const hours = date.getHours();
    newDate.setHours(hours - offset);
    return newDate;
  }

  /**
   * Left pads the number with given number of leading zeros.
   *
   * @param num - Number to convert.
   * @param size - Total size of the resulting string.
   * @returns Padded string.
   */
  public static addLeadnigZeros(num: number, size: number): string {
    let value = String(num);
    while (value.length < (size || 2)) {
      value = `0${value}`;
    }
    return value;
  }

  /**
   * Transforms array of arrays to single array of objects.
   *
   * @param array - Source array in format: [[],[],[]].
   * @returns Array of objects.
   */
  public static transformArrayOfArrays(array: unknown[][]): Array<Record<string, unknown>> {
    if (!array || array.length === 0) {
      return [];
    }
    const props = array[0] as string[];
    return array.slice(1).map((subArray) =>
      subArray.reduce<Record<string, unknown>>(
        (item, subArrayItem, propIndex) => ({
          ...item,
          [props[propIndex]]: subArrayItem,
        }),
        {}
      )
    );
  }

  /**
   * Converts array to map with object hashcode as a map key.
   *
   * @param array - Array to convert.
   * @param propsToExclude - Properties to exclude from hashcode.
   * @returns Map of hashcode => object.
   */
  public static arrayToMapByHashcode(
    array: Array<Record<string, unknown>>,
    propsToExclude?: string[]
  ): Map<string, Record<string, unknown>> {
    const map = new Map<string, Record<string, unknown>>();
    array.forEach((item) => {
      let hash = String(this.getObjectHashcode(item, propsToExclude));
      const baseHash = hash;
      let counter = 0;
      while (map.has(hash)) {
        hash = `${baseHash}_${counter++}`;
      }
      map.set(hash, item);
    });
    return map;
  }

  /**
   * Converts array to map with object property as a key.
   *
   * @param array - Array to convert.
   * @param propertyName - Property used to build the key.
   * @returns Map of property value => object.
   */
  public static arrayToMapByProperty(
    array: Array<Record<string, unknown>>,
    propertyName: string
  ): Map<string, Record<string, unknown>> {
    const map = new Map<string, Record<string, unknown>>();
    array.forEach((item) => {
      let key = String(item[propertyName]);
      const baseKey = key;
      let counter = 0;
      while (map.has(key)) {
        key = `${baseKey}_${counter++}`;
      }
      map.set(key, item);
    });
    return map;
  }

  /**
   * Returns a mapping between objects compared by object hashcode.
   *
   * @param arrayOfKeys - First array (keys).
   * @param arrayOfValues - Second array (values).
   * @param propsToExclude - Properties to exclude when calculating hashcode.
   * @param mkeys - Precomputed key map.
   * @param mvalues - Precomputed value map.
   * @returns Map of object => object.
   */
  public static compareArraysByHashcode(
    arrayOfKeys: Array<Record<string, unknown>>,
    arrayOfValues: Array<Record<string, unknown>>,
    propsToExclude?: string[],
    mkeys?: Map<string, Record<string, unknown>>,
    mvalues?: Map<string, Record<string, unknown>>
  ): Map<Record<string, unknown>, Record<string, unknown> | undefined> {
    const keys = arrayOfKeys || [];
    const values = arrayOfValues || [];
    const keysMap = mkeys ?? this.arrayToMapByHashcode(keys, propsToExclude);
    const valuesMap = mvalues ?? this.arrayToMapByHashcode(values, propsToExclude);
    const result = new Map<Record<string, unknown>, Record<string, unknown> | undefined>();
    [...keysMap.keys()].forEach((hash) => {
      result.set(keysMap.get(hash) as Record<string, unknown>, valuesMap.get(hash));
    });
    return result;
  }

  /**
   * Creates a mapping between members of two arrays compared by the given property.
   *
   * @param arrayOfKeys - First array (keys).
   * @param arrayOfValues - Second array (values).
   * @param propertyName - Property to compare.
   * @param mkeys - Precomputed key map.
   * @param mvalues - Precomputed value map.
   * @returns Map of object => object.
   */
  public static compareArraysByProperty(
    arrayOfKeys: Array<Record<string, unknown>>,
    arrayOfValues: Array<Record<string, unknown>>,
    propertyName: string,
    mkeys?: Map<string, Record<string, unknown>>,
    mvalues?: Map<string, Record<string, unknown>>
  ): Map<Record<string, unknown>, Record<string, unknown> | undefined> {
    const keys = arrayOfKeys || [];
    const values = arrayOfValues || [];
    const keysMap = mkeys ?? this.arrayToMapByProperty(keys, propertyName);
    const valuesMap = mvalues ?? this.arrayToMapByProperty(values, propertyName);
    const result = new Map<Record<string, unknown>, Record<string, unknown> | undefined>();
    [...keysMap.keys()].forEach((key) => {
      result.set(keysMap.get(key) as Record<string, unknown>, valuesMap.get(key));
    });
    return result;
  }

  /**
   * Returns numeric hashcode of the input string.
   *
   * @param inputString - Input string value.
   * @returns Hashcode.
   */
  public static getStringHashcode(inputString: string): number {
    if (!inputString) {
      return 0;
    }
    return inputString.split('').reduce((accumulator, char) => {
      const next = (accumulator << 5) - accumulator + char.charCodeAt(0);
      return next & next;
    }, 0);
  }

  /**
   * Calculate a 32 bit FNV-1a hash.
   *
   * @param inputString - Input value.
   * @param asString - Set to true to return hex string.
   * @param seed - Optional hash seed.
   * @returns Hash value.
   */
  public static getString32FNV1AHashcode(inputString: string, asString?: boolean, seed?: number): string | number {
    // eslint-disable-next-line unicorn/numeric-separators-style
    let hval = seed ?? 0x811c9dc5;
    for (let index = 0; index < inputString.length; index++) {
      hval ^= inputString.charCodeAt(index);
      hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    if (asString) {
      return `0000000${(hval >>> 0).toString(16)}`.slice(-8);
    }
    return hval >>> 0;
  }

  /**
   * Returns numeric hashcode of the input object.
   *
   * @param inputObject - Object to hash.
   * @param propsToExclude - Properties to exclude from hashing.
   * @returns Hashcode.
   */
  public static getObjectHashcode(inputObject: Record<string, unknown>, propsToExclude: string[] = []): number {
    if (!inputObject) {
      return 0;
    }
    const keys = Object.keys(inputObject)
      .filter((key) => !propsToExclude.includes(key))
      .sort();
    const str = keys
      .map((key) => {
        const value = inputObject[key];
        if (value === 'TRUE' || value === true) {
          return 'true';
        }
        if (value === 'FALSE' || value === false) {
          return 'false';
        }
        const numericValue = Number(value);
        if (!Number.isNaN(numericValue)) {
          return String(numericValue);
        }
        const parsedDate = Date.parse(String(value));
        if (!Number.isNaN(parsedDate)) {
          return String(parsedDate);
        }
        if (!value || value === '#N/A') {
          return '';
        }
        return String(value).replace(/[\n\r\s]/gi, '');
      })
      .join('');
    return this.getStringHashcode(str);
  }

  /**
   * Trims end of string if the string ends with the given suffix.
   *
   * @param str - String to trim.
   * @param toTrim - Suffix to trim.
   * @returns Trimmed string.
   */
  public static trimEndStr(str: string, toTrim: string): string {
    if (str.endsWith(toTrim)) {
      return str.substring(0, str.lastIndexOf(toTrim));
    }
    return str;
  }

  /**
   * Replaces the last occurrence of the given substring in the original string.
   *
   * @param original - Original string.
   * @param toReplace - Substring to replace.
   * @param replacement - Replacement string.
   * @returns Modified string.
   */
  public static replaceLast(original: string, toReplace: string, replacement: string): string {
    if (original.endsWith(toReplace)) {
      const startPos = original.length - toReplace.length;
      return original.substring(0, startPos) + replacement;
    }
    return original;
  }

  /**
   * Modifies existing WHERE clause by adding an extra rule.
   *
   * @param where - Source query WHERE to modify.
   * @param fieldName - Field name.
   * @param values - Values to compare against the field.
   * @param operator - Operator for the extra WHERE.
   * @param literalType - Literal type for the extra WHERE.
   * @param logicalOperator - Logical operator between clauses.
   * @returns Modified WHERE clause.
   */
  public static composeWhereClause(
    where: WhereClause | undefined,
    fieldName: string,
    values: string[] | string,
    operator: Operator = 'IN',
    literalType: LiteralType = 'STRING',
    logicalOperator: LogicalOperator = 'OR'
  ): WhereClause {
    const safeWhere = where as SafeWhereClause | undefined;
    const valuesIsArray = Array.isArray(values);
    const valuesArray = (valuesIsArray ? values : [values])
      .filter((value) => Boolean(value))
      .map((value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
    const sanitizedValues = valuesIsArray ? valuesArray : valuesArray[0];
    const condition: ParenthesizedCondition = {
      field: fieldName,
      operator,
      value: sanitizedValues,
      literalType,
    };
    if (!safeWhere?.left) {
      const ret = { left: condition };
      ret.left.openParen = 1;
      ret.left.closeParen = 1;
      return ret;
    }
    safeWhere.left.openParen = Number(safeWhere.left.openParen ?? 0) + 1;
    safeWhere.left.closeParen = Number(safeWhere.left.closeParen ?? 0) + 1;
    const wrappedCondition: ParenthesizedCondition = {
      ...condition,
      openParen: 1,
      closeParen: 1,
    };
    return { left: wrappedCondition, right: safeWhere, operator: logicalOperator };
  }

  /**
   * Returns distinct array of objects by the given object property.
   *
   * @param array - Source array.
   * @param distinctByProp - Property name to compare.
   * @param stringIgnoreCase - Set true to compare strings case-insensitively.
   * @returns Distinct array.
   */
  public static distinctArray<T extends Record<string, unknown>>(
    array: T[],
    distinctByProp: keyof T & string,
    stringIgnoreCase?: boolean
  ): T[] {
    return array.filter((obj, pos, arr) => {
      if (!stringIgnoreCase) {
        return arr.map((item) => item[distinctByProp]).indexOf(obj[distinctByProp]) === pos;
      }
      const getValue = (item: T): string => String(item[distinctByProp] ?? '').toLowerCase();
      return arr.map(getValue).indexOf(getValue(obj)) === pos;
    });
  }

  /**
   * Returns array of distinct string values.
   *
   * @param array - Source array.
   * @param stringIgnoreCase - Set true to compare strings case-insensitively.
   * @returns Distinct array.
   */
  public static distinctStringArray(array: string[], stringIgnoreCase?: boolean): string[] {
    if (!stringIgnoreCase) {
      return [...new Set(array)];
    }
    const map = new Map(array.map((item) => [item.toLowerCase(), item]));
    return [...map.values()];
  }

  /**
   * Removes all objects from the array which match given property value.
   *
   * @param array - Array to mutate.
   * @param field - Property name.
   * @param value - Property value.
   * @returns Removed items.
   */
  public static removeBy(
    array: Array<Record<string, unknown>>,
    field: string,
    value: string
  ): Array<Record<string, unknown>> {
    return array.splice(
      array.findIndex((item) => item[field] === value),
      1
    );
  }

  /**
   * Filters the input map by the keys from the array.
   *
   * @param keysToFilter - Keys to filter.
   * @param sourceMap - Source map to filter.
   * @param defaultValueCallback - Optional value factory when key missing.
   * @param addDefaultValueToSourceMapIfNotExist - Add generated defaults to source map.
   * @returns Filtered map.
   */
  public static filterMapByArray<T>(
    keysToFilter: string[],
    sourceMap: Map<string, T>,
    defaultValueCallback?: (key: string) => T,
    addDefaultValueToSourceMapIfNotExist?: boolean
  ): Map<string, T> {
    return keysToFilter.reduce((mapAccumulator, key) => {
      const obj = sourceMap.get(key);
      if (obj) {
        mapAccumulator.set(key, obj);
      } else if (defaultValueCallback) {
        const value = defaultValueCallback(key);
        mapAccumulator.set(key, value);
        if (addDefaultValueToSourceMapIfNotExist) {
          sourceMap.set(key, value);
        }
      }
      return mapAccumulator;
    }, new Map<string, T>());
  }

  /**
   * Returns true if the field name is a complex field name or __r field name.
   *
   * @param fieldName - Field name to check.
   * @returns True when the field is complex.
   */
  // eslint-disable-next-line camelcase
  public static isComplexOr__rField(fieldName: string): boolean {
    return Boolean(
      fieldName &&
        (fieldName.includes('.') ||
          fieldName.includes(CONSTANTS.COMPLEX_FIELDS_SEPARATOR) ||
          fieldName.startsWith(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX))
    );
  }

  /**
   * Compares field description property value against the given pattern.
   *
   * @param fieldDescribeProperty - Field description property value.
   * @param patternProperty - Pattern property to match.
   * @param negative - Set true for negative match.
   * @returns True when the property matches.
   */
  public static isDescriptionPropertyMatching(
    fieldDescribeProperty: unknown,
    patternProperty: unknown,
    negative = false
  ): boolean {
    if (!negative) {
      // eslint-disable-next-line eqeqeq
      return fieldDescribeProperty == patternProperty || typeof patternProperty === 'undefined';
    }
    // eslint-disable-next-line eqeqeq
    return fieldDescribeProperty != patternProperty && typeof fieldDescribeProperty !== 'undefined';
  }

  /**
   * Returns true if the field name is a __r field name.
   *
   * @param fieldName - Field name to check.
   * @returns True when the field is a relationship field.
   */
  // eslint-disable-next-line camelcase
  public static is__rField(fieldName: string): boolean {
    return Boolean(fieldName && fieldName.includes('.'));
  }

  /**
   * Returns true if the field name is a complex field name.
   *
   * @param fieldName - Field name to check.
   * @returns True when the field is complex.
   */
  public static isComplexField(fieldName: string): boolean {
    return Boolean(
      fieldName &&
        (fieldName.includes(CONSTANTS.COMPLEX_FIELDS_SEPARATOR) ||
          fieldName.startsWith(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX))
    );
  }

  /**
   * Returns true if the field name contains a complex field name.
   *
   * @param fieldName - Field name to check.
   * @returns True when the field contains complex tokens.
   */
  public static isContainsComplexField(fieldName: string): boolean {
    return Boolean(fieldName && fieldName.includes(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX));
  }

  /**
   * Transforms field name into the complex field format.
   *
   * @param fieldName - Field name to transform.
   * @returns Complex field name.
   */
  public static getComplexField(fieldName: string): string {
    if (!fieldName) {
      return fieldName;
    }
    if (fieldName.includes(CONSTANTS.COMPLEX_FIELDS_SEPARATOR)) {
      return (
        CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX +
        fieldName.replace(
          new RegExp(`[${CONSTANTS.COMPLEX_FIELDS_SEPARATOR}]`, 'g'),
          CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR
        )
      );
    }
    return fieldName;
  }

  /**
   * Transforms complex field name into the field name.
   *
   * @param fieldName - Field name to transform.
   * @returns Normalized field name.
   */
  public static getFieldFromComplexField(fieldName: string): string {
    if (!fieldName || !Common.isContainsComplexField(fieldName)) {
      return fieldName;
    }
    return fieldName
      .replace(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX, '')
      .replace(new RegExp(`[${CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR}]`, 'g'), CONSTANTS.COMPLEX_FIELDS_SEPARATOR);
  }

  /**
   * Reads CSV file from the disk.
   *
   * @param filePath - Full path to the CSV file.
   * @param linesAmountToRead - Optional number of lines to read.
   * @param columnToColumnDataTypeMap - Optional column-to-type mapping.
   * @param preserveRawNullTokens - Keeps null tokens as raw string values when true.
   * @param useInternalCsvFormat - Forces internal CSV format (`comma + UTF-8`) when true.
   * @returns Array of row objects.
   */
  public static async readCsvFileAsync(
    filePath: string,
    linesAmountToRead = 0,
    columnToColumnDataTypeMap?: Map<string, string>,
    preserveRawNullTokens = false,
    useInternalCsvFormat = false
  ): Promise<Array<Record<string, unknown>>> {
    const readDelimiter = useInternalCsvFormat ? Common.INTERNAL_CSV_FILE_DELIMITER : Common.csvReadFileDelimiter;
    const readEncoding = useInternalCsvFormat ? Common.INTERNAL_CSV_FILE_ENCODING : Common.csvFileEncoding;
    const shouldStripUtf8Bom = useInternalCsvFormat || (Common.csvUseUtf8Bom && Common._isUtf8Encoding(readEncoding));
    const normalizedColumnDataTypeMap = new Map<string, string>();
    columnToColumnDataTypeMap?.forEach((fieldType, columnName) => {
      const normalizedName = columnName.trim().toLowerCase();
      if (!normalizedName) {
        return;
      }
      if (!normalizedColumnDataTypeMap.has(normalizedName)) {
        normalizedColumnDataTypeMap.set(normalizedName, fieldType);
      }
    });
    function csvCast(value: string, context: CastingContext): unknown {
      if (context.header || typeof context.column === 'undefined') {
        return value;
      }

      const rawValue = typeof value === 'string' ? value : String(value ?? '');
      const normalizedRawValue = rawValue.replace(/\r+$/g, '');
      const trimmedValue = normalizedRawValue.trim();
      if (!trimmedValue.length) {
        if (preserveRawNullTokens) {
          return normalizedRawValue;
        }
        return Common.csvInsertNulls ? null : '';
      }

      if (!preserveRawNullTokens && Common._isCsvNullToken(trimmedValue)) {
        return null;
      }

      const columnName = typeof context.column === 'string' ? context.column : String(context.column);
      const fieldType = resolveFieldType(columnName)?.toLowerCase();
      if (!fieldType) {
        return normalizedRawValue;
      }

      return Common._castCsvValueByFieldType(normalizedRawValue, trimmedValue, fieldType);
    }

    function resolveColumns(header: string[]): Array<string | undefined> {
      void columnToColumnDataTypeMap;
      return header;
    }

    function resolveFieldType(columnName: string): string | undefined {
      const directFieldType = columnToColumnDataTypeMap?.get(columnName);
      if (directFieldType) {
        return directFieldType;
      }
      return normalizedColumnDataTypeMap.get(columnName.trim().toLowerCase());
    }

    return new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        resolve([]);
        return;
      }
      try {
        if (linesAmountToRead === 0) {
          let input = fs.readFileSync(filePath, readEncoding);
          input = shouldStripUtf8Bom ? input.replace(/^\uFEFF/, '') : input;
          /* eslint-disable camelcase */
          const records = parseCsvSync<Record<string, unknown>>(input, {
            columns: resolveColumns,
            delimiter: readDelimiter,
            relax_quotes: true,
            skip_empty_lines: true,
            skip_records_with_error: true,
            cast: csvCast,
          });
          /* eslint-enable camelcase */
          resolve([...records]);
          return;
        }

        const lineReader = readline.createInterface({
          input: fs.createReadStream(filePath, { encoding: readEncoding }),
        });
        let lineCounter = 0;
        const wantedLines: string[] = [];
        lineReader.on('line', (line: string) => {
          lineCounter += 1;
          wantedLines.push(line);
          if (lineCounter === linesAmountToRead) {
            lineReader.close();
          }
        });
        lineReader.on('close', () => {
          if (wantedLines.length === 1) {
            const input = shouldStripUtf8Bom ? wantedLines[0].replace(/^\uFEFF/, '') : wantedLines[0];
            /* eslint-disable camelcase */
            const headerRows: string[][] = parseCsvSync(input, {
              delimiter: readDelimiter,
              relax_quotes: true,
              skip_empty_lines: true,
            });
            /* eslint-enable camelcase */
            const headerColumns = headerRows[0] ?? [];
            if (headerColumns.length === 0) {
              resolve([]);
              return;
            }
            const headerMap = Object.fromEntries(headerColumns.map((field) => [field, null])) as Record<
              string,
              unknown
            >;
            const output = [headerMap];
            resolve(output);
            return;
          }
          const rawInput = wantedLines.join('\n');
          const input = shouldStripUtf8Bom ? rawInput.replace(/^\uFEFF/, '') : rawInput;
          /* eslint-disable camelcase */
          const records = parseCsvSync<Record<string, unknown>>(input, {
            columns: true,
            delimiter: readDelimiter,
            relax_quotes: true,
            skip_empty_lines: true,
            skip_records_with_error: true,
            cast: csvCast,
          });
          /* eslint-enable camelcase */
          resolve([...records]);
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        reject(new CommandExecutionError(this.logger.getResourceString('readingCsvFileError', filePath, message)));
      }
    });
  }

  /**
   * Orders CSV columns with Id first and error columns last.
   *
   * @param columns - Columns to order.
   * @returns Ordered columns.
   */
  public static orderCsvColumnsWithIdFirstAndErrorsLast(columns: string[]): string[] {
    if (columns.length === 0) {
      return [];
    }
    const errorColumnSet = new Set([CONSTANTS.ERRORS_FIELD_NAME.toLowerCase()]);
    const oldIdColumnSet = new Set([CONSTANTS.TARGET_CSV_OLD_ID_FIELD_NAME.toLowerCase()]);
    const ordered: string[] = [];
    const middle: string[] = [];
    const tail: string[] = [];
    let idColumn: string | undefined;
    let oldIdColumn: string | undefined;

    columns.forEach((column) => {
      if (column === 'Id') {
        idColumn = column;
        return;
      }
      if (oldIdColumnSet.has(column.toLowerCase())) {
        oldIdColumn = column;
        return;
      }
      if (errorColumnSet.has(column.toLowerCase())) {
        tail.push(column);
        return;
      }
      middle.push(column);
    });

    if (idColumn) {
      ordered.push(idColumn);
    }
    if (oldIdColumn) {
      ordered.push(oldIdColumn);
    }
    ordered.push(...middle, ...tail);
    return ordered;
  }

  /**
   * Writes array of objects into a CSV file.
   *
   * @param filePath - Full CSV file path.
   * @param array - Array of objects to write.
   * @param createEmptyFileOnEmptyArray - Create empty file if array empty.
   * @param columns - Optional list of columns to include.
   * @param preserveColumnOrder - True to skip automatic sorting.
   * @param useInternalCsvFormat - Forces internal CSV format (`comma + UTF-8 + quoted`) when true.
   * @param alwaysQuoteValues - Always quotes all CSV values when true.
   */
  public static async writeCsvFileAsync(
    filePath: string,
    array: Array<Record<string, unknown>>,
    createEmptyFileOnEmptyArray = false,
    columns?: string[],
    preserveColumnOrder = false,
    useInternalCsvFormat = false,
    alwaysQuoteValues = false
  ): Promise<void> {
    const writeDelimiter = useInternalCsvFormat ? Common.INTERNAL_CSV_FILE_DELIMITER : Common.csvWriteFileDelimiter;
    const writeEncoding = useInternalCsvFormat ? Common.INTERNAL_CSV_FILE_ENCODING : Common.csvFileEncoding;
    const alwaysQuote = useInternalCsvFormat
      ? Common._INTERNAL_CSV_ALWAYS_QUOTE
      : alwaysQuoteValues || Common.csvAlwaysQuoted;
    const writeUpperCaseHeaders = useInternalCsvFormat ? false : Common.csvWriteUpperCaseHeaders;
    const shouldWriteUtf8Bom = Common._isUtf8Encoding(writeEncoding) && (useInternalCsvFormat || Common.csvUseUtf8Bom);
    try {
      if (!array || array.length === 0) {
        if (createEmptyFileOnEmptyArray) {
          fs.writeFileSync(filePath, shouldWriteUtf8Bom ? '\uFEFF' : '', { encoding: writeEncoding });
        }
        return;
      }

      const headerColumns = columns ?? Object.keys(array[0]);
      const orderedColumns = preserveColumnOrder
        ? [...headerColumns]
        : headerColumns.slice().sort((left, right) => left.localeCompare(right));
      const headerOutputColumns = writeUpperCaseHeaders
        ? orderedColumns.map((column) => column.toUpperCase())
        : orderedColumns;

      const lines: string[] = [];
      lines.push(this._createCsvRowLine(headerOutputColumns, writeDelimiter, alwaysQuote));
      array.forEach((record) => {
        const rowValues = orderedColumns.map((columnName) => this._convertCsvCellValue(record[columnName]));
        lines.push(this._createCsvRowLine(rowValues, writeDelimiter, alwaysQuote));
      });

      const fileContent = `${lines.join('\n')}\n`;
      await fs.promises.writeFile(filePath, `${shouldWriteUtf8Bom ? '\uFEFF' : ''}${fileContent}`, {
        encoding: writeEncoding,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CommandExecutionError(this.logger.getResourceString('writingCsvFileError', filePath, message));
    }
  }

  /**
   * Merges all rows from two source csv files into a single csv file.
   *
   * @param source1FilePath - Full path to the first csv.
   * @param source2FilePath - Full path to the second csv.
   * @param targetFilePath - Full path to the merged csv to create.
   * @param deleteSourceFiles - Set true to delete sources after merge.
   * @param columns - Columns to include.
   */
  public static async mergeCsvFilesAsync(
    source1FilePath: string,
    source2FilePath: string,
    targetFilePath: string,
    deleteSourceFiles: boolean,
    ...columns: string[]
  ): Promise<void> {
    const totalRows: Array<Record<string, unknown>> = [];
    await addRowsFromFile(source1FilePath);
    await addRowsFromFile(source2FilePath);
    await this.writeCsvFileAsync(targetFilePath, totalRows);

    async function addRowsFromFile(file: string): Promise<void> {
      if (fs.existsSync(file)) {
        const rows = await Common.readCsvFileAsync(file);
        rows.forEach((row) => {
          const nextRow = columns.reduce<Record<string, unknown>>(
            (acc, column) => ({
              ...acc,
              [column]: typeof row[column] !== 'undefined' ? row[column] : null,
            }),
            {}
          );
          totalRows.push(nextRow);
        });
        if (deleteSourceFiles) {
          fs.unlinkSync(file);
        }
      }
    }
  }

  /**
   * Transforms array of objects into array of CSV strings.
   *
   * @param array - Array of objects to transform.
   * @param maxCsvStringSizeInBytes - Max size of each CSV string in bytes.
   * @param blockSize - Array block size for chunking.
   * @param lineDelimiter - Line delimiter for the csv.
   * @param encoding - Encoding for each value in the generated csv string.
   * @returns CSV chunks with headers.
   */
  public static createCsvStringsFromArray(
    array: Array<Record<string, unknown>>,
    maxCsvStringSizeInBytes: number,
    blockSize: number,
    lineDelimiter = '\n',
    encoding: BufferEncoding = 'utf-8'
  ): CsvChunks<Record<string, unknown>> {
    if (!array || array.length === 0) {
      return new CsvChunks();
    }

    const arrayBlocks = this.chunkArray(array, blockSize);
    const headerArray = Object.keys(array[0])
      .map((key) => ({
        id: key,
        title: key,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const csvStringifier = createObjectCsvStringifier({
      header: headerArray,
      alwaysQuote: true,
      recordDelimiter: lineDelimiter,
    });
    const header = csvStringifier.getHeaderString();
    const csvStrings: Array<[Array<Record<string, unknown>>, string]> = [];
    let buffer = Buffer.from('', encoding);
    let totalCsvChunkSize = 0;
    let arrayBuffer: Array<Record<string, unknown>> = [];

    for (const arrayBlock of arrayBlocks) {
      const csvBlock = Buffer.from(csvStringifier.stringifyRecords(arrayBlock), encoding);
      const csvBlockSize = csvBlock.toString('base64').length;
      if (totalCsvChunkSize + csvBlockSize <= maxCsvStringSizeInBytes) {
        buffer = Buffer.concat([buffer, csvBlock]);
        arrayBuffer = arrayBuffer.concat(arrayBlock);
      } else {
        if (arrayBuffer.length > 0) {
          csvStrings.push([arrayBuffer, (header + buffer.toString(encoding)).trim()]);
        }
        buffer = csvBlock;
        arrayBuffer = arrayBlock;
        totalCsvChunkSize = 0;
      }
      totalCsvChunkSize += csvBlockSize;
    }

    if (arrayBuffer.length > 0) {
      csvStrings.push([arrayBuffer, (header + buffer.toString(encoding)).trim()]);
    }

    return new CsvChunks({
      chunks: csvStrings.map(([records, csvString]) => ({
        records,
        csvString,
      })),
      header: headerArray.map((item) => item.id),
    });
  }

  /**
   * Read csv file only once and cache it into the Map.
   *
   * @param csvDataCacheMap - Cache map.
   * @param fileName - File name to read.
   * @param indexFieldName - Index column name.
   * @param indexValueLength - Length for generated index values.
   * @param useRowIndexAutonumber - Use row number as index if true.
   * @param addIndexKeyValues - Populate missing index values if true.
   * @returns Cached map of rows.
   */
  public static async readCsvFileOnceAsync(
    csvDataCacheMap: Map<string, Map<string, Record<string, unknown>>>,
    fileName: string,
    indexFieldName?: string,
    indexValueLength?: number,
    useRowIndexAutonumber?: boolean,
    addIndexKeyValues?: boolean
  ): Promise<Map<string, Record<string, unknown>>> {
    const finalIndexFieldName = indexFieldName ?? 'Id';
    const finalIndexValueLength = indexValueLength ?? 18;
    const finalUseRowIndexAutonumber =
      typeof useRowIndexAutonumber === 'undefined' || useRowIndexAutonumber === null ? false : useRowIndexAutonumber;
    const finalAddIndexKeyValues =
      typeof addIndexKeyValues === 'undefined' || addIndexKeyValues === null ? true : addIndexKeyValues;

    let currentFileMap = csvDataCacheMap.get(fileName);

    if (!currentFileMap) {
      if (!fs.existsSync(fileName)) {
        return new Map();
      }
      const csvRows = await Common.readCsvFileAsync(fileName);
      currentFileMap = new Map();
      csvRows.forEach((row, index) => {
        const indexKey = finalUseRowIndexAutonumber
          ? String(index + 1)
          : Common.makeId(finalIndexValueLength).toUpperCase();
        const updatedRow =
          !row[finalIndexFieldName] && finalAddIndexKeyValues ? { ...row, [finalIndexFieldName]: indexKey } : row;
        const resolvedKey = String(updatedRow[finalIndexFieldName] ?? indexKey);
        currentFileMap?.set(resolvedKey, updatedRow);
      });
      csvDataCacheMap.set(fileName, currentFileMap);
    }
    return currentFileMap;
  }

  /**
   * List directory files by mask.
   *
   * @param fileDirectory - Directory to list.
   * @param fileMask - File mask.
   * @returns List of file paths.
   */
  public static async listDirAsync(fileDirectory: string, fileMask = '*'): Promise<string[]> {
    const pattern = path.join(fileDirectory, fileMask);
    return glob(pattern);
  }

  /**
   * Displays yes/no user prompt to abort the operation.
   *
   * @param warnMessage - Warning message key.
   * @param showPrompt - Set true to show prompt.
   * @param promptMessage - Prompt message key.
   * @param errorMessage - Error message key.
   * @param onBeforeAbortAsync - Optional hook before aborting.
   * @param warnTokens - Tokens for warning message.
   */
  public static async abortWithPrompt(
    warnMessage: string,
    showPrompt: boolean,
    promptMessage: string,
    errorMessage: string,
    onBeforeAbortAsync?: () => Promise<void>,
    ...warnTokens: string[]
  ): Promise<void> {
    this.logger.warn(warnMessage, ...warnTokens);
    if (showPrompt) {
      if (!(await this.logger.yesNoPromptAsync(promptMessage))) {
        this.logger.log('');
        if (onBeforeAbortAsync) {
          await onBeforeAbortAsync();
        }
        throw new CommandAbortedByUserError(errorMessage);
      }
      this.logger.log('');
    }
  }

  /**
   * Generates random id string with given length.
   *
   * @param length - Desired length.
   * @returns Random id.
   */
  public static makeId(length = 10): string {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let index = 0; index < length; index++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  /**
   * Returns true if this object is custom.
   *
   * @param objectName - Object name.
   * @returns True when object is custom.
   */
  public static isCustomObject(objectName: string): boolean {
    if (!objectName) {
      return false;
    }
    return objectName.endsWith('__c') || objectName.endsWith('__pc') || objectName.endsWith('__s');
  }

  /**
   * Splits string using multiple separators.
   *
   * @param value - Source string.
   * @param separators - Separators to use.
   * @returns Split values.
   */
  public static splitMulti(value: string, separators: string[]): string[] {
    const tempChar = 't3mp';
    const regex = new RegExp(`\\b(${separators.join('|')})\\b`, 'g');
    const temp = value.replace(regex, tempChar).split(tempChar);
    return temp.map((item) => item.trim()).filter((item) => item.length > 0);
  }

  /**
   * Extracts WHERE clause from the query string.
   *
   * @param query - Query to process.
   * @returns Where clause or null.
   */
  public static extractWhereClause(query: string): string | null {
    if ((query || '').match(/WHERE/i)) {
      return query.match(/^.*?WHERE.*?(.+?(?=LIMIT|OFFSET|GROUP|ORDER|$))/i)?.[1].trim() ?? null;
    }
    return null;
  }

  /**
   * Creates array of SOQLs containing WHERE Field IN clauses for given values.
   *
   * @param selectFields - Field names to select.
   * @param fieldName - Field name to use in the WHERE clause.
   * @param sObjectName - SObject name.
   * @param valuesIN - Values for the IN clause.
   * @param whereClause - Additional where clause.
   * @param orderByClause - Optional order by clause.
   * @returns Array of SOQL strings.
   */
  public static createFieldInQueries(
    selectFields: string[],
    fieldName = 'Id',
    sObjectName: string,
    valuesIN: string[],
    whereClause?: string,
    orderByClause?: string
  ): string[] {
    if (valuesIN.length === 0) {
      return [];
    }

    const whereClauseLength = (whereClause ?? '').length;
    const tempWhere: SafeWhereClause = {
      left: {
        field: fieldName,
        operator: 'IN',
        value: [],
        literalType: 'STRING',
      },
    };
    const tempQuery: Query = {
      fields: selectFields.map((field) => getComposedField(field)),
      where: tempWhere as WhereClause,
      sObject: sObjectName,
    };
    let whereValuesCounter = 0;
    let whereValues: string[] = [];

    const parsedWhere = whereClause ? parseQuery(`SELECT Id FROM Account WHERE (${whereClause})`) : undefined;
    const parsedOrderBy = orderByClause ? parseQuery(`SELECT Id FROM Account ORDER BY ${orderByClause}`) : undefined;

    function* queryGen(): Generator<string> {
      while (true) {
        for (
          let whereClauseLengthInner = whereClauseLength;
          whereClauseLengthInner < CONSTANTS.MAX_SOQL_WHERE_CLAUSE_CHARACTER_LENGTH;

        ) {
          const value = String(valuesIN[whereValuesCounter] ?? '').replace(/(['\\])/g, '\\$1');
          whereValues.push(value);
          whereClauseLengthInner += value.length + 4;
          whereValuesCounter += 1;
          if (whereValuesCounter === valuesIN.length) {
            break;
          }
        }

        const condition: ParenthesizedCondition = {
          field: fieldName,
          operator: 'IN',
          value: whereValues,
          literalType: 'STRING',
        };

        tempWhere.left = condition;
        if (parsedWhere) {
          tempWhere.left.openParen = 1;
          tempWhere.left.closeParen = 1;
          tempWhere.right = parsedWhere.where as SafeWhereClause;
          tempWhere.operator = 'AND';
        }

        if (parsedOrderBy) {
          tempQuery.orderBy = parsedOrderBy.orderBy;
        }

        yield composeQuery(tempQuery);

        whereValues = [];

        if (whereValuesCounter === valuesIN.length) {
          break;
        }
      }
    }

    return [...queryGen()];
  }

  /**
   * Transforms array of arrays into array.
   *
   * @param arrays - Arrays to flatten.
   * @returns Flattened array.
   */
  public static flattenArrays<T>(arrays: NestedArray<T>): T[] {
    return arrays.reduce<T[]>(
      (flat, toFlatten) => flat.concat(Array.isArray(toFlatten) ? Common.flattenArrays(toFlatten) : toFlatten),
      []
    );
  }

  /**
   * Clones array of objects by creating new ones.
   *
   * @param objects - Objects to clone.
   * @param propsToInclude - Optional properties to include.
   * @returns Map of clone => original.
   */
  public static cloneArrayOfObjects(
    objects: Array<Record<string, unknown>>,
    propsToInclude: string[] = []
  ): Map<Record<string, unknown>, Record<string, unknown>> {
    const cloneToOriginalMap = new Map<Record<string, unknown>, Record<string, unknown>>();
    objects.forEach((original) => {
      const cloned = { ...original };
      if (propsToInclude.length === 0) {
        cloneToOriginalMap.set(cloned, original);
        return;
      }
      Object.keys(cloned).forEach((key) => {
        if (!propsToInclude.includes(key)) {
          delete cloned[key];
        }
      });
      cloneToOriginalMap.set(cloned, original);
    });
    return cloneToOriginalMap;
  }

  /**
   * Clone object including only the given properties.
   *
   * @param objectToClone - Object to clone.
   * @param propsToInclude - Properties to include.
   * @returns Cloned object.
   */
  public static cloneObjectIncludeProps<T extends Record<string, unknown>>(
    objectToClone: T,
    ...propsToInclude: Array<keyof T & string>
  ): Partial<T> | T {
    if (!objectToClone || Array.isArray(objectToClone) || typeof objectToClone !== 'object') {
      return objectToClone;
    }
    return Object.keys(objectToClone)
      .filter((key) => propsToInclude.includes(key))
      .reduce<Partial<T>>(
        (outObject, key) => ({
          ...outObject,
          [key]: objectToClone[key as keyof T],
        }),
        {}
      );
  }

  /**
   * Clone object with all its properties, but the given ones.
   *
   * @param objectToClone - Object to clone.
   * @param propsToExclude - Properties to exclude.
   * @returns Cloned object.
   */
  public static cloneObjectExcludeProps<T extends Record<string, unknown>>(
    objectToClone: T,
    ...propsToExclude: Array<keyof T & string>
  ): Partial<T> | T {
    if (!objectToClone || Array.isArray(objectToClone) || typeof objectToClone !== 'object') {
      return objectToClone;
    }
    return Object.keys(objectToClone)
      .filter((key) => !propsToExclude.includes(key))
      .reduce<Partial<T>>(
        (outObject, key) => ({
          ...outObject,
          [key]: objectToClone[key as keyof T],
        }),
        {}
      );
  }

  /**
   * Remove folder with all files.
   *
   * @param targetPath - Path to the folder to remove.
   * @param throwIOErrors - Throw on IO errors when true.
   * @param removeSelfDirectory - Remove the root directory when true.
   */
  public static deleteFolderRecursive(targetPath: string, throwIOErrors?: boolean, removeSelfDirectory = true): void {
    if (!fs.existsSync(targetPath)) {
      return;
    }
    fs.readdirSync(targetPath).forEach((file) => {
      const currentPath = path.join(targetPath, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        Common.deleteFolderRecursive(currentPath, throwIOErrors);
      } else {
        try {
          fs.unlinkSync(currentPath);
        } catch (error) {
          if (throwIOErrors) {
            throw new Error((error as Error).message);
          }
        }
      }
    });
    try {
      if (removeSelfDirectory) {
        fs.rmdirSync(targetPath);
      }
    } catch (error) {
      if (throwIOErrors) {
        throw new Error((error as Error).message);
      }
    }
  }

  /**
   * Transforms field name into __r field.
   *
   * @param fieldDescribe - Field description.
   * @param fieldName - Field name.
   * @returns Relationship field name.
   */
  // eslint-disable-next-line camelcase
  public static getFieldName__r(fieldDescribe?: SFieldDescribeType, fieldName?: string): string {
    if (fieldDescribe) {
      let name = fieldDescribe.name.split('.')[0];
      if (fieldDescribe.custom) {
        name = Common.replaceLast(name, '__pc', '__pr');
        name = Common.replaceLast(name, '__c', '__r');
        return name;
      }
      return Common.trimEndStr(name, 'Id');
    }
    if (fieldName) {
      let name = fieldName.split('.')[0];
      if (!name.endsWith('Id')) {
        name = Common.replaceLast(name, '__pc', '__pr');
        name = Common.replaceLast(name, '__c', '__r');
        return name;
      }
      return Common.trimEndStr(name, 'Id');
    }
    return '';
  }

  /**
   * Transforms __r field name into simple lookup Id field.
   *
   * @param fieldDescribe - Field description.
   * @param fieldName - Field name.
   * @returns Field Id name.
   */
  public static getFieldNameId(fieldDescribe?: SFieldDescribeType, fieldName?: string): string {
    if (fieldDescribe) {
      const parts = fieldDescribe.name.split('.');
      if (!fieldDescribe.is__r || parts.length < 2) {
        return fieldDescribe.name;
      }
      if (fieldDescribe.custom) {
        let name = Common.replaceLast(parts[0], '__pc', '__pr');
        name = Common.replaceLast(name, '__c', '__r');
        return name;
      }
      return `${parts[0]}Id`;
    }
    if (fieldName) {
      let name = fieldName.split('.')[0];
      if (name.endsWith('Id')) {
        return name;
      }
      if (name.endsWith('__pr') || name.endsWith('__r')) {
        name = Common.replaceLast(name, '__pc', '__pr');
        name = Common.replaceLast(name, '__c', '__r');
        return name;
      }
      if (!name.endsWith('__pc') && !name.endsWith('__c') && !name.endsWith('__s')) {
        return `${name}Id`;
      }
      return name;
    }
    return '';
  }

  /**
   * Return all members of the specific object.
   *
   * @param instance - Object instance.
   * @param type - Type of members to extract.
   * @returns Member names.
   */
  public static getObjectProperties(
    instance: Record<string, unknown>,
    type: 'function' | 'object' | 'string' = 'function'
  ): string[] {
    const members: string[] = [];
    const prototype = Object.getPrototypeOf(instance) as object;
    const keys = Reflect.ownKeys(prototype).filter((name) => name !== 'constructor');
    keys.forEach((member) => {
      if (typeof instance[member as keyof typeof instance] === type) {
        members.push(member.toString());
      }
    });
    return members;
  }

  /**
   * Extracts only certain properties from the object.
   *
   * @param object - Object instance.
   * @param propertiesToExtract - Property inclusion map.
   * @returns Extracted object.
   */
  public static extractObjectMembers<T extends Record<string, unknown>>(
    object: T,
    propertiesToExtract: Partial<Record<keyof T, boolean | null>>
  ): Partial<T> {
    const result: Partial<T> = {};
    for (const property of Object.keys(propertiesToExtract) as Array<keyof T>) {
      const shouldInclude = propertiesToExtract[property];
      if (shouldInclude === null || typeof shouldInclude === 'undefined') {
        continue;
      }
      result[property] = object[property];
    }
    return result;
  }

  /**
   * Composes the filename for the csv file.
   *
   * @param rootPath - Root directory.
   * @param sObjectName - Object name.
   * @param pattern - Optional suffix for the filename.
   * @returns CSV file path.
   */
  public static getCSVFilename(rootPath: string, sObjectName: string, pattern?: string): string {
    const suffix = `${pattern ?? ''}.csv`;
    return path.join(rootPath, sObjectName) + suffix;
  }

  /**
   * Polyfill of bind function with accessible bound arguments.
   *
   * @param fn - Function to bind.
   * @param thisArg - this arg.
   * @param boundArgs - Bound arguments.
   * @returns Bound function.
   */
  public static bind<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult,
    thisArg: unknown,
    ...boundArgs: TArgs
  ): (...args: TArgs) => TResult {
    const func = (...args: TArgs): TResult => {
      const combinedArgs = [...boundArgs, ...args] as unknown as TArgs;
      return fn.apply(thisArg, combinedArgs);
    };
    Object.defineProperties(func, {
      __boundArgs: { value: boundArgs },
      __thisArg: { value: thisArg },
      __boundFunction: { value: fn },
    });
    return func;
  }

  /**
   * Runs async functions in parallel with maximum simultaneous runnings.
   *
   * @param tasks - Async functions to run.
   * @param maxParallelTasks - Maximum parallelism.
   * @returns Results from all tasks.
   */
  public static async parallelTasksAsync<T>(tasks: Array<ThrottleTask<T>>, maxParallelTasks = 5): Promise<T[]> {
    return throttleAll(tasks, {
      maxInProgress: maxParallelTasks,
    });
  }

  /**
   * Execute several async functions in parallel.
   *
   * @param fns - Functions to execute.
   * @param thisArg - This arg to apply.
   * @param maxParallelTasks - Maximum parallelism.
   * @returns Array of results.
   */
  public static async parallelExecAsync<T>(
    fns: Array<() => Promise<T>>,
    thisArg?: unknown,
    maxParallelTasks = 10
  ): Promise<T[]> {
    const boundThis = thisArg ?? this;
    const queue = fns.map((fn) => () => fn.call(boundThis));
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const parallelLimit = maxParallelTasks || CONSTANTS.DEFAULT_MAX_PARALLEL_EXEC_TASKS;
    return Common.parallelTasksAsync(queue, parallelLimit);
  }

  /**
   * Execute several async functions in serial mode.
   *
   * @param fns - Functions to execute.
   * @param thisArg - This arg to apply.
   * @returns Array of results.
   */
  public static async serialExecAsync<T>(fns: Array<() => Promise<T>>, thisArg?: unknown): Promise<T[]> {
    const boundThis = thisArg ?? this;
    return fns.reduce<Promise<T[]>>(async (promise, fn) => {
      const result = await promise;
      result.push(await fn.call(boundThis));
      return result;
    }, Promise.resolve<T[]>([]));
  }

  /**
   * Converts array to map by given key composed from item properties (multi-value version).
   *
   * @param array - Array to convert.
   * @param keyProps - Props to compose map key.
   * @param keyDelimiter - Delimiter to separate key values.
   * @param defaultValue - Default value if value missing.
   * @param valueProps - Props to compose value.
   * @returns Map of key => array of items.
   */
  public static arrayToMapMulti<T extends Record<string, unknown>>(
    array: T[],
    keyProps: string[],
    keyDelimiter = '|',
    defaultValue = '',
    valueProps?: string[]
  ): Map<string, Array<T | string[]>> {
    const out = new Map<string, Array<T | string[]>>();
    array.forEach((item) => {
      const key = keyProps.map((keyProp) => String(item[keyProp] || defaultValue)).join(keyDelimiter);
      if (!out.has(key)) {
        out.set(key, []);
      }
      if (!valueProps) {
        out.get(key)?.push(item);
      } else {
        out.get(key)?.push(valueProps.map((valueProp) => String(item[valueProp] || '')));
      }
    });
    return out;
  }

  /**
   * Converts array to map by given key composed from item properties.
   *
   * @param array - Array to convert.
   * @param keyProps - Props to compose map key.
   * @param keyDelimiter - Delimiter to separate key values.
   * @param defaultValue - Default value if value missing.
   * @param valueProps - Props to compose value.
   * @returns Map of key => item/value.
   */
  public static arrayToMap<T extends Record<string, unknown>>(
    array: T[],
    keyProps: string[],
    keyDelimiter = '|',
    defaultValue = '',
    valueProps?: string[]
  ): Map<string, T | string[]> {
    const out = new Map<string, T | string[]>();
    array.forEach((item) => {
      const key = keyProps.map((keyProp) => String(item[keyProp] || defaultValue)).join(keyDelimiter);
      if (!valueProps) {
        out.set(key, item);
      } else {
        out.set(
          key,
          valueProps.map((valueProp) => String(item[valueProp] || ''))
        );
      }
    });
    return out;
  }

  /**
   * Converts array of object to array of strings.
   *
   * @param array - Array to convert.
   * @param keyProps - Props to compose key.
   * @param keyDelimiter - Delimiter to separate key values.
   * @param defaultValue - Default value if missing.
   * @returns Array of composed strings.
   */
  public static arrayToPropsArray<T extends Record<string, unknown>>(
    array: T[],
    keyProps: string[],
    keyDelimiter = '|',
    defaultValue = ''
  ): string[] {
    return array.map((item) => keyProps.map((keyProp) => String(item[keyProp] || defaultValue)).join(keyDelimiter));
  }

  /**
   * Formats string with {placeholder} values.
   *
   * @param inputString - Input string.
   * @param placeholderObject - Replacement values.
   * @returns Formatted string.
   */
  public static formatStringObject(
    inputString: string,
    placeholderObject: Record<string, string | number | boolean | null | undefined>
  ): string {
    return inputString.replace(/{(\w+)}/g, (placeholderWithDelimiters: string, placeholderWithoutDelimiters: string) =>
      Object.prototype.hasOwnProperty.call(placeholderObject, placeholderWithoutDelimiters)
        ? String(placeholderObject[placeholderWithoutDelimiters])
        : placeholderWithDelimiters
    );
  }

  /**
   * Formats strings in console.log style.
   *
   * @param args - Format string followed by replacements.
   * @returns Formatted string.
   */
  public static formatStringLog(...args: string[]): string {
    const [format, ...replacements] = args;
    let index = 0;
    return format.replace(/%s/g, () => String(replacements[index++]));
  }

  /**
   * Extracts only domain name from full url string.
   *
   * @param url - Url string to process.
   * @returns Domain or null.
   */
  public static extractDomainFromUrlString(url: string): string | undefined {
    if (!url) {
      return url;
    }
    const matches = url.match(/^https?:\/\/([^/?#]+)(?:[/?#]|$)/i);
    return matches?.[1];
  }

  /**
   * Adds desired fields to the given parsed query.
   *
   * @param query - Query to modify.
   * @param fieldsToAdd - Fields to add.
   * @param fieldsToRemove - Fields to remove.
   */
  public static addOrRemoveQueryFields(query: Query, fieldsToAdd: string[] = [], fieldsToRemove: string[] = []): void {
    const sourceFields = query.fields ?? [];
    const fields = sourceFields.map((field) => {
      const soqlField = field as SoqlField;
      return soqlField.field || (soqlField as unknown as Record<string, string>).rawValue;
    });

    fieldsToAdd.forEach((field) => {
      if (field && !fields.includes(field)) {
        fields.push(field);
      }
    });

    const updatedFields: FieldType[] = [];

    fields.forEach((field) => {
      if (field && !fieldsToRemove.includes(field)) {
        updatedFields.push(getComposedField(field));
      }
    });
    // eslint-disable-next-line no-param-reassign
    query.fields = updatedFields;
  }

  /**
   * Trims specific character at the start and at the end of the string.
   *
   * @param value - Source string.
   * @param charToTrim - Character to trim.
   * @returns Trimmed string.
   */
  public static trimChar(value: string, charToTrim: string): string {
    let result = value;
    while (result.startsWith(charToTrim)) {
      result = result.substring(1);
    }

    while (result.endsWith(charToTrim)) {
      result = result.substring(0, result.length - 1);
    }

    return result;
  }

  /**
   * Parses command line arguments into object.
   *
   * @param argv - Argument list.
   * @returns Parsed argument map.
   */
  public static parseArgv(...argv: string[]): Record<string, string | boolean> {
    const args = argv ?? [];
    const argvObject: Record<string, string | boolean> = {};
    let index = 0;
    while (index < args.length) {
      let command = args[index] ?? '';
      if (command) {
        if (command.startsWith('-')) {
          command = Common.trimChar(Common.trimChar(command.trim(), '-'), '"');
          let value: string | boolean = args[index + 1] ?? '';
          if (String(value).startsWith('-')) {
            value = true;
          } else {
            value = value || true;
            index += 1;
          }
          argvObject[command] = value;
        }
        index += 1;
      }
    }
    return argvObject;
  }

  /**
   * Returns the list of all enum values.
   *
   * @param enumType - Enum object.
   * @returns Enum values.
   */
  public static getEnumValues<T extends Record<string, unknown>>(
    enumType: T
  ): Array<T extends Record<string, infer X> ? Exclude<X, string> : unknown> {
    type ValType = T extends Record<string, infer X> ? Exclude<X, string> : unknown;
    const entryNames = Object.keys(enumType).filter((key) => !/[0-9]+/.test(key[0]));
    return entryNames.map((name) => (enumType as Record<string, ValType>)[name]);
  }

  /**
   * Creates a time delay.
   *
   * @param time - Delay length in ms.
   */
  public static async delayAsync(time: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, time));
  }

  /**
   * Merge two WHERE clauses into a single clause.
   *
   * @param where1 - First WHERE clause.
   * @param where2 - Second WHERE clause.
   * @param operator - Logical operator to use.
   * @returns Merged WHERE clause.
   */
  public static mergeWhereClauses(
    where1?: WhereClause,
    where2?: WhereClause,
    operator: LogicalOperator = 'AND'
  ): WhereClause | undefined {
    if (!where1 || !where2) {
      return where1 ?? where2;
    }

    const safeWhere1 = where1 as SafeWhereClause;
    const safeWhere2 = where2 as SafeWhereClause;
    const { beginClause: wrappedWhere1, endClause: endClause1 } = Common._wrapWhereClauseInParenthesis(safeWhere1);
    const { beginClause: wrappedWhere2 } = Common._wrapWhereClauseInParenthesis(safeWhere2);

    endClause1.operator = operator;
    endClause1.right = wrappedWhere2;

    return wrappedWhere1;
  }

  /**
   * Writes a diagnostic-only message to the file log.
   *
   * @param message - Diagnostic message.
   * @param logger - Logger instance override.
   */
  public static logDiagnostics(message: string, logger: LoggerType = Common.logger): void {
    const sanitized = Common._sanitizeDiagnosticsMessage(message);
    logger.verboseFile(sanitized);
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Converts a raw value to a CSV cell string.
   *
   * @param value - Raw value.
   * @returns CSV cell text.
   */
  private static _convertCsvCellValue(value: unknown): string {
    if (value === null || typeof value === 'undefined') {
      return Common.csvInsertNulls ? '#N/A' : '';
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  }

  /**
   * Builds a single CSV row line with escaping.
   *
   * @param values - Row values.
   * @param delimiter - Active CSV delimiter.
   * @param alwaysQuote - Always wraps each CSV cell in quotes when true.
   * @returns Serialized CSV row.
   */
  private static _createCsvRowLine(values: string[], delimiter: string, alwaysQuote = false): string {
    return values.map((value) => this._escapeCsvCell(value, delimiter, alwaysQuote)).join(delimiter);
  }

  /**
   * Escapes a CSV cell and adds quotes when required or in always-quoted mode.
   *
   * @param value - Raw cell value.
   * @param delimiter - Active CSV delimiter.
   * @param alwaysQuote - Always wraps each CSV cell in quotes when true.
   * @returns Escaped CSV cell.
   */
  private static _escapeCsvCell(value: string, delimiter: string, alwaysQuote = false): string {
    const escaped = value.replace(/"/g, '""');
    if (alwaysQuote) {
      return `"${escaped}"`;
    }
    const mustQuote =
      escaped.includes('"') ||
      escaped.includes('\n') ||
      escaped.includes('\r') ||
      escaped.includes(delimiter) ||
      /^\s|\s$/u.test(escaped);
    return mustQuote ? `"${escaped}"` : escaped;
  }

  /**
   * Returns true when the encoding is UTF-8.
   *
   * @param encoding - Encoding to check.
   * @returns True for UTF-8 encodings.
   */
  private static _isUtf8Encoding(encoding: BufferEncoding): boolean {
    return encoding === 'utf8' || encoding === 'utf-8';
  }

  /**
   * Returns true when the value is one of CSV null tokens.
   *
   * @param value - Raw value.
   * @returns True when token means null.
   */
  private static _isCsvNullToken(value: string): boolean {
    return this._CSV_NULL_TOKENS.has(value.trim().toLowerCase());
  }

  /**
   * Casts a CSV cell value based on field metadata type.
   *
   * @param rawValue - Original raw cell value.
   * @param trimmedValue - Trimmed cell value.
   * @param fieldType - Salesforce field type.
   * @returns Casted value.
   */
  private static _castCsvValueByFieldType(rawValue: string, trimmedValue: string, fieldType: string): unknown {
    if (fieldType === 'boolean') {
      const normalizedBooleanValue = trimmedValue.toLowerCase();
      if (this._CSV_BOOLEAN_TRUE_TOKENS.has(normalizedBooleanValue)) {
        return true;
      }
      if (this._CSV_BOOLEAN_FALSE_TOKENS.has(normalizedBooleanValue)) {
        return false;
      }
      return rawValue;
    }

    if (this._CSV_NUMERIC_FIELD_TYPES.has(fieldType)) {
      const numericValue = Number(trimmedValue);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
    }

    if (this.csvUseEuropeanDateFormat && this._CSV_DATE_FIELD_TYPES.has(fieldType)) {
      const convertedDate = this._convertEuropeanDateToIso(trimmedValue);
      if (convertedDate) {
        return convertedDate;
      }
    }

    if (this.csvUseEuropeanDateFormat && this._CSV_DATETIME_FIELD_TYPES.has(fieldType)) {
      const convertedDateTime = this._convertEuropeanDateTimeToIso(trimmedValue);
      if (convertedDateTime) {
        return convertedDateTime;
      }
    }

    return rawValue;
  }

  /**
   * Converts a European date string to Salesforce API ISO date format.
   *
   * @param value - Raw date value.
   * @returns `yyyy-MM-dd` when parsed.
   */
  private static _convertEuropeanDateToIso(value: string): string | undefined {
    const match = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/u);
    if (!match) {
      return undefined;
    }
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = this._normalizeTwoDigitYear(Number(match[3]));
    if (!this._isValidDateParts(year, month, day)) {
      return undefined;
    }
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  /**
   * Converts a European datetime string to Salesforce API ISO datetime format.
   *
   * @param value - Raw datetime value.
   * @returns `yyyy-MM-ddTHH:mm:ss.000Z` when parsed.
   */
  private static _convertEuropeanDateTimeToIso(value: string): string | undefined {
    const match = value.match(
      /^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/u
    );
    if (!match) {
      return undefined;
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = this._normalizeTwoDigitYear(Number(match[3]));
    const hour = Number(match[4] ?? 0);
    const minute = Number(match[5] ?? 0);
    const second = Number(match[6] ?? 0);

    if (!this._isValidDateParts(year, month, day)) {
      return undefined;
    }
    if (hour > 23 || minute > 59 || second > 59) {
      return undefined;
    }

    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
    return date.toISOString().replace(/\.\d{3}Z$/u, '.000Z');
  }

  /**
   * Converts a 2-digit year to 4-digit format.
   *
   * @param year - Year value.
   * @returns 4-digit year.
   */
  private static _normalizeTwoDigitYear(year: number): number {
    if (year >= 100) {
      return year;
    }
    return year <= 69 ? 2000 + year : 1900 + year;
  }

  /**
   * Validates date parts.
   *
   * @param year - Year.
   * @param month - Month (1..12).
   * @param day - Day.
   * @returns True when valid.
   */
  private static _isValidDateParts(year: number, month: number, day: number): boolean {
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1) {
      return false;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  /**
   * Wraps WHERE clause in parenthesis.
   *
   * @param clause - Clause to wrap.
   * @returns Begin and end clause references.
   */
  private static _wrapWhereClauseInParenthesis(clause: SafeWhereClause): {
    beginClause: SafeWhereClause;
    endClause: SafeWhereClause;
  } {
    const clone = JSON.parse(JSON.stringify(clause)) as SafeWhereClause;
    clone.left.openParen = (clone.left.openParen ?? 0) + 1;
    let current: SafeWhereClause | undefined = clone;
    while (current?.right) {
      current = current.right;
    }
    const endClause = current ?? clone;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    endClause.left.closeParen = (endClause.left.closeParen ?? 0) + 1;
    return { beginClause: clone, endClause };
  }

  /**
   * Normalizes diagnostic messages to be cross-platform safe.
   *
   * @param message - Raw message to normalize.
   * @returns Normalized message.
   */
  private static _sanitizeDiagnosticsMessage(message: string): string {
    const normalized = message.replace(/\\/g, '/').replace(/\r?\n/g, ' ').replace(/\t/g, ' ');
    return normalized.replace(/\/{2,}/g, '/');
  }

  /**
   * Normalizes and validates command metadata.
   *
   * @param command - Command metadata candidate.
   * @returns Validated command metadata.
   */
  private static _normalizeCommand(command: unknown): SfdmuCommandType {
    if (!this._isSfdmuCommand(command)) {
      throw new CommandExecutionError('Invalid command metadata.');
    }
    return command;
  }

  /**
   * Reads plugin package.json metadata.
   *
   * @param pluginRoot - Plugin root path.
   * @returns Parsed package.json data.
   */
  private static _readPluginPackageJson(pluginRoot: string): PluginPackageJsonType {
    const filePath = path.join(pluginRoot, 'package.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!this._isPluginPackageJson(parsed)) {
      throw new CommandExecutionError(`Invalid package.json at ${filePath}`);
    }
    return parsed;
  }

  /**
   * Checks if a value is a plain record.
   *
   * @param value - Value to check.
   * @returns True when the value is a record.
   */
  private static _isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  /**
   * Checks if a value is a string array.
   *
   * @param value - Value to check.
   * @returns True when value is a string array.
   */
  private static _isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
  }

  /**
   * Checks if a value matches command metadata shape.
   *
   * @param value - Value to check.
   * @returns True when value is command metadata.
   */
  private static _isSfdmuCommand(value: unknown): value is SfdmuCommandType {
    if (!this._isRecord(value)) {
      return false;
    }
    return this._isSfdmuStatics(value.statics) && this._isStringArray(value.argv);
  }

  /**
   * Checks if a value matches command statics shape.
   *
   * @param value - Value to check.
   * @returns True when value is command statics.
   */
  private static _isSfdmuStatics(value: unknown): value is SfdmuStaticsType {
    if (!this._isRecord(value)) {
      return false;
    }
    const plugin = value.plugin;
    if (!this._isRecord(plugin)) {
      return false;
    }
    return typeof value.name === 'string' && typeof plugin.name === 'string' && typeof plugin.root === 'string';
  }

  /**
   * Checks if a value matches add-on info shape.
   *
   * @param value - Value to check.
   * @returns True when value is add-on info.
   */
  private static _isAddonInfo(value: unknown): value is SfdmuAddonInfoType {
    if (!this._isRecord(value)) {
      return false;
    }
    const name = value.name;
    const version = value.version;
    if (typeof name !== 'undefined' && typeof name !== 'string') {
      return false;
    }
    if (typeof version !== 'undefined' && typeof version !== 'string') {
      return false;
    }
    return true;
  }

  /**
   * Checks if a value matches package.json shape.
   *
   * @param value - Value to check.
   * @returns True when value is a plugin package.json.
   */
  private static _isPluginPackageJson(value: unknown): value is PluginPackageJsonType {
    if (!this._isRecord(value)) {
      return false;
    }
    const version = value.version;
    if (typeof version !== 'string') {
      return false;
    }
    const addons = value.addons;
    if (typeof addons === 'undefined') {
      return true;
    }
    if (!this._isRecord(addons)) {
      return false;
    }
    const run = addons.run;
    if (typeof run === 'undefined') {
      return true;
    }
    return this._isAddonInfo(run);
  }
}
