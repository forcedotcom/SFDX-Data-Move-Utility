/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { ADDON_MODULE_METHODS } from "../../components/common_components/statics";
import * as path from 'path';

/**
 * Represent an item of the addons section of the ScriptObject / Script  classes
 *
 * @export
 * @class AddonManifestDefinition
 * @implements {IAddonManifestDefinition}
 */
export class AddonManifestDefinition {

    // ------------- JSON --------------
    command: string = "sfdmu:run";
    path: string;
    module: string;
    excluded: boolean;
    args: any;

    // -----------------------------------
    isCore: boolean;
    basePath: string;
    get moduleName(): string {
        let name = this.module || this.path;
        if (name) {
            return path.basename(name);
        }
    }
    get isValid(): boolean {
        return !!this.moduleName && this.method != ADDON_MODULE_METHODS.none;
    }
    method: ADDON_MODULE_METHODS = ADDON_MODULE_METHODS.none;
    objectName: string = '';

    get moduleRequirePath(): string {

        if (!this.isValid) {
            return null;
        }

        let requiredPath = "";

        if (this.module) {
            requiredPath = this.module;
        } else {
            if (!path.isAbsolute(this.path)) {
                requiredPath = path.resolve(this.isCore ? __dirname : this.basePath, this.path);
            } else {
                requiredPath = this.path;
            }
        }
        return requiredPath;

    }

    constructor(init: Partial<AddonManifestDefinition>) {
        if (init) {
            Object.assign(this, init);
        }
    }


}