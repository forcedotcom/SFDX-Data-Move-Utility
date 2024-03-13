/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DATA_CACHE_TYPES, ISfdmuRunCustomAddonScriptAddonManifestDefinition, ISfdmuRunCustomAddonScriptObject, ISfdmuRunCustomAddonScriptOrg } from ".";



/**
 * Provides an access to the currently running export.json script.
 * @see {@link https://help.sfdmu.com/full-documentation/configuration-and-running/full-exportjson-format | Full export.json format} for the detailed information about the fields.
 *
 * @export
 * @interface ISfdmuRunCustomAddonScript
 */
export default interface ISfdmuRunCustomAddonScript {

    orgs?: ISfdmuRunCustomAddonScriptOrg[];
    objects?: ISfdmuRunCustomAddonScriptObject[];

    pollingIntervalMs?: number;
    pollingQueryTimeoutMs?: number;
    concurrencyMode?: "Serial" | "Parallel";
    bulkThreshold?: number;
    queryBulkApiThreshold?: number;
    bulkApiVersion?: string;
    bulkApiV1BatchSize?: number;
    restApiBatchSize?: number;
    allOrNone?: boolean;
    //promptOnUpdateError: boolean;
    promptOnMissingParentObjects?: boolean;
    promptOnIssuesInCSVFiles?: boolean;
    validateCSVFilesOnly?: boolean;
    apiVersion?: string;
    createTargetCSVFiles?: boolean;
    importCSVFilesAsIs?: boolean;
    alwaysUseRestApiToUpdateRecords?: boolean;
    excludeIdsFromCSVFiles?: boolean;
    //fileLog: boolean;
    keepObjectOrderWhileExecute?: boolean;
    allowFieldTruncation?: boolean;
    simulationMode?: boolean;
    proxyUrl?: string;
    binaryDataCache?: DATA_CACHE_TYPES;
    sourceRecordsCache?: DATA_CACHE_TYPES;
    parallelBinaryDownloads?: number;
    parallelBulkJobs?: number;
    parallelRestJobs?: number;

    beforeAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];
    afterAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];
    dataRetrievedAddons?: ISfdmuRunCustomAddonScriptAddonManifestDefinition[];

}
