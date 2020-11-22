
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
import { AddonManifest, CommandInitializationError, Script } from "../../models";
import PluginRuntime from "../../models/addons_models/pluginRuntime";
import { IAddonModule, IPluginRuntime } from "../../models/addons_models/addonSharedPackage";
import { AddonManifestDefinition } from "../../models/script_models/addonManifestDefinition";
import "reflect-metadata";
import "es6-shim";
import { plainToClass } from "class-transformer";



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

    manifests: AddonManifest[] = new Array<AddonManifest>();
    addonsMap: Map<ADDON_MODULE_METHODS, [Function, AddonManifestDefinition][]> = new Map<ADDON_MODULE_METHODS, [Function, AddonManifestDefinition][]>();
    addons: Map<number, IAddonModule[]> = new Map<number, IAddonModule[]>();

    constructor(script: Script) {

        // Setup ************************************************   
        this.script = script;
        this.runtime = new PluginRuntime(script);

        // Load manifests
        this.manifests = [
            // Load the core manifest from the manifest file
            this._loadCoreAddonManifest(),
            // Load the user's manifest from the export.json
            this._loadUserAddonManifest()
        ].filter(manifest => !!manifest && manifest.addons.length > 0);

        // Create functions map
        this._createAddOnsMap();
    }

    async triggerAddonModuleMethodAsync(method: ADDON_MODULE_METHODS, objectName: string): Promise<void> {
        if (!this.addonsMap.has(method)) {
            return;
        }
        let addons = this.addonsMap.get(method).filter(addon => {
            return addon[1].objectName == objectName;
        });

        for (let index = 0; index < addons.length; index++) {
            const addon = addons[index];
            await addon[0]();
        }
    }

    triggerAddonModuleMethodSync(method: ADDON_MODULE_METHODS, objectName: string): void {
        (async () => await this.triggerAddonModuleMethodAsync(method, objectName))();
    }


    // --------- Private members ------------ //
    private _loadCoreAddonManifest(): AddonManifest {
        this.logger.infoNormal(RESOURCES.loadingAddonManifestFile, this.logger.getResourceString(RESOURCES.coreManifest));
        let manifestPath = path.resolve(__dirname, CONSTANTS.CORE_ADDON_MANIFEST_FILE_NAME);
        if (!fs.existsSync(manifestPath)) {
            return null;
        }
        try {
            let manifestPlain = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            let manifest = plainToClass(AddonManifest, manifestPlain);
            manifest.addons.forEach(addon => {
                addon.isCore = true;
                addon.basePath = this.runtime.runInfo.basePath;
            });
            return manifest;
        } catch (ex) {
            throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.scriptJSONReadError, ex.message));
        }
    }

    private _loadUserAddonManifest(): AddonManifest {
        this.logger.infoNormal(RESOURCES.loadingAddonManifestFile, this.logger.getResourceString(RESOURCES.userManifest));
        let manifest: AddonManifest = new AddonManifest();
        this.script.beforeAddons.forEach(addon => {
            if (!addon.excluded && addon.command == this.fullCommandName) {
                addon.method = ADDON_MODULE_METHODS.onBefore;
                manifest.addons.push(addon);
            }
        });
        this.script.objects.forEach(object => {
            object.beforeAddons.forEach(addon => {
                if (!addon.excluded && addon.command == this.fullCommandName) {
                    addon.method = ADDON_MODULE_METHODS.onBefore;
                    addon.objectName = object.name;
                    manifest.addons.push(addon);
                }
            });
            object.afterAddons.forEach(addon => {
                if (!addon.excluded && addon.command == this.fullCommandName) {
                    addon.method = ADDON_MODULE_METHODS.onAfter;
                    addon.objectName = object.name;
                    manifest.addons.push(addon);
                }
            });
        });
        this.script.afterAddons.forEach(addon => {
            if (!addon.excluded && addon.command == this.fullCommandName) {
                addon.method = ADDON_MODULE_METHODS.onAfter;
                manifest.addons.push(addon);
            }
        });
        manifest.addons.forEach(addon => {
            addon.isCore = false;
            addon.basePath = this.runtime.runInfo.basePath;
        });
        return manifest;
    }

    private _createAddOnsMap() {
        this.manifests.forEach(manifest => {
            manifest.addons.forEach(addon => {
                try {
                    if (addon.isValid) {
                        let moduleInstance: IAddonModule = <IAddonModule>new (require(addon.moduleRequirePath).default)(this.runtime);
                        if (!this.addonsMap.has(addon.method)) {
                            this.addonsMap.set(addon.method, []);
                        }
                        this.addonsMap.get(addon.method).push([moduleInstance.onExecute.bind(moduleInstance, addon.args), addon]);
                    }
                } catch (ex) { }
            })
        });
    }
}



