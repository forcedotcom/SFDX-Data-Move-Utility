
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import * as path from 'path';
import * as fs from 'fs';

import "reflect-metadata";
import "es6-shim";
import { plainToClass } from "class-transformer";

import { AddonManifest, CommandInitializationError, Script } from '../../../../modules/models';
import { Logger, RESOURCES } from '../../../../modules/components/common_components/logger';
import AddonManifestDefinition from '../../../../modules/models/script_models/addonManifestDefinition';
import { CONSTANTS } from '../../../../modules/components/common_components/statics';
import { ADDON_MODULE_METHODS } from '../../../../modules/components/common_components/enumerations';
import PluginRuntimeBase from '../common/pluginRuntimeBase';
import AddonModuleBase from '../common/AddonModuleBase';
import IPluginExecutionContext from '../common/IPluginExecutionContext';
import SfdmuPluginRuntime from './sfdmuRunPluginRuntime';
import { IAddonRuntimeSystem } from '../common/IAddonRuntimeSystem';
import { ISfdmuAddonRuntimeSystem } from './ISfdmuAddonRuntimeSystem';




/**
 * The sfdmu Addon extensions manager
 */
export default class SfdmuAddonManager {

    runtime: PluginRuntimeBase;
    runtimeSystem: IAddonRuntimeSystem;
    script: Script;

    get logger(): Logger {
        return this.script.logger;
    }

    get fullCommandName() {
        return this.runtime.runInfo.pinfo.pluginName + ":" + this.runtime.runInfo.pinfo.commandName;
    }

    manifests: AddonManifest[] = new Array<AddonManifest>();
    addonsMap: Map<ADDON_MODULE_METHODS, [Function, AddonManifestDefinition][]> = new Map<ADDON_MODULE_METHODS, [Function, AddonManifestDefinition][]>();
    addons: Map<number, AddonModuleBase[]> = new Map<number, AddonModuleBase[]>();

    constructor(script: Script) {

        // Setup ************************************************   
        this.script = script;
        this.runtime = new SfdmuPluginRuntime(script);
        this.runtimeSystem = <ISfdmuAddonRuntimeSystem>(<any>this.runtime);

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

    async triggerAddonModuleMethodAsync(method: ADDON_MODULE_METHODS, objectName: string = ''): Promise<boolean> {

        if (!this.addonsMap.has(method)) {
            return false;
        }

        let addons = this.addonsMap.get(method).filter(addon => {
            return addon[1].appliedToObject(objectName);
        });

        if (addons.length > 0) {

            let globalText = this.logger.getResourceString(RESOURCES.global);
            this.logger.infoNormal(RESOURCES.runAddonMethod, objectName || globalText, method.toString());

            for (let index = 0; index < addons.length; index++) {
                let addon = addons[index];
                if (addon[1].startupMessage) {
                    this.logger.infoNormal(addon[1].startupMessage);
                }
                await addon[0]();
            }

            this.logger.infoNormal(RESOURCES.runAddonMethodCompleted, objectName || globalText, method.toString());
            return true;
        }

        return false;
    }

    triggerAddonModuleMethodSync(method: ADDON_MODULE_METHODS, objectName: string): void {
        // tslint:disable-next-line: no-floating-promises
        (async () => await this.triggerAddonModuleMethodAsync(method, objectName))();
    }


    // --------- Private members ------------ //
    private _loadCoreAddonManifest(): AddonManifest {
        this.logger.infoNormal(RESOURCES.loadingAddonManifestFile, 
                this.logger.getResourceString(RESOURCES.coreManifest));
        let manifestPath = path.resolve(__dirname, CONSTANTS.CORE_ADDON_MANIFEST_FILE_NAME);
        if (!fs.existsSync(manifestPath)) {
            return null;
        }
        try {
            let manifestPlain = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            let manifest = plainToClass(AddonManifest, manifestPlain);
            manifest.addons.forEach(addon => this._setupAddonDefinition(addon, true));
            manifest.addons = manifest.addons.filter(addon => !addon.excluded);
            return manifest;
        } catch (ex) {
            throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.scriptJSONReadError, ex.message));
        }
    }

    private _loadUserAddonManifest(): AddonManifest {
       
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
            object.beforeUpdateAddons.forEach(addon => {
                if (!addon.excluded && addon.command == this.fullCommandName) {
                    addon.method = ADDON_MODULE_METHODS.onBeforeUpdate;
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
            this.logger.infoNormal(RESOURCES.loadingAddon, 
                this.logger.getResourceString(RESOURCES.userManifest),
                addon.moduleName);
            this._setupAddonDefinition(addon, false); 
        });
        return manifest;
    }

    private _setupAddonDefinition(addon: AddonManifestDefinition, isCore: boolean) {
        addon.isCore = isCore;
        addon.basePath = this.runtime.runInfo.basePath;
        addon.args = addon.args || {};
    }

    private _createAddOnsMap() {
        let globalText = this.logger.getResourceString(RESOURCES.global);
        this.manifests.forEach(manifest => {
            manifest.addons.forEach(addon => {
                try {
                    if (addon.isValid) {
                        let moduleInstance: AddonModuleBase = <AddonModuleBase>new (require(addon.moduleRequirePath).default)(this.runtime);
                        if (!this.addonsMap.has(addon.method)) {
                            this.addonsMap.set(addon.method, []);
                        }
                        moduleInstance.context = <IPluginExecutionContext>{
                            eventName: addon.method.toString(),
                            objectName: addon.objectName,
                            startupMessage: addon.startupMessage,
                            description: addon.description,
                            objectDisplayName: addon.objectName || globalText
                        };
                        this.addonsMap.get(addon.method).push([moduleInstance.onExecute.bind(moduleInstance, moduleInstance.context, addon.args), addon]);
                    }
                } catch (ex) {
                    this.logger.warn(RESOURCES.canNotLoadModule, addon.moduleRequirePath);
                }
            })
        });
    }
}



