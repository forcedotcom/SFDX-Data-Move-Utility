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
    "Child value": string,
    "Child sObject": string,
    "Child field": string,
    "Parent value": string,
    "Parent sObject": string,
    "Parent field": string,
    "Error": string
}

export interface IMissingParentLookupRecordCsvRow {
    "Date update": string,
    "Id": string,
    "Child SObject": string;
    "Child lookup": string;
    "Child ExternalId": string;
    "Parent SObject": string;
    "Parent ExternalId": string;
    "Missing value": string;
}

