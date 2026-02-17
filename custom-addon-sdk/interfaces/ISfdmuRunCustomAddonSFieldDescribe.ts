/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Description of a Salesforce object field.
 */
export default interface ISfdmuRunCustomAddonSFieldDescribe {
  objectName: string;
  name: string;
  type: string;
  label: string;
  updateable: boolean;
  creatable: boolean;
  cascadeDelete: boolean;
  autoNumber: boolean;
  unique: boolean;
  nameField: boolean;
  custom: boolean;
  calculated: boolean;

  lookup: boolean;
  referencedObjectType: string;
  polymorphicReferenceObjectType: string;

  length: number;

  isPolymorphicField: boolean;
  readonly: boolean;
  isMasterDetail: boolean;
}
