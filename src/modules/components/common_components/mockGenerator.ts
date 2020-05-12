/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



/**
 * Used to generate random values to mask real data
 *
 * @export
 * @class MockGenerator
 */
export class MockGenerator {

    static counter: any;


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

        let self = this;

        casual.define('c_seq_number', function (field: any, prefix: any, from: any, step: any) {
            if (!self.counter.counter[field]) {
                self.counter.counter[field] = +from || 1;
            } else {
                self.counter.counter[field] = (+self.counter.counter[field]) + step
            }
            return prefix + self.counter.counter[field];
        });

        casual.define('c_seq_date', function (field: any, from: any, step: any) {
            step = step || "d";
            if (!self.counter.counter[field]) {
                if (!(from instanceof Date)) {
                    from = new Date(Date.parse(from));
                }
                self.counter.counter[field] = (from instanceof Date ? from : new Date())
            } else {
                switch (step) {
                    case "d":
                        self.counter.counter[field] = new Date(self.counter.counter[field].setDate(self.counter.counter[field].getDate() + 1));
                        break;
                    case "-d":
                        self.counter.counter[field] = new Date(self.counter.counter[field].setDate(self.counter.counter[field].getDate() - 1));
                        break;

                    case "m":
                        self.counter.counter[field] = new Date(self.counter.counter[field].setMonth(self.counter.counter[field].getMonth() + 1));
                        break;
                    case "-m":
                        self.counter.counter[field] = new Date(self.counter.counter[field].setMonth(self.counter.counter[field].getMonth() - 1));
                        break;

                    case "y":
                        self.counter.counter[field] = new Date(self.counter.counter[field].setFullYear(self.counter.counter[field].getFullYear() + 1));
                        break;
                    case "-y":
                        self.counter.counter[field] = new Date(self.counter.counter[field].setFullYear(self.counter.counter[field].getFullYear() - 1));
                        break;

                    case "s":
                        self.counter.counter[field] = new Date(self.counter.counter[field].setSeconds(self.counter.counter[field].getSeconds() + 1));
                        break;
                    case "-s":
                        self.counter.counter[field] = new Date(self.counter.counter[field].setSeconds(self.counter.counter[field].getSeconds() - 1));
                        break;

                    case "ms":
                        self.counter.counter[field] = new Date(self.counter.counter[field].setMilliseconds(self.counter.counter[field].getMilliseconds() + 1));
                        break;
                    case "-ms":
                        self.counter.counter[field] = new Date(self.counter.counter[field].setMilliseconds(self.counter.counter[field].getMilliseconds() - 1));
                        break;


                    default:
                        break;
                }
            }
            return new Date(self.counter.counter[field].getTime());
        });
    }

}
