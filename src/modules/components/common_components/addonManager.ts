
import { CommandInitializationError } from "../../models";
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IAddonManifest, IAddonModule, IPluginRuntime } from "../../models/addons_models/addon_interfaces";
import { Logger, RESOURCES } from "./logger";
import * as path from 'path';
import * as fs from 'fs';
import { CONSTANTS } from "./statics";




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

    constructor(runtime: IPluginRuntime, logger: Logger) {

        // Setup
        this.runtime = runtime;
        this.logger = logger;

        // Load manifests
        this.manifests = [
            // Core
            this._loadManifestJsonFile(CONSTANTS.CORE_ADDON_MANIFEST_FILE_NAME, true),
            // Users
            this._loadManifestJsonFile(path.join(runtime.basePath, CONSTANTS.USER_ADDON_MANIFEST_FILE_NAME))
        ].filter(manifest => !!manifest);

        // Load modules from the manifests
        

    }



    // --------- Private members ------------ //
    private _loadManifestJsonFile(manifestPath: string, isCore: boolean = false): IAddonManifest {

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

}



