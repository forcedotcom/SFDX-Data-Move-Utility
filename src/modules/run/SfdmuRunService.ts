/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import * as os from 'node:os';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type { Connection } from '@jsforce/jsforce-node';
import { Common } from '../common/Common.js';
import { DATA_MEDIA_TYPE } from '../common/Enumerations.js';
import {
  COMMAND_EXIT_STATUSES,
  CSV_FILE_ORG_NAME,
  LOG_LEVELS,
  MAX_PARALLEL_REQUESTS,
  PLUGIN_NAME,
  RUN_COMMAND_NAME,
  SCRIPT_FILE_NAME,
} from '../constants/Constants.js';
import CjsDependencyAdapters from '../dependencies/CjsDependencyAdapters.js';
import LoggingContext from '../logging/LoggingContext.js';
import LoggingService from '../logging/LoggingService.js';
import MigrationJob from '../models/job/MigrationJob.js';
import { CommandAbortedByAddOnError } from '../models/common/CommandAbortedByAddOnError.js';
import { CommandAbortedByUserError } from '../models/common/CommandAbortedByUserError.js';
import { CommandExecutionError } from '../models/common/CommandExecutionError.js';
import { CommandInitializationError } from '../models/common/CommandInitializationError.js';
import { CommandInitializationNoStackError } from '../models/common/CommandInitializationNoStackError.js';
import { OrgMetadataError } from '../models/common/OrgMetadataError.js';
import { SuccessExit } from '../models/common/SuccessExit.js';
import { UnresolvableWarning } from '../models/common/UnresolvableWarning.js';
import { CommandAbortedByWarningError } from '../models/common/CommandAbortedByWarningError.js';
import Script from '../models/script/Script.js';
import ScriptObjectSet from '../models/script/ScriptObjectSet.js';
import ScriptOrg from '../models/script/ScriptOrg.js';
import OrgConnectionAdapter from '../org/OrgConnectionAdapter.js';
import OrgMetadataProvider, { type OrgMetadataCacheType } from '../org/OrgMetadataProvider.js';
import ScriptLoader from '../script/ScriptLoader.js';
import type { FinishMessageType } from '../logging/models/FinishMessageType.js';
import type { SfdmuRunFlagsType } from './models/SfdmuRunFlagsType.js';
import type { SfdmuRunRequestType } from './models/SfdmuRunRequestType.js';
import type { SfdmuRunResultType } from './models/SfdmuRunResultType.js';

type RawRecordType = Record<string, unknown>;

type OrgNamesType = {
  source?: string;
  target?: string;
};

type OrgSummaryConnectionType = {
  singleRecordQuery?: <T>(query: string) => Promise<T>;
};

type OrganizationSummaryType = {
  OrganizationType?: string;
  IsSandbox?: boolean;
};

type ObjectOrderInfoType = {
  objectSetIndex: number;
  queryOrder: string[];
  deleteOrder: string[];
  updateOrder: string[];
};

type AnonymiseEntryType = {
  value: string;
  label: string;
};

type ManualConnectionCtorType = new (options: {
  instanceUrl: string;
  accessToken: string;
  maxRequest: number;
  proxyUrl?: string;
}) => Connection;

const execFileAsync = promisify(execFile);

const isRecord = (value: unknown): value is RawRecordType =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Service layer for the sfdmu run command.
 */
