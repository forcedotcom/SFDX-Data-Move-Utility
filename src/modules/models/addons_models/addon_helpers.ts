/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


export interface IAddonManifest {
    addons: IAddonManifestDefinition[]
}

export interface IAddonManifestDefinition {
    command: string,
    path: string,
    module: string,
    priority: number,
    enabled: boolean,
    isCore: boolean
}

export const IPLUGIN_RUNTIME_SHARED_MEMBERS = {
    basePath: true
}


export enum ADDON_MODULE_METHODS {
    onScriptSetup = "onScriptSetup"
}
