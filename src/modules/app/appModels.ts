/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DATA_CACHE_TYPES } from "../components/common_components/enumerations";
import { LOG_MESSAGE_TYPE, LOG_MESSAGE_VERBOSITY } from "../components/common_components/logger";
import { ObjectFieldMapping, SFieldDescribe, SObjectDescribe } from "../models";
import { IBlobField } from "../models/api_models/helper_interfaces";
import { IIdentityInfo, ITableMessage } from "../models/common_models/helper_interfaces";

export interface IAppLogger {
  log(message: string | object | ITableMessage,
    type?: LOG_MESSAGE_TYPE,
    verbosity?: LOG_MESSAGE_VERBOSITY,
    ...tokens: string[]
  ): void;
  infoMinimal(message: string, ...tokens: string[]): void;
  infoNormal(message: string, ...tokens: string[]): void;
  infoVerbose(message: string, ...tokens: string[]): void
}

export interface IAppScript {
  logger: IAppLogger;
  sourceRecordsCache: DATA_CACHE_TYPES;
  binaryDataCache: DATA_CACHE_TYPES;
  parallelBinaryDownloads: number;
  binaryCacheDirectory: string;
  sourceRecordsCacheDirectory: string;
  groupQuery?: string;
}

export interface IAppScriptOrg {
  script: IAppScript;
  getConnection(): any;
  isSource: boolean;
}

export interface IAppSfdxService {
  org: IAppScriptOrg;
  readonly logger: IAppLogger;
  queryOrgOrCsvAsync(soql: string, useBulkQueryApi: boolean, csvFullFilename?: string, sFieldsDescribeMap?: Map<string, SFieldDescribe>, useQueryAll?: boolean, bulkQueryPollTimeout?: number): Promise<Array<any>>;
  queryOrgAsync(soql: string, useBulkQueryApi: boolean, useQueryAll?: boolean, bulkQueryPollTimeout?: number): Promise<Array<any>>;
  describeOrgAsync(): Promise<Array<SObjectDescribe>>;
  getPolymorphicObjectFields(sObjectName: string): Promise<string[]>;
  identityAsync(): Promise<IIdentityInfo>;
  describeSObjectAsync(objectName: string, objectFieldMapping?: ObjectFieldMapping): Promise<SObjectDescribe>;
  downloadBlobFieldDataAsync(recordIds: Array<string>, blobField: IBlobField): Promise<Map<string, string>>;
}
