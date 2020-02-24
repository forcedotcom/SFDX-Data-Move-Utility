/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';

import { CONSTANTS } from './models';
import { List } from 'linq.ts';
import SimpleCrypto from 'simple-crypto-js';

import path = require('path');
import parse = require('csv-parse/lib/sync');
import glob = require("glob");
import { SfdxCommand } from '@salesforce/command';

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

const createCsvWriter = require('csv-writer').createObjectCsvWriter;



/**
 * Common utilities
 */
export class CommonUtils {


    /**
     * Trims end of string
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
     * Merges two objects by copying 
     * all props that exist in the source object but empty in the target  
     * from the source object to the target object 
     * @param  {object} source Source object to merge
     * @param  {object} target Target object to merge
     * @returns object Merged object
     */
    public static mergeObjectsEmptyProps(source: object, target: object): object {
        return {
            ...source,
            ...Reflect.ownKeys(target).filter(k => target[k] || target[k] == false).reduce((res, curr) => ({ ...res, [curr]: target[curr] }), {})
        };
    }


    /**
    * Clones list of objects by creating a new one.
    * Each item of the new list is a clone of the original one 
    * and has no properties that marked as to be excluded.
    */
    /**
     * @param  {List<object>} objects List of objects to clone
     * @param  {Array<string>} propsToExclude Optional properties to exclude from applying to target objects
     * @returns List
     */
    public static cloneList(objects: List<object>, propsToExclude: Array<string> = new Array<string>()): List<object> {
        var props = propsToExclude.map((prop) => {
            return "'" + prop + "': " + prop.replace(/[\.]/g, "");
        }).join(",");
        var func = new Function("item", `return (({ ${props}, ...x }) => ({ ...x }))(item)`);
        return objects.Select(item => func(item));
    }


    /**
     * Splits array to multiple chunks by max chunk size
     * @param  {Array<any>} array Array to split
     * @param  {number} chunkMaxSize Max size of each chunk
     * @returns Array
     */
    public static chunkArray(array: Array<any>, chunkMaxSize: number): Array<Array<any>> {
        var i, j, arr: Array<Array<any>> = new Array<Array<any>>();
        for (i = 0, j = array.length; i < j; i += chunkMaxSize) {
            arr.push(array.slice(i, i + chunkMaxSize));
        }
        return arr;
    }



    /**
     * Calculates and displays difference between two dates in format [HH:mm:ss.mmm]
     * @param  {Date} dateStart Start date
     * @param  {Date} dateEnd End date
     * @returns string
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
     * Converts number to string with leading zerros
     * @param  {number} num Number to convert
     * @param  {number} size Total size of resulting string including zeros
     * @returns string
     */
    public static addLeadnigZeros(num: number, size: number): string {
        var s = String(num);
        while (s.length < (size || 2)) { s = "0" + s; }
        return s;
    }


    /**
     * Returns full console line
     * which the command was started with it
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
     * Converts given UTC date to the local date
     *
     * @static
     * @param {Date} date The UTC date
     * @returns {Date} Local date
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
     * Formats date to string [yyyy-MM-dd HH:mm:ss:mmm]
     * @param  {Date} date Date to format
     * @param  {boolean=true} addMilliseconds Set to true to add milliseconds to the resulting string
     * @returns string
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
     * Formats date to string [d_MM_yyyy_HH_mm_ss ] to use with fs
     * @param  {Date} date Date to format
     * @returns string
     */
    public static formatFileDate(date: Date): string {
        return this.formatDateTime(date, false).replace(/[:]/g, "_").replace(/\s/g, "_").replace(/[/]/g, "_");
    }

    /**
     * 
     *
     * @static Formats date to string [HH:mm:dd.mmm] using 24h-format
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
     * Compares values of all props of two objects excluding giving properties if apply
     * @param  {Object} firstObject The first object to compare
     * @param  {Object} secondObject The second object to compare
     * @param  {Array<string>=newArray<string>(} propsToExclude
     * @returns boolean Returns true if the objects are identical
     */
    public static areEqual(firstObject: Object, secondObject: Object, propsToExclude: Array<string> = new Array<string>()): boolean {
        for (var key in firstObject) {
            if ((!(key in secondObject) || firstObject[key] != secondObject[key] && (firstObject[key] || secondObject[key])) && propsToExclude.indexOf(key) < 0) {
                return false;
            }
        }
        return true;
    }





