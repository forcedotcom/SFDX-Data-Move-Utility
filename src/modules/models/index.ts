/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export * from "./errorsModels";
export * from "./sfdxModels";
export * from "./scriptModels";
export * from "./describeModels";
export * from "./jobModels";

export namespace Enums {

    export enum OPERATION {

        /**
         * Always inserts new records whether they exist or missing in the target
         */
        Insert,

        /**
         * Only inserts new record that do not exist in the target
         */
        Add,

        /**
         * Only updates existing records with overriding all fields
         */
        Update,


        /**
         * Only updates existing records, but updates only empty fields from the record skipping non-empty
         */
        Merge,


        /**
         * Inserts non-existing and updates existing records overriding all fields
         */
        Upsert,

        /**
         * Only takes existing data from the object without modifying. Using to define parent relationship.
         */
        Readonly,


        /**
         * Only delete old target data
         */
        Delete

    }

    export enum RECORDS_SET {
        Main,
        ExtIdMap
    }


    export enum DATA_MEDIA_TYPE {
        Org,
        File
    }

}

export let CONSTANTS = {

    /**
     * Can't fetch more then this by the query
     */
    MAX_FETCH_SIZE: 10000000,


    MAX_BATCH_SIZE : 9500,

    /**
     * Max time to wait for bulk job poll response
     */
    POLL_TIMEOUT: 3000000,

    /**
     * Used to calculate allRecords flat
     */
    ALL_RECORDS_FLAG_AMOUNT_FROM: 2000,

    /**
     * Used to calculate allRecords flat
     */
    ALL_RECORDS_FLAG_AMOUNT_TO: 30000,


    /**
     * When displaying query in the log set the length
     * of the displayed query string in IN_RECORDS mode
     */
    IN_RECORDS_QUERY_DISPLAY_LENGTH: 400,


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

    TARGET_CSV_FILE_SUBDIR: "target"

};


