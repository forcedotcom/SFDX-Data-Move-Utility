/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SFieldDescribe } from '../';

/**
 * Description of the sobject
 *
 * @export
 * @class SObjectDescribe
 */
export default class SObjectDescribe {

    constructor(init?: Partial<SObjectDescribe>) {
        if (init) {
            Object.assign(this, init);
        }
    }

    name: string = "";
    label: string = "";
    updateable: boolean = false;
    createable: boolean = false;
    custom: boolean = false;
    fieldsMap: Map<string, SFieldDescribe> = new Map<string, SFieldDescribe>();
}
