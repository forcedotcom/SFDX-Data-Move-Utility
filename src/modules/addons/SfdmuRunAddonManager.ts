/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Common } from '../common/Common.js';
import { ADDON_EVENTS } from '../common/Enumerations.js';
import {
  ADDON_MESSAGES_FILE_NAME,
  ADDON_RESOURCES_FOLDER_NAME,
  CORE_ADDON_MANIFEST_FILE_NAME,
  PLUGIN_NAME,
  RUN_COMMAND_NAME,
  USER_ADDON_MANIFEST_FILE_NAME,
} from '../constants/Constants.js';
import { CommandAbortedByAddOnError } from '../models/common/CommandAbortedByAddOnError.js';
import { CommandInitializationError } from '../models/common/CommandInitializationError.js';
import type { LoggerType } from '../logging/LoggerType.js';
import ScriptAddonManifestDefinition from '../models/script/ScriptAddonManifestDefinition.js';
import type Script from '../models/script/Script.js';
import type {
  ISfdmuRunCustomAddonModule,
  ISfdmuRunCustomAddonResult,
} from '../../../custom-addon-sdk/interfaces/index.js';
import AddonResult from './models/AddonResult.js';
import type { IAddonContext } from './models/IAddonContext.js';
import BridgeRuntimeAdapter from './bridge/BridgeRuntimeAdapter.js';
import SfdmuRunAddonRuntime from './SfdmuRunAddonRuntime.js';

type AddonRuntimeAdapterType = BridgeRuntimeAdapter;
type AddonModuleInstanceType = ISfdmuRunCustomAddonModule;
type AddonExecutionResultType = AddonResult | ISfdmuRunCustomAddonResult | void;
type AddonMethodNameType = 'onExecuteAsync' | 'onExecute' | 'onInitAsync' | 'onInit';

type AddonModuleEntryType = {
  module: AddonModuleInstanceType;
  manifest: ScriptAddonManifestDefinition;
  context: IAddonContext;
  executeAsync: (context: IAddonContext) => Promise<AddonExecutionResultType>;
  initAsync?: (context: IAddonContext) => Promise<AddonExecutionResultType>;
};

type AddonInvocationContextType = {
  passNumber?: number;
  isFirstPass?: boolean;
  objectSetIndex?: number;
};

type LoggerAdapterType = {
  info: (message: string, ...tokens: string[]) => void;
  warn: (message: string, ...tokens: string[]) => void;
  getResourceString: (message: string, ...tokens: string[]) => string;
};

/**
 * Add-on manager for loading and executing run add-ons.
 */
export default class SfdmuRunAddonManager {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Script instance owning this addon manager.
   */
  public script: Script;

  /**
   * Runtime instance shared by add-ons.
   */
  public runtime: SfdmuRunAddonRuntime;

  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Map of event name to loaded addon modules.
   */
  private _addonsByEvent: Map<ADDON_EVENTS, AddonModuleEntryType[]> = new Map();

  /**
   * Flag indicating the manager has been initialized.
   */
  private _isInitialized = false;

  /**
   * Base path for resolving core add-ons.
   */
  private _coreBasePath: string;

  /**
   * Require function for loading CommonJS add-ons.
   */
  private _require: NodeRequire;

  /**
   * Cached global node_modules directory.
   */
  private _globalNodeModulesPath?: string;

