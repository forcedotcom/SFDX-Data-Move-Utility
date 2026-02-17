/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SPECIAL_MOCK_PATTERN_TYPES } from '../common/Enumerations.js';

/**
 * Shared constants for the SFDMU plugin.
 */
export const PLUGIN_NAME = 'sfdmu';
export const RUN_COMMAND_NAME = 'run';

export const RUN_MESSAGE_BUNDLE = 'sfdmu.run';
export const RUN_CORE_ADDON_MESSAGE_BUNDLE = 'sfdmu-run-core-addon';
export const LOGGING_MESSAGE_BUNDLE = 'logging';
export const LOG_LEVELS = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  FATAL: 5,
} as const;
export const LOG_LEVEL_NAMES = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const;
export const RUN_STATUS_READY = 'READY';
export const COMMAND_EXIT_STATUSES = {
  SUCCESS: 0,
  COMMAND_UNEXPECTED_ERROR: 1,
  COMMAND_INITIALIZATION_ERROR: 2,
  ORG_METADATA_ERROR: 3,
  COMMAND_EXECUTION_ERROR: 4,
  COMMAND_ABORTED_BY_USER: 5,
  UNRESOLVABLE_WARNING: 6,
  COMMAND_ABORTED_BY_ADDON: 7,
} as const;
export const FILE_LOG_DEFAULT = 0;
export const JOB_PIPELINE_STAGES = ['load', 'setup', 'processCsv', 'prepare', 'addons', 'execute'] as const;
export const CSV_FILE_ORG_NAME = 'csvfile';
export const ORG_TEST_SOURCE_ENV = 'SFDMU_TEST_SOURCE_ORG';
export const ORG_TEST_TARGET_ENV = 'SFDMU_TEST_TARGET_ORG';
export const ORG_INFO_QUERY = 'SELECT Id, Name, InstanceName, OrganizationType, IsSandbox FROM Organization';

export const DEFAULT_USER_PROMPT_TIMEOUT_MS = 10_000;
export const DEFAULT_USER_PROMPT_TEXT_ENTER_TIMEOUT_MS = 30_000;
export const DEFAULT_POLLING_INTERVAL_MS = 5000;
export const DEFAULT_POLLING_QUERY_TIMEOUT_MS = 4 * 60 * 1000;
export const DEFAULT_BULK_API_THRESHOLD_RECORDS = 200;
export const DEFAULT_BULK_API_VERSION = '2.0';
export const DEFAULT_BULK_API_V1_BATCH_SIZE = 9500;
export const DEFAULT_REST_API_BATCH_SIZE: number | undefined = undefined;
export const REST_API_JOB_ID = 'REST';
export const DEFAULT_API_VERSION = '65.0';
export const DEFAULT_EXTERNAL_ID_FIELD_NAME = 'Name';
export const USER_OBJECT_NAME = 'User';
export const GROUP_OBJECT_NAME = 'Group';
export const DEFAULT_GROUP_WHERE_CLAUSE = "Type = 'Queue'";
export const POLYMORPHIC_FIELD_DEFINITION_QUERY_TEMPLATE =
  "SELECT QualifiedApiName FROM FieldDefinition WHERE EntityDefinitionId = '%s' AND IsPolymorphicForeignKey = true";
