/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
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



    /**
     * Helper enum to store record sets
     */
    export enum RECORDS_SET {
        Main,
        ExtIdMap
    }



    /**
    * Represents media type of the given sOrg instance
    *
    * @export
    * @enum {number}
    */
    export enum DATA_MEDIA_TYPE {
        Org,
        File
    }

}