/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import IBlobField from "../../../addons/package/base/IBlobField";





export const CONSTANTS = {

    DEFAULT_USER_PROMPT_TIMEOUT_MS: 6000,
    DEFAULT_POLLING_INTERVAL_MS: 5000,
    DEFAULT_BULK_API_THRESHOLD_RECORDS: 200,
    DEFAULT_BULK_API_VERSION: '2.0',
    DEFAULT_BULK_API_V1_BATCH_SIZE: 9500,
    DEFAULT_API_VERSION: '49.0',
    DEFAULT_EXTERNAL_ID_FIELD_NAME: "Name",

    __ID_FIELD_NAME: "___Id",
    __IS_PROCESSED_FIELD_NAME: "___IsProcessed",

    ERRORS_FIELD_NAME: "Errors",
    DEFAULT_RECORD_TYPE_ID_EXTERNAL_ID_FIELD_NAME: "DeveloperName;NamespacePrefix;SobjectType",
    OLD_DEFAULT_RECORD_TYPE_ID_FIELD_R_NAME: "RecordType.DeveloperName",
    COMPLEX_FIELDS_QUERY_SEPARATOR: '$',
    COMPLEX_FIELDS_QUERY_PREFIX: '$$',
    COMPLEX_FIELDS_SEPARATOR: ';',
    REFERENCE_FIELD_OBJECT_SEPARATOR: '$',
    FIELDS_MAPPING_REGEX_PATTERN: '^\/(.*)\/$',

    SCRIPT_FILE_NAME: 'export.json',

    CORE_ADDON_MANIFEST_FILE_NAME: "../../addons/addonsCore.json",
    USER_ADDON_MANIFEST_FILE_NAME: "addons.json",
    CORE_ADDON_MODULES_BASE_PATH: "../../../addons/modules/",
    CORE_ADDON_MODULES_FOLDER_SEPARATOR: ':',
    CORE_ADDON_MODULES_NAME_PREFIX: 'core:',
    CORE_ADDON_MODULES_FOLDER_NAME_SEPARATOR: '-',
    ADDON_TEMP_RELATIVE_FOLDER: 'temp_%s/',

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
    FIELD_MAPPING_FILENAME: "FieldMapping.csv",
    CSV_FILES_SOURCENAME: "csvfile",

    DEFAULT_ORG_MEDIA_TYPE: "csvfile",
   
    MAX_CONCURRENT_PARALLEL_REQUESTS: 10,
    MAX_PARALLEL_DOWNLOAD_THREADS: 5,
    MAX_FETCH_SIZE: 100000,
    QUERY_BULK_API_THRESHOLD: 30000,
    BULK_API_V2_BLOCK_SIZE: 1000,
    BULK_API_V2_MAX_CSV_SIZE_IN_BYTES: 145000000,
    POLL_TIMEOUT: 3000000,
    BULK_QUERY_API_POLL_TIMEOUT: 4 * 60 * 1000,
    SHORT_QUERY_STRING_MAXLENGTH: 250,
    MAX_SOQL_WHERE_CLAUSE_CHARACTER_LENGTH: 3900,
    USER_ADDON_PRIORITY_OFFSET: 1000000,

    MOCK_PATTERN_ENTIRE_ROW_FLAG: '--row',
    SPECIAL_MOCK_COMMANDS: [
        "c_seq_number",
        "c_seq_date"
    ],

    RECORD_TYPE_SOBJECT_NAME: "RecordType",
    NOT_SUPPORTED_OBJECTS: [
        'Profile',
        'User',
        'Group',
        'DandBCompany',
        'ContentVersion'// Content version has deprecated using the SFDMU core in favor to the ExportFiles Add-On Module 
    ],
    NOT_SUPPORTED_OBJECTS_IN_BULK_API: [
        "Attachment",
        "ContentVersion"
    ],
    SPECIAL_OBJECTS: [
        "Group",
        "User",
        "RecordType"
    ],
    OBJECTS_NOT_TO_USE_IN_FILTERED_QUERYIN_CLAUSE: [
        'RecordType',
        'User',
        'Group',
        'DandBCompany'
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
        "standard_true",
        "standard_false",
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
        },
        {
            objectName: "ContentVersion",
            fieldName: "VersionData",
            dataType: "base64"
        }
    ),

    TEXTUAL_FIELD_TYPES: ['string', 'id',
        'url', 'textarea',
        'picklist',
        'reference',
        'encryptedstring',
        'phone',
        'multipicklist'],

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
        )],
        ["ContentVersion", new Array<string>(
            "VersionData",
            "Title",
            "Description",
            "PathOnClient",
            "ContentUrl",
            "FirstPublishLocationId"
        )]
    ]),

    MANDATORY_QUERY_FIELDS_FOR_UPDATE: new Map<string, Array<string>>([
        ["Attachment", new Array<string>(
            "BodyLength",
            "Name"
        )],
        ["ContentVersion", new Array<string>(
            "Title",
            "Description"
        )]
    ]),

    // Some fields like Attachment.Body can't be compared to detect similar records.
    // Fields below are the comparable fields for the specific objects.
    FIELDS_TO_COMPARE_SOURCE_WITH_TARGET_RECORDS: new Map<string, Array<string>>([
        ["Attachment", new Array<string>(
            "BodyLength",
            "Name"
        )],
        ["ContentVersion", new Array<string>(
            "Title",
            "Description"
        )]
    ]),

    // Some fields like Attachment.Body are not necessary to be fetched from the Target,
    // since they are not of comparable type and are overloading the API.
    // We need to exclude such fields from querying the Target.
    FIELDS_EXCLUDED_FROM_TARGET_QUERY: new Map<string, Array<string>>([
        ["Attachment", new Array<string>(
            "Body"
        )],
        ["ContentVersion", new Array<string>(
            "VersionData"
        )]
    ]),

    COMPOUND_FIELDS: new Map<string, Array<string>>([
        ["BillingAddress", new Array<string>(
            "BillingGeocodeAccuracy",
            "BillingCity",
            "BillingCountry",
            "BillingLatitude",
            "BillingLongitude",
            "BillingPostalCode",
            "BillingState",
            "BillingStreet"
        )],
        ["ShippingAddress", new Array<string>(
            "ShippingGeocodeAccuracy",
            "ShippingCity",
            "ShippingCountry",
            "ShippingLatitude",
            "ShippingLongitude",
            "ShippingPostalCode",
            "ShippingState",
            "ShippingStreet"
        )],
        ["MailingAddress", new Array<string>(
            "MailingGeocodeAccuracy",
            "MailingCity",
            "MailingCountry",
            "MailingLatitude",
            "MailingLongitude",
            "MailingPostalCode",
            "MailingState",
            "MailingStreet"
        )]
    ]),

}