export const QUERY_PROGRESS_MESSAGE_PER_RECORDS = 2000;
export const DOWNLOAD_BLOB_PROGRESS_MESSAGE_PER_RECORDS = 10;
export const __ID_FIELD_NAME = '___Id';
export const __SOURCE_ID_FIELD_NAME = '___SourceId';
export const __IS_PROCESSED_FIELD_NAME = '___IsProcessed';
export const ERRORS_FIELD_NAME = 'Errors';
export const OLD_DEFAULT_RECORD_TYPE_ID_FIELD_R_NAME = 'RecordType.DeveloperName';
export const COMPLEX_FIELDS_QUERY_SEPARATOR = '$';
export const COMPLEX_FIELDS_QUERY_PREFIX = '$$';
export const COMPLEX_FIELDS_SEPARATOR = ';';
export const REFERENCE_FIELD_OBJECT_SEPARATOR = '$';
export const FIELDS_MAPPING_REGEX_PATTERN = '^/(.*)/$';
export const FIELDS_MAPPING_EVAL_PATTERN = '^eval[(](.*)[)]$';
export const FIELD_MAPPING_EVAL_PATTERN_ORIGINAL_VALUE = 'RAW_VALUE';
export const MOCK_EXPRESSION_ORIGINAL_VALUE = 'RAW_VALUE';
export const SCRIPT_FILE_NAME = 'export.json';
export const CORE_ADDON_MANIFEST_FILE_NAME = '../../addons/addonsCore.json';
export const USER_ADDON_MANIFEST_FILE_NAME = 'addons.json';
export const CORE_ADDON_MODULES_BASE_PATH = './modules/';
export const CORE_ADDON_MODULES_FOLDER_SEPARATOR = ':';
export const CORE_ADDON_MODULES_NAME_PREFIX = 'core:';
export const CUSTOM_ADDON_MODULES_NAME_PREFIX = 'custom:';
export const CORE_ADDON_MODULES_FOLDER_NAME_SEPARATOR = '-';
export const CORE_ADDON_ENTRY_FILE_NAME = 'index.js';
export const ADDON_TEMP_RELATIVE_FOLDER = 'temp_%s/';
export const ADDON_RESOURCES_FOLDER_NAME = 'resources';
export const ADDON_MESSAGES_FILE_NAME = 'messages.md';
export const CSV_SOURCE_SUB_DIRECTORY = 'source';
export const RAW_SOURCE_SUB_DIRECTORY = 'objectset_source';
export const CSV_TARGET_SUB_DIRECTORY = 'target';
export const OBJECT_SET_SUBDIRECTORY_PREFIX = '/object-set-';
export const BINARY_CACHE_SUB_DIRECTORY = 'binary_cache';
export const REPORTS_SUB_DIRECTORY = 'reports';
export const SOURCE_RECORDS_CACHE_SUB_DIRECTORY = 'source_records_cache';
export const CSV_SOURCE_FILE_SUFFIX = '_source';
export const CSV_TARGET_FILE_SUFFIX = '_target';
export const CSV_TARGET_FILE_PERSON_ACCOUNTS_SUFFIX = '_person';
export const FILE_LOG_SUBDIRECTORY = 'logs';
export const FILE_LOG_FILEEXTENSION = 'log';
export const LOG_FILE_NO_ANONYMIZE_MARKER = '@@NO_ANON@@';
export const VALUE_MAPPING_CSV_FILENAME = 'ValueMapping.csv';
export const USER_AND_GROUP_FILENAME = 'UserAndGroup';
export const USER_AND_GROUP_COMMON_FIELDS = ['Id', 'Name', 'CreatedDate', 'LastModifiedDate', 'SystemModstamp'];
export const CSV_ISSUES_ERRORS_FILENAME = 'CSVIssuesReport.csv';
export const CSV_ISSUE_REPORT_COLUMNS: readonly string[] = [
  'Date update',
  'sObject name',
  'Field name',
  'Field value',
  'Parent SObject name',
  'Parent field name',
  'Parent field value',
  'Error',
];
export const MISSING_PARENT_LOOKUP_RECORDS_ERRORS_FILENAME = 'MissingParentRecordsReport.csv';
export const FIELD_MAPPING_FILENAME = 'FieldMapping.csv';
export const CSV_FILES_SOURCENAME = CSV_FILE_ORG_NAME;
export const BINARY_FILE_CACHE_TEMPLATE = (id: string): string => `${id}.blob`;
export const BINARY_FILE_CACHE_RECORD_PLACEHOLDER = (id: string): string => `[blob[${id}]]`;
export const BINARY_FILE_CACHE_RECORD_PLACEHOLDER_ID = (value: string): string =>
  (/\[blob\[([\w\d]+)\]\]/.exec(value || '') ?? [])[1] ?? '';
