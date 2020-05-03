/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


/**
 * Connection data for salesforce env
 *
 * @export
 * @interface IOrgConnectionData
 */
export default interface IOrgConnectionData {
    instanceUrl: string;
    accessToken: string;
    apiVersion: string;
}
