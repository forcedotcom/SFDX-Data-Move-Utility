
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * The available types of the SF object field.
 * Mostly is compatible with the official SF documentaiton.
 */
export type FieldType =
    | 'string'
    | 'boolean'
    | 'int'
    | 'double'
    | 'date'
    | 'datetime'
    | 'base64'
    | 'id'
    | 'reference'
    | 'currency'
    | 'textarea'
    | 'percent'
    | 'phone'
    | 'url'
    | 'email'
    | 'combobox'
    | 'picklist'
    | 'multipicklist'
    | 'anyType'
    | 'location'
    // the following are not found in official documentation, but still occur when describing an sobject
    | 'time'
    | 'encryptedstring'
    | 'address'
    | 'complexvalue'


    export enum OPERATION {
        Insert,
        Update,
        Upsert,
        Readonly,
        Delete,
        DeleteSource,
        DeleteHierarchy,
        Unknown
    }

    export enum DATA_MEDIA_TYPE {
        Org,
        File
    }