/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



export const CONSTANTS = {
    DEFAULT_USER_PROMPT_TIMEOUT_MS: 6000,
    DEFAULT_POLLING_INTERVAL_MS: 5000,
    DEFAULT_BULK_API_THRESHOLD_RECORDS: 200,
    DEFAULT_BULK_API_VERSION: '2.0',
    DEFAULT_BULK_API_V1_BATCH_SIZE: 9500,
    DEFAULT_API_VERSION: '47.0',
    DEFAULT_EXTERNAL_ID_FIELD_NAME: "Name",

    SCRIPT_FILE_NAME: 'export.json',
    CSV_SOURCE_SUBDIRECTORY: "source",
    CSV_TARGET_SUBDIRECTORY: "target",
    FILE_LOG_SUBDIRECTORY: "logs",
    FILE_LOG_FILEEXTENSION: "log",
    VALUE_MAPPING_CSV_FILENAME: 'ValueMapping.csv',
    USER_AND_GROUP_FILENAME: 'UserAndGroup',
    CSV_ISSUES_ERRORS_FILENAME: 'CSVIssuesReport.csv',
    

    MAX_CONCURRENT_PARALLEL_REQUESTS: 10,
    MAX_FETCH_SIZE: 100000,
    QUERY_BULK_API_THRESHOLD: 30000,
    BULK_API_V2_BLOCK_SIZE: 1000,
    BULK_API_V2_MAX_CSV_SIZE_IN_BYTES: 145000000,

    COMPLEX_FIELDS_QUERY_SEPARATOR: '$',
    COMPLEX_FIELDS_QUERY_PREFIX: '$$',
    COMPLEX_FIELDS_SEPARATOR: ';',

    NOT_SUPPORTED_OBJECTS: [
        'Profile',
        'RecordType',
        'User',
        'Group'
    ],
    SPECIAL_OBJECTS: [
        "Group",
        "User",
        "RecordType"
    ]
}

export enum DATA_MEDIA_TYPE {
    Org,
    File
}

export enum OPERATION {
    Insert,
    Update,
    Upsert,
    Readonly,
    Delete
}

export enum RESULT_STATUSES {
    Undefined = "Undefined",
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
    High,
    Warn,
    Error
}






