/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Describes a blob field for binary transfers.
 */
export type BlobFieldType = {
  /**
   * Target object name.
   */
  objectName: string;

  /**
   * Field API name.
   */
  fieldName: string;

  /**
   * Content encoding for the blob field.
   */
  dataType: BufferEncoding;
};
