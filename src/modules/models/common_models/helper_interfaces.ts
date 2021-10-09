/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import IAddonModuleBase from "../../../addons/components/addon_components/interfaces/IAddonModuleBase";
import { STANDARD_MESSAGES } from "../../../addons/messages/standard";





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

// tslint:disable-next-line: no-empty-interface
export interface IPluginRuntimeSystemBase {
    $$getStandardMessage(module: IAddonModuleBase, message: STANDARD_MESSAGES, ...tokens: string[]): string,
    $$writeStandardInfoMessage(module: IAddonModuleBase, message: STANDARD_MESSAGES, ...tokens: string[]): void,
    $$writeStandardWarningMessage(module: IAddonModuleBase, message: STANDARD_MESSAGES, ...tokens: string[]): void,
    $$writeStandardErrorMessage(module: IAddonModuleBase, message: STANDARD_MESSAGES, ...tokens: string[]): void,
    $$setSfdmuPluginJob(): void
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






