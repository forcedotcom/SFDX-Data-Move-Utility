/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { ADDON_EVENTS } from '../../common/Enumerations.js';
import {
  CORE_ADDON_MODULES_BASE_PATH,
  CORE_ADDON_ENTRY_FILE_NAME,
  CORE_ADDON_MODULES_FOLDER_NAME_SEPARATOR,
  CORE_ADDON_MODULES_FOLDER_SEPARATOR,
  CORE_ADDON_MODULES_NAME_PREFIX,
  CUSTOM_ADDON_MODULES_NAME_PREFIX,
} from '../../constants/Constants.js';

/**
 * Add-on manifest definition from export.json.
 */
export default class ScriptAddonManifestDefinition {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Command scope for the add-on.
   */
  public command = 'sfdmu:run';

  /**
   * Add-on locator path (relative/absolute path or module-like specifier).
   */
  public path = '';

  /**
   * Add-on module specifier (module name or path-like value).
   */
  public module = '';

  /**
   * Human readable description.
   */
  public description = '';

  /**
   * Excludes the add-on from execution.
   */
  public excluded = false;

  /**
   * Add-on arguments from export.json.
   */
  public args: Record<string, unknown> = {};

  /**
   * List of object names this add-on applies to.
   * Empty list means all objects.
   */
  public objects: string[] = [];

  /**
   * Add-on execution event.
   */
  public event: ADDON_EVENTS = ADDON_EVENTS.none;

  /**
   * Optional explicit object name (single-object shortcut).
   */
  public objectName = '';

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new add-on manifest definition.
   *
   * @param init - Optional initialization values.
   */
  public constructor(init?: Partial<ScriptAddonManifestDefinition>) {
    if (init) {
      Object.assign(this, init);
    }
    this._normalizeLocatorFields();
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Returns true when this definition references a core add-on.
   *
   * @returns True for core add-ons.
   */
  public isCore(): boolean {
    return this._moduleSpecifier().startsWith(CORE_ADDON_MODULES_NAME_PREFIX);
  }

  /**
   * Returns the resolved module name.
   *
   * @returns Module name.
   */
  public moduleName(): string {
    const specifier = this._moduleSpecifier();
    return specifier ? path.basename(specifier) : '';
  }

  /**
   * Returns the module name with core/custom prefix.
   *
   * @returns Display module name.
   */
  public moduleDisplayName(): string {
    const moduleName = this.moduleName();
    if (!moduleName) {
      return '';
    }
    if (moduleName.includes(':')) {
      return moduleName;
    }
    return this.isCore()
      ? `${CORE_ADDON_MODULES_NAME_PREFIX}${moduleName}`
      : `${CUSTOM_ADDON_MODULES_NAME_PREFIX}${moduleName}`;
  }

  /**
   * Returns true when the definition is valid.
   *
   * @returns True when valid.
   */
  public isValid(): boolean {
    return this.hasModuleOrPath() && this.event !== ADDON_EVENTS.none;
  }

  /**
   * Returns true when a locator is configured through `module` or `path`.
   *
   * @returns True when locator is configured.
   */
  public hasModuleOrPath(): boolean {
    return Boolean(this._moduleSpecifier());
  }

  /**
   * Normalizes module/path locator fields.
   * If module is present, it is treated as the effective locator.
   */
  public normalizeLocatorFields(): void {
    this._normalizeLocatorFields();
  }

  /**
   * Resolves the path for requiring the add-on module.
   *
   * @param basePath - Base path for relative resolution.
   * @returns Absolute require path or empty string.
   */
  public moduleRequirePath(basePath: string): string {
    if (!this.isValid()) {
      return '';
    }
    const moduleSpecifier = this._moduleSpecifier();
    if (moduleSpecifier.includes(CORE_ADDON_MODULES_NAME_PREFIX)) {
      const modulePath =
        CORE_ADDON_MODULES_BASE_PATH +
        this.command.replace(CORE_ADDON_MODULES_FOLDER_SEPARATOR, CORE_ADDON_MODULES_FOLDER_NAME_SEPARATOR) +
        '/' +
        moduleSpecifier.replace(CORE_ADDON_MODULES_NAME_PREFIX, '/');
      const resolved = path.normalize(path.resolve(basePath, modulePath));
      return path.extname(resolved) ? resolved : path.join(resolved, CORE_ADDON_ENTRY_FILE_NAME);
    }

    if (this._isPathLikeModuleSpecifier(moduleSpecifier)) {
      if (path.isAbsolute(moduleSpecifier)) {
        return moduleSpecifier;
      }
      return path.resolve(basePath, moduleSpecifier);
    }

    return moduleSpecifier;
  }

  /**
   * Returns true when the definition applies to the given object.
   *
   * @param objectName - Object API name.
   * @returns True when the add-on applies.
   */
  public appliedToObject(objectName: string): boolean {
    if (this.objectName && this.objectName === objectName) {
      return true;
    }
    if (Array.isArray(this.objects)) {
      return this.objects.length === 0 || this.objects.includes(objectName);
    }
    return false;
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Returns true when module specifier is a filesystem path.
   *
   * @param specifier - Module specifier.
   * @returns True when the specifier points to a path.
   */
  private _isPathLikeModuleSpecifier(specifier: string): boolean {
    void this;
    if (!specifier) {
      return false;
    }
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      return true;
    }
    if (specifier.startsWith('/') || specifier.startsWith('\\')) {
      return true;
    }
    if (/^[a-zA-Z]:[\\/]/.test(specifier)) {
      return true;
    }
    if (specifier.startsWith('file://')) {
      return true;
    }
    if (specifier.startsWith('@')) {
      return false;
    }
    return specifier.includes('/') || specifier.includes('\\');
  }

  /**
   * Returns the effective module specifier from module/path fields.
   *
   * @returns Effective module specifier.
   */
  private _moduleSpecifier(): string {
    return this._trimLocatorValue(this.module) || this._trimLocatorValue(this.path);
  }

  /**
   * Normalizes locator fields to keep module/path behavior consistent.
   */
  private _normalizeLocatorFields(): void {
    const normalizedModule = this._trimLocatorValue(this.module);
    const normalizedPath = this._trimLocatorValue(this.path);

    if (normalizedModule) {
      this.module = normalizedModule;
      this.path = normalizedModule;
      return;
    }

    this.module = '';
    this.path = normalizedPath;
  }

  /**
   * Trims locator values safely.
   *
   * @param value - Locator value.
   * @returns Trimmed string value.
   */
  private _trimLocatorValue(value: unknown): string {
    void this;
    return typeof value === 'string' ? value.trim() : '';
  }
}