    /**
     * Prompts user to input value from the command or terminal console
     * @param  {string} message Message to prompt the user
     * @returns string 
     */
    public static async promptUserAsync(message: string): Promise<string> {
        // TODO: Use messageUtils        
        return new Promise((resolve, reject) => {
            readline.question(message, (ans) => {
                readline.close();
                resolve(ans);
            });
        });
    }



    /**
     * Reads csv file from disk
     * Can read both entire file or wanted amount of lines
     * @param  {string} filePath Full path to CSV to read
     * @param  {number=0} linesAmountToRead 
     * @param  {Map<string,string>?} acceptedColumnsToColumnsTypeMap Map between column to be imported from the csv to its expected type. Type can be 'string', 'boolean' etc
     * @returns Array<object>
     */
    public static async readCsvFileAsync(filePath: string, linesAmountToRead: number = 0, acceptedColumnsToColumnsTypeMap?: Map<string, string>): Promise<Array<object>> {

        function csvCast(value, context) {

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

        function columns(header) {
            if (!acceptedColumnsToColumnsTypeMap) {
                return header;
            }
            return header.map(column => {
                if (column.indexOf('.') >= 0
                    || column.indexOf(CONSTANTS.CSV_COMPLEX_FIELDS_COLUMN_SEPARATOR) >= 0
                    || column.indexOf(CONSTANTS.COMPLEX_FIELDS_QUERY_SEPARATOR) >= 0
                    || column.indexOf(CONSTANTS.COMPLEX_FIELDS_SEPARATOR) >= 0
                    || acceptedColumnsToColumnsTypeMap.has(column))
                    return column;
                else {
                    return undefined;
                }
            });
        }


        return new Promise<Array<object>>(resolve => {

            if (!fs.existsSync(filePath)) {
                resolve(new Array<object>());
                return;
            }

            if (linesAmountToRead == 0) {
                let input = fs.readFileSync(filePath, 'utf8');
                const records = parse(input, {
                    columns: columns,
                    skip_empty_lines: true,
                    cast: csvCast
                });
                resolve([...records]);
            } else {

                let lineReader = require('readline').createInterface({
                    input: require('fs').createReadStream(filePath),
                });

                let lineCounter = 0; let wantedLines = [];

                lineReader.on('line', function (line) {
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
                        cast: csvCast
                    });
                    resolve([...records]);
                });

            }

        });
    }



    /**
     * Writes array of objects to csv file
     * @param  {string} filePath Full file path to write to
     * @param  {Array<object>} array Array of objects to write to the csv file
     * @param  {boolean=false} createEmptyFileOnEmptyArray Set to true forces creating empty file if the input array is empty or undefined otherwise nothing acts
     */
    public static async writeCsvFileAsync(filePath: string, array: Array<object>, createEmptyFileOnEmptyArray: boolean = false): Promise<void> {
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
            path: filePath
        });
        return csvWriter.writeRecords(array);
    }



    /**
     * @param  {string} source1FilePath Full path to the first csv
     * @param  {string} source2FilePath Full path to the second csv
     * @param  {string} targetFilePath Full path to the target merged csv to create
     * @param  {boolean} deleteSourceFiles Set true to delete all source files after successfull merging
     * @param  {Array<string>} ...columns Acceptable columns from the source and the target to insert into the resulting csv file
     */
    public static async mergeCsvFiles(source1FilePath: string, source2FilePath: string, targetFilePath: string, deleteSourceFiles: boolean, ...columns: Array<string>) {

        let totalRows: Array<object> = new Array<object>();

        async function addRowsFromFile(file: string) {
            if (fs.existsSync(file)) {
                let rows = await CommonUtils.readCsvFileAsync(file);
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

        await addRowsFromFile(source1FilePath);
        await addRowsFromFile(source2FilePath);

        await this.writeCsvFileAsync(targetFilePath, totalRows);

    }



    /**
     * Read csv file only once and cache it into the Map.
     * If the file was previously read and it is in the cache it retrieved from cache instead of reading file again
     * @param  {Map<string, Map<string, any>}  csvDataCacheMap
     * @param  {string} fileName File name to write
     * @param  {string} indexFieldName The name of column that its value used as an index of the row in the file
     * @param  {string} indexValueLength Length of generated random string for missing row index values
     * @param  {string} useRowIndexAutonumber If index value is empty for the given row 
     *                                        fills it with row number instead of random string
     * @returns Map<string, any>
     */
    public static async readCsvFileOnceAsync(csvDataCacheMap: Map<string, Map<string, any>>,
        fileName: string,
        indexFieldName: string = "Id",
        indexValueLength: number = 18,
        useRowIndexAutonumber: boolean = false): Promise<Map<string, any>> {

        let m: Map<string, any> = csvDataCacheMap.get(fileName);

        if (!m) {
            if (!fs.existsSync(fileName)) {
                return null;
            }
            let csvRows = await CommonUtils.readCsvFileAsync(fileName);
            m = new Map<string, any>();
            csvRows.forEach((row, index) => {
                if (!row[indexFieldName]) {
                    row[indexFieldName] = useRowIndexAutonumber ? String(index + 1) : CommonUtils.makeId(indexValueLength);
                }
                m.set(row[indexFieldName], row);
            });
            csvDataCacheMap.set(fileName, m);
        }
        return m;
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
     * Decrypts array of objects per item per property
     * The input array need to be encrypted with the same passphrase previously
     * @param  {Array<object>} array 
     * @param  {string?} password Passphrase to use for decryption
     * @returns  Array<object>
     */
    public static decryptArray(array: Array<object>, password?: string): Array<object> {
        if (!password || array.length == 0)
            return array;
        var simpleCrypto = new SimpleCrypto(password);
        let keys = [...Object.keys(array[0])];
        array.forEach(record => {
            keys.forEach(key => {
                if (key) {
                    let v = record[key] ? simpleCrypto.decrypt(record[key]) : record[key];
                    if (v)
                        record[key] = v;
                    else
                        record[key] = null;
                }
            });
        });
        return array;
    }



    /**
     * Encrypts array of objects per item per property
     * @param  {Array<object>} array
     * @param  {string?} password Passphrase to use for encryption
     * @returns  Array<object>
     */
    public static encryptArray(array: Array<object>, password?: string): Array<object> {
        if (!password || array.length == 0)
            return array;
        var simpleCrypto = new SimpleCrypto(password);
        let keys = [...Object.keys(array[0])];
        array.forEach(record => {
            keys.forEach(key => {
                if (key) {
                    let v = record[key] != null && typeof record[key] != "undefined" ? simpleCrypto.encrypt(record[key]) : record[key];
                    record[key] = v;
                }
            });
        });
        return array;
    }

    /**
     * Generates random id string with given length
     * @param  {Number=10} length
     */
    public static makeId(length: Number = 10) {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }


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
}


/**
 * Used to generate random values to mask real data
 */
export class MockGenerator {

    static counter;


    /**
     * When used custom sequental generators the function resets the counters.
     * Each object property has its own counter.
     * The function resets counters for all properties.
     */
    public static resetCounter() {
        this.counter = {
            counter: {}
        };
    }

    /**
     * Adds custom generators to the casual engine
     * @param casual The casual engine instance
     */
    public static createCustomGenerators(casual: any) {

        let _this = this;

        casual.define('c_seq_number', function (field, prefix, from, step) {
            if (!_this.counter.counter[field]) {
                _this.counter.counter[field] = +from || 1;
            } else {
                _this.counter.counter[field] = (+_this.counter.counter[field]) + step
            }
            return prefix + _this.counter.counter[field];
        });

        casual.define('c_seq_date', function (field, from, step) {
            step = step || "d";
            if (!_this.counter.counter[field]) {
                if (!(from instanceof Date)) {
                    from = new Date(Date.parse(from));
                }
                _this.counter.counter[field] = (from instanceof Date ? from : new Date())
            } else {
                switch (step) {
                    case "d":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setDate(_this.counter.counter[field].getDate() + 1));
                        break;
                    case "-d":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setDate(_this.counter.counter[field].getDate() - 1));
                        break;

                    case "m":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setMonth(_this.counter.counter[field].getMonth() + 1));
                        break;
                    case "-m":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setMonth(_this.counter.counter[field].getMonth() - 1));
                        break;

                    case "y":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setFullYear(_this.counter.counter[field].getFullYear() + 1));
                        break;
                    case "-y":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setFullYear(_this.counter.counter[field].getFullYear() - 1));
                        break;

                    case "s":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setSeconds(_this.counter.counter[field].getSeconds() + 1));
                        break;
                    case "-s":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setSeconds(_this.counter.counter[field].getSeconds() - 1));
                        break;

                    case "ms":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setMilliseconds(_this.counter.counter[field].getMilliseconds() + 1));
                        break;
                    case "-ms":
                        _this.counter.counter[field] = new Date(_this.counter.counter[field].setMilliseconds(_this.counter.counter[field].getMilliseconds() - 1));
                        break;


                    default:
                        break;
                }
            }
            return new Date(_this.counter.counter[field].getTime());
        });
    }

}

