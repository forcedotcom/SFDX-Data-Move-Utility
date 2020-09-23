
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IAddonManifest, IAddonManifestDefinition, iPluginRuntimeMembers as pluginRuntimeSharedMembers } from "../../models/addons_models/addon_helpers";
import { Logger, RESOURCES } from "./logger";
import * as path from 'path';
import * as fs from 'fs';
import { CONSTANTS } from "./statics";
import { CommandInitializationError } from "../../models";
import { Common } from "./common";
import { AddonModuleBase } from "../../models/addons_models/AddonModuleBase";
import { IPluginRuntime } from "../../models/addons_models/IPluginRuntime";




/**
 * The sfdmu extensions manager
 *
 * @export
 * @class AddonManager
 */
export default class AddonManager {

    addonModuleRuntime: IPluginRuntime;
    runtime: IPluginRuntime;
    logger: Logger;

    manifests: IAddonManifest[] = new Array<IAddonManifest>();
    addons: Map<number, AddonModuleBase[]> = new Map<number, AddonModuleBase[]>();

    /**
     * Map : Function name => List of functions ordered by the addon priority
     *
     * @type {Map<string, Function[]>}
     * @memberof AddonManager
     */
    addonHandlersMap: Map<string, Function[]> = new Map<string, Function[]>();

    constructor(runtime: IPluginRuntime, logger: Logger) {

        // Setup ************************************************   
        this.runtime = runtime;     
        this.addonModuleRuntime = Common.extractObjectMembers(runtime, pluginRuntimeSharedMembers);
        this.logger = logger;

        // Load manifests ***************************************
        this.manifests = [
            // Core manifest...
            this._loadAddonManifest(CONSTANTS.CORE_ADDON_MANIFEST_FILE_NAME, true),
            // Custom manifest...
            this._loadAddonManifest(path.join(runtime.basePath, CONSTANTS.USER_ADDON_MANIFEST_FILE_NAME))
        ].filter(manifest => !!manifest);

        // Load modules from the manifests ***********************
        this.manifests.forEach(manifest => {
            manifest.addons.forEach(addon => {
                if (addon.enabled) {
                    let module = this._loadAddonModule(addon);
                    if (module) {
                        if (!this.addons.has(addon.priority)) {
                            this.addons.set(addon.priority, []);
                        }
                        this.addons.get(addon.priority).push(this._loadAddonModule(addon));
                    }
                }
            });
        });

        // Create addon modules method map ***********************
        this._createModuleMethodsMap();
        

    }



    // --------- Private members ------------ //
    private _loadAddonManifest(manifestPath: string, isCore: boolean = false): IAddonManifest {

        if (!path.isAbsolute(manifestPath)) {
            manifestPath = path.resolve(__dirname, manifestPath);
        }

        if (!fs.existsSync(manifestPath)) {
            if (isCore)
                throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.missingNecessaryComponent, manifestPath));
            else
                return null;
        }

        this.logger.infoMinimal(RESOURCES.loadingAddonManifestFile, isCore ? this.logger.getResourceString(RESOURCES.coreManifest) : manifestPath);

        try {
            let manifest = <IAddonManifest>JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            manifest.addons.forEach(addon => {
                addon.isCore = isCore;
                addon.priority = (addon.priority || 1) + (isCore ? 0 : CONSTANTS.USER_ADDON_PRIORITY_OFFSET);
            });
            return manifest;
        } catch (ex) {
            throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.scriptJSONReadError, ex.message));
        }
    }

    private _loadAddonModule(manifestDefinition: IAddonManifestDefinition): AddonModuleBase {

        try {

            let moduleId = "";

            if (manifestDefinition.module) {
                moduleId = manifestDefinition.module;
            } else {
                if (!path.isAbsolute(manifestDefinition.path)) {
                    moduleId = path.resolve(__dirname, manifestDefinition.path);
                } else {
                    moduleId = manifestDefinition.path;
                }
            }

            return <AddonModuleBase> new (require(moduleId).default)(this.addonModuleRuntime);

        } catch (ex) { }

        return null;
    }

    private _createModuleMethodsMap() {
        let keys = [...this.addons.keys()].sort();
        keys.forEach(priority => {
            this.addons.get(priority).forEach((module: AddonModuleBase) => {
                let functions = Common.getObjectProperties(module);
                functions.forEach($function => {
                    if (!this.addonHandlersMap.has($function)) {
                        this.addonHandlersMap.set($function, []);
                    }
                    this.addonHandlersMap.get($function).push(module[$function]);
                });
            });
        });
    }

}



