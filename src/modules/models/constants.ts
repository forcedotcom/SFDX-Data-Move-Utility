
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export let CONSTANTS = {


    /**
     * Can't fetch totally more records then this by the query
     */
    MAX_FETCH_SIZE: 100000,


    QUERY_BULK_API_THRESHOLD: 30000,


    /**
     * Max time to wait for bulk job poll response
     */
    POLL_TIMEOUT: 3000000,


    /**
     * When displaying query in the log set the length
     * of the displayed query string in IN_RECORDS mode
     */
    IN_RECORDS_QUERY_DISPLAY_LENGTH: 400,

    BULK_API_V2_BLOCK_SIZE: 1000,

    BULK_API_V2_MAX_CSV_SIZE_IN_BYTES: 145000000,

    

    // Helper constants ----------

    SPECIAL_MOCK_COMMANDS: ["c_seq_number", "c_seq_date"],

    COMPLEX_FIELDS_QUERY_SEPARATOR: '$',

    COMPLEX_FIELDS_QUERY_PREFIX: '$$',

    COMPLEX_FIELDS_SEPARATOR: ';',

    FIELD_NOT_FOR_EXTERNAL_ID: ["OwnerId"],

    USER_AND_GROUP_FILE_NAME: 'UserAndGroup',

    CSV_LOOKUP_ERRORS_FILE_NAME: 'CSVIssuesReport.csv',

    CSV_COMPLEX_FIELDS_COLUMN_SEPARATOR : '!',

    MISSING_PARENT_RECORDS_ERRORS_FILE_NAME: 'MissingParentRecordsReport.csv',

    TARGET_CSV_FILE_POSTFIX : "_target",

    TARGET_CSV_FILE_SUBDIR: "target",

    MOCK_PATTERN_ENTIRE_ROW_FLAG: '--row'

};


