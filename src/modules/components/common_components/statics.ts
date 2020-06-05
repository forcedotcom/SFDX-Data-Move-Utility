/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IBlobField } from "../../models/common_models/helper_interfaces";


export const CONSTANTS = {

    DEFAULT_USER_PROMPT_TIMEOUT_MS: 6000,
    DEFAULT_POLLING_INTERVAL_MS: 5000,
    DEFAULT_BULK_API_THRESHOLD_RECORDS: 200,
    DEFAULT_BULK_API_VERSION: '2.0',
    DEFAULT_BULK_API_V1_BATCH_SIZE: 9500,
    DEFAULT_API_VERSION: '47.0',
    DEFAULT_EXTERNAL_ID_FIELD_NAME: "Name",

    __ID_FIELD_NAME: "___Id",
    __IS_PROCESSED_FIELD_NAME: "___IsProcessed",
    DEFAULT_RECORD_TYPE_ID_EXTERNAL_ID_FIELD_NAME: "DeveloperName",
    COMPLEX_FIELDS_QUERY_SEPARATOR: '$',
    COMPLEX_FIELDS_QUERY_PREFIX: '$$',
    COMPLEX_FIELDS_SEPARATOR: ';',
    REFERENCE_FIELD_OBJECT_SEPARATOR: '$',

    SCRIPT_FILE_NAME: 'export.json',
    CSV_SOURCE_SUB_DIRECTORY: "source",
    CSV_TARGET_SUB_DIRECTORY: "target",
    CSV_SOURCE_FILE_SUFFIX: "_source",
    CSV_TARGET_FILE_SUFFIX: "_target",
    CSV_TARGET_FILE_PERSON_ACCOUNTS_SUFFIX: "_person",
    FILE_LOG_SUBDIRECTORY: "logs",
    FILE_LOG_FILEEXTENSION: "log",
    VALUE_MAPPING_CSV_FILENAME: 'ValueMapping.csv',
    USER_AND_GROUP_FILENAME: 'UserAndGroup',
    CSV_ISSUES_ERRORS_FILENAME: 'CSVIssuesReport.csv',
    MISSING_PARENT_LOOKUP_RECORDS_ERRORS_FILENAME: "MissingParentRecordsReport.csv",

    MAX_CONCURRENT_PARALLEL_REQUESTS: 10,
    MAX_PARALLEL_DOWNLOAD_THREADS: 5,
    MAX_FETCH_SIZE: 100000,
    QUERY_BULK_API_THRESHOLD: 30000,
    BULK_API_V2_BLOCK_SIZE: 1000,
    BULK_API_V2_MAX_CSV_SIZE_IN_BYTES: 145000000,
    POLL_TIMEOUT: 3000000,
    SHORT_QUERY_STRING_MAXLENGTH: 250,
    MAX_SOQL_WHERE_CLAUSE_CHARACTER_LENGTH: 3900,

    MOCK_PATTERN_ENTIRE_ROW_FLAG: '--row',
    SPECIAL_MOCK_COMMANDS: [
        "c_seq_number",
        "c_seq_date"
    ],

    RECORD_TYPE_SOBJECT_NAME: "RecordType",
    NOT_SUPPORTED_OBJECTS: [
        'Profile',
        'RecordType',
        'User',
        'Group',
        'DandBCompany'
    ],
    SPECIAL_OBJECTS: [
        "Group",
        "User",
        "RecordType"
    ],
    OBJECTS_NOT_TO_USE_IN_FILTERED_QUERYIN_CLAUSE: [
        "RecordType"
    ],
    OBJECTS_NOT_TO_USE_IN_QUERY_MULTISELECT: [
        'RecordType',
        'User',
        'Group',
        'DandBCompany'
    ],

    FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_BUSINESS_ACCOUNT: [
        "FirstName",
        "LastName",
        "IsPersonAccount",
        "Salutation"
    ],
    FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_BUSINESS_CONTACT: [
        "IsPersonAccount",
        "Name"
    ],
    FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_PERSON_ACCOUNT: [
        "IsPersonAccount",
        "Name"
    ],

    MULTISELECT_SOQL_KEYWORDS: [
        "readonly_true",
        "readonly_false",
        "custom_true",
        "custom_false",
        "updateable_true",
        "updateable_false",
        "createable_true",
        "createable_false",
        "lookup_true",
        "lookup_false",
        "person_true",
        "person_false"
    ],

    BLOB_FIELDS: new Array<IBlobField>(
        {
            objectName: "Attachment",
            fieldName: "Body",
            dataType: "base64"
        }
    ),

    MANDATORY_QUERY_FIELDS_FOR_INSERT: new Map<string, Array<string>>([
        ["Attachment", new Array<string>(
            "Body",
            "ParentId",
            "Name"
        )],
        ["Note", new Array<string>(
            "Body",
            "ParentId",
            "Title"
        )]
    ]),

    MANDATORY_QUERY_FIELDS_FOR_UPDATE: new Map<string, Array<string>>([
        ["Attachment", new Array<string>(
            "BodyLength",
            "Name"
        )]
    ]),

    // Some fields like Attachment.Body can't be compared to detect similar records.
    // Fields below are the comparable fields for the specific objects.
    FIELDS_TO_COMPARE_SOURCE_WITH_TARGET_RECORDS: new Map<string, Array<string>>([
        ["Attachment", new Array<string>(
            "BodyLength",
            "Name"
        )]
    ]),

    // Some fields like Attachment.Body are not necessary to be fetched from the Target,
    // since they are not of comparable type and are overloading the API.
    // We need to exclude such fields from querying the Target.
    FIELDS_EXCLUDED_FROM_TARGET_QUERY: new Map<string, Array<string>>([
        ["Attachment", new Array<string>(
            "Body"
        )]
    ])

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
