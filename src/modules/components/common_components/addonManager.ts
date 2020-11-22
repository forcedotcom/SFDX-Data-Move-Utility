
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { Logger, RESOURCES } from "./logger";
import * as path from 'path';
import * as fs from 'fs';
import { ADDON_MODULE_METHODS, CONSTANTS } from "./statics";
import { CommandInitializationError, Script } from "../../models";
import { Common } from "./common";
import PluginRuntime from "../../models/addons_models/pluginRuntime";
import { IAddonModule, IPluginRuntime } from "../../models/addons_models/addonSharedPackage";
import { IAddonManifest, IAddonManifestDefinition } from "../../models/common_models/helper_interfaces";



/**
 * The sfdmu extensions manager
 *
 * @export
 * @class AddonManager
 */
export default class AddonManager {

    runtime: IPluginRuntime;
    script: Script;

    get logger(): Logger {
        return this.script.logger;
    }

    get fullCommandName() {
        return this.runtime.runInfo.pinfo.pluginName + ":" + this.runtime.runInfo.pinfo.commandName;
    }
   
    




    manifests: IAddonManifest[] = new Array<IAddonManifest>();
    addons: Map<number, IAddonModule[]> = new Map<number, IAddonModule[]>();

    /**
     * Map : Function name => List of functions ordered by the addon priority
     *
     * @type {Map<string, Function[]>}
     * @memberof AddonManager
     */
    addonHandlersMap: Map<string, [Function, any][]> = new Map<string, [Function, any][]>();

    constructor(script: Script) {

        // Setup ************************************************   
        this.script = script;
        this.runtime = new PluginRuntime(script);


        // Load manifests ***************************************
        this.manifests = [
            // Core manifest...
            this._loadAddonManifest(CONSTANTS.CORE_ADDON_MANIFEST_FILE_NAME, true, this.runtime.runInfo.basePath),
            // Custom manifest...
            this._loadAddonManifest(path.join(this.runtime.runInfo.basePath, CONSTANTS.USER_ADDON_MANIFEST_FILE_NAME), false, this.runtime.runInfo.basePath)
        ].filter(manifest => !!manifest);


        // Load modules from the manifests ***********************
        this.manifests.forEach(manifest => {
            manifest.addons.forEach((manifestDefinition, runOrder) => {
                if (!manifestDefinition.excluded && this.fullCommandName == manifestDefinition.command) {
                    if (manifestDefinition["valid"]) {
                        let module = this._loadAddonModule(manifestDefinition, this.runtime.runInfo.basePath);
                        if (module) {
                            runOrder = manifestDefinition.runOrder || runOrder + 1;
                            if (!this.addons.has(runOrder)) {
                                this.addons.set(runOrder, []);
                            }
                            this.addons.get(runOrder).push(this._loadAddonModule(manifestDefinition, this.runtime.runInfo.basePath));
                            this.logger.infoVerbose(RESOURCES.loaded, manifestDefinition["moduleName"])
                        }
                    } else {
                        this.logger.warn(RESOURCES.cantLoad, manifestDefinition["moduleName"])
                    }
                }
            });
        });

        // Create addon modules method map ***********************
        this._createModuleMethodsMap();

    }

    async triggerAddonModuleMethodAsync(method: ADDON_MODULE_METHODS, ...params: any[]): Promise<any> {

        let fns = this.addonHandlersMap.get(method);
        let lastResult: any;
        if (!fns) return lastResult;

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

    triggerAddonModuleMethodSync(method: ADDON_MODULE_METHODS, ...params: any[]): any[] {
        let fns = this.addonHandlersMap.get(method);
        let lastResult: any;
        if (!fns) return lastResult;

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
    private _loadCoreAddonManifest(): IAddonManifest {
        let manifestPath = path.resolve(__dirname, CONSTANTS.CORE_ADDON_MANIFEST_FILE_NAME);
        try {
            let manifest = <IAddonManifest>JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            manifest.addons.forEach(manifestDefinition => {
                manifestDefinition.objectName = undefined; // Core addon => is object undependent
                manifestDefinition.isCore = true;
                manifestDefinition.runOrder = manifestDefinition.runOrder || 1;
                manifestDefinition.moduleName = manifestDefinition.module || manifestDefinition.path;
                manifestDefinition.valid = !!manifestDefinition.moduleName;
                if (manifestDefinition.valid) {
                    manifestDefinition.moduleName = path.basename(manifestDefinition.moduleName);
                }
            });
            return manifest;
        } catch (ex) {
            throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.scriptJSONReadError, ex.message));
        }
    }

    private _loadManifestFromScript(): IAddonManifest {

    }



    private _loadAddonManifest(manifestPath: string, isCore: boolean, basePath: string): IAddonManifest {

        if (!path.isAbsolute(manifestPath)) {
            manifestPath = path.resolve(isCore ? __dirname : basePath, manifestPath);
        }

        if (isCore) {
            this.logger.infoNormal(RESOURCES.loadingAddonManifestFile, this.logger.getResourceString(RESOURCES.coreManifest));
            if (!fs.existsSync(manifestPath)) {
                this.logger.warn(RESOURCES.addonManifestFileDoesNotFound, this.logger.getResourceString(RESOURCES.coreManifest));
                return null;
            }
        } else {
            if (!fs.existsSync(manifestPath)) {
                return null;
            }
            this.logger.infoNormal(RESOURCES.loadingAddonManifestFile, manifestPath);
        }

        try {
            let manifest = <IAddonManifest>JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            manifest.addons.forEach(manifestDefinition => {
                manifestDefinition.isCore = isCore;
                manifestDefinition.runOrder = (manifestDefinition.runOrder || 1) + (isCore ? 0 : CONSTANTS.USER_ADDON_PRIORITY_OFFSET);
                manifestDefinition["moduleName"] = manifestDefinition.module || manifestDefinition.path;
                manifestDefinition["valid"] = !!manifestDefinition["moduleName"];
                if (manifestDefinition["valid"]) {
                    manifestDefinition["moduleName"] = path.basename(manifestDefinition["moduleName"]);
                }
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
                functions.forEach(method => {
                    if (!this.addonHandlersMap.has(method)) {
                        this.addonHandlersMap.set(method, []);
                    }
                    this.addonHandlersMap.get(method).push([module[method], module]);
                });
            });
        });
    }

}



