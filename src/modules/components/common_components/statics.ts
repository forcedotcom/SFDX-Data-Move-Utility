/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IBlobField } from '../../models/api_models';
import { SPECIAL_MOCK_PATTERN_TYPES } from './enumerations';

export const CONSTANTS = {

  DEFAULT_USER_PROMPT_TIMEOUT_MS: 10000,
  DEFAULT_USER_PROMT_TEXT_ENTER_TIMEOUT_MS: 30000,

  DEFAULT_POLLING_INTERVAL_MS: 5000,
  DEFAULT_POLLING_QUERY_TIMEOUT_MS: 4 * 60 * 1000,
  DEFAULT_BULK_API_THRESHOLD_RECORDS: 200,
  DEFAULT_BULK_API_VERSION: '2.0',
  DEFAULT_BULK_API_V1_BATCH_SIZE: 9500,
  DEFAULT_REST_API_BATCH_SIZE: undefined,
  DEFAULT_API_VERSION: '60.0',
  DEFAULT_EXTERNAL_ID_FIELD_NAME: "Name",

  QUERY_PROGRESS_MESSAGE_PER_RECORDS: 2000,
  DOWNLOAD_BLOB_PROGRESS_MESSAGE_PER_RECORDS: 10,


  __ID_FIELD_NAME: "___Id",
  __IS_PROCESSED_FIELD_NAME: "___IsProcessed",

  ERRORS_FIELD_NAME: "Errors",
  //DEFAULT_RECORD_TYPE_ID_EXTERNAL_ID_FIELD_NAME: "DeveloperName;NamespacePrefix;SobjectType",
  OLD_DEFAULT_RECORD_TYPE_ID_FIELD_R_NAME: "RecordType.DeveloperName",
  COMPLEX_FIELDS_QUERY_SEPARATOR: '$',
  COMPLEX_FIELDS_QUERY_PREFIX: '$$',
  COMPLEX_FIELDS_SEPARATOR: ';',
  REFERENCE_FIELD_OBJECT_SEPARATOR: '$',
  FIELDS_MAPPING_REGEX_PATTERN: '^\/(.*)\/$',
  FIELDS_MAPPING_EVAL_PATTERN: '^eval[(](.*)[)]$',
  FIELD_MAPPING_EVAL_PATTERN_ORIGINAL_VALUE: 'RAW_VALUE',

  SCRIPT_FILE_NAME: 'export.json',

  CORE_ADDON_MANIFEST_FILE_NAME: "../../addons/addonsCore.json",
  USER_ADDON_MANIFEST_FILE_NAME: "addons.json",
  CORE_ADDON_MODULES_BASE_PATH: "../../../addons/modules/",
  CORE_ADDON_MODULES_FOLDER_SEPARATOR: ':',
  CORE_ADDON_MODULES_NAME_PREFIX: 'core:',
  CUSTOM_ADDON_MODULES_NAME_PREFIX: 'custom:',
  CORE_ADDON_MODULES_FOLDER_NAME_SEPARATOR: '-',
  ADDON_TEMP_RELATIVE_FOLDER: 'temp_%s/',

  CSV_SOURCE_SUB_DIRECTORY: "source",
  RAW_SOURCE_SUB_DIRECTORY: "objectset_source",
  CSV_TARGET_SUB_DIRECTORY: "target",
  OBJECT_SET_SUBDIRECTORY_PREFIX : '/object-set-',
  BINARY_CACHE_SUB_DIRECTORY: "binary_cache",
  REPORTS_SUB_DIRECTORY: "reports",
  SOURCE_RECORDS_CACHE_SUB_DIRECTORY: "source_records_cache",
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
  BINARY_FILE_CACHE_TEMPLATE: (id: string) => `${id}.blob`,
  BINARY_FILE_CACHE_RECORD_PLACEHOLDER: (id: string) => `[blob[${id}]]`,
  BINARY_FILE_CACHE_RECORD_PLACEHOLDER_ID: (value: any) => /\[blob\[([\w\d]+)\]\]/.exec(value || '')[1],
  BINARY_FILE_CACHE_RECORD_PLACEHOLDER_PREFIX: '[blob[',

  SOURCE_RECORDS_FILE_CACHE_TEMPLATE: (id: string) => `${id}.dat`,

  DEFAULT_ORG_MEDIA_TYPE: "csvfile",

  MAX_PARALLEL_REQUESTS: 10,
  DEFAULT_MAX_PARALLEL_BLOB_DOWNLOADS: 20,
  DEFAULT_MAX_PARALLEL_EXEC_TASKS: 10,

  MAX_FETCH_SIZE: 100000,
  QUERY_BULK_API_THRESHOLD: 30000,
  BULK_API_V2_BLOCK_SIZE: 1000,
  BULK_API_V2_MAX_CSV_SIZE_IN_BYTES: 145000000,
  POLL_TIMEOUT: 3000000,
  SHORT_QUERY_STRING_MAXLENGTH: 250,
  MAX_SOQL_WHERE_CLAUSE_CHARACTER_LENGTH: 3900,
  USER_ADDON_PRIORITY_OFFSET: 1000000,

  MOCK_PATTERN_ENTIRE_ROW_FLAG: '--row',
  SPECIAL_MOCK_COMMANDS: [
    "c_seq_number",
    "c_seq_date",
    "c_set_value"
  ],
  MOCK_ALL_FIELDS_PATTERN: 'all',

  SPECIAL_MOCK_PATTERNS: new Map<SPECIAL_MOCK_PATTERN_TYPES, string>(
    [
      [SPECIAL_MOCK_PATTERN_TYPES.haveAnyValue, "*"],
      [SPECIAL_MOCK_PATTERN_TYPES.missingValue, "^*"]
    ]
  ),

  RECORD_TYPE_SOBJECT_NAME: "RecordType",

  DEFAULT_EXTERNAL_IDS: {
    'EmailMessage': 'Subject',
    'RecordType': 'DeveloperName;NamespacePrefix;SobjectType'
  },

  EXCLUDED_OBJECTS: [
    'Group'
  ],

  NOT_SUPPORTED_OBJECTS: [
    'Profile',
    'User',
    'Group',
    'DandBCompany'
  ],

  SUPPORTED_OBJECTS_FOR_OPERATION: new Map<string, Array<string>>([
    ["FeedItem", new Array<string>(
      "Insert"
    )],
    ["FeedComment", new Array<string>(
      "Insert"
    )]
  ]),

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

  FIELDS_NOT_TO_USE_IN_QUERY_MULTISELECT: {
    '*': ['MasterRecordId'],
    'Opportunity': ['ContactId']
  },

  FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_BUSINESS_ACCOUNT: [
    "FirstName",
    "LastName",
    "IsPersonAccount",
    "Salutation",
    "MiddleName",
    "Suffix"
  ],
  FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_BUSINESS_CONTACT: [
    "IsPersonAccount",
    "Name"
  ],
  FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_PERSON_ACCOUNT: [
    "IsPersonAccount",
    "Name"
  ],

  FIELDS_NOT_CHECK_FOR_POLYMORPHIC_ISSUES: [
    'OwnerId',
    "FeedItemId"
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
    "person_false",
    "type_*"
  ],

  SPECIAL_OBJECT_LOOKUP_MASTER_DETAIL_ORDER: new Map<string, Array<string>>([
    ['Contact', ['Case']],
    ['Account', ['Case']]
  ]),


  SPECIAL_OBJECT_QUERY_ORDER: new Map<string, Array<string>>([
    ['AccountContactRelation', ['Account', 'Contact', 'Case']]
  ]),

  SPECIAL_OBJECT_DELETE_ORDER: new Map<string, Array<string>>([
    ['ProductAttribute', ['ProductAttributeSetProduct']]
  ]),

  SPECIAL_OBJECT_UPDATE_ORDER: new Map<string, Array<string>>([
    ['ProductAttributeSetProduct', ['ProductAttribute']]
  ]),

  OBJECTS_TO_FERIFY_IN_QUERY_TRANSFORM: ['Group'],
  EXTRA_OBJECTS_TO_DESCRIBE: ['Group'],

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

  EXCLUDED_QUERY_FIELDS: new Map<string, Array<string>>([
    ["Attachment", new Array<string>(
      "Body"
    )]
  ]),

  FIELDS_TO_UPDATE_ALWAYS: new Map<string, Array<string>>([
    ["FeedComment", new Array<string>(
      "FeedItemId"
    )]
  ]),

  __R_FIELD_MAPPING: new Map<string, any>([
    ["FeedComment",
      {
        "FeedItem.Id": "FeedItemId",
        "FeedItem.Name": "FeedItemId"
      }
    ]
  ]),

  SIMPLE_REFERENCE_FIELDS: new Map<string, Array<string>>([
    ["FeedComment", new Array<string>(
      "FeedItemId"
    )]
  ]),

  REFERENCED_SOBJECT_TYPE_MAP: new Map<string, any>([
    ["FeedComment",
      {
        "FeedItemId": "FeedItem"
      }
    ]
  ]),

  REFERENCED_FIELDS_MAP:  new Map<string, String>([
    ["OwnerId", "User"],
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


  FELDS_NOT_TO_OUTPUT_TO_TARGET_CSV: new Map<string, Array<string>>([
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



  // ------ AddOns -------------------- //
  DEFAULT_MAX_CHUNK_SIZE: 15728640,
  MAX_CHUNK_SIZE: 38797312,

  DEFAULT_MAX_FILE_SIZE: 38797312,
  MAX_FILE_SIZE: 38797312,



  // ------- Headers ------------------ //
  SFORCE_API_CALL_HEADERS: {
    "Sforce-Call-Options": "client=SFDMU"
  },




}



