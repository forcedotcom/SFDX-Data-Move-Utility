
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ADDON_MODULE_METHODS, IAddonManifest, IAddonManifestDefinition } from "../../models/addons_models/addon_helpers";
import { Logger, RESOURCES } from "./logger";
import * as path from 'path';
import * as fs from 'fs';
import { CONSTANTS } from "./statics";
import { CommandInitializationError } from "../../models";
import { Common } from "./common";
import { IPluginRuntime } from "../../models/addons_models/IPluginRuntime";
import { IAddonModule } from "../../models/addons_models/IAddonModule";




/**
 * The sfdmu extensions manager
 *
 * @export
 * @class AddonManager
 */
export default class AddonManager {

    runtime: IPluginRuntime;
    logger: Logger;

    manifests: IAddonManifest[] = new Array<IAddonManifest>();
    addons: Map<number, IAddonModule[]> = new Map<number, IAddonModule[]>();

    /**
     * Map : Function name => List of functions ordered by the addon priority
     *
     * @type {Map<string, Function[]>}
     * @memberof AddonManager
     */
    addonHandlersMap: Map<string, [Function, any][]> = new Map<string, [Function, any][]>();

    constructor(runtime: IPluginRuntime, logger: Logger) {

        // Setup ************************************************   
        this.runtime = runtime;
        this.logger = logger;

        // Load manifests ***************************************
        this.manifests = [
            // Core manifest...
            this._loadAddonManifest(CONSTANTS.CORE_ADDON_MANIFEST_FILE_NAME, true, this.runtime.basePath),
            // Custom manifest...
            this._loadAddonManifest(path.join(runtime.basePath, CONSTANTS.USER_ADDON_MANIFEST_FILE_NAME), false, this.runtime.basePath)
        ].filter(manifest => !!manifest);

        // Load modules from the manifests ***********************
        this.manifests.forEach(manifest => {
            manifest.addons.forEach(addon => {
                if (addon.enabled) {
                    let module = this._loadAddonModule(addon, this.runtime.basePath);
                    if (module) {
                        if (!this.addons.has(addon.priority)) {
                            this.addons.set(addon.priority, []);
                        }
                        this.addons.get(addon.priority).push(this._loadAddonModule(addon, this.runtime.basePath));
                    }
                }
            });
        });

        // Create addon modules method map ***********************
        this._createModuleMethodsMap();

    }

    async callAddonModuleMethodAsync(method: ADDON_MODULE_METHODS, ...params: any[]): Promise<any> {

        let fns = this.addonHandlersMap.get(method);
        let lastResult: any;

        for (let index = 0; index < fns.length; index++) {
            let actualParams = [].concat(params);
            const fn = fns[index];
            if (index > 0) {
                actualParams = actualParams.slice(1);
                actualParams.unshift(lastResult);
            }
            lastResult = await fn[0].apply(fn[1], actualParams);
        }
        return lastResult;
    }

    callAddonModuleMethod(method: ADDON_MODULE_METHODS, ...params: any[]): any[] {
        let fns = this.addonHandlersMap.get(method);
        let lastResult: any;

        for (let index = 0; index < fns.length; index++) {
            let actualParams = [].concat(params);
            const fn = fns[index];
            if (index > 0) {
                actualParams = actualParams.slice(1);
                actualParams.unshift(lastResult);
            }
            lastResult = fn[0].apply(fn[1], actualParams);
        }
        return lastResult;
    }


    // --------- Private members ------------ //
    private _loadAddonManifest(manifestPath: string, isCore: boolean, basePath: string): IAddonManifest {

        if (!path.isAbsolute(manifestPath)) {
            manifestPath = path.resolve(isCore ? __dirname : basePath, manifestPath);
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

    private _loadAddonModule(manifestDefinition: IAddonManifestDefinition, basePath: string): IAddonModule {

        try {

            let moduleId = "";

            if (manifestDefinition.module) {
                moduleId = manifestDefinition.module;
            } else {
                if (!path.isAbsolute(manifestDefinition.path)) {
                    moduleId = path.resolve(manifestDefinition.isCore ? __dirname : basePath, manifestDefinition.path);
                } else {
                    moduleId = manifestDefinition.path;
                }
            }

            return <IAddonModule>new (require(moduleId).default)(this.runtime);

        } catch (ex) { }

        return null;
    }

    private _createModuleMethodsMap() {
        let keys = [...this.addons.keys()].sort();
        keys.forEach(priority => {
            this.addons.get(priority).forEach((module: IAddonModule) => {
                let functions = Common.getObjectProperties(module);
                functions.forEach($function => {
                    if (!this.addonHandlersMap.has($function)) {
                        this.addonHandlersMap.set($function, []);
                    }
                    this.addonHandlersMap.get($function).push([module[$function], module]);
                });
            });
        });
    }

}



