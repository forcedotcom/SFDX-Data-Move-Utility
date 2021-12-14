/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IResourceBundle } from "../components/common_components/logger";
import * as path from 'path';

export default class JsonMessages implements IResourceBundle {

    jsonPath: string;
    messages: Map<string, string> = new Map<string, string>();

    constructor(rootPath: string, bundleName: string) {
        this.jsonPath = path.join(rootPath, "messages", bundleName + ".json");
        let json = require(this.jsonPath);
        this.messages = Object.keys(json).reduce((acc: Map<string, string>, key: string) => {
            acc.set(key, String(json[key]));
            return acc;
        }, new Map<string, string>());
    }

    getMessage(key: string, tokens?: any): string {
        let message = this.messages.get(key) || '';
        let counter = 0;
        tokens = tokens || [];
        return message.replace(/(%s)/gi, () => {
            return tokens[counter++] || '';  
        });
    }

}