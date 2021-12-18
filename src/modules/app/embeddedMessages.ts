/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IResourceBundle } from "../components/common_components/logger";
import AppMessagesBase from "./appMessagesBase";

export default class EmbeddedMessages extends AppMessagesBase implements IResourceBundle {

    constructor() {
        super();
    }

    setup<RType>(resourceInstance: RType): EmbeddedMessages {
        resourceInstance = (resourceInstance as any) || {};
        this.messages.clear();
        Object.keys(resourceInstance).forEach(key => {
            this.messages.set(key, resourceInstance[key] || '');
        });
        return this;
    }
}