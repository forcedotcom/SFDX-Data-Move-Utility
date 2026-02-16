/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * ContentVersion model used by file transfer add-ons.
 */
export default class ContentVersion {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Source record Id.
   */
  public Id = '';

  /**
   * ContentDocument Id.
   */
  public ContentDocumentId = '';

  /**
   * Title value.
   */
  public Title = '';

  /**
   * Description value.
   */
  public Description = '';

  /**
   * Client path for the file.
   */
  public PathOnClient = '';

  /**
   * Binary file data.
   */
  public VersionData = '';

  /**
   * Last modified date.
   */
  public ContentModifiedDate: Date = new Date(0);

  /**
   * File size in bytes.
   */
  public ContentSize = 0;

  /**
   * Checksum value.
   */
  public Checksum = '';

  /**
   * URL content reference.
   */
  public ContentUrl = '';

  /**
   * Content body Id.
   */
  public ContentBodyId = '';

  /**
   * Target record Id.
   */
  public targetId = '';

  /**
   * Target ContentDocument Id.
   */
  public targetContentDocumentId = '';

  /**
   * True when the record contains errors.
   */
  public isError = false;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new ContentVersion model.
   *
   * @param init - Optional initialization values.
   */
  public constructor(init?: Partial<ContentVersion>) {
    if (init) {
      Object.assign(this, init);
      if (typeof this.ContentModifiedDate === 'string') {
        this.ContentModifiedDate = new Date(this.ContentModifiedDate);
      }
    }
  }

  // ------------------------------------------------------//
  // -------------------- GETTERS/SETTERS ----------------//
  // ------------------------------------------------------//

  /**
   * Returns true when the content uses a URL.
   *
   * @returns True for URL content.
   */
  public get isUrlContent(): boolean {
    return Boolean(this.ContentUrl);
  }

  /**
   * Returns the reason for change based on document linkage.
   *
   * @returns Reason for change or undefined.
   */
  public get reasonForChange(): string | undefined {
    return this.ContentDocumentId ? 'Updated' : undefined;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Determines whether the record is newer than the provided version.
   *
   * @param previous - Previous ContentVersion record.
   * @returns True when this version is newer.
   */
  public isNewer(previous: ContentVersion): boolean {
    if (this.isUrlContent !== previous.isUrlContent) {
      return true;
    }
    if (this.isUrlContent) {
      return this.ContentModifiedDate > previous.ContentModifiedDate || this.ContentUrl !== previous.ContentUrl;
    }
    return this.Checksum !== previous.Checksum;
  }
}
