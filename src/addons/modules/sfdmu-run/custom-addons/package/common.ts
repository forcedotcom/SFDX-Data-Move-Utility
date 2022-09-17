
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


/**
 * The available operations
 *
 * @export
 * @enum {number}
 */
export enum OPERATION {
  Insert,
  Update,
  Upsert,
  Readonly,
  Delete,
  DeleteSource,
  DeleteHierarchy,
  HardDelete,
  Unknown
}


/**
 * The available media sources
 *
 * @export
 * @enum {number}
 */
export enum DATA_MEDIA_TYPE {
  Org,
  File
}


/**
 *  The detailed information about the current version of the Add-On Api.
 *
 * @export
 * @interface ISfdmuAddonInfo
 */
export interface ISfdmuAddonInfo {

  /**
   * The number of the Api version (f.ex. ```1.0.0```).
   *
   * @type {string}
   * @memberof ISfdmuAddonInfo
   */
  version: string;
}

/**
 * The type of caching (for the bimary data or for records)
 * when the caching feature is enabled.
 * @see {@link https://help.sfdmu.com/full-documentation/configuration-and-running/full-exportjson-format | Full export.json format} for the detailed information.
 *
 * @export
 * @enum {number}
 */
export enum DATA_CACHE_TYPES {
  InMemory = "InMemory",
  CleanFileCache = "CleanFileCache",
  FileCache = "FileCache"
}

