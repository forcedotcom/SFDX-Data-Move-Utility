
/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export default interface IApiResultRecord {
    
    id: string;
    sourceRecord: object;
    targetRecord: object;

    isFailed: boolean;
    isUnprocessed: boolean;
    isMissingSourceTargetMapping: boolean;

    readonly isSuccess : boolean;

    isCreated: boolean;
    errorMessage: string;
}