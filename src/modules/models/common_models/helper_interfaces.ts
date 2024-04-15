/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


export interface IOrgConnectionData {
  instanceUrl: string;
  accessToken: string;
  apiVersion: string;
  proxyUrl: string;
}

export interface IMockField {
  fn: string;
  regIncl: string;
  regExcl: string;
  disallowMockAllRecord: boolean;
  allowMockAllRecord: boolean;
}

export interface ICSVIssueCsvRow {
  "Date update": string,
  "Field value": string,
  "sObject name": string,
  "Field name": string,
  "Parent field value": string,
  "Parent SObject name": string,
  "Parent field name": string,
  "Error": string
}

export interface IMissingParentLookupRecordCsvRow {
  "Date update": string,
  "Record Id": string,
  "sObject name": string;
  "Lookup field name": string;
  "Lookup reference field name": string;
  "Parent SObject name": string;
  "Parent ExternalId field name": string;
  "Missing parent External Id value": string;
}


export interface IFieldMapping {
  sourceQueryToTarget: (query: string, sourceObjectName: string) => IFieldMappingResult;
  sourceRecordsToTarget: (records: Array<any>, sourceObjectName: string) => IFieldMappingResult;
  targetRecordsToSource: (records: Array<any>, sourceObjectName: string) => IFieldMappingResult;
  transformQuery: (query: string, sourceObjectName: string) => IFieldMappingResult;
}

export interface IFieldMappingResult {
  query?: string;
  records?: Array<any>;
  targetSObjectName?: string;
}

export interface IIdentityInfo {
  user_id: string,
  organization_id: string,
  username: string,
  display_name: string
}


/**
 * Metadata to write table into log
 */
export interface ITableMessage {
  tableBody: Array<object>,
  tableColumns: Array<{
    key: string,
    label: string,
    width?: number
  }>
}








