/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


 /**
 * Represents the record returned by the Api operation
 *
 * @export
 * @class BulkApiResultRecord
 */
export default class ApiResultRecord {

    constructor(init: Partial<ApiResultRecord>) {
        Object.assign(this, init);
    }

    id: string;
    sourceRecord: object;
    targetRecord: object;

    isFailed: boolean;
    isUnprocessed: boolean;
    isMissingSourceTargetMapping: boolean;

    get isSuccess() {
        return !this.isFailed
            && !this.isUnprocessed
            && !this.isMissingSourceTargetMapping;
    }

    isCreated: boolean;
    errorMessage: string;
}