/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { IUxLogger } from "../components/common_components/logger";

const readline = require('readline');
const {
    stdin: input,
    stdout: output
} = require('process');
const rl = readline.createInterface({ input, output });

export default class AppConsoleLogger implements IUxLogger {

    log = (message: any): void => {
        console.log(`${message}`);
    }

    styledJSON = (message: string): void => console.log('\x1b[34m%s\x1b[0m', JSON.stringify(JSON.parse(message || '{}'), null, 4));

    warn = (message: any): void => console.warn('\x1b[33m%s\x1b[0m', `${message}`);
    error = (message: any): void => console.error('\x1b[31m%s\x1b[0m', `${message}`);
    styledObject = (message: any): void => console.log('\x1b[34m%s\x1b[0m', JSON.stringify(message || {}, null, 4));
    table = (message: any): void => console.log(message);

    prompt = (message: string, params: {
        default: string,
        timeout: number
    }): Promise<any> => {
        return new Promise<any>(resolve => {
            let timeout: any;
            if (params && params.timeout) {
                timeout = setTimeout(() => {
                    rl.close();
                    resolve(params.default);
                }, params.timeout);
            }
            rl.question(message + ' ', function (answer: string) {
                if (timeout) {
                    clearTimeout(timeout);
                }
                rl.close();
                resolve(answer);
            });
        });
    };
    styledHeader = (message: any): void => console.log('\x1b[32m%s\x1b[0m', '\n'
        + String(message || '').toUpperCase()
        + '\n=================\n');

    startSpinner = (): void => void (0);
    stopSpinner = (): void => void (0);
    setSpinnerStatus = (): void => void (0);

}

