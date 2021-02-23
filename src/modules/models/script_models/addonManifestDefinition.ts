/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { CONSTANTS } from "../../components/common_components/statics";
import * as path from 'path';
import { ADDON_MODULE_METHODS } from "../../../addons/package/base/enumerations";

/**
 * Represent an item of the addons section of the ScriptObject / Script  classes
 *
 * @export
 * @class AddonManifestDefinition
 * @implements {IAddonManifestDefinition}
 */
export class AddonManifestDefinition {

    // ------------- JSON --------------
    // Common definitions
    command: string = "sfdmu:run";
    path: string;
    module: string;
    excluded: boolean;
    args: any;

    // Core definitions
    objects: string[];

    constructor(init: Partial<AddonManifestDefinition>) {
        if (init) {
            Object.assign(this, init);
        }
    }

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
            if (this.module.indexOf(CONSTANTS.CORE_ADDON_MODULES_NAME_PREFIX) >= 0) {
                // Core module like ":OnBefore"
                let modulePath = CONSTANTS.CORE_ADDON_MODULES_BASE_PATH
                    + this.command.replace(CONSTANTS.CORE_ADDON_MODULES_FOLDER_SEPARATOR, CONSTANTS.CORE_ADDON_MODULES_FOLDER_NAME_SEPARATOR) + '/' // sfdmu-run/
                    + this.module.replace(CONSTANTS.CORE_ADDON_MODULES_NAME_PREFIX, '/'); // /OnBefore
                requiredPath = path.normalize(path.resolve(__dirname, modulePath));
            } else {
                // NPM module
                requiredPath = this.module;
            }
        } else {
            // Module by path
            if (!path.isAbsolute(this.path)) {
                requiredPath = path.resolve(this.isCore ? __dirname : this.basePath, this.path);
            } else {
                requiredPath = this.path;
            }
        }
        return requiredPath;

    }

    appliedToObject(objectName: string) {
        return this.objectName == objectName
            || Array.isArray(this.objects) && (this.objects.length == 0 || this.objects.indexOf(objectName) >= 0);
    }

}