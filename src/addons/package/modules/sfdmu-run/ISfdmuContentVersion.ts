/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Class to hold SF ContentVersion record + necessary helper data
 *
 * @export
 * @interface ISfdmuContentVersion
 */
export default interface ISfdmuContentVersion {

    /**
     * The source content version id
     *
     * @type {string}
     * @memberof ISfdmuContentVersion
     */
    Id: string;

    /**
     * The source content document id
     *
     * @type {string}
     * @memberof ISfdmuContentVersion
     */
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

    // ---- Helper members ---------- //
    /**
     * true if it's of url content type
     */
    readonly isUrlContent: boolean;

    /**
     * Determines if this is a newer version of the same content document
     * @param old The old version to compare to
     */
    isNewer(old: ISfdmuContentVersion): boolean;

    /**
     * The default text to populate the ReasonForChange standard field 
     * to use when updating the version
     *
     * @type {string}
     * @memberof ISfdmuContentVersion
     */
    readonly reasonForChange: string;

    /**
     * The target content version id after the record creation completed
     *
     * @type {string}
     * @memberof ISfdmuContentVersion
     */
    targetId: string;

    /**
     * true if occured any error during upload / update of this content document
     *
     * @type {boolean}
     * @memberof ISfdmuContentVersion
     */
    isError: boolean;

    /**
     * The target content document id after the record creation completed
     *
     * @type {string}
     * @memberof ISfdmuContentVersion
     */
    targetContentDocumentId: string;

}