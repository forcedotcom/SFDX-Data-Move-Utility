/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { Buffer } from 'buffer';
import { execSync } from 'child_process';
//import * as parse2 from 'csv-parse/sync';
const parse2 = require('csv-parse/lib/sync');
import * as fs from 'fs';
import * as glob2 from 'glob';
import * as path from 'path';
import * as Throttle from 'promise-parallel-throttle';
import * as readline from 'readline';
import {
  composeQuery,
  Condition,
  Field as SOQLField,
  FieldType,
  getComposedField,
  LiteralType,
  LogicalOperator,
  Operator,
  parseQuery,
  Query,
  WhereClause,
} from 'soql-parser-js';

import {
  ISfdmuAddonInfo,
} from '../../../addons/modules/sfdmu-run/custom-addons/package/common';
import {
  CommandAbortedByUserError,
  CommandExecutionError,
  CsvChunks,
  SFieldDescribe,
} from '../../models';
import IPluginInfo from '../../models/common_models/IPluginInfo';
import ISfdmuCommand from '../../models/common_models/ISfdxCommand';
import {
  Logger,
  RESOURCES,
} from './logger';
import { CONSTANTS } from './statics';
import { Transform } from 'stream';

const parse = (parse2 as any).parse || parse2;

const glob = (glob2 as any).glob || glob2;

const { closest } = require('fastest-levenshtein')

const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;



/**
 * Common utilities
 */
export class Common {

  static logger: Logger;
  static csvReadFileDelimiter: ',' | ';' = ",";
  static csvWriteFileDelimiter: ',' | ';' = ",";

  /**
  * @static Splits array to multiple chunks by max chunk size
  *
  * @param  {Array<any>} array Array to split
  * @param  {number} chunkMaxSize Max size of each chunk
  * @returns {Array<Array<any>>}
  */
  public static chunkArray(array: Array<any>, chunkMaxSize: number): Array<Array<any>> {
    var i, j, arr: Array<Array<any>> = new Array<Array<any>>();
    for (i = 0, j = array.length; i < j; i += chunkMaxSize) {
      arr.push(array.slice(i, i + chunkMaxSize));
    }
    return arr;
  }

  /**
  * @static Formats date to string [HH:mm:dd.mmm] using 24h-format
  *
  * @param {Date} date Date to format
  * @param  {boolean=true} addMilliseconds Set to true to add milliseconds to the resulting string
  * @returns {string}
  * @memberof CommonUtils
  */
  public static formatDateTimeShort(date: Date, addMilliseconds: boolean = true): string {
    if (addMilliseconds) {
      return `${date.toLocaleTimeString(undefined, { hour12: false })}.${date.getMilliseconds()}`;
    }
    return `${date.toLocaleTimeString(undefined, { hour12: false })}`;
  }

  /**
   * @static Formats date to string [d_MM_yyyy_HH_mm_ss] to use with fs
   *
   * @param {Date} date Date to format
   * @returns {string}
   * @memberof CommonUtils
   */
  public static formatFileDate(date: Date): string {
    return this.formatDateTime(date, false).replace(/[:]/g, "_").replace(/\s/g, "_").replace(/[/]/g, "_");
  }

  /**
  * @static Returns the plugin info
  *
  * @param {ISfdmuCommand} command
  * @returns {IPluginInfo}
  * @memberof CommonUtils
  */
  public static getPluginInfo(command: ISfdmuCommand): IPluginInfo {
    let statics = command.statics;
    let pjson = require(path.join(statics.plugin.root, '/package.json'));
    let runAddOnApiInfo = (pjson.addons.run as ISfdmuAddonInfo);
    let info = <IPluginInfo>{
      commandName: statics.name.toLowerCase(),
      pluginName: statics.plugin.name,
      version: pjson.version,
      path: statics.plugin.root,
      runAddOnApiInfo
    };
    info.commandString = `sfdx ${info.pluginName}:${info.commandName} ${command.argv.join(' ')}`;
    info.argv = command.argv;
    return info;
  }

  /**
  * @static Formats date to string [yyyy-MM-dd HH:mm:ss:mmm]
  *
  * @param  {Date} date Date to format
  * @param  {boolean=true} addMilliseconds Set to true to add milliseconds to the resulting string
  * @returns {string}
  * @memberof CommonUtils
  */
  public static formatDateTime(date: Date, addMilliseconds: boolean = true): string {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();
    var ms = date.getMilliseconds();
    hours = hours % 24;
    var strTime = this.addLeadnigZeros(hours, 2) + ':' + this.addLeadnigZeros(minutes, 2) + ':' + this.addLeadnigZeros(seconds, 2) + (addMilliseconds ? "." + this.addLeadnigZeros(ms, 3) : "");
    return date.getFullYear() + "-" + this.addLeadnigZeros(date.getMonth() + 1, 2) + "-" + this.addLeadnigZeros(date.getDate(), 2) + "  " + strTime;
  }

  /**
  * @static Returns a difference between two dates in format [HH:mm:ss.mmm]
  *
  * @param  {Date} dateStart Start date
  * @param  {Date} dateEnd End date
  * @returns {string}
  * @memberof CommonUtils
  */
  public static timeDiffString(dateStart: Date, dateEnd: Date): string {
    var duration = Math.abs(dateEnd.getTime() - dateStart.getTime());
    var milliseconds = (duration % 1000)
      , seconds = (duration / 1000) % 60
      , minutes = (duration / (1000 * 60)) % 60
      , hours = (duration / (1000 * 60 * 60)) % 24;
    return this.addLeadnigZeros(Math.floor(hours), 2)
      + "h " + this.addLeadnigZeros(Math.floor(minutes), 2)
      + "m " + this.addLeadnigZeros(Math.floor(seconds), 2)
      + "s " + this.addLeadnigZeros(Math.floor(milliseconds), 3)
      + "ms ";
  }

  /**
   * @static Returns the full command line string,
   * which has been used to start the current SFDX CLI command
   *
   * @static
   * @returns {string}
   * @memberof CommonUtils
   */
  public static getFullCommandLine(): string {
    if (process.argv.length >= 3)
      return "sfdx " + process.argv.slice(2).join(' ');
    return process.argv.join(' ');
  }

  /**
   * @static Converts given UTC date to the local date
   *
   * @param {Date} date The UTC date
   * @returns {Date}
   * @memberof CommonUtils
   */
  public static convertUTCDateToLocalDate(date: Date): Date {
    var newDate = new Date(date.getTime() + date.getTimezoneOffset() * 60 * 1000);
    var offset = date.getTimezoneOffset() / 60;
    var hours = date.getHours();
    newDate.setHours(hours - offset);
    return newDate;
  }

  /**
  * @static Left pads the number with given number of leading zerros
  *
  * @param  {number} num Number to convert
  * @param  {number} size Total size of the resulting string including zeros
  * @returns {string}
  * @memberof CommonUtils
  */
  public static addLeadnigZeros(num: number, size: number): string {
    var s = String(num);
    while (s.length < (size || 2)) { s = "0" + s; }
    return s;
  }

  /**
   * @static Transforms array of arrays to single array of objects.
   * The first member of the source array holds the property names.
   *
   * @param {Array<any>} array The array to transform in format: [[],[],[]]
   * @returns {Array<object>}
   * @memberof CommonUtils
   */
  public static transformArrayOfArrays(array: Array<any>): Array<object> {
    if (!array || array.length == 0) return new Array<object>();
    let props = array[0];
    let singleArray = array.slice(1).map((subArray: any) => {
      return subArray.reduce((item: object, subArrayItem: object, propIndex: number) => {
        item[props[propIndex]] = subArrayItem;
        return item;
      }, {});
    });
    return singleArray;
  }

