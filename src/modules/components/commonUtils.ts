/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execSync } from 'child_process';
import path = require('path');
import { SfdxCommand } from '@salesforce/command';
import {
    composeQuery,
    Condition,
    Field as SOQLField,
    FieldType,
    getComposedField,
    LiteralType,
    LogicalOperator,
    parseQuery,
    Query,
    WhereClause,
    Operator
} from 'soql-parser-js';
import { CONSTANTS } from './statics';

/**
 * Common utility functions
 */
export class CommonUtils {



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
     * @static Returns array with distinct values comparing by the given object property
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
     * 
     *
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
     *
     *
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
     * Returns true if the field name is a complex field name
     * (f.ex. Account__r.Name)
     *
     * @static
     * @param {string} fieldName The field name
     * @returns {boolean}
     * @memberof CommonUtils
     */
    public static isComplexField(fieldName: string): boolean {
        return fieldName && (fieldName.indexOf('.') >= 0
            || fieldName.indexOf(CONSTANTS.COMPLEX_FIELDS_SEPARATOR) >= 0
            || fieldName.startsWith(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX));
    }



}
