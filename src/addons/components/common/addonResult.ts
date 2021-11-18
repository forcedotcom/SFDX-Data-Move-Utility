/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuRunCustomAddonResult } from "../../modules/sfdmu-run/custom-addons/package";


export default class AddonResult implements ISfdmuRunCustomAddonResult {

    constructor(init: Partial<AddonResult>) {
        if (init) {
            Object.assign(this, init);
        }
    }

    cancel: boolean;
}