  /**
   * @static Converts array to map with object hashcode as a map key:
   *         [object_hashcode => object]
   *
   * @param {Array<object>} array
   * @param {Array<string>} [propsToExclude] Properties to exclude from hashcode calculation when creating the map key
   * @returns {Map<string, object>}
   * @memberof CommonUtils
   */
  public static arrayToMapByHashcode(array: Array<object>, propsToExclude?: Array<string>): Map<string, object> {
    let m = new Map<string, object>();
    array.forEach(x => {
      let hash = String(this.getObjectHashcode(x, propsToExclude));
      let h = hash;
      let counter = 0;
      while (m.has(hash)) {
        hash = h + "_" + String(counter++);
      }
      m.set(hash, x);
    });
    return m;
  }

  /**
   * @static Converts array to map with object property as a key:
   *         object_property => object
   *
   * @param {Array<object>} array
   * @param {Array<string>} [propertyName] Property used to build the key of the map
   * @returns {Map<string, object>}
   * @memberof CommonUtils
   */
  public static arrayToMapByProperty(array: Array<object>, propertyName: string): Map<string, object> {
    let m = new Map<string, object>();
    array.forEach(x => {
      let key = String(x[propertyName]);
      let k = key;
      let counter = 0;
      while (m.has(key)) {
        key = k + "_" + String(counter++);
      }
      m.set(key, x);
    });
    return m;
  }

  /**
   * @static Returns a mapping between objects compared by object hashcode
   *
   * @param {Array<object>} arrayOfKeys First array - become keys for the output map
   * @param {Array<object>} arrayOfValues Second array - become values for the output map
   * @param {Array<string>} [propsToExclude] Properties to exclude when calculating the object hashcode
   * @param {Map<string, object>} [mkeys] Hashmap for the array of keys if already exist
   * @param {Map<string, object>} [mvalues] Hashmap for the array of values if already exist
   * @returns {Map<object, object>}
   * @memberof CommonUtils
   */
  public static compareArraysByHashcode(
    arrayOfKeys: Array<object>,
    arrayOfValues: Array<object>,
    propsToExclude?: Array<string>,
    mkeys?: Map<string, object>,
    mvalues?: Map<string, object>): Map<object, object> {

    arrayOfKeys = arrayOfKeys || new Array<object>();
    arrayOfValues = arrayOfValues || new Array<object>();

    if (!mkeys) {
      mkeys = this.arrayToMapByHashcode(arrayOfKeys, propsToExclude);
    }
    if (!mvalues) {
      mvalues = this.arrayToMapByHashcode(arrayOfValues, propsToExclude);
    }

    let retMap: Map<object, object> = new Map<object, object>();
    [...mkeys.keys()].forEach(hash => {
      retMap.set(mkeys.get(hash), mvalues.get(hash));
    });

    return retMap;

  }

  /**
  * @static Created a mapping between members of two arrays compared by the given object property
  *
  * @param {Array<object>} arrayOfKeys First array - become keys for the output map
  * @param {Array<object>} arrayOfValues Second array - become values for the output map
  * @param {Array<string>} [propsToExclude] Property to map the array items
  * @param {Map<string, object>} [mkeys] Mapping for the keys array if already exist
  * @param {Map<string, object>} [mvalues] Mapping for the values array if already exist
  * @returns {Map<object, object>}
  * @memberof CommonUtils
  */
  public static compareArraysByProperty(
    arrayOfKeys: Array<object>,
    arrayOfValues: Array<object>,
    propertyName: string,
    mkeys?: Map<string, object>,
    mvalues?: Map<string, object>): Map<object, object> {

    arrayOfKeys = arrayOfKeys || new Array<object>();
    arrayOfValues = arrayOfValues || new Array<object>();

    if (!mkeys) {
      mkeys = this.arrayToMapByProperty(arrayOfKeys, propertyName);
    }
    if (!mvalues) {
      mvalues = this.arrayToMapByProperty(arrayOfValues, propertyName);
    }

    let retMap: Map<object, object> = new Map<object, object>();
    [...mkeys.keys()].forEach(key => {
      retMap.set(mkeys.get(key), mvalues.get(key));
    });

    return retMap;

  }

