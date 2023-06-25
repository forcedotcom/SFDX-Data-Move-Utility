
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

import { AddonManifest, CommandAbortedByAddOnError, CommandInitializationError, Script } from '../../../modules/models';
import { Logger, RESOURCES } from '../../../modules/components/common_components/logger';
import ScriptAddonManifestDefinition from '../../../modules/models/script_models/scriptAddonManifestDefinition';
import { CONSTANTS } from '../../../modules/components/common_components/statics';
import { ADDON_EVENTS } from '../../../modules/components/common_components/enumerations';
import AddonModule from '../common/addonModule';
import SfdmuRunAddonRuntime from './sfdmuRunAddonRuntime';
import IAddonContext from '../common/IAddonContext';
import ISfdmuRunAddonResult from './ISfdmuRunAddonResult';



export default class SfdmuRunAddonManager {

  runtime: SfdmuRunAddonRuntime;

  script: Script;

  get logger(): Logger {
    return this.script.logger;
  }

  get fullCommandName() {
    return this.runtime.runInfo.pinfo.pluginName + ":" + this.runtime.runInfo.pinfo.commandName;
  }

  manifests: AddonManifest[] = new Array<AddonManifest>();
  addonsMap: Map<ADDON_EVENTS, [Function, ScriptAddonManifestDefinition, Function][]> = new Map<ADDON_EVENTS, [Function, ScriptAddonManifestDefinition, Function][]>();
  addons: Map<number, AddonModule[]> = new Map<number, AddonModule[]>();

