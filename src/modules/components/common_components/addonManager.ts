
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IAddonManifest, IAddonManifestDefinition, IAddonModule, IPluginRuntime } from "../../models/addons_models/addon_interfaces";
import { Logger, RESOURCES } from "./logger";
import * as path from 'path';
import * as fs from 'fs';
import { CONSTANTS } from "./statics";
import { CommandInitializationError } from "../../models";



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
    addons: IAddonModule[] = new Array<IAddonModule>();

    /**
     * Map : Function name => List of functions ordered by the addon priority
     *
     * @type {Map<string, Function[]>}
     * @memberof AddonManager
     */
    moduleMethodsMap: Map<string, Function[]> = new Map<string, Function[]>();

    constructor(runtime: IPluginRuntime, logger: Logger) {

        // Setup
        this.runtime = runtime;
        this.logger = logger;

        // Load manifests
        this.manifests = [
            // Core manifest...
            this._loadAddonManifest(CONSTANTS.CORE_ADDON_MANIFEST_FILE_NAME, true),
            // Custom manifest...
            this._loadAddonManifest(path.join(runtime.basePath, CONSTANTS.USER_ADDON_MANIFEST_FILE_NAME))
        ].filter(manifest => !!manifest);

        // Load modules from the manifests
        this.manifests.forEach(manifest => {
            manifest.addons.forEach(addon => {
                this.addons.push(this._loadAddonModule(addon));
            });
        });
        this.addons = this.addons.filter(addon => addon);


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
            return <IAddonManifest>JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch (ex) {
            throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.scriptJSONReadError, ex.message));
        }
    }

    private _loadAddonModule(manifestDefinition: IAddonManifestDefinition): IAddonModule {
        
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

            return <IAddonModule>require(moduleId);

        } catch (ex) { }

        return null;
    }

    private _createModuleMethodsMap(){

    }



}



