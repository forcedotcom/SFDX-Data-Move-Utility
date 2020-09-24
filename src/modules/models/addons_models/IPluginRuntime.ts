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

    // Returns the path from where the export.json is running
    basePath: string,

    // Returns the jsforce.Connection object 
    //  for the source/target org to perform api operations
    getConnection(isSource: boolean): any,

    // Returns the info about the 
    // connected orgs
    getOrgInfo(isSource: boolean): {
        instanceUrl: string,
        accessToken: string,
        apiVersion: string,
        isFile: boolean,
    };
}
