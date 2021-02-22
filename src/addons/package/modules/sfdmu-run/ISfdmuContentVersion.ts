/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Class to hold SF ContentVersion record
 *
 * @export
 * @interface ISfdmuContentVersion
 */
export default interface ISfdmuContentVersion {

    Id: string;
    ContentDocumentId: string;
    Title: string;
    Description: string;
    PathOnClient: string;
    VersionData: string;
    ContentModifiedDate: Date;
    ContentSize: number;
    Checksum: string;
    ContentUrl: string;
    ContentBodyId: string;
    readonly isUrlContent: boolean;
    isNewer(old: ISfdmuContentVersion): boolean;
    readonly reasonForChange: string;
    targetId: string;

}