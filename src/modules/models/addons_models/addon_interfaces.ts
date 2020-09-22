/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


/**
 * Provides access to the plugin runtime functions
 *
 * @export
 * @interface IPluginRuntime
 */
export interface IPluginRuntime {
    basePath: string
}



/**
 * The implementation of the addon module
 *
 * @export
 * @interface IAddonModule
 */
export interface IAddonModule {

}


export interface IAddonManifest {
    addons: IAddonManifestDefinition[]
}

export interface IAddonManifestDefinition {
    command: string,
    path: string,
    module: string,
    priority: number,
    enabled: boolean
}