  /**
   * Cached legacy runtime adapter instance.
   */
  private _bridgeRuntimeAdapter?: BridgeRuntimeAdapter;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new addon manager.
   *
   * @param script - Script instance.
   */
  public constructor(script: Script) {
    this.script = script;
    this.runtime = new SfdmuRunAddonRuntime(script);
    this._coreBasePath = path.dirname(fileURLToPath(import.meta.url));
    this._require = createRequire(import.meta.url);
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Initializes addon manager state.
   */
  public async initializeAsync(): Promise<void> {
    if (this._isInitialized) {
      return;
    }
    this._isInitialized = true;
    const manifestAddons = await this._loadAllManifestsAsync();
    await this._createAddonsMapAsync(manifestAddons);
    await this.triggerAddonModuleInitAsync();
  }

  /**
   * Runs a global addon event.
   *
   * @param event - Addon event identifier.
   */
  public async runAddonEventAsync(event: ADDON_EVENTS): Promise<void> {
    await this.triggerAddonModuleMethodAsync(event, '');
  }

  /**
   * Executes add-on initialization hooks.
   */
  public async triggerAddonModuleInitAsync(): Promise<void> {
    const executed = new Set<AddonModuleInstanceType>();
    const tasks: Array<() => Promise<void>> = [];

    for (const entries of this._addonsByEvent.values()) {
      for (const entry of entries) {
        if (!entry.initAsync || executed.has(entry.module)) {
          continue;
        }
        tasks.push(async () => {
          const result = await entry.initAsync?.(entry.context);
          executed.add(entry.module);
          if (result?.cancel) {
            throw new CommandAbortedByAddOnError(entry.manifest.moduleDisplayName());
          }
        });
      }
    }

    await Common.serialExecAsync(tasks);
  }

  /**
   * Executes add-on modules for the given event and object.
   *
   * @param event - Add-on event identifier.
   * @param objectName - Optional object name to filter.
   * @returns True when any add-on executed.
   */
  public async triggerAddonModuleMethodAsync(
    event: ADDON_EVENTS,
    objectName = '',
    contextOverrides?: AddonInvocationContextType
  ): Promise<boolean> {
    const entries = this._addonsByEvent.get(event);
    if (!entries || entries.length === 0) {
      return false;
    }

    const matching = entries.filter((entry) => this._appliesToObject(entry.manifest, objectName));
    if (matching.length === 0) {
      return false;
    }

    const logger = this._getLogger();
    const globalLabel = logger.getResourceString('global');
    const objectDisplayName = objectName || globalLabel;

    logger.info('runAddonMethod', objectDisplayName, event.toString());

    const tasks = matching.map((entry) => async () => {
      const invocationContext = this._buildInvocationContext(entry.context, objectName, contextOverrides);
      if (this._isRecord(entry.module)) {
        const moduleInstance = entry.module;
        moduleInstance.context = invocationContext;
      }
      const result = await entry.executeAsync(invocationContext);
      if (result?.cancel) {
        throw new CommandAbortedByAddOnError(entry.manifest.moduleDisplayName());
      }
    });

    await Common.serialExecAsync(tasks);

    logger.info('runAddonMethodCompleted', objectDisplayName, event.toString());
    return true;
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Loads add-ons from all supported manifests.
   *
   * @returns Combined add-on list.
   */
  private async _loadAllManifestsAsync(): Promise<ScriptAddonManifestDefinition[]> {
    const coreAddons = await this._loadCoreManifestAsync();
    const fileAddons = await this._loadUserManifestFileAsync();
    const scriptAddons = this._loadScriptAddons();
    return [...coreAddons, ...fileAddons, ...scriptAddons];
  }

  /**
   * Loads core add-ons manifest when present.
   *
   * @returns Core add-on definitions.
   */
  private async _loadCoreManifestAsync(): Promise<ScriptAddonManifestDefinition[]> {
    const logger = this._getLogger();
    logger.info('loadingCoreAddonManifestFile');

    const manifestPaths = this._getCoreManifestPaths();
    const pathChecks = await Promise.all(
      manifestPaths.map(async (manifestPath) => ({
        manifestPath,
        exists: await this._pathExistsAsync(manifestPath),
      }))
    );

    const match = pathChecks.find((entry) => entry.exists);
    if (match) {
      return this._loadManifestFileAsync(match.manifestPath);
    }
    return [];
  }

  /**
   * Loads add-ons from addons.json when present.
   *
   * @returns Add-on definitions from addons.json.
   */
  private async _loadUserManifestFileAsync(): Promise<ScriptAddonManifestDefinition[]> {
    const manifestPath = path.resolve(this.script.basePath, USER_ADDON_MANIFEST_FILE_NAME);
    if (!(await this._pathExistsAsync(manifestPath))) {
      return [];
    }
    return this._loadManifestFileAsync(manifestPath);
  }

  /**
   * Reads and parses a manifest file.
   *
   * @param manifestPath - Manifest file path.
   * @returns Parsed add-on definitions.
   */
  private async _loadManifestFileAsync(manifestPath: string): Promise<ScriptAddonManifestDefinition[]> {
    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      return this._normalizeManifestAddons(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new CommandInitializationError(message);
    }
  }

  /**
   * Collects add-ons declared in the script definition.
   *
   * @returns Script-based add-on definitions.
   */
  private _loadScriptAddons(): ScriptAddonManifestDefinition[] {
    const fullCommandName = this._getFullCommandName();
    const addons: ScriptAddonManifestDefinition[] = [];

    const appendGlobal = (items: ScriptAddonManifestDefinition[], event: ADDON_EVENTS): void => {
      items.forEach((addon) => {
        if (addon.excluded || !this._commandMatches(addon.command, fullCommandName)) {
          return;
        }
        const clone = this._cloneAddon(addon);
        clone.event = event;
        clone.objectName = '';
        addons.push(clone);
      });
    };

    const appendObject = (items: ScriptAddonManifestDefinition[], event: ADDON_EVENTS, objectName: string): void => {
      items.forEach((addon) => {
        if (addon.excluded || !this._commandMatches(addon.command, fullCommandName)) {
          return;
        }
        const clone = this._cloneAddon(addon);
        clone.event = event;
        clone.objectName = objectName;
        addons.push(clone);
      });
    };

    appendGlobal(this.script.beforeAddons, ADDON_EVENTS.onBefore);
    appendGlobal(this.script.dataRetrievedAddons, ADDON_EVENTS.onDataRetrieved);
    appendGlobal(this.script.afterAddons, ADDON_EVENTS.onAfter);

    this.script.getAllObjects().forEach((object) => {
      appendObject(object.beforeAddons, ADDON_EVENTS.onBefore, object.name);
      appendObject(object.afterAddons, ADDON_EVENTS.onAfter, object.name);
      appendObject(object.beforeUpdateAddons, ADDON_EVENTS.onBeforeUpdate, object.name);
      appendObject(object.afterUpdateAddons, ADDON_EVENTS.onAfterUpdate, object.name);
      appendObject(object.filterRecordsAddons, ADDON_EVENTS.filterRecordsAddons, object.name);
    });

    return addons;
  }

  /**
   * Builds addon module instances map.
   *
   * @param addons - Add-on definitions.
   */
  private async _createAddonsMapAsync(addons: ScriptAddonManifestDefinition[]): Promise<void> {
    this._addonsByEvent = new Map();
    const fullCommandName = this._getFullCommandName();
    const logger = this._getLogger();

    const tasks = addons.map((addon) => async () => {
      if (addon.excluded || !this._commandMatches(addon.command, fullCommandName)) {
        return undefined;
      }
      if (!addon.hasModuleOrPath()) {
        logger.warn('cantLoadModule', '[empty add-on module/path]');
        return undefined;
      }
      if (!addon.isValid()) {
        return undefined;
      }

      const basePath = addon.isCore() ? this._coreBasePath : this.script.basePath;
      const requirePath = addon.moduleRequirePath(basePath);
      if (!requirePath) {
        return undefined;
      }

      logger.info('loadingAddonModule', addon.moduleDisplayName());

      const entry = await this._loadAddonModuleEntryAsync(addon, requirePath);
      if (!entry) {
        return undefined;
      }
      const eventEntries = this._addonsByEvent.get(addon.event) ?? [];
      eventEntries.push(entry);
      this._addonsByEvent.set(addon.event, eventEntries);
      return undefined;
    });

    await Common.serialExecAsync(tasks);
  }

  /**
   * Loads and instantiates an add-on module entry.
   *
   * @param addon - Add-on definition.
   * @param requirePath - Module path to load.
   * @returns Loaded addon entry or undefined.
   */
  private async _loadAddonModuleEntryAsync(
    addon: ScriptAddonManifestDefinition,
    requirePath: string
  ): Promise<AddonModuleEntryType | undefined> {
    const logger = this._getLogger();
    try {
      const moduleExports = await this._importModuleAsync(requirePath);
      const addonConstructor = this._resolveAddonConstructor(moduleExports);
      if (!addonConstructor) {
        logger.warn('cantLoadModule', requirePath);
        return undefined;
      }
      const runtime = this._getBridgeRuntimeAdapter();
      const moduleInstance = new addonConstructor(runtime);
      const context: IAddonContext = {
        eventName: addon.event.toString(),
        objectName: addon.objectName,
        description: addon.description,
        objectDisplayName: addon.objectName || logger.getResourceString('global'),
        moduleDisplayName: addon.moduleDisplayName(),
        isCore: addon.isCore(),
        isFirstPass: true,
        passNumber: 0,
        objectSetIndex: this.script.objectSetIndex,
      };
      if (this._isRecord(moduleInstance)) {
        moduleInstance.context = context;
      }
      await this._registerAddonMessagesAsync(addon, moduleInstance, requirePath);
      const executeAsync = addon.isCore()
        ? this._resolveAddonMethodAsync(moduleInstance, ['onExecuteAsync', 'onExecute'])
        : this._resolveAddonMethodAsync(moduleInstance, ['onExecute']);
      if (!executeAsync) {
        logger.warn('cantLoadModule', requirePath);
        return undefined;
      }
      const initAsync = addon.isCore()
        ? this._resolveAddonMethodAsync(moduleInstance, ['onInitAsync', 'onInit'])
        : this._resolveAddonMethodAsync(moduleInstance, ['onInit']);
      const entry: AddonModuleEntryType = {
        module: moduleInstance,
        manifest: addon,
        context,
        executeAsync: async (invocationContext: IAddonContext): Promise<AddonExecutionResultType> =>
          executeAsync(invocationContext, addon.args),
      };
      if (initAsync) {
        entry.initAsync = async (invocationContext: IAddonContext): Promise<AddonExecutionResultType> =>
          initAsync(invocationContext, addon.args);
      }
      return entry;
    } catch {
      logger.warn('cantLoadModule', requirePath);
      return undefined;
    }
  }

  /**
   * Imports an addon module from the resolved path.
   *
   * @param requirePath - Module path.
   * @returns Loaded module exports.
   */
  private async _importModuleAsync(requirePath: string): Promise<unknown> {
    const primary = await this._tryImportAsync(requirePath);
    if (typeof primary !== 'undefined') {
      return primary;
    }

    const alternate = this._getAlternateModulePath(requirePath);
    if (alternate) {
      const alternateModule = await this._tryImportAsync(alternate);
      if (typeof alternateModule !== 'undefined') {
        return alternateModule;
      }
    }

    const globalResolved = this._resolveGlobalModulePath(requirePath);
    if (globalResolved) {
      const globalImport = await this._tryImportAsync(globalResolved);
      if (typeof globalImport !== 'undefined') {
        return globalImport;
      }
    }

    const moduleExports: unknown = this._require(requirePath);
    return moduleExports;
  }

  /**
   * Attempts to import a module by path.
   *
   * @param requirePath - Module path.
   * @returns Module exports or undefined when import fails.
   */
  private async _tryImportAsync(requirePath: string): Promise<unknown> {
    void this;
    const specifier = path.isAbsolute(requirePath) ? pathToFileURL(requirePath).href : requirePath;
    try {
      const moduleExports: unknown = await import(specifier);
      return moduleExports;
    } catch {
      return undefined;
    }
  }

  /**
   * Returns alternate module path by swapping extensions.
   *
   * @param requirePath - Module path.
   * @returns Alternate path or undefined.
   */
  private _getAlternateModulePath(requirePath: string): string | undefined {
    void this;
    if (requirePath.endsWith('.js')) {
      return requirePath.slice(0, -3) + '.ts';
    }
    if (requirePath.endsWith('.ts')) {
      return requirePath.slice(0, -3) + '.js';
    }
    return undefined;
  }

  /**
   * Resolves a global module path for a non-absolute specifier.
   *
   * @param moduleName - Module specifier.
   * @returns Resolved path or undefined.
   */
  private _resolveGlobalModulePath(moduleName: string): string | undefined {
    if (path.isAbsolute(moduleName)) {
      return undefined;
    }

    const globalModulesPath = this._getGlobalNodeModulesPath();
    if (!globalModulesPath) {
      return undefined;
    }

    try {
      const resolved = this._require.resolve(moduleName, { paths: [globalModulesPath] });
      return typeof resolved === 'string' ? resolved : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Returns the global node_modules directory if available.
   *
   * @returns Global node_modules directory.
   */
  private _getGlobalNodeModulesPath(): string | undefined {
    if (this._globalNodeModulesPath) {
      return this._globalNodeModulesPath;
    }

    const candidates: string[] = [];
    const nodePath = process.env.NODE_PATH;
    if (nodePath) {
      candidates.push(...nodePath.split(path.delimiter).filter((entry) => entry.length > 0));
    }

    const npmPrefix = process.env.NPM_CONFIG_PREFIX;
    if (npmPrefix) {
      candidates.push(path.join(npmPrefix, 'node_modules'));
    }

    try {
      const npmRoot = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
      if (npmRoot) {
        candidates.push(npmRoot);
      }
    } catch {
      // Ignore failures, global npm may be unavailable.
    }

    const resolved = candidates.find((entry) => entry.length > 0);
    if (resolved) {
      this._globalNodeModulesPath = resolved;
    }
    return this._globalNodeModulesPath;
  }

  /**
   * Registers a custom message bundle for an add-on module when available.
   *
   * @param addon - Add-on definition.
   * @param moduleInstance - Loaded module instance.
   * @param requirePath - Module require path.
   */
  private async _registerAddonMessagesAsync(
    addon: ScriptAddonManifestDefinition,
    moduleInstance: AddonModuleInstanceType,
    requirePath: string
  ): Promise<void> {
    if (addon.isCore()) {
      return;
    }

    const messagesPath = await this._resolveCustomAddonMessagesPathAsync(requirePath);
    if (!messagesPath) {
      return;
    }

    await this.runtime.registerAddonMessagesAsync(moduleInstance, messagesPath);
  }

  /**
   * Resolves the custom add-on messages file path.
   *
   * @param requirePath - Module require path.
   * @returns Messages file path or undefined.
   */
  private async _resolveCustomAddonMessagesPathAsync(requirePath: string): Promise<string | undefined> {
    const modulePath = this._resolveAddonModulePath(requirePath);
    if (!modulePath) {
      return undefined;
    }

    const basePaths = this._getAddonResourceBasePaths(modulePath);
    const candidates = basePaths.map((basePath) =>
      path.join(basePath, ADDON_RESOURCES_FOLDER_NAME, ADDON_MESSAGES_FILE_NAME)
    );
    // Try base folder first, then its parent when module is shipped in dist/lib.
    const checks = await Promise.all(
      candidates.map(async (candidate) => ({
        candidate,
        exists: await this._pathExistsAsync(candidate),
      }))
    );
    const match = checks.find((entry) => entry.exists);
    if (match) {
      return match.candidate;
    }

    return undefined;
  }

  /**
   * Resolves the absolute module entry path for a require specifier.
   *
   * @param requirePath - Module require path.
   * @returns Absolute module path or undefined.
   */
  private _resolveAddonModulePath(requirePath: string): string | undefined {
    if (path.isAbsolute(requirePath)) {
      return requirePath;
    }

    try {
      const resolved = this._require.resolve(requirePath, { paths: [this.script.basePath] });
      return typeof resolved === 'string' ? resolved : undefined;
    } catch {
      // Resolution can fail for non-local modules.
    }

    const globalResolved = this._resolveGlobalModulePath(requirePath);
    if (globalResolved) {
      return globalResolved;
    }

    return undefined;
  }

  /**
   * Builds candidate base paths for add-on resources.
   *
   * @param modulePath - Resolved module path.
   * @returns Candidate base paths.
   */
  private _getAddonResourceBasePaths(modulePath: string): string[] {
    void this;
    const basePath = path.extname(modulePath) ? path.dirname(modulePath) : modulePath;
    const parentPath = path.dirname(basePath);
    const candidates = new Set<string>([basePath]);

    if (parentPath && parentPath !== basePath) {
      candidates.add(parentPath);
    }

    return [...candidates];
  }

  /**
   * Resolves a constructor from module exports.
   *
   * @param moduleExports - Module export object.
   * @returns Constructor or undefined.
   */
  private _resolveAddonConstructor(
    moduleExports: unknown
  ): (new (runtime: AddonRuntimeAdapterType) => AddonModuleInstanceType) | undefined {
    if (typeof moduleExports === 'function') {
      return moduleExports as new (runtime: AddonRuntimeAdapterType) => AddonModuleInstanceType;
    }
    if (this._isRecord(moduleExports) && typeof moduleExports.default === 'function') {
      return moduleExports.default as new (runtime: AddonRuntimeAdapterType) => AddonModuleInstanceType;
    }
    return undefined;
  }

  /**
   * Resolves an add-on method by name.
   *
   * @param moduleInstance - Module instance.
   * @param methodNames - Candidate method names.
   * @returns Method function or undefined.
   */
  private _resolveAddonMethodAsync(
    moduleInstance: AddonModuleInstanceType,
    methodNames: AddonMethodNameType[]
  ): ((context: IAddonContext, args: Record<string, unknown>) => Promise<AddonExecutionResultType>) | undefined {
    void this;
    const candidateRecord = moduleInstance as unknown as Record<string, unknown>;
    for (const methodName of methodNames) {
      const candidate = candidateRecord[methodName];
      if (typeof candidate === 'function') {
        return candidate.bind(moduleInstance) as (
          context: IAddonContext,
          args: Record<string, unknown>
        ) => Promise<AddonExecutionResultType>;
      }
    }
    return undefined;
  }

  /**
   * Determines whether the addon applies to the object.
   *
   * @param addon - Add-on definition.
   * @param objectName - Object name.
   * @returns True when the add-on applies.
   */
  private _appliesToObject(addon: ScriptAddonManifestDefinition, objectName: string): boolean {
    void this;
    if (addon.objectName && addon.objectName !== objectName) {
      return false;
    }
    return addon.appliedToObject(objectName);
  }

  /**
   * Builds invocation context for an add-on event call.
   *
   * @param baseContext - Base context captured when add-on was loaded.
   * @param objectName - Current object name for the invocation.
   * @param overrides - Runtime context overrides.
   * @returns Invocation context payload.
   */
  private _buildInvocationContext(
    baseContext: IAddonContext,
    objectName: string,
    overrides?: AddonInvocationContextType
  ): IAddonContext {
    const logger = this._getLogger();
    const resolvedObjectName = objectName || baseContext.objectName || '';
    const passNumber = typeof overrides?.passNumber === 'number' ? overrides.passNumber : baseContext.passNumber ?? 0;
    const isFirstPass =
      typeof overrides?.isFirstPass === 'boolean' ? overrides.isFirstPass : baseContext.isFirstPass ?? passNumber === 0;
    const objectSetIndex =
      typeof overrides?.objectSetIndex === 'number'
        ? overrides.objectSetIndex
        : baseContext.objectSetIndex ?? this.script.objectSetIndex;

    return {
      ...baseContext,
      objectName: resolvedObjectName,
      objectDisplayName: resolvedObjectName || logger.getResourceString('global'),
      passNumber,
      isFirstPass,
      objectSetIndex,
    };
  }

  /**
   * Resolves manifest paths for core add-ons.
   *
   * @returns List of manifest paths.
   */
  private _getCoreManifestPaths(): string[] {
    return [
      path.resolve(this._coreBasePath, CORE_ADDON_MANIFEST_FILE_NAME),
      path.resolve(this._coreBasePath, '../../../addons/addonsCore.json'),
    ];
  }

  /**
   * Normalizes a manifest payload into add-on definitions.
   *
   * @param manifest - Raw manifest payload.
   * @returns Normalized add-on definitions.
   */
  private _normalizeManifestAddons(manifest: unknown): ScriptAddonManifestDefinition[] {
    if (!this._isRecord(manifest)) {
      return [];
    }
    const addons = manifest.addons;
    if (!Array.isArray(addons)) {
      return [];
    }
    return addons
      .map((entry) => this._normalizeManifestEntry(entry))
      .filter((entry): entry is ScriptAddonManifestDefinition => Boolean(entry));
  }

  /**
   * Normalizes a manifest entry into ScriptAddonManifestDefinition.
   *
   * @param entry - Raw entry value.
   * @returns Normalized addon definition or undefined.
   */
  private _normalizeManifestEntry(entry: unknown): ScriptAddonManifestDefinition | undefined {
    if (!this._isRecord(entry)) {
      return undefined;
    }
    const command = this._normalizeString(entry.command) ?? this._getFullCommandName();
    const addon = new ScriptAddonManifestDefinition({
      command,
      path: this._normalizeString(entry.path) ?? '',
      module: this._normalizeString(entry.module) ?? '',
      description: this._normalizeString(entry.description) ?? '',
      excluded: Boolean(entry.excluded),
      args: this._normalizeArgs(entry.args),
      objects: this._normalizeStringArray(entry.objects),
      event: this._resolveEvent(entry.event),
      objectName: this._normalizeString(entry.objectName) ?? '',
    });
    return addon;
  }

  /**
   * Clones a ScriptAddonManifestDefinition with safe defaults.
   *
   * @param addon - Addon to clone.
   * @returns Cloned addon definition.
   */
  private _cloneAddon(addon: ScriptAddonManifestDefinition): ScriptAddonManifestDefinition {
    const clone = new ScriptAddonManifestDefinition({
      command: addon.command,
      path: addon.path,
      module: addon.module,
      description: addon.description,
      excluded: addon.excluded,
      args: this._normalizeArgs(addon.args),
      objects: this._normalizeStringArray(addon.objects),
      event: addon.event,
      objectName: addon.objectName,
    });
    return clone;
  }

  /**
   * Resolves the full command name for the run command.
   *
   * @returns Full command name.
   */
  private _getFullCommandName(): string {
    const pluginName = this.script.runInfo?.pluginInfo?.pluginName ?? PLUGIN_NAME;
    const commandName = this.script.runInfo?.pluginInfo?.commandName ?? RUN_COMMAND_NAME;
    return `${pluginName}:${commandName}`;
  }

  /**
   * Checks if the command matches the current run command.
   *
   * @param command - Command string from manifest.
   * @param expected - Expected command string.
   * @returns True when matching.
   */
  private _commandMatches(command: string, expected: string): boolean {
    void this;
    const normalizedCommand = command.trim().toLowerCase();
    if (!normalizedCommand) {
      const defaultCommand = `${PLUGIN_NAME}:${RUN_COMMAND_NAME}`.toLowerCase();
      return defaultCommand === expected.toLowerCase();
    }
    return normalizedCommand === expected.toLowerCase();
  }

  /**
   * Normalizes a raw args value into a record.
   *
   * @param args - Raw args value.
   * @returns Args record.
   */
  private _normalizeArgs(args: unknown): Record<string, unknown> {
    if (this._isRecord(args)) {
      return args;
    }
    return {};
  }

  /**
   * Normalizes a value into a string.
   *
   * @param value - Raw value.
   * @returns Trimmed string or undefined.
   */
  private _normalizeString(value: unknown): string | undefined {
    void this;
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  /**
   * Normalizes a value into string array.
   *
   * @param value - Raw value.
   * @returns Normalized string array.
   */
  private _normalizeStringArray(value: unknown): string[] {
    void this;
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
  }

  /**
   * Resolves event enum value from manifest value.
   *
   * @param value - Raw event value.
   * @returns Resolved ADDON_EVENTS enum.
   */
  private _resolveEvent(value: unknown): ADDON_EVENTS {
    void this;
    if (typeof value === 'string') {
      const match = (Object.values(ADDON_EVENTS) as string[]).find(
        (event) => event.toLowerCase() === value.toLowerCase()
      );
      if (match) {
        return match as ADDON_EVENTS;
      }
    }
    return ADDON_EVENTS.none;
  }

  /**
   * Checks whether a value is a plain record.
   *
   * @param value - Value to check.
   * @returns True when value is a record.
   */
  private _isRecord(value: unknown): value is Record<string, unknown> {
    void this;
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Creates a logger adapter for this manager.
   *
   * @returns Logger adapter instance.
   */
  private _getLogger(): LoggerAdapterType {
    const logger = (this.script.logger ?? Common.logger) as LoggerType & {
      info?: (message: string, ...tokens: string[]) => void;
    };
    return {
      info: typeof logger.info === 'function' ? logger.info.bind(logger) : logger.log.bind(logger),
      warn: logger.warn.bind(logger),
      getResourceString: logger.getResourceString.bind(logger),
    };
  }

  /**
   * Returns the cached legacy runtime adapter.
   *
   * @returns Bridge runtime adapter.
   */
  private _getBridgeRuntimeAdapter(): BridgeRuntimeAdapter {
    if (!this._bridgeRuntimeAdapter) {
      this._bridgeRuntimeAdapter = new BridgeRuntimeAdapter(this.runtime);
    }
    return this._bridgeRuntimeAdapter;
  }

  /**
   * Checks if a path exists.
   *
   * @param filePath - Path to check.
   * @returns True when path exists.
   */
  private async _pathExistsAsync(filePath: string): Promise<boolean> {
    void this;
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
