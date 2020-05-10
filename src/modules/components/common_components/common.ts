/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execSync } from 'child_process';
import path = require('path');
import * as fs from 'fs';
import { SfdxCommand } from '@salesforce/command';
import {
    Condition,
    LiteralType,
    LogicalOperator,
    WhereClause,
    Operator,
    Query,
    getComposedField,
    composeQuery
} from 'soql-parser-js';
import { CONSTANTS } from './statics';

import parse = require('csv-parse/lib/sync');
import glob = require("glob");
import { Logger, RESOURCES } from './logger';
import { CommandAbortedByUserError } from '../../models';


const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const createCsvStringifier = require('csv-writer').createObjectCsvStringifier;


/**
 * Common utility functions
 */
export class Common {

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
    * @static Returns the current active plugin information
    * 
    * @param {typeof SfdxCommand} command
    * @returns {{
    *         pluginName: string,
    *         commandName: string,
    *         version: string,
    *         path: string
    *     }}
    * @memberof CommonUtils
    */
    public static getPluginInfo(command: typeof SfdxCommand): {
        pluginName: string,
        commandName: string,
        version: string,
        path: string
    } {
        var pjson = require(path.join(command.plugin.root, '/package.json'));
        return {
            commandName: command.name.toLowerCase(),
            pluginName: command.plugin.name,
            version: pjson.version,
            path: command.plugin.root
        }
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
    * @static Calculates and returns difference between two dates in format [HH:mm:ss.mmm]
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
     * @static Returns the full command line string, which was used to start the current SFDX Command
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
     * @param {Array<any>} array The array to transform in format [[],[],[]]
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
     * @static Creates a Map for the input array of objects: 
     * object_hashcode => object
     * 
     * @param {Array<object>} array Array to process
     * @param {Array<string>} [propsToExclude] Properties to exclude from hashcode calculation when creating the map key
     * @returns {Map<string, object>} 
     * @memberof CommonUtils
     */
    public static mapArrayItemsByHashcode(array: Array<object>, propsToExclude?: Array<string>): Map<string, object> {
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
     * Creates map for the input array of objects:
     * object_property => object
     *
     * @static
     * @param {Array<object>} array Array to process
     * @param {Array<string>} [propertyName] Property used to build the key of the map
     * @returns {Map<string, object>} 
     * @memberof CommonUtils
     */
    public static mapArrayItemsByPropertyName(array: Array<object>, propertyName: string): Map<string, object> {
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
     * @static Compares each member of two arrays an returns  
     * a mapping between equal objects in the both arrays detected
     * using object hashcode
     * 
     * @param {Array<object>} arrayOfKeys First array - become keys for the output map
     * @param {Array<object>} arrayOfValues Second array - become values for the output map
     * @param {Array<string>} [propsToExclude] Properties to exclude when calculating the object hashcode
     * @param {Map<string, object>} [mkeys] Hashmap for the array of keys if already exist
     * @param {Map<string, object>} [mvalues] Hashmap for the array of values if already exist
     * @returns {Map<object, object>}
     * @memberof CommonUtils
     */
    public static mapArraysByHashcode(
        arrayOfKeys: Array<object>,
        arrayOfValues: Array<object>,
        propsToExclude?: Array<string>,
        mkeys?: Map<string, object>,
        mvalues?: Map<string, object>): Map<object, object> {

        arrayOfKeys = arrayOfKeys || new Array<object>();
        arrayOfValues = arrayOfValues || new Array<object>();

        if (!mkeys) {
            mkeys = this.mapArrayItemsByHashcode(arrayOfKeys, propsToExclude);
        }
        if (!mvalues) {
            mvalues = this.mapArrayItemsByHashcode(arrayOfValues, propsToExclude);
        }

        let retMap: Map<object, object> = new Map<object, object>();
        [...mkeys.keys()].forEach(hash => {
            retMap.set(mkeys.get(hash), mvalues.get(hash));
        });

        return retMap;

    }

    /**
    * @static Created mapping between members of two arrays compared by the given object property
    *
    * @param {Array<object>} arrayOfKeys First array - become keys for the output map
    * @param {Array<object>} arrayOfValues Second array - become values for the output map
    * @param {Array<string>} [propsToExclude] Property to map the array items
    * @param {Map<string, object>} [mkeys] Mapping for the keys array if already exist
    * @param {Map<string, object>} [mvalues] Mapping for the values array if already exist
    * @returns {Map<object, object>}
    * @memberof CommonUtils
    */
    public static mapArraysByItemProperty(
        arrayOfKeys: Array<object>,
        arrayOfValues: Array<object>,
        propertyName: string,
        mkeys?: Map<string, object>,
        mvalues?: Map<string, object>): Map<object, object> {

        arrayOfKeys = arrayOfKeys || new Array<object>();
        arrayOfValues = arrayOfValues || new Array<object>();

        if (!mkeys) {
            mkeys = this.mapArrayItemsByPropertyName(arrayOfKeys, propertyName);
        }
        if (!mvalues) {
            mvalues = this.mapArrayItemsByPropertyName(arrayOfValues, propertyName);
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
     * @param {string} str Input string
     * @returns {number}
     * @memberof CommonUtils
     */
    public static getStringHashcode(str: string): number {
        return !str ? 0 : str.split("").reduce(function (a, b) { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
    }

    /**
     * @static Creates numeric hashcode of the object based on its string representation
     * 
     * @param {object} object Object to get hashcode for it
     * @param {Array<string>} [propsToExclude=new Array<string>()] Poperties to exclude from the hashing
     * @returns {number}
     * @memberof CommonUtils
     */
    public static getObjectHashcode(object: object, propsToExclude: Array<string> = new Array<string>()): number {
        if (!object) return 0;
        let keys = Object.keys(object).filter(k => propsToExclude.indexOf(k) < 0).sort();
        let str = keys.map(k => {
            let v = object[k];
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
    * @static Modifies existing WHERE clause by adding extra rule.
    * Ex:
    *   fieldName = "Source__c" 
    *   values = ['Source1', 'Source2']
    *   source query = "WHERE Account.Name = 'Account'"
    *   operator = "AND"
    * 
    *   returned query:  "WHERE (Account.Name = 'Account') AND (Source__c IN ('Source1', 'Source2'))"
    * 
    * Also can add any other extra rule like WHERE .... AND (x = ...)
    * 
    * @param {WhereClause} where Source query to modify
    * @param {string} fieldName Field name
    * @param {Array<string> | string} values Values to compare
    * @param {operator} [Operator="IN"] (Default="IN") The operator for the extra WHERE
    * @param {LogicalOperator} [logicalOperator="OR"] (Default="OR") Logical operator to apply between the original WHERE and the new WHERE..IN
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
     * @param {Array<T>} array The source array
     * @param {string} distinctByProp The property to make distinct by it
     * @returns {Array<T>}
     * @memberof CommonUtils
     */
    public static distinctArray<T>(array: Array<T>, distinctByProp: string): Array<T> {
        return array.filter((obj, pos, arr) => {
            return arr.map<T>(mapObj => mapObj[distinctByProp]).indexOf(obj[distinctByProp]) === pos;
        });
    }

    /**
     * Returns array of distinct string values
     *
     * @static
     * @param {string[]} array The source array
     * @returns {Array<string>}
     * @memberof CommonUtils
     */
    public static distinctStringArray(array: string[]): Array<string> {
        return [...new Set<string>(array)];
    }

    /**
     * @static Removes all objects from the array which are matched given property value
     * 
     * @param {Array<object>} arr The input array
     * @param {string} field The field name
     * @param {string} value The value to remove by it
     * @returns {Array<object>}
     * @memberof CommonUtils
     */
    public static removeBy(arr: Array<object>, field: string, value: string): Array<object> {
        return arr.splice(arr.findIndex(item => item[field] == value), 1);
    }

    /**
     * @static Converts array to map
     * 
     * @template T
     * @param {Array<T>} arr 
     * @param {string} keyField The field to use for map key
     * @returns {Map<string, T>}
     * @memberof CommonUtils
     */
    public static arrayToMap<T>(arr: Array<T>, keyField: string): Map<string, T> {
        return arr.reduce((mapAccumulator: Map<string, T>, obj) => {
            mapAccumulator.set(String(obj[keyField]), obj);
            return mapAccumulator;
        }, new Map<string, T>());
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
     * (f.ex. Account__r.Name or $$Account__r.Name$Account__r.Id => true, 
     *        Id => false)
     * 
     *
     * @static
     * @param {string} fieldName The field name
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
         * Returns true if the field name is a complex field name
         * (f.ex. $$Account__r.Name$Account__r.Id => true, 
         *        Id => false)
         * 
         *
         * @static
         * @param {string} fieldName The field name
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
     * Transforms field name into the complex field 
     * (f.ex. Account__r.Name;Account__r.Id => $$Account__r.Name$Account__r.Id
     *        Account__r.Name => Account__r.Name)
     *
     * @static
     * @param {string} fieldName
     * @returns {string}
     * @memberof CommonUtils
     */
    public static getComplexField(fieldName: string): string {
        if (fieldName.indexOf(CONSTANTS.COMPLEX_FIELDS_SEPARATOR) >= 0) {
            return CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX
                + fieldName.replace(
                    new RegExp(`${CONSTANTS.COMPLEX_FIELDS_SEPARATOR}`, 'g'),
                    CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR
                );
        }
        return fieldName;
    }

    /**
      * @static Reads csv file from disk
      * Can read both entire file or wanted amount of lines
      * 
      * @param  {string} filePath Full path to CSV to read
      * @param  {number=0} linesAmountToRead 
      * @param  {Map<string,string>?} acceptedColumnsToColumnsTypeMap Map between column to be imported from 
      *             the csv to its expected type. Type can be 'string', 'boolean' etc
      * @returns Array<object>
      * @memberof CommonUtils
      */
    public static async readCsvFileAsync(filePath: string,
        linesAmountToRead: number = 0,
        acceptedColumnsToColumnsTypeMap?: Map<string, string>): Promise<Array<object>> {

        return new Promise<Array<object>>(resolve => {
            if (!fs.existsSync(filePath)) {
                resolve(new Array<object>());
                return;
            }
            if (linesAmountToRead == 0) {
                let input = fs.readFileSync(filePath, 'utf8');
                input = input.replace(/^\uFEFF/, '');
                const records = parse(input, {
                    columns: ___columns,
                    skip_empty_lines: true,
                    cast: ___csvCast
                });
                resolve([...records]);
            } else {
                let lineReader = require('readline').createInterface({
                    input: require('fs').createReadStream(filePath),
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
                        cast: ___csvCast
                    });
                    resolve([...records]);
                });
            }
        });

        // ----------------- internal functions -------------------------//
        function ___csvCast(value: any, context: any) {
            if (context.header || typeof context.column == "undefined") {
                return value;
            }
            if (value == "#N/A") {
                return null;
            }
            let fieldType = acceptedColumnsToColumnsTypeMap && acceptedColumnsToColumnsTypeMap.get(context.column);
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
            if (!acceptedColumnsToColumnsTypeMap) {
                return header;
            }
            return header.map((column: any) => {
                if (column.indexOf('.') >= 0
                    || column.indexOf(CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR) >= 0
                    || column.indexOf(CONSTANTS.COMPLEX_FIELDS_SEPARATOR) >= 0
                    || acceptedColumnsToColumnsTypeMap.has(column))
                    return column;
                else {
                    return undefined;
                }
            });
        }
    }

    /**
     * @static Writes array of objects to csv file
     * 
     * @param  {string} filePath Full file path to write to
     * @param  {Array<object>} array Array of objects to write to the csv file
     * @param  {boolean=false} createEmptyFileOnEmptyArray Set to true forces creating empty file 
     *                          if the input array is empty or undefined otherwise nothing acts
     * @memberof CommonUtils 
     */
    public static async writeCsvFileAsync(filePath: string,
        array: Array<object>,
        createEmptyFileOnEmptyArray: boolean = false): Promise<void> {

        if (!array || array.length == 0) {
            if (createEmptyFileOnEmptyArray) {
                fs.writeFileSync(filePath, "");
            }
            return;
        }
        const csvWriter = createCsvWriter({
            header: Object.keys(array[0]).map(x => {
                return {
                    id: x,
                    title: x
                }
            }),
            path: filePath,
            encoding: "utf8"
        });
        return csvWriter.writeRecords(array);
    }

    /**
     * @static Merges all rows from two source csv files into the single csv file
     * 
     * @param  {string} source1FilePath Full path to the first csv
     * @param  {string} source2FilePath Full path to the second csv
     * @param  {string} targetFilePath Full path to the target merged csv to create
     * @param  {boolean} deleteSourceFiles Set true to delete all source files after successfull merging
     * @param  {Array<string>} ...columns Acceptable columns from the source and the target to insert into the resulting csv file
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
     * Method splits the input array into chunks and to limit maximal size 
     * of each produced csv string after base64 encoding.
     *
     * @static
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
        });
        const csvStringifier = createCsvStringifier({
            header: headerArray,
            alwaysQuote: true,
            recordDelimiter: lineDelimiter
        });
        let header = csvStringifier.getHeaderString();
        let csvStrings: Array<[Array<object>, string]> = new Array<[Array<object>, string]>();
        let buffer: Buffer = Buffer.from('', encoding);
        let totalCsvChunkSize = 0;
        let csvBlock: Buffer;
        let arrayBuffer: Array<object> = new Array<object>();
        for (let index = 0; index < arrayBlocks.length; index++) {
            const arrayBlock = arrayBlocks[index];
            csvBlock = Buffer.from(csvStringifier.stringifyRecords(arrayBlock), encoding);
            let csvBlockSize = csvBlock.toString('base64').length;
            if (totalCsvChunkSize + csvBlockSize <= maxCsvStringSizeInBytes) {
                buffer = Buffer.concat([buffer, csvBlock]);
                arrayBuffer = arrayBuffer.concat(arrayBlock);
            } else {
                if (arrayBuffer.length > 0) {
                    csvStrings.push([arrayBuffer, (header + buffer.toString(encoding)).trim()]);
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
     * If the file was previously read and it is in the cache it retrieved from cache instead of reading file again
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
    public static async abortWithPrompt(logger: Logger,
        warnMessage: string,
        showPrompt: boolean,
        promptMessage: string,
        errorMessage: string,
        onBeforeAbortAsync: () => Promise<void>,
        ...warnTokens: string[]): Promise<void> {
        logger.warn.apply(logger, [warnMessage, ...warnTokens]);
        if (showPrompt) {
            if (!(await logger.yesNoPromptAsync(promptMessage))) {
                logger.log(RESOURCES.newLine);
                if (onBeforeAbortAsync) {
                    await onBeforeAbortAsync();
                }
                throw new CommandAbortedByUserError(logger.getResourceString(errorMessage));
            }
            logger.log(RESOURCES.newLine);
        }
    }

    /**
     * @static Generates random id string with given length
     * @param  {Number=10} length
     * @returns {string}
     * @memberof CommonUtils
     */
    public static makeId(length: Number = 10): string {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }


    /**
    * Get record value by given property name
    *     for this sobject
    *
    * @param {*} record The record
    * @param {string} thisSobjectName The current sObject name that we want to retrieve value for the record object
    * @param {string} propName The property name to extract value from the record object
    * @param {string} [sObjectName] If the current task is RecordType and propName = DeveloperName - 
    *                               pass here the SobjectType o include in the returned value
    * @param {string} [sFieldName]  If the current task is RecordType and propName = DeveloperName -
    *                               pass here the property name to extract value from the record object
    *                               instead of passing it with the "propName" parameter
    * @returns {*}
    * @memberof MigrationJobTask
    */
    public static getRecordValue(thisSobjectName: string, record: any, propName: string, sObjectName?: string, sFieldName?: string): any {
        if (!record) return null;
        let value = record[sFieldName || propName];
        if (!value) return value;
        sObjectName = sObjectName || record["SobjectType"];
        if (thisSobjectName == CONSTANTS.RECORD_TYPE_SOBJECT_NAME && propName == CONSTANTS.DEFAULT_RECORD_TYPE_ID_EXTERNAL_ID_FIELD_NAME) {
            return value + CONSTANTS.COMPLEX_FIELDS_SEPARATOR + sObjectName;
        } else {
            return value;
        }
    }

    /**
     * Parsed value and retrieves clear value.
     * For example for the field RecordType.DeveloperName: "AccountRT;Account" => "AccountRT"
     *
     * @static
     * @param {string} sObjectName The sObject name
     * @param {*} rawFieldValue The raw field value to transform
     * @param {string} fieldName The field name
     * @returns {string}
     * @memberof Common
     */
    public static getFieldValue(sObjectName: string, rawFieldValue: any, fieldName: string) : string {
        if (!rawFieldValue) return rawFieldValue;
        if (sObjectName == CONSTANTS.RECORD_TYPE_SOBJECT_NAME && fieldName == CONSTANTS.DEFAULT_RECORD_TYPE_ID_EXTERNAL_ID_FIELD_NAME) {
            //"AccountRT;Account" => "AccountRT"
            return String(rawFieldValue).split(CONSTANTS.COMPLEX_FIELDS_SEPARATOR)[0];
        }
        return rawFieldValue;
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
       * @returns {Array<string>} Returns an array of SOQLs
       * @memberof SfdxUtils
       */
    public static createFieldInQueries(
        selectFields: Array<string>,
        fieldName: string = "Id",
        sObjectName: string,
        valuesIN: Array<string>): Array<string> {

        let tempQuery = <Query>{
            fields: selectFields.map(field => getComposedField(field)),
            where: <WhereClause>{},
            sObject: sObjectName
        };
        let whereValuesCounter: number = 0;
        let whereValues = new Array<string>();

        function* queryGen() {
            while (true) {
                for (let whereClausLength = 0; whereClausLength < CONSTANTS.MAX_SOQL_WHERE_CLAUSE_CHARACTER_LENGTH;) {
                    let value = String(valuesIN[whereValuesCounter] || "");
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
                yield composeQuery(tempQuery);
                whereValues = new Array<string>();

                if (whereValuesCounter == valuesIN.length)
                    break;
            }
        }

        return [...queryGen()];
    }



}



// ---------------------------- Helper classes -------------------------------
/**
 * Represents the set of chunks of CSV file
 *
 * @export
 * @class CsvChunks
 */
export class CsvChunks {
    constructor(init?: Partial<CsvChunks>) {
        Object.assign(this, init);
    }
    chunks: Array<ICsvChunk> = [];
    header: Array<string> = new Array<string>();
    /**
     * Converts array chunks into CsvChunk object
     */
    fromArrayChunks(arrayChunks: Array<Array<any>>): CsvChunks {
        if (arrayChunks.length == 0) return;
        this.chunks = [].concat(arrayChunks.map(records => <ICsvChunk>{
            csvString: "",
            records
        }));
        this.header = Object.keys(arrayChunks[0][0]);
        return this;
    }
    fromArray(array: Array<any>): CsvChunks {
        return this.fromArrayChunks([array]);
    }
}

/**
 * Single chunk of CSV
 *
 * @export
 * @interface ICsvChunk
 */
export interface ICsvChunk {
    records: Array<object>,
    csvString: string
}

