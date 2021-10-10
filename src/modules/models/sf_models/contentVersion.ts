/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


export default class ContentVersion {
    constructor(init: Partial<ContentVersion>) {
        if (init) {
            Object.assign(this, init);
            if (typeof this.ContentModifiedDate == 'string') {
                this.ContentModifiedDate = new Date(this.ContentModifiedDate);
            }
        }
    }
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
    targetId: string;
    targetContentDocumentId: string;
    isError: boolean;
    get isUrlContent() {
        return !!this.ContentUrl;
    }
    isNewer(old: ContentVersion) {
        return this.isUrlContent != old.isUrlContent
            || this.isUrlContent && (this.ContentModifiedDate > old.ContentModifiedDate || this.ContentUrl != old.ContentUrl)
            || !this.isUrlContent && this.Checksum != old.Checksum;
    }
    get reasonForChange(): string {
        return this.ContentDocumentId ? 'Updated' : undefined;
    }

}