export default class SfdmuRunService {
  // ------------------------------------------------------//
  // -------------------- STATIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Lookup of status codes to status strings.
   */
  private static readonly _STATUS_STRINGS = new Map<number, string>([
    [COMMAND_EXIT_STATUSES.SUCCESS, 'SUCCESS'],
    [COMMAND_EXIT_STATUSES.COMMAND_UNEXPECTED_ERROR, 'COMMAND_UNEXPECTED_ERROR'],
    [COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR, 'COMMAND_INITIALIZATION_ERROR'],
    [COMMAND_EXIT_STATUSES.ORG_METADATA_ERROR, 'ORG_METADATA_ERROR'],
    [COMMAND_EXIT_STATUSES.COMMAND_EXECUTION_ERROR, 'COMMAND_EXECUTION_ERROR'],
    [COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_USER, 'COMMAND_ABORTED_BY_USER'],
    [COMMAND_EXIT_STATUSES.UNRESOLVABLE_WARNING, 'UNRESOLVABLE_WARNING'],
    [COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_ADDON, 'COMMAND_ABORTED_BY_ADDON'],
    [COMMAND_EXIT_STATUSES.WARNING_AS_ERROR, 'WARNING_AS_ERROR'],
  ]);

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Build the command response for the current implementation phase.
   *
   * @param request - Parsed input from the CLI.
   * @returns The structured command result payload.
   */
  public static async executeAsync(request: SfdmuRunRequestType): Promise<SfdmuRunResultType> {
    const startTime = new Date();
    const flags = this._normalizeFlags(request.flags);
    const rootPath = this._resolveRootPath(flags.path);
    if (flags.version) {
      return this._handleVersionOutputAsync(request.stdoutWriter, flags, startTime);
    }
    const logger = this._createLogger(
      rootPath,
      flags,
      request.stdoutWriter,
      request.stderrWriter,
      request.warnWriter,
      request.errorWriter,
      request.jsonWriter,
      request.promptWriter,
      request.textPromptWriter
    );
    Common.logger = logger;
    await this._logEnvironmentDiagnosticsAsync(logger, rootPath, flags);

    try {
      logger.logColored('jobStartedHeader', 'green');
      logger.logColored('commandStartTemplate', 'blue', logger.context.commandFullName);

      const orgNames = this._normalizeOrgNames(flags);
      if (!orgNames.source && !orgNames.target) {
        throw new CommandInitializationError(
          logger.getMessage('errorMissingRequiredFlag', '--sourceusername, --targetusername')
        );
      }

      if (this._isCsvFileAlias(orgNames.source) && this._isCsvFileAlias(orgNames.target)) {
        throw new CommandInitializationError(logger.getMessage('cannotMigrateFile2File'));
      }

      const script = await ScriptLoader.loadFromPathAsync(rootPath, logger);
      this._applyScriptRuntimeFlags(script, flags, rootPath, logger);
      this._initializeScriptOrgs(script, orgNames);

      if (this._shouldValidateOrgAlias(orgNames.source, script.sourceOrg)) {
        const sourceMissing = await this._isOrgAliasMissingAsync(orgNames.source);
        if (sourceMissing) {
          const finish = logger.finishCommand(
            'orgAliasNotFound',
            COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR,
            this._getStatusString(COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR),
            undefined,
            logger.getResourceString('source'),
            orgNames.source ?? ''
          );
          return this._attachFlags(finish, flags);
        }
      }

      if (this._shouldValidateOrgAlias(orgNames.target, script.targetOrg)) {
        const targetMissing = await this._isOrgAliasMissingAsync(orgNames.target);
        if (targetMissing) {
          const finish = logger.finishCommand(
            'orgAliasNotFound',
            COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR,
            this._getStatusString(COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR),
            undefined,
            logger.getResourceString('target'),
            orgNames.target ?? ''
          );
          return this._attachFlags(finish, flags);
        }
      }

      await this._resolveDefaultApiVersionAsync(script, flags, logger);
      const objectSets = this._resolveObjectSets(script, logger);
      await this._resolveOrgTypesForSummaryAsync(script);
      const metadataCaches: OrgMetadataCacheType = {
        sourceDescribeCache: new Map(),
        targetDescribeCache: new Map(),
        polymorphicCache: new Map(),
      };

      const objectOrders: ObjectOrderInfoType[] = [];
      const objectSetTasks = objectSets.map((_objectSet, index) => async () => {
        logger.info('newLine');
        logger.logColored('objectSetStarted', 'green', String(index + 1));
        logger.info('newLine');
        if (index === 0) {
          this._logRunSummary(logger, orgNames, script);
        }
        const orderInfo = await this._runObjectSetAsync(script, index, logger, request, metadataCaches);
        if (orderInfo) {
          objectOrders.push(orderInfo);
        }
        await this._runGlobalOnAfterAsync(script);
      });
      await Common.serialExecAsync(objectSetTasks);

      const finish = logger.finishCommand(
        'commandSucceededResult',
        COMMAND_EXIT_STATUSES.SUCCESS,
        this._getStatusString(COMMAND_EXIT_STATUSES.SUCCESS)
      );
      return this._attachFlags(finish, flags, objectOrders);
    } catch (error) {
      return this._finishWithError(logger, flags, error);
    }
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Normalize CLI flags for downstream execution.
   *
   * @param flags - Raw CLI flags.
   * @returns Normalized flags.
   */
  private static _normalizeFlags(flags: SfdmuRunFlagsType): SfdmuRunFlagsType {
    const loglevel = typeof flags.loglevel === 'string' ? flags.loglevel.toUpperCase() : flags.loglevel;
    const canmodify = typeof flags.canmodify === 'string' ? flags.canmodify.trim() : flags.canmodify;
    const filelog = flags.diagnostic ? 1 : flags.filelog;
    return {
      ...flags,
      json: Boolean(flags.json),
      version: Boolean(flags.version),
      silent: Boolean(flags.silent),
      quiet: Boolean(flags.quiet),
      diagnostic: Boolean(flags.diagnostic),
      anonymise: Boolean(flags.anonymise),
      failonwarning: Boolean(flags.failonwarning),
      verbose: false,
      loglevel,
      canmodify,
      filelog,
    };
  }

  /**
   * Applies runtime flags to the loaded script instance.
   *
   * @param script - Script instance to update.
   * @param flags - Normalized CLI flags.
   * @param rootPath - Working directory.
   * @param logger - Logging service instance.
   */
  private static _applyScriptRuntimeFlags(
    script: Script,
    flags: SfdmuRunFlagsType,
    rootPath: string,
    logger: LoggingService
  ): void {
    const nextScript = script;
    nextScript.basePath = rootPath;
    nextScript.logger = logger;
    nextScript.canModify = flags.canmodify ?? '';
    nextScript.logfullquery = Boolean(flags.logfullquery);
    nextScript.simulationMode = nextScript.simulationMode || Boolean(flags.simulation);
    if (flags.apiversion) {
      nextScript.apiVersion = flags.apiversion;
    }
  }

  /**
   * Resolve the working directory used for logs and export.json.
   *
   * @param rootPath - Optional working path.
   * @returns Absolute path to the working directory.
   */
  private static _resolveRootPath(rootPath?: string): string {
    const normalized = rootPath?.trim();
    return path.resolve(normalized && normalized.length > 0 ? normalized : process.cwd());
  }

  /**
   * Create the logging service from normalized flags.
   *
   * @param rootPath - Working directory.
   * @param flags - Normalized flags.
   * @returns Logging service instance.
   */
  private static _createLogger(
    rootPath: string,
    flags: SfdmuRunFlagsType,
    stdoutWriter?: (message: string) => void,
    stderrWriter?: (message: string) => void,
    warnWriter?: (message: string) => void,
    errorWriter?: (message: string) => void,
    jsonWriter?: (message: string) => void,
    promptWriter?: (message: string) => Promise<boolean>,
    textPromptWriter?: (message: string) => Promise<string>
  ): LoggingService {
    const anonymiseSeed = flags.anonymise ? this._createAnonymiseSeed() : undefined;
    const context = new LoggingContext({
      commandName: RUN_COMMAND_NAME,
      rootPath,
      logLevelName: flags.loglevel,
      fileLogEnabled: flags.filelog,
      jsonEnabled: flags.json,
      quiet: flags.quiet,
      silent: flags.silent,
      verbose: flags.diagnostic,
      anonymise: flags.anonymise,
      anonymiseValues: this._createAnonymiseValueList(flags, rootPath),
      anonymiseEntries: this._createAnonymiseEntries(flags, rootPath),
      anonymiseSeed,
      noWarnings: flags.nowarnings,
      failOnWarning: flags.failonwarning,
      noPrompt: flags.noprompt,
      stdoutWriter,
      stderrWriter,
      warnWriter,
      errorWriter,
      jsonWriter,
      promptWriter,
      textPromptWriter,
    });
    return new LoggingService(context);
  }

  /**
   * Logs environment metadata into the diagnostic file log.
   *
   * @param logger - Logging service instance.
   * @param rootPath - Working directory.
   * @param flags - Normalized command flags.
   */
  private static async _logEnvironmentDiagnosticsAsync(
    logger: LoggingService,
    rootPath: string,
    flags: SfdmuRunFlagsType
  ): Promise<void> {
    if (!logger.context.verbose || !logger.context.fileLogEnabled) {
      return;
    }

    const [npmVersion, sfVersion] = await Promise.all([
      this._resolveCommandVersionAsync('npm', ['--version']),
      this._resolveCommandVersionAsync('sf', ['--version']),
    ]);

    const osVersion = typeof os.version === 'function' ? os.version() : '';
    const osDetails = [os.type(), os.release(), osVersion].filter((value) => value && value.length > 0).join(' ');

    const execPathSafe = this._sanitizeLogPath(process.execPath);
    const rootPathSafe = this._sanitizeLogPath(rootPath);
    const flagsJson = JSON.stringify(this._createDiagnosticFlagsSnapshot(flags), null, 2) ?? '{}';
    const lines = [
      'Run flags:',
      ...flagsJson.split(/\r?\n/),
      'Environment information:',
      `node: ${process.version}`,
      `npm: ${npmVersion}`,
      `sf-cli: ${sfVersion}`,
      `os: ${osDetails || 'unknown'}`,
      `platform: ${process.platform}`,
      `arch: ${process.arch}`,
      `execPath: ${execPathSafe}`,
      `cwd: ${rootPathSafe}`,
    ];

    lines.forEach((line) => logger.verboseFile(line));
    await this._logExportJsonDiagnosticsAsync(logger, rootPath, Boolean(flags.anonymise));
  }

  /**
   * Builds a stable diagnostic snapshot for run flags.
   *
   * @param flags - Normalized flags.
   * @returns Serializable flags object with explicit nullable values.
   */
  private static _createDiagnosticFlagsSnapshot(
    flags: SfdmuRunFlagsType
  ): Record<string, string | number | boolean | null> {
    return {
      sourceusername: flags.sourceusername ?? null,
      targetusername: flags.targetusername ?? null,
      path: flags.path ?? null,
      silent: flags.silent ?? null,
      quiet: flags.quiet ?? null,
      diagnostic: flags.diagnostic ?? null,
      verbose: flags.verbose ?? null,
      concise: flags.concise ?? null,
      logfullquery: flags.logfullquery ?? null,
      apiversion: flags.apiversion ?? null,
      filelog: flags.filelog ?? null,
      json: flags.json ?? null,
      noprompt: flags.noprompt ?? null,
      nowarnings: flags.nowarnings ?? null,
      failonwarning: this._toNullableFlagValue(flags.failonwarning),
      canmodify: flags.canmodify ?? null,
      simulation: flags.simulation ?? null,
      loglevel: flags.loglevel ?? null,
      usesf: flags.usesf ?? null,
      version: flags.version ?? null,
    };
  }

  /**
   * Normalizes optional scalar flag values to explicit nullable values.
   *
   * @param value - Optional flag value.
   * @returns Original value or null.
   */
  private static _toNullableFlagValue(value: string | number | boolean | undefined): string | number | boolean | null {
    return value ?? null;
  }

  /**
   * Builds literal values list used for file-log anonymization.
   *
   * @param flags - Normalized command flags.
   * @param rootPath - Resolved working path.
   * @returns Values to mask in file logs.
   */
  private static _createAnonymiseValueList(flags: SfdmuRunFlagsType, rootPath: string): string[] {
    const values = new Set<string>();
    const addValue = (value?: string): void => {
      const trimmed = value?.trim();
      if (!trimmed) {
        return;
      }
      values.add(trimmed);
      values.add(trimmed.replace(/\\/g, '/'));
      values.add(trimmed.replace(/\//g, '\\'));
    };

    addValue(flags.sourceusername);
    addValue(flags.targetusername);
    addValue(flags.canmodify);
    if (flags.path && path.isAbsolute(flags.path)) {
      addValue(flags.path);
    }
    addValue(rootPath);

    return [...values].filter((value) => value.length > 0);
  }

  /**
   * Builds labeled values used for contextual file-log anonymization.
   *
   * @param flags - Normalized command flags.
   * @param rootPath - Resolved working path.
   * @returns Labeled values to hash in file logs.
   */
  private static _createAnonymiseEntries(flags: SfdmuRunFlagsType, rootPath: string): AnonymiseEntryType[] {
    const keySeparator = '\u0000';
    const entries = new Map<string, AnonymiseEntryType>();
    const addEntry = (value: string | undefined, label: string): void => {
      const trimmed = value?.trim();
      if (!trimmed) {
        return;
      }
      const variants = new Set<string>([trimmed, trimmed.replace(/\\/g, '/'), trimmed.replace(/\//g, '\\')]);
      variants.forEach((variant) => {
        if (!variant) {
          return;
        }
        const key = `${variant}${keySeparator}${label}`;
        if (!entries.has(key)) {
          entries.set(key, { value: variant, label });
        }
      });
    };

    addEntry(flags.sourceusername, this._resolveUsernameAnonymiseLabel(flags.sourceusername, true));
    addEntry(flags.targetusername, this._resolveUsernameAnonymiseLabel(flags.targetusername, false));
    addEntry(flags.canmodify, 'canModify');
    if (flags.path && path.isAbsolute(flags.path)) {
      addEntry(flags.path, 'path');
    }
    addEntry(rootPath, 'cwd');

    return [...entries.values()];
  }

  /**
   * Resolves label for source/target username values.
   *
   * @param username - Raw source/target username flag value.
   * @param isSource - True for source username.
   * @returns Context label.
   */
  private static _resolveUsernameAnonymiseLabel(username: string | undefined, isSource: boolean): string {
    const normalized = username?.trim() ?? '';
    const isEmail = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/u.test(normalized);
    if (isSource) {
      return isEmail ? 'sourceUser' : 'sourceOrg';
    }
    return isEmail ? 'targetUser' : 'targetOrg';
  }

  /**
   * Creates a random run-scoped anonymization seed.
   *
   * @returns Random seed value.
   */
  private static _createAnonymiseSeed(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Masks sensitive fields only inside export.json `orgs` entries.
   *
   * @param raw - Raw export.json string.
   * @returns Masked JSON string.
   */
  private static _maskExportJsonOrgsSection(raw: string): string {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isRecord(parsed)) {
        return raw;
      }

      const clone = JSON.parse(JSON.stringify(parsed)) as RawRecordType;
      const orgs = clone['orgs'];
      if (!Array.isArray(orgs)) {
        return raw;
      }

      orgs.forEach((entry) => {
        if (!isRecord(entry)) {
          return;
        }
        this._maskOrgEntrySecrets(entry);
      });

      return JSON.stringify(clone, null, 2);
    } catch {
      return raw;
    }
  }

  /**
   * Masks auth-related fields in one export.json org entry.
   *
   * @param orgEntry - Org entry object.
   */
  private static _maskOrgEntrySecrets(orgEntry: RawRecordType): void {
    const nextEntry = orgEntry;
    Object.keys(nextEntry).forEach((key) => {
      const normalized = key.toLowerCase();
      if (
        normalized === 'accesstoken' ||
        normalized === 'refreshtoken' ||
        normalized === 'password' ||
        normalized === 'clientsecret' ||
        normalized === 'instanceurl' ||
        normalized === 'sessionid' ||
        normalized === 'token'
      ) {
        nextEntry[key] = '<masked>';
      }
    });
  }

  /**
   * Logs the export.json contents into the diagnostic file log.
   *
   * @param logger - Logging service instance.
   * @param rootPath - Working directory.
   */
  private static async _logExportJsonDiagnosticsAsync(
    logger: LoggingService,
    rootPath: string,
    anonymise: boolean
  ): Promise<void> {
    if (!logger.context.verbose || !logger.context.fileLogEnabled) {
      return;
    }

    const scriptPath = path.join(rootPath, SCRIPT_FILE_NAME);
    try {
      const raw = await readFile(scriptPath, 'utf8');
      const content = anonymise ? this._maskExportJsonOrgsSection(raw) : raw;
      logger.verboseFile(logger.getMessage('exportJsonDiagnosticHeader'));
      content.split(/\r?\n/).forEach((line) => logger.verboseFile(line));
    } catch {
      // Ignore missing export.json diagnostics.
    }
  }

  /**
   * Resolves the version of a CLI command.
   *
   * @param command - Command binary.
   * @param args - Arguments to request version information.
   * @returns Version string or 'not available'.
   */
  private static async _resolveCommandVersionAsync(command: string, args: string[]): Promise<string> {
    const candidates = await this._resolveCommandCandidatesAsync(command);
    const results = await Promise.all(candidates.map((candidate) => this._executeCommandVersionAsync(candidate, args)));
    const resolved = results.find((value) => Boolean(value));
    if (resolved) {
      return resolved;
    }

    if (command === 'npm') {
      const userAgent = process.env.npm_config_user_agent ?? '';
      const match = userAgent.match(/npm\/([0-9]+(?:\.[0-9]+)*)/i);
      if (match?.[1]) {
        return match[1];
      }
    }

    return 'not available';
  }

  /**
   * Resolves command candidates for version checks.
   *
   * @param command - Command binary.
   * @returns List of command candidates to try.
   */
  private static async _resolveCommandCandidatesAsync(command: string): Promise<string[]> {
    const candidates: string[] = [];
    const resolvedPaths = await this._resolveCommandPathsAsync(command);
    candidates.push(...resolvedPaths, command);
    if (process.platform === 'win32') {
      candidates.push(`${command}.cmd`, `${command}.exe`);
    }
    return Array.from(new Set(candidates.filter((value) => value && value.length > 0)));
  }

  /**
   * Resolves binary paths using platform-specific lookup commands.
   *
   * @param command - Command binary name.
   * @returns Resolved absolute paths.
   */
  private static async _resolveCommandPathsAsync(command: string): Promise<string[]> {
    const lookup = process.platform === 'win32' ? 'where' : 'which';
    try {
      const { stdout } = await execFileAsync(lookup, [command], { encoding: 'utf8', windowsHide: true });
      return stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    } catch {
      return [];
    }
  }

  /**
   * Executes a command to resolve its version.
   *
   * @param command - Command or full path to execute.
   * @param args - Version arguments.
   * @returns Version string when available.
   */
  private static async _executeCommandVersionAsync(command: string, args: string[]): Promise<string | undefined> {
    try {
      const useCmd = process.platform === 'win32';
      const commandArgs = useCmd ? ['/c', `"${command}"`, ...args] : args;
      const executable = useCmd ? 'cmd.exe' : command;
      const { stdout, stderr } = await execFileAsync(executable, commandArgs, {
        encoding: 'utf8',
        windowsHide: true,
      });
      const output = `${stdout ?? ''}\n${stderr ?? ''}`.trim();
      if (!output) {
        return 'unknown';
      }
      const [firstLine] = output.split(/\r?\n/);
      return (firstLine || output).trim();
    } catch {
      return undefined;
    }
  }

  /**
   * Sanitizes a filesystem path for safe log output across platforms.
   *
   * @param value - Path to sanitize.
   * @returns Sanitized path string.
   */
  private static _sanitizeLogPath(value: string): string {
    const normalized = value.replace(/\\/g, '/').replace(/\r?\n/g, ' ').replace(/\t/g, ' ');
    return normalized.replace(/\/{2,}/g, '/');
  }

  /**
   * Handle the --version short-circuit flow without logging.
   *
   * @param stdoutWriter - Optional stdout writer.
   * @param flags - Normalized flags.
   * @param startTime - Command start time.
   * @returns Command result payload.
   */
  private static async _handleVersionOutputAsync(
    stdoutWriter: ((message: string) => void) | undefined,
    flags: SfdmuRunFlagsType,
    startTime: Date
  ): Promise<SfdmuRunResultType> {
    const version = await this._getPluginVersionAsync();
    stdoutWriter?.(`v${version}`);

    const endTime = new Date();
    const finish: FinishMessageType = {
      command: `${PLUGIN_NAME}:${RUN_COMMAND_NAME}`,
      cliCommandString: Common.getFullCommandLine(),
      message: '',
      fullLog: [],
      stack: [],
      status: COMMAND_EXIT_STATUSES.SUCCESS,
      statusString: this._getStatusString(COMMAND_EXIT_STATUSES.SUCCESS),
      startTime: Common.convertUTCDateToLocalDate(startTime),
      startTimeUTC: startTime,
      endTime: Common.convertUTCDateToLocalDate(endTime),
      endTimeUTC: endTime,
      timeElapsedString: Common.timeDiffString(startTime, endTime),
    };
    return this._attachFlags(finish, flags);
  }

  /**
   * Load the plugin version from package.json.
   *
   * @returns Plugin version string.
   */
  private static async _getPluginVersionAsync(): Promise<string> {
    const packagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../package.json');
    try {
      const raw = await readFile(packagePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (isRecord(parsed) && typeof parsed.version === 'string') {
        return parsed.version;
      }
    } catch {
      return 'unknown';
    }
    return 'unknown';
  }

  /**
   * Normalize source and target org names.
   *
   * @param flags - Normalized flags.
   * @returns Normalized org names.
   */
  private static _normalizeOrgNames(flags: SfdmuRunFlagsType): OrgNamesType {
    const source = flags.sourceusername?.trim();
    const target = flags.targetusername?.trim();
    if (!source && !target) {
      return {};
    }
    if (!source) {
      return {
        source: target,
        target,
      };
    }
    if (!target) {
      return {
        source,
        target: source,
      };
    }
    return {
      source,
      target,
    };
  }

  /**
   * Resolve script object sets, validating that at least one exists.
   *
   * @param script - Script instance.
   * @param logger - Optional logger for error reporting.
   * @returns Object sets list.
   */
  private static _resolveObjectSets(script: Script, logger?: LoggingService): ScriptObjectSet[] {
    const sets = script.objectSets.length > 0 ? script.objectSets : [];
    if (sets.length === 0 && logger) {
      throw new CommandInitializationError(logger.getMessage('noObjectsToProcess'));
    }
    return sets;
  }

  /**
   * Clears the target directory for the current object set.
   *
   * @param script - Script instance.
   * @param logger - Logging service instance.
   */
  private static async _clearTargetDirectoryForObjectSetAsync(script: Script, logger: LoggingService): Promise<void> {
    if (!script.createTargetCSVFiles) {
      return;
    }
    const clearDirectoryAsync = async (
      directoryPath: string,
      errorResourceKey: string,
      errorFactory: (message: string) => Error
    ): Promise<void> => {
      try {
        Common.logDiagnostics(`Clearing directory: ${directoryPath}.`, logger);
        Common.deleteFolderRecursive(directoryPath, true, false);
        await mkdir(directoryPath, { recursive: true });
        Common.logDiagnostics(`Cleared directory: ${directoryPath}.`, logger);
      } catch {
        const message = logger.getResourceString(errorResourceKey, directoryPath);
        logger.error(message);
        Common.logDiagnostics(message, logger);
        throw errorFactory(message);
      }
    };

    await clearDirectoryAsync(
      script.targetDirectoryPath,
      'unableToDeleteTargetDirectory',
      (message) => new CommandInitializationNoStackError(message)
    );
    await clearDirectoryAsync(
      script.reportsDirectoryPath,
      'unableToDeleteReportsDirectory',
      (message) => new CommandInitializationNoStackError(message)
    );
  }

  /**
   * Execute the pipeline for a single object set.
   *
   * @param baseScript - Base script definition.
   * @param objectSetIndex - Object set index to process.
   * @param logger - Logging service instance.
   * @param request - Run request payload.
   * @param metadataCaches - Shared metadata caches between object sets.
   */
  private static async _runObjectSetAsync(
    baseScript: Script,
    objectSetIndex: number,
    logger: LoggingService,
    request: SfdmuRunRequestType,
    metadataCaches: OrgMetadataCacheType
  ): Promise<ObjectOrderInfoType | null> {
    const script = ScriptLoader.createScriptForObjectSet(baseScript, objectSetIndex);
    await this._clearTargetDirectoryForObjectSetAsync(script, logger);
    const metadataProvider = new OrgMetadataProvider({ script, caches: metadataCaches });
    const job = new MigrationJob({ script, metadataProvider });
    logger.info('newLine');
    logger.info('dataMigrationProcessStarted');
    await job.loadAsync();
    logger.info('buildingMigrationStaregy');
    await job.setupAsync();
    if (job.tasks.length === 0) {
      logger.warn('objectSetSkippedNoObjects', String(objectSetIndex + 1));
      return null;
    }
    const sourceIsCsv = script.sourceOrg?.isFileMedia ?? false;
    const targetIsCsv = script.targetOrg?.isFileMedia ?? false;
    if (sourceIsCsv || targetIsCsv) {
      logger.info('processingCsvFiles');
    }
    await job.processCsvAsync();
    await job.prepareAsync();
    logger.info('preparingJob');
    const orderInfo = this._logObjectOrders(logger, job, request, objectSetIndex);
    logger.info('newLine');
    logger.info('processingAddon');
    await job.runAddonsAsync();
    logger.info('nothingToProcess');
    logger.info('newLine');
    logger.info('executingJob');
    await job.executeAsync();
    logger.info('newLine');
    return orderInfo;
  }

  /**
   * Run the global onAfter addon event.
   *
   * @param script - Script instance.
   */
  private static async _runGlobalOnAfterAsync(script: Script): Promise<void> {
    void script;
    await Common.delayAsync(0);
  }

  /**
   * Return true when the org name represents CSV file media.
   *
   * @param aliasOrUsername - Org alias or username.
   * @returns True when CSV files are used.
   */
  private static _isCsvFileAlias(aliasOrUsername?: string): boolean {
    if (!aliasOrUsername) {
      return false;
    }
    return aliasOrUsername.trim().toLowerCase() === CSV_FILE_ORG_NAME;
  }

  /**
   * Initializes ScriptOrg instances for source and target.
   *
   * @param script - Script instance.
   * @param orgNames - Normalized org names.
   */
  private static _initializeScriptOrgs(script: Script, orgNames: OrgNamesType): void {
    const nextScript = script;
    const sourceOrg = this._resolveScriptOrg(nextScript, orgNames.source, true);
    const targetOrg = this._resolveScriptOrg(nextScript, orgNames.target, false);
    if (sourceOrg) {
      nextScript.sourceOrg = sourceOrg;
    }
    if (targetOrg) {
      nextScript.targetOrg = targetOrg;
    }
  }

  /**
   * Resolves a ScriptOrg for the provided name.
   *
   * @param script - Script instance.
   * @param name - Org alias or username.
   * @param isSource - True when source org.
   * @returns ScriptOrg or undefined.
   */
  private static _resolveScriptOrg(script: Script, name?: string, isSource = false): ScriptOrg | undefined {
    if (!name) {
      return undefined;
    }
    const normalized = name.trim();
    const existing = script.orgs.find((org) => org.name?.trim().toLowerCase() === normalized.toLowerCase());
    const org = existing ?? new ScriptOrg();
    org.name = normalized;
    org.script = script;
    org.isSource = isSource;
    org.media = this._isCsvFileAlias(normalized) ? DATA_MEDIA_TYPE.File : DATA_MEDIA_TYPE.Org;
    return org;
  }

  /**
   * Logs summary details for the first object set.
   *
   * @param logger - Logging service instance.
   * @param orgNames - Normalized org names.
   */
  private static _logRunSummary(logger: LoggingService, orgNames: OrgNamesType, script: Script): void {
    const sourceLabel = logger.getMessage('source');
    const targetLabel = logger.getMessage('target');
    const sourceDisplay = this._formatOrgWithType(script.sourceOrg, orgNames.source);
    const targetDisplay = this._formatOrgWithType(script.targetOrg, orgNames.target);
    const sourceValue = logger.getMessage('sourceOrg', sourceDisplay);
    const targetValue = logger.getMessage('targetOrg', targetDisplay);

    logger.logColored(`${sourceLabel}: ${sourceValue}`, 'green');
    logger.logColored(`${targetLabel}: ${targetValue}`, 'green');
  }

  /**
   * Formats an org display string with a user-facing org type label.
   *
   * @param org - Script org metadata.
   * @param fallbackName - Fallback org name from command flags.
   * @returns Formatted org display value.
   */
  private static _formatOrgWithType(org?: ScriptOrg, fallbackName?: string): string {
    const primaryName = org?.name?.trim();
    const orgName = primaryName && primaryName.length > 0 ? primaryName : fallbackName?.trim() ?? '';
    if (!orgName) {
      return '';
    }

    const orgType = this._resolveOrgTypeLabel(org);
    if (!orgType) {
      return orgName;
    }

    return `${orgName} (${orgType})`;
  }

  /**
   * Resolves a stable user-facing org type label.
   *
   * @param org - Script org metadata.
   * @returns Org type label.
   */
  private static _resolveOrgTypeLabel(org?: ScriptOrg): string | undefined {
    if (!org || org.isFileMedia) {
      return undefined;
    }
    if (org.isScratch) {
      return 'scratch org';
    }
    if (org.isSandbox) {
      return 'sandbox';
    }
    if (org.isDeveloper) {
      return 'dev edition';
    }
    if (org.isProduction) {
      return 'production';
    }
    return 'production';
  }

  /**
   * Resolves org type metadata for SOURCE/TARGET summary output.
   *
   * @param script - Script instance.
   */
  private static async _resolveOrgTypesForSummaryAsync(script: Script): Promise<void> {
    await Promise.all([
      this._resolveSingleOrgTypeForSummaryAsync(script.sourceOrg),
      this._resolveSingleOrgTypeForSummaryAsync(script.targetOrg),
    ]);
  }

  /**
   * Resolves sandbox/dev/prod/scratch flags for a single org.
   *
   * @param org - Script org metadata.
   */
  private static async _resolveSingleOrgTypeForSummaryAsync(org?: ScriptOrg): Promise<void> {
    if (!org || org.isFileMedia) {
      return;
    }
    const scriptOrg = org;

    try {
      const connection = (await scriptOrg.getConnectionAsync()) as unknown as OrgSummaryConnectionType;
      const summary = await this._queryOrganizationSummaryAsync(connection);
      if (typeof summary.OrganizationType === 'string' && summary.OrganizationType.trim().length > 0) {
        scriptOrg.organizationType = summary.OrganizationType;
      }
      if (typeof summary.IsSandbox === 'boolean') {
        scriptOrg.isSandbox = summary.IsSandbox;
      }
    } catch {
      // Keep existing defaults when organization summary cannot be resolved.
    }

    try {
      const resolvedOrg = await OrgConnectionAdapter.resolveOrgAsync(scriptOrg.name);
      scriptOrg.isScratch = resolvedOrg.isScratch();
    } catch {
      // Keep existing scratch-org flag when it cannot be resolved.
    }
  }

  /**
   * Queries Organization info needed for user-facing org type labels.
   *
   * @param connection - Active org connection.
   * @returns Organization summary fields.
   */
  private static async _queryOrganizationSummaryAsync(
    connection: OrgSummaryConnectionType
  ): Promise<OrganizationSummaryType> {
    const query = 'SELECT OrganizationType, IsSandbox FROM Organization LIMIT 1';
    if (connection.singleRecordQuery) {
      return connection.singleRecordQuery<OrganizationSummaryType>(query);
    }
    return {};
  }

  /**
   * Logs the query, delete, and update execution order.
   *
   * @param logger - Logging service instance.
   * @param job - Migration job instance.
   */
  private static _logObjectOrders(
    logger: LoggingService,
    job: MigrationJob,
    request: SfdmuRunRequestType,
    objectSetIndex: number
  ): ObjectOrderInfoType {
    const queryOrder = job.queryTasks.filter((task) => !task.scriptObject.excluded).map((task) => task.sObjectName);
    const deleteOrder = job.deleteTasks.filter((task) => !task.scriptObject.excluded).map((task) => task.sObjectName);
    const updateOrder = job.updateTasks.filter((task) => !task.scriptObject.excluded).map((task) => task.sObjectName);

    const activeTasks = job.tasks.filter((task) => !task.scriptObject.excluded);
    const deleteTaskNames = new Set(
      job.deleteTasks.filter((task) => !task.scriptObject.excluded).map((task) => task.sObjectName)
    );
    activeTasks.forEach((task) => {
      logger.logFileOnly(`{${task.sObjectName}} Final source query: ${task.scriptObject.query}`);
      logger.logFileOnly(`{${task.sObjectName}} Final target query: ${task.scriptObject.targetQuery}`);
      if (deleteTaskNames.has(task.sObjectName)) {
        logger.logFileOnly(`{${task.sObjectName}} Final delete query: ${task.scriptObject.deleteQuery}`);
      }
    });

    const columns: Array<{ key: 'query' | 'delete' | 'update'; name: string }> = [
      { key: 'query', name: 'Query Order' },
      { key: 'delete', name: 'Delete Order' },
      { key: 'update', name: 'Update Order' },
    ];
    const maxRows = Math.max(queryOrder.length, deleteOrder.length, updateOrder.length);
    const rows: Array<{ query: string; delete: string; update: string }> = [];
    if (maxRows === 0) {
      rows.push({ query: '-', delete: '-', update: '-' });
    } else {
      for (let index = 0; index < maxRows; index += 1) {
        rows.push({
          query: queryOrder[index] ?? '',
          delete: deleteOrder[index] ?? '',
          update: updateOrder[index] ?? '',
        });
      }
    }

    const tableWriter = request.tableWriter;
    const shouldRenderTable = logger.context.logLevel < LOG_LEVELS.ERROR;
    if (tableWriter && shouldRenderTable) {
      tableWriter({ data: rows, columns, overflow: 'wrap' });
    }

    logger.logFileOnly('queryingOrder');
    logger.logFileOnly(queryOrder.join(', ') || '-');
    logger.logFileOnly('deletingOrder');
    logger.logFileOnly(deleteOrder.join(', ') || '-');
    logger.logFileOnly('executionOrder');
    logger.logFileOnly(updateOrder.join(', ') || '-');

    if (!tableWriter) {
      logger.info('queryingOrder');
      logger.info(queryOrder.join(', ') || '-');
      logger.info('deletingOrder');
      logger.info(deleteOrder.join(', ') || '-');
      logger.info('executionOrder');
      logger.info(updateOrder.join(', ') || '-');
    }

    return {
      objectSetIndex,
      queryOrder,
      deleteOrder,
      updateOrder,
    };
  }

  /**
   * Finish the command based on the raised error.
   *
   * @param logger - Logging service instance.
   * @param flags - Normalized flags.
   * @param error - Error raised during execution.
   * @returns Command result payload.
   */
  private static _finishWithError(
    logger: LoggingService,
    flags: SfdmuRunFlagsType,
    error: unknown
  ): SfdmuRunResultType {
    if (error instanceof SuccessExit) {
      const finish = logger.finishCommand(
        'commandSucceededResult',
        COMMAND_EXIT_STATUSES.SUCCESS,
        this._getStatusString(COMMAND_EXIT_STATUSES.SUCCESS)
      );
      return this._attachFlags(finish, flags);
    }
    if (error instanceof CommandInitializationNoStackError) {
      const finish = logger.finishCommandErrorNoStack(
        'commandInitializationErrorResult',
        COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR,
        this._getStatusString(COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR),
        error.message
      );
      return this._attachFlags(finish, flags);
    }
    if (error instanceof CommandInitializationError) {
      const finish = logger.finishCommandErrorNoStack(
        'commandInitializationErrorResult',
        COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR,
        this._getStatusString(COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR),
        error.message
      );
      return this._attachFlags(finish, flags);
    }
    if (error instanceof OrgMetadataError) {
      const finish = logger.finishCommandWithError(
        'commandOrgMetadataErrorResult',
        COMMAND_EXIT_STATUSES.ORG_METADATA_ERROR,
        this._getStatusString(COMMAND_EXIT_STATUSES.ORG_METADATA_ERROR),
        error
      );
      return this._attachFlags(finish, flags);
    }
    if (error instanceof CommandExecutionError) {
      const finish = logger.finishCommandWithError(
        'commandExecutionErrorResult',
        COMMAND_EXIT_STATUSES.COMMAND_EXECUTION_ERROR,
        this._getStatusString(COMMAND_EXIT_STATUSES.COMMAND_EXECUTION_ERROR),
        error
      );
      return this._attachFlags(finish, flags);
    }
    if (error instanceof UnresolvableWarning) {
      const finish = logger.finishCommandWithError(
        'commandAbortedDueWarningErrorResult',
        COMMAND_EXIT_STATUSES.UNRESOLVABLE_WARNING,
        this._getStatusString(COMMAND_EXIT_STATUSES.UNRESOLVABLE_WARNING),
        error
      );
      return this._attachFlags(finish, flags);
    }
    if (error instanceof CommandAbortedByWarningError) {
      const finish = logger.finishCommandWithError(
        'commandAbortedDueWarningErrorResult',
        COMMAND_EXIT_STATUSES.WARNING_AS_ERROR,
        this._getStatusString(COMMAND_EXIT_STATUSES.WARNING_AS_ERROR),
        error
      );
      return this._attachFlags(finish, flags);
    }
    if (error instanceof CommandAbortedByUserError) {
      const finish = logger.finishCommandInfo(
        'commandAbortedByUserErrorResult',
        COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_USER,
        this._getStatusString(COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_USER)
      );
      return this._attachFlags(finish, flags);
    }
    if (error instanceof CommandAbortedByAddOnError) {
      const finish = logger.finishCommandWithError(
        'commandAbortedByAddOnErrorResult',
        COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_ADDON,
        this._getStatusString(COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_ADDON),
        error
      );
      return this._attachFlags(finish, flags);
    }

    const finish = logger.finishCommandWithError(
      'commandAbortedDueUnexpectedErrorResult',
      COMMAND_EXIT_STATUSES.COMMAND_UNEXPECTED_ERROR,
      this._getStatusString(COMMAND_EXIT_STATUSES.COMMAND_UNEXPECTED_ERROR),
      error
    );
    return this._attachFlags(finish, flags);
  }

  /**
   * Attach flags to the finish payload for command output.
   *
   * @param finish - Finish payload.
   * @param flags - Normalized flags.
   * @returns Result payload including flags.
   */
  private static _attachFlags(
    finish: FinishMessageType,
    flags: SfdmuRunFlagsType,
    objectOrders: ObjectOrderInfoType[] = []
  ): SfdmuRunResultType {
    return {
      ...finish,
      flags,
      objectOrders,
    };
  }

  /**
   * Resolve status string for the given status code.
   *
   * @param status - Status code.
   * @returns Status string.
   */
  private static _getStatusString(status: number): string {
    return this._STATUS_STRINGS.get(status) ?? 'UNKNOWN_STATUS';
  }

  /**
   * Returns true when alias/username validation must run through SF auth.
   *
   * @param aliasOrUsername - Alias or username value from CLI.
   * @param scriptOrg - Matching org definition from export.json.
   * @returns True when alias must be validated via SF auth store.
   */
  private static _shouldValidateOrgAlias(aliasOrUsername: string | undefined, scriptOrg?: ScriptOrg): boolean {
    if (!aliasOrUsername || this._isCsvFileAlias(aliasOrUsername)) {
      return false;
    }
    return !this._hasManualOrgCredentials(scriptOrg);
  }

  /**
   * Returns true when export.json org contains manual auth data.
   *
   * @param scriptOrg - Script org definition.
   * @returns True when manual auth data is present.
   */
  private static _hasManualOrgCredentials(scriptOrg?: ScriptOrg): boolean {
    if (!scriptOrg) {
      return false;
    }
    return Boolean(scriptOrg.instanceUrl?.trim()) && Boolean(scriptOrg.accessToken?.trim());
  }

  /**
   * Resolves default API version from org metadata when user did not set it explicitly.
   *
   * @param script - Script instance.
   * @param flags - Normalized flags.
   * @param logger - Logging service instance.
   */
  private static async _resolveDefaultApiVersionAsync(
    script: Script,
    flags: SfdmuRunFlagsType,
    logger: LoggingService
  ): Promise<void> {
    if (this._hasExplicitApiVersion(script, flags)) {
      return;
    }

    const [sourceVersion, targetVersion] = await Promise.all([
      this._resolveSingleOrgMaxApiVersionAsync(script.sourceOrg, logger),
      this._resolveSingleOrgMaxApiVersionAsync(script.targetOrg, logger),
    ]);

    const autoResolvedVersion = this._resolveDefaultApiVersionFromOrgs(sourceVersion, targetVersion);
    if (!autoResolvedVersion) {
      return;
    }

    const nextScript = script;
    nextScript.apiVersion = autoResolvedVersion;
    logger.verboseFile(`[diagnostic] Auto-resolved run apiVersion=${autoResolvedVersion}`);
  }

  /**
   * Returns true when apiVersion was explicitly set by user in CLI or export.json.
   *
   * @param script - Script instance.
   * @param flags - Normalized flags.
   * @returns True when apiVersion is explicit.
   */
  private static _hasExplicitApiVersion(script: Script, flags: SfdmuRunFlagsType): boolean {
    if (typeof flags.apiversion === 'string' && flags.apiversion.trim().length > 0) {
      return true;
    }

    const workingJson = script.workingJson;
    if (!isRecord(workingJson)) {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(workingJson, 'apiVersion')) {
      return false;
    }
    const value = workingJson.apiVersion;
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }
    return value !== null && typeof value !== 'undefined';
  }

  /**
   * Resolves the maximum API version for a single org.
   *
   * @param org - Script org definition.
   * @param logger - Logging service instance.
   * @returns Maximum org API version.
   */
  private static async _resolveSingleOrgMaxApiVersionAsync(
    org: ScriptOrg | undefined,
    logger: LoggingService
  ): Promise<string | undefined> {
    if (!org || org.isFileMedia) {
      return undefined;
    }
    try {
      if (this._hasManualOrgCredentials(org)) {
        return await this._resolveManualOrgMaxApiVersionAsync(org);
      }
      const version = await OrgConnectionAdapter.resolveMaxApiVersionAsync(org.name);
      return version.trim().length > 0 ? version : undefined;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.verboseFile(`[diagnostic] Failed to auto-resolve max apiVersion for org "${org.name}", reason=${message}`);
      return undefined;
    }
  }

  /**
   * Resolves a single default API version from source and target org versions.
   *
   * @param sourceVersion - Source max API version.
   * @param targetVersion - Target max API version.
   * @returns Effective default API version.
   */
  private static _resolveDefaultApiVersionFromOrgs(sourceVersion?: string, targetVersion?: string): string | undefined {
    const source = this._parseApiVersion(sourceVersion);
    const target = this._parseApiVersion(targetVersion);
    if (typeof source === 'undefined' && typeof target === 'undefined') {
      return undefined;
    }
    if (typeof source === 'undefined') {
      return targetVersion?.trim();
    }
    if (typeof target === 'undefined') {
      return sourceVersion?.trim();
    }
    return source <= target ? sourceVersion?.trim() : targetVersion?.trim();
  }

  /**
   * Resolves max API version for an org configured with manual credentials.
   *
   * @param org - Script org definition with manual auth data.
   * @returns Maximum org API version.
   */
  private static async _resolveManualOrgMaxApiVersionAsync(org: ScriptOrg): Promise<string | undefined> {
    const jsforceModule = CjsDependencyAdapters.getJsforceNode() as {
      Connection?: ManualConnectionCtorType;
    };
    const ConnectionCtor = jsforceModule.Connection;
    if (!ConnectionCtor) {
      return undefined;
    }

    const connection = new ConnectionCtor({
      instanceUrl: org.instanceUrl,
      accessToken: org.accessToken,
      maxRequest: MAX_PARALLEL_REQUESTS,
      proxyUrl: org.script?.proxyUrl ?? undefined,
    });
    return OrgConnectionAdapter.resolveMaxApiVersionFromConnectionAsync(connection);
  }

  /**
   * Parses API version string into numeric form.
   *
   * @param version - API version string.
   * @returns Parsed numeric version.
   */
  private static _parseApiVersion(version?: string): number | undefined {
    const normalized = version?.trim();
    if (!normalized) {
      return undefined;
    }
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) {
      return undefined;
    }
    return parsed;
  }

  /**
   * Returns true when the provided org alias is missing from the environment.
   *
   * @param aliasOrUsername - Alias or username value.
   * @returns True when the org is not found.
   */
  private static async _isOrgAliasMissingAsync(aliasOrUsername?: string): Promise<boolean> {
    if (!aliasOrUsername || this._isCsvFileAlias(aliasOrUsername)) {
      return false;
    }
    try {
      await OrgConnectionAdapter.resolveOrgAsync(aliasOrUsername);
      return false;
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      const message = error instanceof Error ? error.message : String(error);
      if (name === 'NamedOrgNotFoundError' || message.toLowerCase().includes('no authorization information found')) {
        return true;
      }
      throw error;
    }
  }
}
