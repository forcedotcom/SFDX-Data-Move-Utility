
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


export interface IRecordsFilterArgs {
  filterType: string;
  settings: IRecordsFilterSetting;
}

export interface IRecordsFilterSetting {
  // TODO: Can add extra props for all filters
}


export interface IRecordsFilter {
  isInitialized: boolean;
  filterRecords(records: any[]): Promise<any[]>;
}


