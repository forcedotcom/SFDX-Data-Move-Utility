/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/**
 * Force:org:display command response
 */
export class OrgInfo {
    AccessToken: string;
    ClientId: string;
    ConnectedStatus: string;
    OrgId: string;
    InstanceUrl: string;
    Username: string;

    get isConnected(){
        return this.ConnectedStatus == "Connected";
    }
}