  constructor(script: Script) {

    // Setup ************************************************
    this.script = script;
    this.runtime = new SfdmuRunAddonRuntime(script);


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

  async triggerAddonModuleInitAsync(): Promise<void> {

    let addons = [...this.addonsMap.values()].reduce((item, acc) => {
      return acc.concat(item);
    }, []);
    for (let index = 0; index < addons.length; index++) {
      const addon = addons[index];
      if (addon[2]) {
        let result: ISfdmuRunAddonResult = await addon[2]();
        if (result && result.cancel) {
          // Stop execution
          throw new CommandAbortedByAddOnError(addon[1].moduleDisplayName);
        }
      }
    }
  }

  async triggerAddonModuleMethodAsync(event: ADDON_EVENTS, objectName: string = ''): Promise<boolean> {

    if (!this.addonsMap.has(event)) {
      return false;
    }

    let addons = this.addonsMap.get(event).filter(addon => {
      return addon[1].appliedToObject(objectName);
    });

    if (addons.length > 0) {

      let globalText = this.logger.getResourceString(RESOURCES.global);
      this.logger.infoNormal(RESOURCES.runAddonMethod, objectName || globalText, event.toString());

      for (let index = 0; index < addons.length; index++) {
        let addon = addons[index];
        let result: ISfdmuRunAddonResult = await addon[0]();
        if (result && result.cancel) {
          // Stop execution
          throw new CommandAbortedByAddOnError(addon[1].moduleDisplayName);
        }
      }

      this.logger.infoNormal(RESOURCES.runAddonMethodCompleted, objectName || globalText, event.toString());
      return true;
    }

    return false;
  }

  triggerAddonModuleMethodSync(event: ADDON_EVENTS, objectName: string): void {
    // tslint:disable-next-line: no-floating-promises
    (async () => await this.triggerAddonModuleMethodAsync(event, objectName))();
  }

  triggerAddonModuleInitSync(): void {
    // tslint:disable-next-line: no-floating-promises
    (async () => await this.triggerAddonModuleInitAsync())();
  }


  // --------- Private members ------------ //
  private _loadCoreAddonManifest(): AddonManifest {
    this.logger.infoNormal(RESOURCES.loadingCoreAddonManifestFile);
    let manifestPath = path.resolve(__dirname, CONSTANTS.CORE_ADDON_MANIFEST_FILE_NAME);
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    try {
      let manifestPlain: string = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      let manifest = plainToClass(AddonManifest, manifestPlain);
      manifest.addons.forEach(addon => this._setupAddonDefinition(addon));
      manifest.addons = manifest.addons.filter(addon => !addon.excluded);
      return manifest;
    } catch (ex: any) {
      throw new CommandInitializationError(this.logger.getResourceString(RESOURCES.exportJsonFileLoadError, ex.message));
    }
  }

  private _loadUserAddonManifest(): AddonManifest {

    // Global before
    let manifest: AddonManifest = new AddonManifest();
    this.script.beforeAddons.forEach(addon => {
      if (!addon.excluded && addon.command == this.fullCommandName) {
        addon.event = ADDON_EVENTS.onBefore;
        manifest.addons.push(addon);
      }
    });

    // Object related
    this.script.objects.forEach(object => {
      // Before
      object.beforeAddons.forEach(addon => {
        if (!addon.excluded && addon.command == this.fullCommandName) {
          addon.event = ADDON_EVENTS.onBefore;
          addon.objectName = object.name;
          manifest.addons.push(addon);
        }
      });
      // After
      object.afterAddons.forEach(addon => {
        if (!addon.excluded && addon.command == this.fullCommandName) {
          addon.event = ADDON_EVENTS.onAfter;
          addon.objectName = object.name;
          manifest.addons.push(addon);
        }
      });

      // BeforeUpdate
      object.filterRecordsAddons.forEach(addon => {
        if (!addon.excluded && addon.command == this.fullCommandName) {
          addon.event = ADDON_EVENTS.onTargetDataFiltering;
          addon.objectName = object.name;
          manifest.addons.push(addon);
        }
      });
      // BeforeUpdate
      object.beforeUpdateAddons.forEach(addon => {
        if (!addon.excluded && addon.command == this.fullCommandName) {
          addon.event = ADDON_EVENTS.onBeforeUpdate;
          addon.objectName = object.name;
          manifest.addons.push(addon);
        }
      });
      // After Update
      object.afterUpdateAddons.forEach(addon => {
        if (!addon.excluded && addon.command == this.fullCommandName) {
          addon.event = ADDON_EVENTS.onAfterUpdate;
          addon.objectName = object.name;
          manifest.addons.push(addon);
        }
      });
    });

    // Global DataRetrieved
    this.script.dataRetrievedAddons.forEach(addon => {
      if (!addon.excluded && addon.command == this.fullCommandName) {
        addon.event = ADDON_EVENTS.onDataRetrieved;
        manifest.addons.push(addon);
      }
    });

    // Global After
    this.script.afterAddons.forEach(addon => {
      if (!addon.excluded && addon.command == this.fullCommandName) {
        addon.event = ADDON_EVENTS.onAfter;
        manifest.addons.push(addon);
      }
    });


    // Setup -------------------
    manifest.addons.forEach(addon => {
      this.logger.infoNormal(RESOURCES.loadingAddonModule,
        addon.moduleDisplayName);
      this._setupAddonDefinition(addon);
    });
    return manifest;
  }

  private _setupAddonDefinition(addon: ScriptAddonManifestDefinition) {
    addon.basePath = this.runtime.runInfo.basePath;
    addon.args = addon.args || {};
  }

  private _createAddOnsMap() {
    let globalText = this.logger.getResourceString(RESOURCES.global);
    this.manifests.forEach(manifest => {
      manifest.addons.forEach(addon => {
        try {
          if (addon.isValid) {
            let moduleInstance: AddonModule = <AddonModule>new (require(addon.moduleRequirePath).default)(this.runtime);
            if (!this.addonsMap.has(addon.event)) {
              this.addonsMap.set(addon.event, []);
            }
            moduleInstance.context = <IAddonContext>{
              eventName: addon.event.toString(),
              objectName: addon.objectName,
              description: addon.description,
              objectDisplayName: addon.objectName || globalText,
              moduleDisplayName: addon.moduleDisplayName,
              isCore: addon.isCore
            };
            this.addonsMap.get(addon.event).push([
              moduleInstance.onExecute.bind(moduleInstance, moduleInstance.context, addon.args),
              addon,
              moduleInstance.onInit ? moduleInstance.onInit.bind(moduleInstance, moduleInstance.context, addon.args) : () => void 0,
            ]);
          }
        } catch (ex) {
          this.logger.warn(RESOURCES.cantLoadModule, addon.moduleRequirePath);
        }
      })
    });
  }
}