  /**
   * Returns numeric hashcode of the input string
   *
   * @static
   * @param {string} inputString the input string value
   * @returns {number}
   * @memberof CommonUtils
   */
  public static getStringHashcode(inputString: string): number {
    return !inputString ? 0 : inputString.split("").reduce(function (a, b) { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
  }

  /**
   * Calculate a 32 bit FNV-1a hash
   *
   * @param {string} inputString the input value
   * @param {boolean} asString set to true to return the hash value as
   *                          8-digit hex string instead of an integer
   * @param {number} seed optionally pass the hash of the previous chunk
   * @returns {number | string}
   */
  public static getString32FNV1AHashcode(inputString: string, asString?: boolean, seed?: number): string | number {
    var i: number, l: number,
      hval = (seed === undefined) ? 0x811c9dc5 : seed;

    for (i = 0, l = inputString.length; i < l; i++) {
      hval ^= inputString.charCodeAt(i);
      hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
    }
    if (asString) {
      // Convert to 8 digit hex string
      return ("0000000" + (hval >>> 0).toString(16)).substr(-8);
    }
    return hval >>> 0;
  }

  /**
   * @static Returns numeric hashcode of the input object
   *
   * @param {object} inputObject
   * @param {Array<string>} [propsToExclude=new Array<string>()] Poperties to exclude from the hashing
   * @returns {number}
   * @memberof CommonUtils
   */
  public static getObjectHashcode(inputObject: object, propsToExclude: Array<string> = new Array<string>()): number {
    if (!inputObject) return 0;
    let keys = Object.keys(inputObject).filter(k => propsToExclude.indexOf(k) < 0).sort();
    let str = keys.map(k => {
      let v = inputObject[k];
      return v == "TRUE" || v == true ? "true"
        : v == "FALSE" || v == false ? "false"
          : !isNaN(v) ? String(+v)
            : !isNaN(Date.parse(v)) ? String(Date.parse(v))
              : !v || v == "#N/A" ? '' : String(v).replace(/[\n\r\s]/gi, '');
    }).join('');
    return this.getStringHashcode(str);
  }

  /**
   * @static Trims end of string if the string ends with the given suffix
   *
   * @param  {string} str String to trim
   * @param  {string} toTrim Chars to trim from the end
   * @returns string
   */
  public static trimEndStr(str: string, toTrim: string): string {
    if (str.endsWith(toTrim)) {
      return str.substring(0, str.lastIndexOf(toTrim));
    } else {
      return str;
    }
  }

  /**
   *  Replaces the last occurence of the given substring in the original string
   * @param original  The original string
   * @param toReplace  The substring to replace
   * @param replacement  The replacement string
   * @returns  The modified string
   */
  public static replaceLast(original: string, toReplace: string, replacement: string): string {
    // Check if the original string ends with the substring we want to replace
    if (original.endsWith(toReplace)) {
      // Calculate the start position of the substring to replace
      const startPos = original.length - toReplace.length;
      // Replace the substring by taking the part of the original string before the substring
      // and concatenating it with the replacement string
      return original.substring(0, startPos) + replacement;
    }

    // If the substring to replace is not at the end, return the original string
    return original;
  }

  /**
  * @static Executes SFDX command synchronously
  *
  * @param  {String} command SFDX command to execute ex. force:org:display without previous sfdx
  * @param  {String} targetusername --targetusername flag (if applied)
  * @returns string Returns command output
  */
  public static execSfdx(command: String, targetusername: String): string {
    if (typeof targetusername != "undefined")
      return execSync(`sfdx ${command} --targetusername ${targetusername}`).toString();
    else
      return execSync(`sfdx ${command}`).toString();
  };

  /**
  * @static Executes Sf command synchronously
  *
  * @param  {String} command Sf command to execute ex. force:org:display without previous sfdx
  * @param  {String} targetusername --targetusername flag (if applied)
  * @returns string Returns command output
  */
  public static execSf(command: String, targetusername: String): string {

    if (typeof targetusername != "undefined")
      return execSync(`sf ${command} --target-org ${targetusername}`).toString();
    else
      return execSync(`sf ${command}`).toString();
  };

  /**
  * @static Modifies existing WHERE clause by adding extra rule.
  *
  * Example:
  *   fieldName = "Source__c"
  *   values = ['Source1', 'Source2']
  *   source query = "WHERE Account.Name = 'Account'"
  *   operator = "AND"
  *  ==== >
  *   returns following query:  "WHERE (Account.Name = 'Account') AND (Source__c IN ('Source1', 'Source2'))"
  *
  * @param {WhereClause} where Source query to modify
  * @param {string} fieldName Field name
  * @param {Array<string> | string} values Values to compare against the field
  * @param {operator} [Operator="IN"] The operator for the extra WHERE
  * @param {LogicalOperator} [logicalOperator="OR"] Logical operator to apply between the original WHERE clause and the new one
  * @returns {WhereClause} Returns modified WHERE clause
  * @memberof CommonUtils
  */
  public static composeWhereClause(
    where: WhereClause,
    fieldName: string,
    values: Array<string> | string,
    operator: Operator = "IN",
    literalType: LiteralType = "STRING",
    logicalOperator: LogicalOperator = "OR"): WhereClause {

    let valuesIsArray = Array.isArray(values);
    let values2 = [].concat(values).filter(x => !!x).map(x => x.replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
    if (!valuesIsArray) {
      values2 = values2[0];
    }
    let c: Condition = { field: fieldName, operator: operator, value: values2, literalType: literalType };
    if (!where || !where.left) {
      let ret = { left: c };
      ret.left.openParen = 1;
      ret.left.closeParen = 1;
      return ret;
    } else {
      where.left.openParen = (where.left.openParen || 0) + 1;
      where.left.closeParen = (where.left.closeParen || 0) + 1;
      c.openParen = 1;
      c.closeParen = 1;
      let ret = { left: c, right: where, operator: logicalOperator };
      return ret;
    }
  }

  /**
   * @static Returns distinct array of objects by the given object property
   *
   * @template T
   * @param {Array<T>} array
   * @param {string} distinctByProp
   * @param {boolean} stringIgnoreCase
   * @returns {Array<T>}
   * @memberof CommonUtils
   */
  public static distinctArray<T>(array: Array<T>, distinctByProp: string, stringIgnoreCase?: boolean): Array<T> {
    return array.filter((obj, pos, arr) => {
      if (!stringIgnoreCase) {
        return arr.map<T>(mapObj => mapObj[distinctByProp])
          .indexOf(obj[distinctByProp]) === pos;
      }
      return arr.map<T>(mapObj => ((mapObj[distinctByProp] as any) || '').toLowerCase())
        .indexOf(((obj[distinctByProp] as any) || '').toLowerCase()) === pos;
    });
  }

  /**
   * Returns array of distinct string values
   *
   * @static
   * @param {string[]} array
   * @returns {Array<string>}
   * @param {boolean} stringIgnoreCase
   * @memberof CommonUtils
   */
  public static distinctStringArray(array: string[], stringIgnoreCase?: boolean): Array<string> {
    if (!stringIgnoreCase) {
      return [...new Set<string>(array)];
    }
    let m = new Map(array.map(s => [s.toLowerCase(), s]));
    return [...m.values()];
  }

  /**
   * @static Removes all objects from the array which are matched given property value
   *
   * @param {Array<object>} arr
   * @param {string} field
   * @param {string} value
   * @returns {Array<object>}
   * @memberof CommonUtils
   */
  public static removeBy(arr: Array<object>, field: string, value: string): Array<object> {
    return arr.splice(arr.findIndex(item => item[field] == value), 1);
  }

  /**
   * @static Filters the input map by the keys from the array
   *
   * @template T
   * @param {Array<string>} keysToFilter The array of keys to filter the map
   * @param {Map<string, T>} sourceMap The source map to filter
   * @param {(key: string) => T} [defaultValueCallback] The default value to set if key in the fiter array was not found in the map
   * @param {boolean} [addDefaultValueToSourceMapIfNotExist] true to add default value to the source map if the kye does not exist
   * @returns {Map<string, T>}
   * @memberof CommonUtils
   */
  public static filterMapByArray<T>(keysToFilter: Array<string>,
    sourceMap: Map<string, T>,
    defaultValueCallback?: (key: string) => T,
    addDefaultValueToSourceMapIfNotExist?: boolean): Map<string, T> {

    return keysToFilter.reduce((mapAccumulator: Map<string, T>, key) => {
      let obj = sourceMap.get(key);
      if (obj) {
        mapAccumulator.set(key, obj);
      } else if (defaultValueCallback) {
        let value = defaultValueCallback(key);
        mapAccumulator.set(key, value);
        if (addDefaultValueToSourceMapIfNotExist) {
          sourceMap.set(key, value)
        }
      }
      return mapAccumulator;
    }, new Map<string, T>());

  }

  /**
   * Returns true if the field name is a complex field name or __r field name
   * (f.ex: for "Account__r.Name" and  "$$Account__r.Name$Account__r.Id" => will return true,
   *        for "Id"  => will return false)
   *
   * @static
   * @param {string} fieldName
   * @returns {boolean}
   * @memberof CommonUtils
   */
  public static isComplexOr__rField(fieldName: string): boolean {
    return fieldName && (fieldName.indexOf('.') >= 0
      || fieldName.indexOf(CONSTANTS.COMPLEX_FIELDS_SEPARATOR) >= 0
      || fieldName.startsWith(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX)
    );
  }

  /**
   * Compares sfield property value against the given pattern.
   * For example: description.type == 'string'.
   * Typically used to test field names against multiselect keywords
   *
   * @static
   * @param {*} fieldDescribeProperty The SDescription property value to test
   * @param {*} patternProperty The pattern property to test
   * @param {boolean} [negative=false] If true => returns a negative result
   * @return {*}  {boolean}
   * @memberof Common
   */
  public static isDescriptionPropertyMatching(fieldDescribeProperty: any, patternProperty: any, negative: boolean = false): boolean {
    if (!negative)
      return fieldDescribeProperty == patternProperty || typeof patternProperty == "undefined";
    else
      return fieldDescribeProperty != patternProperty && typeof fieldDescribeProperty != "undefined";
  }

  /**
   * Returns true if the field name is a  __r field name
   * (f.ex: for "Account__r.Name" => will return true,
   *        for "Id"  => will return false)
   *
   * @static
   * @param {string} fieldName
   * @returns {boolean}
   * @memberof CommonUtils
   */
  public static is__rField(fieldName: string): boolean {
    return fieldName && fieldName.indexOf('.') >= 0;
  }

  /**
   * Returns true if the field name is a complex field name
   * (f.ex. for "$$Account__r.Name$Account__r.Id" => will return true,
   *       for "Parent.$$Account__r.Name$Account__r.Id" => will return false,
   *        for "Id" => will return false)
   *
   * @static
   * @param {string} fieldName
   * @returns {boolean}
   * @memberof CommonUtils
   */
  public static isComplexField(fieldName: string): boolean {
    return fieldName && (
      fieldName.indexOf(CONSTANTS.COMPLEX_FIELDS_SEPARATOR) >= 0
      || fieldName.startsWith(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX)
    );
  }

  /**
 * Returns true if the field name contains complex field name
 * (f.ex. for "Parent.$$Account__r.Name$Account__r.Id" => will return true,
 *        for "Id" => will return false)
 *
 * @static
 * @param {string} fieldName
 * @returns {boolean}
 * @memberof CommonUtils
 */
  public static isContainsComplexField(fieldName: string): boolean {
    return fieldName && fieldName.indexOf(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX) >= 0;
  }


  /**
   * Transforms field name into the complex field
   * (f.ex. "Account__r.Name;Account__r.Id" => become "$$Account__r.Name$Account__r.Id"
   *        "Account__r.Name" => become "Account__r.Name")
   *
   * @static
   * @param {string} fieldName
   * @returns {string}
   * @memberof CommonUtils
   */
  public static getComplexField(fieldName: string): string {
    if (!fieldName) return fieldName;
    if (fieldName.indexOf(CONSTANTS.COMPLEX_FIELDS_SEPARATOR) >= 0) {
      return CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX
        + fieldName.replace(
          new RegExp(`[${CONSTANTS.COMPLEX_FIELDS_SEPARATOR}]`, 'g'),
          CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR
        );
    }
    return fieldName;
  }

  /**
  * Transforms complex field name into the  field  name
  * (f.ex. "$$Account__r.Name$Account__r.Id" => become "Account__r.Name;Account__r.Id"
  *        "Account__r.Name" => become "Account__r.Name")
  *
  * @static
  * @param {string} fieldName
  * @returns {string}
  * @memberof CommonUtils
  */
  public static getFieldFromComplexField(fieldName: string) {
    if (!fieldName || !Common.isContainsComplexField(fieldName)) return fieldName;
    return fieldName.replace(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX, '')
      .replace(
        new RegExp(`[${CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR}]`, 'g'),
        CONSTANTS.COMPLEX_FIELDS_SEPARATOR
      );
  }

  /**
    * @static Reads CSV file from the disk.
    * Can read both entire file or wanted amount of lines.
    *
    * @param  {string} filePath Full path to the CSV file
    * @param  {number=0} linesAmountToRead
    * @param  {Map<string,string>?} columnToColumnDataTypeMap The mapping between each CSV column and column data type.
    *                                                         Available types are those from the SF DisplayType enum.
    * @returns Array<object>
    * @memberof CommonUtils
    */
  public static async readCsvFileAsync(filePath: string,
    linesAmountToRead: number = 0,
    columnToColumnDataTypeMap?: Map<string, string>): Promise<Array<object>> {

    return new Promise<Array<object>>(resolve => {
      if (!fs.existsSync(filePath)) {
        resolve(new Array<object>());
        return;
      }
      try {
        if (linesAmountToRead == 0) {
          let input = fs.readFileSync(filePath, 'utf8');
          input = input.replace(/^\uFEFF/, '');
          const records = parse(input, {
            columns: ___columns,
            delimiter: Common.csvReadFileDelimiter,
            skip_empty_lines: true,
            skip_lines_with_error: true,
            cast: ___csvCast
          });
          resolve([...records]);
        } else {
          let lineReader = readline.createInterface({
            input: fs.createReadStream(filePath, { encoding: 'utf8' })
          });
          let lineCounter = 0; let wantedLines = [];
          lineReader.on('line', function (line: any) {
            lineCounter++;
            wantedLines.push(line);
            if (lineCounter == linesAmountToRead) {
              lineReader.close();
            }
          });
          lineReader.on('close', function () {
            if (wantedLines.length == 1) {
              let output = [wantedLines[0].split(',').reduce((acc, field) => {
                acc[field] = null;
                return acc;
              }, {})];
              resolve(output);
              return;
            }
            let input = wantedLines.join('\n');
            const records = parse(input, {
              columns: true,
              skip_empty_lines: true,
              skip_lines_with_error: true,
              cast: ___csvCast
            });
            resolve([...records]);
          });
        }
      } catch (ex) {
        throw new CommandExecutionError(this.logger.getResourceString(RESOURCES.readingCsvFileError, filePath, ex.message));
      }
    });

    // ----------------- Internal functions -------------------------//
    function ___csvCast(value: any, context: any) {
      if (context.header || typeof context.column == "undefined") {
        return value;
      }
      let fieldType = columnToColumnDataTypeMap && columnToColumnDataTypeMap.get(context.column);
      if (fieldType == "boolean") {
        if (value == "1" || value == "TRUE" || value == "true")
          return true;
        else
          return false;
      }
      if (!value) {
        return null;
      }
      return value;
    }

    function ___columns(header: any) {
      if (!columnToColumnDataTypeMap) {
        return header;
      }
      return header.map((column: any) => {
        if (column.indexOf('.') >= 0
          || column.indexOf(CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR) >= 0
          || column.indexOf(CONSTANTS.COMPLEX_FIELDS_SEPARATOR) >= 0
          || columnToColumnDataTypeMap.has(column))
          return column;
        else {
          return undefined;
        }
      });
    }
  }

  /**
   * @static Writes array of objects into CSV file
   *
   * @param  {string} filePath Full CSV file path
   * @param  {Array<object>} array Array of objects to write into the csv file
   * @param  {boolean=false} createEmptyFileOnEmptyArray Set to true forces creating empty file
   *                                                     even the input array is empty or undefined,
   *                                                     otherwise no file will be created
   * @memberof CommonUtils
   */
  public static async writeCsvFileAsync(filePath: string,
    array: Array<object>,
    createEmptyFileOnEmptyArray: boolean = false,
    columns?: Array<string>): Promise<void> {

    try {

      if (!array || array.length == 0) {
        if (createEmptyFileOnEmptyArray) {
          fs.writeFileSync(filePath, "");
        }
        return;
      }

      class CsvTransformStream extends Transform {
        _first: boolean
        _stringifier: any

        constructor() {
          super({ objectMode: true });

          this._first = true;
          this._stringifier = createCsvStringifier({
            fieldDelimiter: Common.csvWriteFileDelimiter,
            header: (columns || Object.keys(array[0])).map(x => {
              return {
                id: x,
                title: x
              }
            }).sort((a, b) => { return a.id.localeCompare(b.id) }),
          })
        }

        _transform(record, encoding, callback) {
          //passes records one by one
          const line = this._stringifier.stringifyRecords([record])
          if (this._first) {
            this._first = false;
            callback(null, this._stringifier.getHeaderString() + line)
          } else {
            callback(null, line)
          }
        }
      }

      const fileStream = fs.createWriteStream(filePath);
      const csvTransformStream = new CsvTransformStream();

      csvTransformStream.pipe(fileStream);

      for (const record of array) {
        csvTransformStream.write(record);
      }

      csvTransformStream.end();

      // Wait for file to be fully written #618
      return new Promise((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      })
    } catch (ex) {
      throw new CommandExecutionError(this.logger.getResourceString(RESOURCES.writingCsvFileError, filePath, ex.message));
    }
  }

  /**
   * @static Merges all rows from two source csv files into the single csv file
   *
   * @param  {string} source1FilePath Full path to the first csv
   * @param  {string} source2FilePath Full path to the second csv
   * @param  {string} targetFilePath Full path to the target merged csv to create
   * @param  {boolean} deleteSourceFiles Set true to delete all source files after successfull merging
   * @param  {Array<string>} columns[] Set the list of CSV columns that must be inserted from the both source CSV files
   * @memberof CommonUtils
   */
  public static async mergeCsvFilesAsync(source1FilePath: string,
    source2FilePath: string,
    targetFilePath: string,
    deleteSourceFiles: boolean,
    ...columns: Array<string>) {

    let totalRows: Array<object> = new Array<object>();

    await ___addRowsFromFile(source1FilePath);
    await ___addRowsFromFile(source2FilePath);
    await this.writeCsvFileAsync(targetFilePath, totalRows);

    // ------------------ internal functions -----------------//
    async function ___addRowsFromFile(file: string) {
      if (fs.existsSync(file)) {
        let rows = await Common.readCsvFileAsync(file);
        rows.forEach(row => {
          let thisRow = columns.reduce((acc, column) => {
            if (typeof row[column] != "undefined") {
              acc[column] = row[column];
            } else {
              acc[column] = null;
            }
            return acc;
          }, {});
          totalRows.push(thisRow);
        });
        if (deleteSourceFiles) {
          fs.unlinkSync(file);
        }
      }
    }
  }

  /**
   * @static Transforms array of objects into array of CSV strings.
   * Method generates multiple chunks of CSV string, which each of them is limited
   * by the given size in bytes after base64 encoding.
   *
   * @param {Array<object>} array The array of objects to transform
   * @param {number} maxCsvStringSizeInBytes The maximal size of each CSV string in bytes
   * @param {number} blockSize The array block size. Used for calculation of the resulting csv string.
   * @param {string} [lineDelimiter='\n'] The line delimiter for the csv
   * @param {string} encoding The encoding for each value in the generated csv string
   * @returns {[Array<[Array<object>, string]>, Array<string>]} Returns array of splitted csv files + records per csv and array of csv column names
   * @memberof CommonUtils
   */
  public static createCsvStringsFromArray(array: Array<object>,
    maxCsvStringSizeInBytes: number,
    blockSize: number,
    lineDelimiter: string = '\n',
    encoding: string = 'utf-8'): CsvChunks {

    if (!array || array.length == 0) return new CsvChunks();

    const arrayBlocks = this.chunkArray(array, blockSize);
    const headerArray = Object.keys(array[0]).map(key => {
      return {
        id: key,
        title: key
      }
    }).sort((a, b) => { return a.id.localeCompare(b.id) });
    const csvStringifier = createCsvStringifier({
      header: headerArray,
      alwaysQuote: true,
      recordDelimiter: lineDelimiter
    });
    let header = csvStringifier.getHeaderString();
    let csvStrings: Array<[Array<object>, string]> = new Array<[Array<object>, string]>();
    let buffer: Buffer = Buffer.from('', <BufferEncoding>encoding);
    let totalCsvChunkSize = 0;
    let csvBlock: Buffer;
    let arrayBuffer: Array<object> = new Array<object>();
    for (let index = 0; index < arrayBlocks.length; index++) {
      const arrayBlock = arrayBlocks[index];
      csvBlock = Buffer.from(csvStringifier.stringifyRecords(arrayBlock), <BufferEncoding>encoding);
      let csvBlockSize = csvBlock.toString('base64').length;
      if (totalCsvChunkSize + csvBlockSize <= maxCsvStringSizeInBytes) {
        buffer = Buffer.concat([buffer, csvBlock]);
        arrayBuffer = arrayBuffer.concat(arrayBlock);
      } else {
        if (arrayBuffer.length > 0) {
          csvStrings.push([arrayBuffer, (header + buffer.toString(<BufferEncoding>encoding)).trim()]);
        }
        buffer = csvBlock
        arrayBuffer = arrayBlock;
        totalCsvChunkSize = 0
      }
      totalCsvChunkSize += csvBlockSize;
    }
    if (arrayBuffer.length > 0) {
      csvStrings.push([arrayBuffer, (header + buffer.toString('utf-8')).trim()]);
    }
    return new CsvChunks({
      chunks: csvStrings.map(x => {
        return {
          records: x[0],
          csvString: x[1]
        };
      }),
      header: headerArray.map(x => x.id)
    });
  }

  /**
   * @static Read csv file only once and cache it into the Map.
   * If the file was previously read and it is in the cache
   * it retrieved from cache instead of reading file again.
   *
   * @param  {Map<string, Map<string, any>}  csvDataCacheMap
   * @param  {string} fileName File name to read
   * @param  {string} indexFieldName The name of column that its value used as an index of the row in the file (default to "Id")
   * @param  {string} indexValueLength Length of generated random string for missing row index values (default to 18)
   * @param  {string} useRowIndexAutonumber If index value is empty for the given row
   *                                        fills it with a row number starting from 1
   *                                        instead of filling by a random string
   * @param  {string} addIndexKeyValues true to generate new value to update
   *                                    an index field for each object
   *                                    when this value is missing
   * @returns {Map<string, any>}
   */
  public static async readCsvFileOnceAsync(
    csvDataCacheMap: Map<string, Map<string, any>>,
    fileName: string,
    indexFieldName?: string,
    indexValueLength?: number,
    useRowIndexAutonumber?: boolean,
    addIndexKeyValues?: boolean): Promise<Map<string, any>> {

    indexFieldName = indexFieldName || "Id";
    indexValueLength = indexValueLength || 18;
    useRowIndexAutonumber = typeof useRowIndexAutonumber == "undefined" || useRowIndexAutonumber == null ? false : useRowIndexAutonumber;
    addIndexKeyValues = typeof addIndexKeyValues == "undefined" || addIndexKeyValues == null ? true : addIndexKeyValues;

    let currentFileMap: Map<string, any> = csvDataCacheMap.get(fileName);

    if (!currentFileMap) {
      if (!fs.existsSync(fileName)) {
        return new Map<string, any>();
      }
      let csvRows = await Common.readCsvFileAsync(fileName);
      currentFileMap = new Map<string, any>();
      csvRows.forEach((row, index) => {
        let indexKey = useRowIndexAutonumber ? String(index + 1) : Common.makeId(indexValueLength).toUpperCase();
        if (!row[indexFieldName] && addIndexKeyValues) {
          row[indexFieldName] = indexKey;
        }
        currentFileMap.set(row[indexFieldName] || indexKey, row);
      });
      csvDataCacheMap.set(fileName, currentFileMap);
    }
    return currentFileMap;
  }

  /**
   * @param  {string} fileDirectory Directory to list files in it
   * @param  {string="*"} fileMask File mask ex. *.txt
   * @returns Array<string>
   */
  public static listDirAsync(fileDirectory: string, fileMask: string = "*"): Promise<Array<string>> {
    return new Promise<Array<string>>(resolve => {
      let fn = path.join(fileDirectory, fileMask);
      glob(fn, undefined, function (er, files) {
        resolve(files);
      });
    });
  }

  /**
  *
  * @static Displays yes/no user prompt to abort
  *          the operation with warning
  *
  * @param {Logger} logger
  * @param {string} warnMessage The message for warning
  * @param {boolean} showPrompt true to show prompt, false to continue with warning
  * @param {string} promptMessage  The yes/no prompt message
  * @param {string} errorMessage The error message when user selected to abort the operation (choosen "no")
  * @param {...string[]} warnTokens The tokens for the warning message
  * @returns {Promise<void>}
  * @memberof CommonUtils
  */
  public static async abortWithPrompt(warnMessage: string,
    showPrompt: boolean,
    promptMessage: string,
    errorMessage: string,
    onBeforeAbortAsync: () => Promise<void>,
    ...warnTokens: string[]): Promise<void> {
    this.logger.warn.apply(this.logger, [warnMessage, ...warnTokens]);
    if (showPrompt) {
      if (!(await this.logger.yesNoPromptAsync(promptMessage))) {
        this.logger.log(RESOURCES.newLine);
        if (onBeforeAbortAsync) {
          await onBeforeAbortAsync();
        }
        throw new CommandAbortedByUserError(errorMessage);
      }
      this.logger.log(RESOURCES.newLine);
    }
  }

  /**
   * @static Generates random id string with given length
   * @param  {Number=10} length
   * @returns {string}
   * @memberof CommonUtils
   */
  public static makeId(length: number = 10): string {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  /**
   * Returns true if this object is custom
   *
   * @static
   * @param {string} objectName the name of the object
   * @returns {boolean}
   * @memberof Common
   */
  public static isCustomObject(objectName: string): boolean {
    if (!objectName) return false;
    return objectName.endsWith('__c')
      || objectName.endsWith('__pc')
      || objectName.endsWith('__s');
  }


  public static splitMulti(str: string, separators: Array<string>) {
    var tempChar = 't3mp'; //prevent short text separator in split down
    //split by regex e.g. \b(or|and)\b
    var regex = new RegExp('\\b(' + separators.join('|') + ')\\b', "g");
    let temp = str.replace(regex, tempChar).split(tempChar);
    // trim & remove empty
    return temp.map(el => el.trim()).filter(el => el.length > 0);
  }

  /**
   * Extracts QHERE clause from the query string
   *
   * @static
   * @param {string} query The query to process (SELECT Name, a__c FROM Account WHERE b__c = 'test')
   * @return {*}  {string} Dry WHERE clause string (b__c = 'test')
   * @memberof Common
   */
  public static extractWhereClause(query: string): string {
    if ((query || '').match(/WHERE/i)) {
      return query.match(/^.*?WHERE.*?(.+?(?=LIMIT|OFFSET|GROUP|ORDER|$))/i)[1].trim();
    }
    return null;
  }

  /**
     * Creates array of SOQLs that each of them contains "WHERE Field__c IN (values)"  clauses
     * for given input values.
     *
     * The function automatically will split the input array into multiple chunks
     * according to the projected length of each query in respect to the SF max SOQL length limitations.
     *
     * @static
     * @param {Array<string>} selectFields Field names to select
     * @param {string} [fieldName="Id"] The field name to use in the  WHERE Field IN (Values) clause
     * @param {Array<string>} valuesIN Values to use in in the WHERE Field IN (Values) clause
     * @param {string} whereClause The additional where clause to add besides the IN, like (Id Name ('Name1', 'Name2)) AND (Field__c = 'value')
     * @param {string} orderByClause Specify how records are ordered i.e. ORDER By CreatedDate
     * @returns {Array<string>} Returns an array of SOQLs
     * @memberof SfdxUtils
     */
  public static createFieldInQueries(
    selectFields: Array<string>,
    fieldName: string = "Id",
    sObjectName: string,
    valuesIN: Array<string>,
    whereClause?: string,
    orderByClause?: string): Array<string> {

    if (valuesIN.length == 0) {
      return new Array<string>();
    }

    const whereClauseLength = (whereClause || '').length;

    let tempQuery = <Query>{
      fields: selectFields.map(field => getComposedField(field)),
      where: <WhereClause>{},
      sObject: sObjectName
    };
    let whereValuesCounter: number = 0;
    let whereValues = new Array<string>();

    let parsedWhere: Query;
    if (whereClause) {
      parsedWhere = parseQuery('SELECT Id FROM Account WHERE (' + whereClause + ')');
    }

    let parsedOrderBy: Query;
    if (orderByClause) {
      parsedOrderBy = parseQuery('SELECT Id FROM Account ORDER BY ' + orderByClause + '')
    }

    function* queryGen() {
      while (true) {
        for (let whereClausLength = whereClauseLength; whereClausLength < CONSTANTS.MAX_SOQL_WHERE_CLAUSE_CHARACTER_LENGTH;) {
          let value = String(valuesIN[whereValuesCounter] || "").replace(/(['\\])/g, "\\$1");
          whereValues.push(value);
          whereClausLength += value.length + 4;
          whereValuesCounter++;
          if (whereValuesCounter == valuesIN.length)
            break;
        }

        let c: Condition = {
          field: fieldName,
          operator: "IN",
          value: whereValues,
          literalType: "STRING"
        };

        tempQuery.where.left = c;
        if (parsedWhere) {
          tempQuery.where.left.openParen = 1;
          tempQuery.where.left.closeParen = 1;
          tempQuery.where.right = parsedWhere.where;
          tempQuery.where.operator = "AND";
        }

        if (parsedOrderBy) {
          tempQuery.orderBy = parsedOrderBy.orderBy
        }

        yield composeQuery(tempQuery);

        whereValues = new Array<string>();

        if (whereValuesCounter == valuesIN.length)
          break;
      }
    }

    return [...queryGen()];
  }

  /**
  * Polyfill of flatMap ES2019 function
  *
  * @static
  * @memberof Common
  */
  public static flatMap = (arr: Array<any>, f: any) => arr.reduce((x, y) => [...x, ...f(y)], []);

  /**
   * Transforms array of arrays into array
   * @param arrays
   */
  public static flattenArrays(arrays: Array<any>): Array<any> {
    return arrays.reduce(function (flat, toFlatten) {
      return flat.concat(Array.isArray(toFlatten) ? Common.flattenArrays(toFlatten) : toFlatten);
    }, []);
  }

  /**
  * Clones array of objects by creating a new one.
  * Each item of the new list is a clone of the original one
  * and has no properties that marked as to be excluded.
  *
  * @param  {Array<any>} objects List of objects to clone
  * @param  {Array<string>} propsToInclude Optional properties to include in the target objects
  * @returns Map<any, any> Map cloned => oroginal
  */
  public static cloneArrayOfObjects(objects: Array<any>, propsToInclude: Array<string> = new Array<string>()): Map<any, any> {
    let cloneToOriginalMap = new Map<any, any>();
    objects.forEach(original => {
      let cloned = Object.assign({}, original);
      if (propsToInclude.length == 0) {
        cloneToOriginalMap.set(cloned, original);
        return;
      }
      Object.keys(cloned).forEach(key => {
        if (propsToInclude.indexOf(key) < 0) {
          delete cloned[key];
        }
      });
      cloneToOriginalMap.set(cloned, original);
    });
    return cloneToOriginalMap;
  }

  /**
   * Clone object including only the given properties
   *
   * @static
   * @param {object} objectToClone
   * @param {...string[]} propsToInclude
   * @returns
   * @memberof Common
   */
  public static cloneObjectIncludeProps(objectToClone: object, ...propsToInclude: string[]) {
    if (!objectToClone || Array.isArray(objectToClone) || typeof objectToClone != 'object') return objectToClone;
    return Object.keys(objectToClone)
      .filter(key => propsToInclude.indexOf(key) >= 0)
      .reduce((outObject, key) => (outObject[key] = objectToClone[key], outObject), {});
  }

  /**
   * Clone object with all its properties, but the given ones
   *
   * @static
   * @param {object} objectToClone
   * @param {...string[]} propsToInclude
   * @returns
   * @memberof Common
   */
  public static cloneObjectExcludeProps(objectToClone: object, ...propsToExclude: string[]) {
    if (!objectToClone || Array.isArray(objectToClone) || typeof objectToClone != 'object') return objectToClone;
    return Object.keys(objectToClone)
      .filter(key => propsToExclude.indexOf(key) < 0)
      .reduce((outObject, key) => (outObject[key] = objectToClone[key], outObject), {});
  }

  /**
   * Remove folder with all files
   *
   * @static
   * @param {string} pth Path to the folder to remove
   * @memberof Common
   */
  public static deleteFolderRecursive(pth: string, throwIOErrors?: boolean, removeSelfDirectory: boolean = true) {
    if (fs.existsSync(pth)) {
      fs.readdirSync(pth).forEach(file => {
        var curPath = path.join(pth, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          // Recursive call
          this.deleteFolderRecursive(curPath, throwIOErrors);
        } else {
          // Delete file
          try {
            fs.unlinkSync(curPath);
          } catch (ex) {
            if (throwIOErrors) {
              throw new Error(ex.message);
            }
          }
        }
      });
      try {
        if (removeSelfDirectory) {
          fs.rmdirSync(pth);
        }
      } catch (ex) {
        if (throwIOErrors) {
          throw new Error(ex.message);
        }
      }
    }
  }



  /**
       * @static Transforms field name into __r field
       * f. ex.: Account__c => Account__r
       *              ParentId => Parent
       *
       * @param {SFieldDescribe} [fieldDescribe] The field description [optional]
       * @param {string} [fieldName] The field name [optional]
       * @returns {string}
       * @memberof Common
       */
  public static getFieldName__r(fieldDescribe?: SFieldDescribe, fieldName?: string): string {
    if (fieldDescribe) {
      let name = fieldDescribe.name.split('.')[0];
      if (fieldDescribe.custom) {
        name = Common.replaceLast(name, "__pc", "__pr");
        name = Common.replaceLast(name, "__c", "__r");
        return name;
      } else {
        return Common.trimEndStr(name, "Id");
      }
    } else if (fieldName) {
      let name = fieldName.split('.')[0];
      if (!name.endsWith("Id")) {
        name = Common.replaceLast(name, "__pc", "__pr");
        name = Common.replaceLast(name, "__c", "__r");
        return name;
      } else {
        return Common.trimEndStr(name, "Id");
      }
    } else {
      return "";
    }
  }

  /**
   * @static Transforms __r field name into simple lookup Id field
   * f.ex.: Account__r.Name => Account__c
   *       Id => Id,
   *       Account__c => Account__c

   * @param {SFieldDescribe} [fieldDescribe] The field description [optional]
   * @param {string} [fieldName] The field name [optional]
   * @returns {string}
   * @memberof Common
   */
  public static getFieldNameId(fieldDescribe?: SFieldDescribe, fieldName?: string): string {
    if (fieldDescribe) {
      let parts = fieldDescribe.name.split('.');
      if (!fieldDescribe.is__r || parts.length < 2) {
        return fieldDescribe.name;
      }
      if (fieldDescribe.custom) {
        let name = Common.replaceLast(parts[0], "__pc", "__pr");
        name = Common.replaceLast(name, "__c", "__r");
        return name;
      } else {
        return parts[0] + "Id";
      }
    } else if (fieldName) {
      fieldName = fieldName.split('.')[0];
      if (fieldName.endsWith("Id")) {
        return fieldName;
      } else if (fieldName.endsWith("__pr") || fieldName.endsWith("__r")) {
        fieldName = Common.replaceLast(fieldName, "__pc", "__pr");
        fieldName = Common.replaceLast(fieldName, "__c", "__r");
        return fieldName;
      } else if (!fieldName.endsWith("__pc") && !fieldName.endsWith("__c")
        && !fieldName.endsWith("__s")) {
        return fieldName + "Id";
      } else {
        return fieldName;
      }
    } else {
      return "";
    }
  }

  /**
   * Returns closest match
   *
   * @static
   * @param {string} itemToSearchFor Item to search for in the source array
   * @param {Array<string>} arrayToSearchIn Array of items
   * @param {boolean} exactlyCaseInsensitiveMatch Optionally allows fo find
   *                                              the exaclty match that is case insensitive
   * @returns {string}
   * @memberof Common
   */
  public static searchClosest(itemToSearchFor: string, arrayToSearchIn: Array<string>, exactlyCaseInsensitiveMatch: boolean = false): string {
    if (!itemToSearchFor) return itemToSearchFor;
    if (exactlyCaseInsensitiveMatch) {
      return arrayToSearchIn.find(item => item && item.toLowerCase() == itemToSearchFor.toLowerCase());
    }
    return closest(itemToSearchFor, arrayToSearchIn);
  }

  /**
   * Return all members of the specific object
   *
   * @static
   * @param {*} instance The object instance
   * @param {string} [type="function"] The type of members to extract
   * @returns {string[]}
   * @memberof Common
   */
  public static getObjectProperties(instance: any, type: "function" | "object" | "string" = "function"): string[] {
    let members = [];
    let keys = Reflect.ownKeys(instance.__proto__).filter(name => name != "constructor");
    keys.forEach(member => {
      if (typeof instance[member] == type) {
        members.push(member);
      }
    });
    return members;
  }

  /**
   * Extracts only certain properties from the object
   *
   * @static
   * @template T The bject type
   * @param {T} object The object instance
   * @param {Record<keyof T, boolean>} propertiesToExtract Property=>yes/no pairs { 'a' : true, 'b' : false} to extract
   * @returns
   * @memberof Common
   */
  public static extractObjectMembers<T>(object: T, propertiesToExtract: Record<keyof T, boolean>) {
    return (function <TActual extends T>(value: TActual) {
      let result = {} as T;
      for (const property of Object.keys(propertiesToExtract) as Array<keyof T>) {
        result[property] = value[property];
      }
      return result;
    })(object);
  }

  /**
   * Composes the filename for the csv file
   *
   * @static
   * @param {string} rootPath The root directory
   * @param {string} sObjectName The object name
   * @param {string} [pattern] The suffix to put to the end of the filename
   * @returns {string}
   * @memberof Common
   */
  public static getCSVFilename(rootPath: string, sObjectName: string, pattern?: string): string {
    let suffix = `${pattern || ''}.csv`;
    if (sObjectName == "User" || sObjectName == "Group") {
      return path.join(rootPath, CONSTANTS.USER_AND_GROUP_FILENAME) + suffix;
    } else {
      return path.join(rootPath, sObjectName) + suffix;
    }
  }

  /**
   * The polyfill of bind function with accessible bound arguments
   *
   * @static
   * @param {Function} fn The funciton to bind
   * @param {*} thisArg The this arg
   * @param {...any[]} boundArgs The list of bound arguments
   * @returns new bound function
   * @memberof Common
   */
  public static bind(fn: Function, thisArg: any, ...boundArgs: any[]) {
    const func = function (...args: any[]) {
      return fn.call(thisArg, ...boundArgs, ...args)
    }
    Object.defineProperties(func, {
      __boundArgs: { value: boundArgs },
      __thisArg: { value: thisArg },
      __boundFunction: { value: fn }
    })
    return func;
  }

  /**
   * @static Runs async functions in parallel with maximum simultaneous runnings
   *
   * @param {Array<Throttle.Task<any>>} tasks The async functions to run
   * @param {number} [maxParallelTasks=5] The maximum parallelism
   * @returns {Promise<any>} The summarized array of all results returned by all promises
   * @memberof Common
   */
  public static async parallelTasksAsync(tasks: Array<Throttle.Task<any>>, maxParallelTasks: number = 5): Promise<Array<any>> {
    return await Throttle.all(tasks, {
      maxInProgress: maxParallelTasks
    });
  }

  /**
   * Execute several async functions in parallel
   *
   * @static
   * @param {Array<(...args: any[]) => Promise<any>>} fns The functions to execute
   * @param {*} [thisArg] This arg to apply to all functions
   * @param {number} [maxParallelTasks=10] The maximum parallelizm
   * @returns {Promise<any[]>} Array of results of all functions
   * @memberof Common
   */
  public static async parallelExecAsync(fns: Array<(...args: any[]) => Promise<any>>, thisArg?: any, maxParallelTasks: number = 10): Promise<any[]> {
    thisArg = thisArg || this;
    const queue = fns.map(fn => () => fn.call(thisArg));
    const result: any[] = await Common.parallelTasksAsync(queue, maxParallelTasks || CONSTANTS.DEFAULT_MAX_PARALLEL_EXEC_TASKS);
    return result;
  }

  /**
   * Execute secveral async functions in serial mode
   *
   * @static
   * @param {Array<(...args: any[]) => Promise<any>>} fns The functions to execute
   * @param {*} [thisArg] This arg to apply to all functions
   * @returns {Promise<any[]>} Array of results of all functions
   * @memberof Common
   */
  public static async serialExecAsync(fns: Array<(...args: any[]) => Promise<any>>, thisArg?: any): Promise<any[]> {
    thisArg = thisArg || this;
    let result = [];
    const queue = fns.map(fn => async () => fn.bind(thisArg, ...fn.arguments));
    for (let index = 0; index < queue.length; index++) {
      const fn = queue[index];
      result = result.concat(await fn());
    }
    return result;
  }

  /**
   * Converts array to map by given key composed from the item properties (multiple value version)
   *
   * @static
   * @param {Array<any>} array The array to convert
   * @param {Array<string>} keyProps The props to compose the map key
   * @param {('|')} keyDelimiter The delimiter to separate the key values
   * @param {string} defaultValue The default value to put into the key if the value missing in the object item
   * @param {Array<string>} valueProps The array of props to compose the value, if null - the whole item object used as a value
   * @returns {Map<string, Array<any>>} The resulting map as: key => [array of items with the given key]
   * @memberof Common
   */
  public static arrayToMapMulti(array: Array<any>,
    keyProps: Array<string>,
    keyDelimiter: string = '|',
    defaultValue: string = '',
    valueProps?: Array<string>): Map<string, Array<any>> {
    let out = new Map<string, Array<any>>();
    array.forEach(item => {
      let key = keyProps.map(keyProp => String(item[keyProp] || defaultValue)).join(keyDelimiter);
      if (!out.has(key)) {
        out.set(key, []);
      }
      if (!valueProps)
        out.get(key).push(item);
      else
        out.get(key).push(valueProps.map(valueProp => String(item[valueProp] || '')));
    });
    return out;
  }

  /**
      * Converts array to map by given key composed from the item properties (multiple value version)
      *
      * @static
      * @param {Array<any>} array The array to convert
      * @param {Array<string>} keyProps The props to compose the map key
      * @param {('|')} keyDelimiter The delimiter to separate the key values
      * @param {string} defaultValue The default value to put into the key if the value missing in the object item
      * @param {Array<string>} valueProps The array of props to compose the value, if null - the whole item object used as a value
      * @returns {Map<string, Array<any>>} The resulting map as: key => [item of the key]
      * @memberof Common
      */
  public static arrayToMap(array: Array<any>,
    keyProps: Array<string>,
    keyDelimiter: string = '|',
    defaultValue: string = '',
    valueProps?: Array<string>): Map<string, any> {
    let out = new Map<string, any>();
    array.forEach(item => {
      let key = keyProps.map(keyProp => String(item[keyProp] || defaultValue)).join(keyDelimiter);
      if (!valueProps)
        out.set(key, item);
      else
        out.set(key, valueProps.map(valueProp => String(item[valueProp] || '')));
    });
    return out;
  }

  /**
   * Converts array of object to array of strings
   *
   * @static
   * @param {Array<any>} array The array to convert
   * @param {Array<string>} keyProps The props to compose the map key
   * @param {string} [keyDelimiter='|'] The delimiter to separate the key values
   * @param {string} [defaultValue=''] he default value to put into the key if the value missing in the object item
   * @returns {Array<string>} The resulting array of strings, composed from the given keys
   * @memberof Common
   */
  public static arrayToPropsArray(array: Array<any>,
    keyProps: Array<string>,
    keyDelimiter: string = '|',
    defaultValue: string = ''): Array<string> {
    return array.map(item => {
      let key = keyProps.map(keyProp => String(item[keyProp] || defaultValue)).join(keyDelimiter);
      return key;
    });
  }
  /**
   * Formats string in object-like style like:
   *
   * formatString('My Name is {name} and my age is {age}.', {name: 'Mike', age : '26'})
   *
   * @static
   * @param {string} inputString The input string
   * @param {*} placeholderObject The replacement object
   * @returns {string}
   * @memberof Common
   */
  public static formatStringObject(inputString: string, placeholderObject: any): string {
    return inputString.replace(/{(\w+)}/g, (placeholderWithDelimiters: any, placeholderWithoutDelimiters: any) =>
      placeholderObject.hasOwnProperty(placeholderWithoutDelimiters) ?
        placeholderObject[placeholderWithoutDelimiters] : placeholderWithDelimiters
    );
  }

  /**
   * Formats strings in 'console.log' style like:
   *
   * formatStringS('This is replacement: %s', 'replacement')
   *
   * @static
   * @returns {string} The input string
   * @memberof Common
   */
  public static formatStringLog(...args: string[]): string {
    var argum = Array.prototype.slice.call(args);
    var rep = argum.slice(1, argum.length);
    var i = 0;
    var output = argum[0].replace(/%s/g, () => {
      var subst = rep.slice(i, ++i);
      return subst;
    });
    return output;
  }

  /**
   * Extracts only domain name from full url string.
   * For example "https://stackoverflow.com/questions/8498592/extract-hostname-name-from-string/"
   * => stackoverflow.com
   *
   * @static
   * @param {string} url The url string to process
   * @return {*}
   * @memberof Common
   */
  public static extractDomainFromUrlString(url: string): string {
    if (!url) return url;
    const matches = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);
    return matches && matches[1];
  }

  /**
    * Adds desired fields to the given parsed query
   *
   * @static
   * @param {Query} query
   * @param {Array<string>} [fieldsToAdd]
   * @param {Array<string>} [fieldsToRemove]
   * @memberof Common
   */
  public static addOrRemoveQueryFields(query: Query, fieldsToAdd: Array<string> = [], fieldsToRemove: Array<string> = []) {

    let fields = [].concat(query.fields.map(f => {
      let field = (<SOQLField>f);
      return field.field || field["rawValue"];
    }));

    fieldsToAdd.forEach(field => {
      if (field && fields.indexOf(field) < 0) {
        fields.push(field);
      }
    });

    query.fields = new Array<FieldType>();

    fields.forEach(field => {
      if (field && fieldsToRemove.indexOf(field) < 0) {
        query.fields.push(getComposedField(field));
      }
    });
  }

  /**
   * Trims specific character at the start and at the end of the string
   *
   * @static
   * @param {string} str
   * @param {string} charToTrim
   * @return {*}  {string}
   * @memberof Common
   */
  public static trimChar(str: string, charToTrim: string): string {
    while (str.charAt(0) == charToTrim) {
      str = str.substring(1);
    }

    while (str.charAt(str.length - 1) == charToTrim) {
      str = str.substring(0, str.length - 1);
    }

    return str;
  }

  /**
   * Parses command line arguments into object,
   * e.g.: --arg1 value --arg2 --arg3 "value2" => {
   *      arg1: "value",
   *      arg2: true,
   *      arg3: "value2"
   * }
   *
   * @static
   * @param {...string[]} argv
   * @return {*}  {*}
   * @memberof Common
   */
  public static parseArgv(...argv: string[]): any {
    argv = argv || [];
    let argvObject = {};
    let index = 0;
    while (index < argv.length) {
      let command = argv[index] || "";
      if (command) {
        if (command.startsWith('-')) {
          command = Common.trimChar(Common.trimChar(command.trim(), "-"), "\"");
          let value: any = argv[index + 1] || "";
          if (value.startsWith("-")) {
            value = true;
          } else {
            value = value || true;
            index++;
          }
          argvObject[command] = value;
        }
        index++;
      }
    }
    return argvObject;
  }

  /**
   * REturns the list of all enum values
   *
   * @static
   * @template T
   * @param {T} enumType
   * @return {*}
   * @memberof Common
   */
  public static getEnumValues<T>(enumType: T) {
    type ValType = T extends { [k: string]: infer X } ? Exclude<X, string> : any;

    const entryNames = Object.keys(enumType).filter(key => !/[0-9]+/.test(key[0]));
    return entryNames.map(name => enumType[name] as ValType);
  }

  /**
    * Creates a time delay
    *
    * @static
    * @param {number} time The delay length in ms
    * @return {*}  {Promise<void>}
    * @memberof Utils
    */
  static async delayAsync(time: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, time));
  }

  private static wrapWhereClauseInParenthesis(clause: WhereClause): { beginClause: WhereClause, endClause: WhereClause } {
    const clone = JSON.parse(JSON.stringify(clause)) as WhereClause;
    clone.left.openParen = (clone.left.openParen ?? 0) + 1
    let current = clone;
    while (current.right) {
      current = current.right;
    }
    current.left.closeParen = (current.left.closeParen || 0) + 1
    return { beginClause: clone, endClause: current };
  }

  static mergeWhereClauses(
    where1?: WhereClause,
    where2?: WhereClause,
    operator: LogicalOperator = 'AND',
  ): WhereClause | undefined {
    if (!where1 || !where2) return where1 || where2;

    const { beginClause: wrappedWhere1, endClause: endClause1 } = Common.wrapWhereClauseInParenthesis(where1);
    const { beginClause: wrappedWhere2 } = Common.wrapWhereClauseInParenthesis(where2);

    endClause1.operator = operator;
    endClause1.right = wrappedWhere2;

    return wrappedWhere1;
  }
}
