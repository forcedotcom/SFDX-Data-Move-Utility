/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export enum DATA_MEDIA_TYPE {
    Org,
    File
}

export enum OPERATION {
    Insert,
    Update,
    Upsert,
    Readonly,
    Delete,
    DeleteSource,
    DeleteHierarchy,
    Unknown,
    HardDelete
}

export enum API_ENGINE {
    DEFAULT_ENGINE,
    REST_API,
    BULK_API_V1,
    BULK_API_V2
}

export enum RESULT_STATUSES {
    Undefined = "Undefined",
    ApiOperationStarted = "ApiOperationStarted",
    ApiOperationFinished = "ApiOperationFinished",
    Information = "Information",
    JobCreated = "JobCreated",
    BatchCreated = "BatchCreated",
    DataUploaded = "DataUploaded",
    InProgress = "InProgress",
    Completed = "Completed",
    FailedOrAborted = "FailedOrAborted",
    ProcessError = "ProcessError"
}

export enum MESSAGE_IMPORTANCE {
    Silent,
    Low,
    Normal,
    High,
    Warn,
    Error
}

export enum ADDON_EVENTS {
    none = 'none',
    onBefore = "onBefore",
    onAfter = "onAfter",
    onBeforeUpdate = "onBeforeUpdate",
    onAfterUpdate = "onAfterUpdate",
    onDataRetrieved = "onDataRetrieved",

    onTargetDataFiltering = "onTargetDataFiltering"
}

export enum SPECIAL_MOCK_PATTERN_TYPES {
    haveAnyValue,
    missingValue
}

export enum DATA_CACHE_TYPES {
    InMemory = "InMemory",
    CleanFileCache = "CleanFileCache",
    FileCache = "FileCache"
}
