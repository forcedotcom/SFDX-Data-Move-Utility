/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * The available types of the SF object field.
 * Mostly compatible with official Salesforce documentation.
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
  // The following are not listed in official docs, but still occur in sObject describe metadata.
  | 'time'
  | 'encryptedstring'
  | 'address'
  | 'complexvalue';

/**
 * Available operations.
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
  Unknown,
}

/**
 * Available data media sources.
 *
 * @export
 * @enum {number}
 */
export enum DATA_MEDIA_TYPE {
  Org,
  File,
}

/**
 * Detailed information about the current version of the Add-On API.
 *
 * @export
 * @interface ISfdmuAddonInfo
 */
export interface ISfdmuAddonInfo {
  /**
   * Add-On API version string (for example `1.0.0`).
   *
   * @type {string}
   * @memberof ISfdmuAddonInfo
   */
  version: string;
}

/**
 * Type of caching (for binary data or records)
 * when the caching feature is enabled.
 *
 * @see {@link https://help.sfdmu.com/full-documentation/configuration-and-running/full-exportjson-format | Full export.json format} for the detailed information.
 *
 * @export
 * @enum {number}
 */
export enum DATA_CACHE_TYPES {
  InMemory = 'InMemory',
  CleanFileCache = 'CleanFileCache',
  FileCache = 'FileCache',
}
