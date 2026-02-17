/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Common } from '../../common/Common.js';
import ScriptObject, { createAutoGroupScriptObject, createAutoUserScriptObject } from './ScriptObject.js';

/**
 * Object set definition from export.json.
 */
export default class ScriptObjectSet {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Object list in this set.
   */
  public objects: ScriptObject[] = [];

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new object set.
   *
   * @param objects - Optional objects list.
   */
  public constructor(objects?: ScriptObject[]) {
    if (objects) {
      this.objects = objects;
    }
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Ensures required `User`/`Group` objects are present for polymorphic lookups in this set.
   * The requirement can come from explicit TYPEOF targets or from polymorphic metadata declarations.
   */
  public expandPolymorphicLookups(): void {
    const requires = this._collectPolymorphicTargets();
    const hasUser = this._hasObject((obj) => obj.isUser());
    const hasGroup = this._hasObject((obj) => obj.isGroup());
    if (!requires.hasPolymorphicLookups) {
      return;
    }

    const requiresUser = requires.requiresUser;
    const requiresGroup = requires.requiresGroup;

    if (requiresUser && !hasUser) {
      this.objects.push(createAutoUserScriptObject());
      Common.logger.verboseFile('{User} Added to object set because polymorphic lookup requires User.');
    }
    if (requiresGroup && !hasGroup) {
      this.objects.push(createAutoGroupScriptObject());
      Common.logger.verboseFile('{Group} Added to object set because polymorphic lookup requires Group.');
    }
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Checks if any object matches the provided predicate.
   *
   * @param predicate - Match predicate.
   * @returns True when a match is found.
   */
  private _hasObject(predicate: (obj: ScriptObject) => boolean): boolean {
    return this.objects.some(predicate);
  }

  /**
   * Collects required `User`/`Group` targets based on polymorphic lookup declarations.
   *
   * @returns Lookup requirements.
   */
  private _collectPolymorphicTargets(): {
    requiresUser: boolean;
    requiresGroup: boolean;
    hasPolymorphicLookups: boolean;
  } {
    let requiresUser = false;
    let requiresGroup = false;
    let hasPolymorphicLookups = false;

    for (const object of this.objects) {
      const explicitTargets = object.getExplicitPolymorphicTargets();
      if (explicitTargets.hasExplicit) {
        hasPolymorphicLookups = true;
        requiresUser = requiresUser || explicitTargets.requiresUser;
        requiresGroup = requiresGroup || explicitTargets.requiresGroup;
      }

      for (const lookup of object.polymorphicLookups) {
        hasPolymorphicLookups = true;
        const referenced = lookup.referencedObjectType?.toLowerCase();
        if (!referenced) {
          requiresUser = true;
          requiresGroup = true;
        } else if (referenced === 'group') {
          requiresGroup = true;
        } else if (referenced === 'user') {
          requiresUser = true;
        }
      }
    }

    return {
      requiresUser,
      requiresGroup,
      hasPolymorphicLookups,
    };
  }
}
