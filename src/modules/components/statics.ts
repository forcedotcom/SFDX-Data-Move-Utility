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
    VALUE_MAPPING_CSV_FILENAME: 'ValueMapping.csv',
    USER_AND_GROUP_FILENAME: 'UserAndGroup',

    MAX_CONCURRENT_PARALLEL_REQUESTS: 10,
    MAX_FETCH_SIZE: 100000,

    COMPLEX_FIELDS_QUERY_SEPARATOR: '$',
    COMPLEX_FIELDS_QUERY_PREFIX: '$$',
    COMPLEX_FIELDS_SEPARATOR: ';',
    COMPLEX_FIELDS_CSV_COLUMN_SEPARATOR : '!',

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
    Add,
    Update,
    Merge,
    Upsert,
    Readonly,
    Delete
}