export const BINARY_FILE_CACHE_RECORD_PLACEHOLDER_PREFIX = '[blob[';
export const SOURCE_RECORDS_FILE_CACHE_TEMPLATE = (id: string): string => `${id}.dat`;
export const DEFAULT_ORG_MEDIA_TYPE = CSV_FILE_ORG_NAME;
export const MAX_PARALLEL_REQUESTS = 10;
export const DEFAULT_MAX_PARALLEL_BLOB_DOWNLOADS = 20;
export const DEFAULT_MAX_PARALLEL_EXEC_TASKS = 10;
export const MAX_FETCH_SIZE = 100_000;
export const QUERY_BULK_API_THRESHOLD = 30_000;
export const BULK_API_V2_BLOCK_SIZE = 1000;
export const BULK_API_V2_MAX_CSV_SIZE_IN_BYTES = 145_000_000;
export const POLL_TIMEOUT = 3_000_000;
export const LOG_QUERY_SELECT_MAXLENGTH = 250;
export const LOG_QUERY_WHERE_MAXLENGTH = 250;
export const MAX_SOQL_WHERE_CLAUSE_CHARACTER_LENGTH = 3900;
export const USER_ADDON_PRIORITY_OFFSET = 1_000_000;
export const MOCK_PATTERN_ENTIRE_ROW_FLAG = '--row';
export const SPECIAL_MOCK_COMMANDS = ['c_seq_number', 'c_seq_date', 'c_set_value'];
export const MOCK_ALL_FIELDS_PATTERN = 'all';
export const SPECIAL_MOCK_PATTERNS = new Map<SPECIAL_MOCK_PATTERN_TYPES, string>([
  [SPECIAL_MOCK_PATTERN_TYPES.haveAnyValue, '*'],
  [SPECIAL_MOCK_PATTERN_TYPES.missingValue, '^*'],
]);
export const RECORD_TYPE_SOBJECT_NAME = 'RecordType';
export const DEFAULT_EXTERNAL_IDS: Record<string, string> = {
  EmailMessage: 'Subject',
  RecordType: 'DeveloperName;NamespacePrefix;SobjectType',
};
export const EXCLUDED_OBJECTS = ['Group'];
export const NOT_SUPPORTED_OBJECTS = [
  'Profile',
  'User',
  'Group',
  'DandBCompany',
  'ContentVersion',
  'ContentDocument',
  'ContentDocumentLink',
  'Attachment',
  'Note',
];
export const SUPPORTED_OBJECTS_FOR_OPERATION = new Map<string, string[]>([
  ['FeedItem', ['Insert']],
  ['FeedComment', ['Insert']],
]);
export const NOT_SUPPORTED_OBJECTS_IN_BULK_API = ['Attachment', 'ContentVersion'];
export const SPECIAL_OBJECTS = ['Group', 'User', 'RecordType'];
export const OBJECTS_NOT_TO_USE_IN_FILTERED_QUERYIN_CLAUSE = ['RecordType', 'User', 'Group', 'DandBCompany'];
export const OBJECTS_NOT_TO_USE_IN_QUERY_MULTISELECT = ['RecordType', 'User', 'Group', 'DandBCompany'];
export const FIELDS_NOT_TO_USE_IN_QUERY_MULTISELECT: Record<string, string[]> = {
  '*': ['MasterRecordId'],
  Product2: ['ExternalDataSourceId'],
  Opportunity: ['ContactId'],
};
export const FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_BUSINESS_ACCOUNT = [
  'FirstName',
  'LastName',
  'IsPersonAccount',
  'Salutation',
  'MiddleName',
  'Suffix',
];
export const FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_BUSINESS_CONTACT = ['IsPersonAccount', 'Name'];
export const FIELDS_TO_EXCLUDE_FROM_UPDATE_FOR_PERSON_ACCOUNT = ['IsPersonAccount', 'Name'];
export const FIELDS_NOT_CHECK_FOR_POLYMORPHIC_ISSUES = ['OwnerId', 'FeedItemId'];
export const MULTISELECT_SOQL_KEYWORDS = [
  'readonly_true',
  'readonly_false',
  'custom_true',
  'custom_false',
  'standard_true',
  'standard_false',
  'updateable_true',
  'updateable_false',
  'createable_true',
  'createable_false',
  'lookup_true',
  'lookup_false',
  'person_true',
  'person_false',
  'type_*',
];
export const SPECIAL_OBJECT_LOOKUP_MASTER_DETAIL_ORDER = new Map<string, string[]>([
  ['Contact', ['Case']],
  ['Account', ['Case']],
]);
export const SPECIAL_OBJECT_QUERY_ORDER = new Map<string, string[]>([
  ['AccountContactRelation', ['Account', 'Contact', 'Case']],
]);
export const SPECIAL_OBJECT_DELETE_ORDER = new Map<string, string[]>([
  ['ProductAttribute', ['ProductAttributeSetProduct']],
]);
export const SPECIAL_OBJECT_UPDATE_ORDER = new Map<string, string[]>([
  ['ProductAttributeSetProduct', ['ProductAttribute']],
]);
export const OBJECTS_TO_FERIFY_IN_QUERY_TRANSFORM = ['Group'];
export const EXTRA_OBJECTS_TO_DESCRIBE = ['Group'];
export const POLYMORPHIC_FIELD_PARSER_PLACEHOLDER = '__DOLLAR__';
export const TEXTUAL_FIELD_TYPES = [
  'string',
  'id',
  'url',
  'textarea',
  'picklist',
  'reference',
  'encryptedstring',
  'phone',
  'multipicklist',
];
export const EXCLUDED_QUERY_FIELDS = new Map<string, string[]>([]);
export const FIELDS_TO_UPDATE_ALWAYS = new Map<string, string[]>([['FeedComment', ['FeedItemId']]]);
export const __R_FIELD_MAPPING = new Map<string, Record<string, string>>([
  [
    'FeedComment',
    {
      'FeedItem.Id': 'FeedItemId',
      'FeedItem.Name': 'FeedItemId',
    },
  ],
]);
export const SIMPLE_REFERENCE_FIELDS = new Map<string, string[]>([['FeedComment', ['FeedItemId']]]);
export const REFERENCED_SOBJECT_TYPE_MAP = new Map<string, Record<string, string>>([
  [
    'FeedComment',
    {
      FeedItemId: 'FeedItem',
    },
  ],
]);
export const REFERENCED_FIELDS_MAP = new Map<string, string>([['OwnerId', 'User']]);
export const COMPOUND_FIELDS = new Map<string, string[]>([
  [
    'BillingAddress',
    [
      'BillingGeocodeAccuracy',
      'BillingCity',
      'BillingCountry',
      'BillingLatitude',
      'BillingLongitude',
      'BillingPostalCode',
      'BillingState',
      'BillingStreet',
    ],
  ],
  [
    'ShippingAddress',
    [
      'ShippingGeocodeAccuracy',
      'ShippingCity',
      'ShippingCountry',
      'ShippingLatitude',
      'ShippingLongitude',
      'ShippingPostalCode',
      'ShippingState',
      'ShippingStreet',
    ],
  ],
  [
    'MailingAddress',
    [
      'MailingGeocodeAccuracy',
      'MailingCity',
      'MailingCountry',
      'MailingLatitude',
      'MailingLongitude',
      'MailingPostalCode',
      'MailingState',
      'MailingStreet',
    ],
  ],
]);
export const DEFAULT_MAX_CHUNK_SIZE = 15_728_640;
export const MAX_CHUNK_SIZE = 38_797_312;
export const DEFAULT_MAX_FILE_SIZE = 38_797_312;
export const MAX_FILE_SIZE = 38_797_312;
export const SFORCE_API_CALL_HEADERS: Record<string, string> = {
  'Sforce-Call-Options': 'client=SFDMU',
};
