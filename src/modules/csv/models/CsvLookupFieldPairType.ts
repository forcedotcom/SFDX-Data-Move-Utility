/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Defines a lookup id field and its related reference field.
 */
export type CsvLookupFieldPairType = {
  /**
   * Lookup Id field name (e.g., AccountId, Account__c).
   */
  idFieldName: string;

  /**
   * Reference field name (e.g., Account__r.Name).
   */
  referenceFieldName?: string;

  /**
   * External Id field name for the referenced object.
   */
  externalIdFieldName?: string;
};
