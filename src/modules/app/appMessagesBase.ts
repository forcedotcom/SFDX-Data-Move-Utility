/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IResourceBundle } from "../components/common_components/logger";

export default abstract class AppMessagesBase implements IResourceBundle {

    protected messages: Map<string, string> = new Map<string, string>();

    getMessage(key: string, tokens?: any): string { 
        let message = this.messages.get(key) || '';
        let counter = 0;
        tokens = tokens || [];
        return message.replace(/(%s)/gi, () => {
            return tokens[counter++] || '';  
        });
    }
    
}