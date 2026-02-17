/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createRequire } from 'node:module';
import type { CasualModuleType } from './models/CasualModuleType.js';
import type { CsvWriterModuleType } from './models/CsvWriterModuleType.js';

/**
 * Adapters for CommonJS dependencies in an ESM runtime.
 */
export default class CjsDependencyAdapters {
  // ------------------------------------------------------//
  // -------------------- STATIC MEMBERS ----------------- //
  // ------------------------------------------------------//

  /**
   * Node require shim for ESM modules.
   */
  private static _require = createRequire(import.meta.url);

  /**
   * Cache of loaded CommonJS modules to prevent re-requiring.
   */
  private static _moduleCache: Map<string, unknown> = new Map();

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Get the alasql module.
   *
   * @returns The alasql module instance.
   */
  public static getAlasql(): typeof import('alasql') {
    return this._loadModule<typeof import('alasql')>('alasql');
  }

  /**
   * Get the casual module.
   *
   * @returns The casual module instance.
   */
  public static getCasual(): CasualModuleType {
    return this._loadModule<CasualModuleType>('casual');
  }

  /**
   * Get the class-transformer module.
   *
   * @returns The class-transformer module instance.
   */
  public static getClassTransformer(): typeof import('class-transformer') {
    return this._loadModule<typeof import('class-transformer')>('class-transformer');
  }

  /**
   * Get the csv-writer module.
   *
   * @returns The csv-writer module instance.
   */
  public static getCsvWriter(): CsvWriterModuleType {
    return this._loadModule<CsvWriterModuleType>('csv-writer');
  }

  /**
   * Get the soql-parser-js module.
   *
   * @returns The soql-parser-js module instance.
   */
  public static getSoqlParser(): typeof import('soql-parser-js') {
    return this._loadModule<typeof import('soql-parser-js')>('soql-parser-js');
  }

  /**
   * Get the @jsforce/jsforce-node module.
   *
   * @returns The @jsforce/jsforce-node module instance.
   */
  public static getJsforceNode(): unknown {
    return this._loadModule<unknown>('@jsforce/jsforce-node');
  }

  /**
   * Load es6-shim for its global polyfills.
   */
  public static loadEs6Shim(): void {
    this._loadModule<unknown>('es6-shim');
  }

  /**
   * Load reflect-metadata for decorator metadata support.
   */
  public static loadReflectMetadata(): void {
    this._loadModule<unknown>('reflect-metadata');
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Load a CommonJS module with caching and ESM default normalization.
   *
   * @param moduleName - The package name to require.
   * @returns The resolved module export.
   */
  private static _loadModule<T>(moduleName: string): T {
    if (this._moduleCache.has(moduleName)) {
      return this._moduleCache.get(moduleName) as T;
    }

    const loaded = this._require(moduleName) as { default?: T } | T;
    // Normalize CJS exports that surface a default property.
    const resolved = (loaded as { default?: T }).default ?? loaded;

    this._moduleCache.set(moduleName, resolved);

    return resolved as T;
  }
}
