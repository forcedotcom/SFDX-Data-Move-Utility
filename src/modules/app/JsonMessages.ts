/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IResourceBundle } from "../components/common_components/logger";
import * as path from 'path';
import AppMessagesBase from "./appMessagesBase";

export default class JsonMessages extends AppMessagesBase implements IResourceBundle {

    jsonPath: string;

    constructor(rootPath: string, bundleName: string) {
        super();
        this.jsonPath = path.join(rootPath, "messages", bundleName + ".json");
        try {
            let json = require(this.jsonPath);
            this.messages = Object.keys(json).reduce((acc: Map<string, string>, key: string) => {
                acc.set(key, String(json[key]));
                return acc;
            }, new Map<string, string>());
        } catch (e: any) { }
    }

}