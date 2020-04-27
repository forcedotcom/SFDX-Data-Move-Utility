/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import path = require('path');
import { SfdxCommand } from '@salesforce/command';


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
    

}
