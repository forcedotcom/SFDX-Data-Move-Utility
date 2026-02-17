/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { Common } from '../common/Common.js';
import {
  FILE_LOG_FILEEXTENSION,
  FILE_LOG_SUBDIRECTORY,
  LOG_LEVEL_NAMES,
  LOG_LEVELS,
  PLUGIN_NAME,
} from '../constants/Constants.js';

type LogLevelType = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

type LoggingContextOptionsType = {
  commandName: string;
  rootPath: string;
  logLevelName?: string;
  fileLogEnabled?: boolean | number;
  anonymise?: boolean;
  anonymiseValues?: string[];
  anonymiseEntries?: Array<{ value: string; label: string }>;
  anonymiseSeed?: string;
  jsonEnabled?: boolean;
  quiet?: boolean;
  silent?: boolean;
  verbose?: boolean;
  noWarnings?: boolean;
  noPrompt?: boolean;
  startTime?: Date;
  stdoutWriter?: (message: string) => void;
  stderrWriter?: (message: string) => void;
  warnWriter?: (message: string) => void;
  errorWriter?: (message: string) => void;
  jsonWriter?: (message: string) => void;
  promptWriter?: (message: string) => Promise<boolean>;
  textPromptWriter?: (message: string) => Promise<string>;
};

const resolveLogLevel = (logLevelName?: string): LogLevelType => {
  if (!logLevelName) {
    return LOG_LEVELS.TRACE;
  }
  const normalizedName = logLevelName.trim().toUpperCase();
  if (!normalizedName) {
    return LOG_LEVELS.TRACE;
  }
  if (Object.prototype.hasOwnProperty.call(LOG_LEVELS, normalizedName)) {
    return LOG_LEVELS[normalizedName as keyof typeof LOG_LEVELS];
  }
  return LOG_LEVELS.TRACE;
};

const noopWriter = (): void => undefined;
const noopPromptAsync = (message: string): Promise<boolean> => {
  void message;
  return Promise.resolve(true);
};
const noopTextPromptAsync = (message: string): Promise<string> => {
  void message;
  return Promise.resolve('');
};

/**
 * Runtime logging settings and derived paths.
 */
export default class LoggingContext {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Fully qualified command name.
   */
  public readonly commandFullName: string;

  /**
   * Base working directory.
   */
  public readonly rootPath: string;

  /**
   * Log level value.
   */
  public readonly logLevel: LogLevelType;

  /**
   * Log level name.
   */
  public readonly logLevelName: string;

  /**
   * Flag indicating JSON output mode.
   */
  public readonly jsonEnabled: boolean;

  /**
   * Flag indicating quiet output mode.
   */
  public readonly quiet: boolean;

  /**
   * Flag indicating silent output mode.
   */
  public readonly silent: boolean;

  /**
   * Flag indicating verbose mode for file logging.
   */
  public readonly verbose: boolean;

  /**
   * Flag indicating file logging is enabled.
   */
  public readonly fileLogEnabled: boolean;

  /**
   * Flag indicating file log anonymization is enabled.
   */
  public readonly anonymise: boolean;

  /**
   * Literal values to mask in file logs.
   */
  public readonly anonymiseValues: string[];

  /**
   * Labeled values to hash in file logs.
   */
  public readonly anonymiseEntries: Array<{ value: string; label: string }>;

  /**
   * Run-scoped random seed used by anonymization hashing.
   */
  public readonly anonymiseSeed: string;

  /**
   * Flag indicating warnings should be suppressed in stdout.
   */
  public readonly noWarnings: boolean;

  /**
   * Flag indicating prompts should be suppressed.
   */
  public readonly noPrompt: boolean;

  /**
   * Command start time.
   */
  public readonly startTime: Date;

  /**
   * Path to the log file.
   */
  public readonly logFilePath: string;

  /**
   * Writer used for stdout.
   */
  public readonly stdoutWriter: (message: string) => void;

  /**
   * Writer used for stderr.
   */
  public readonly stderrWriter: (message: string) => void;

  /**
   * Writer used for warnings.
   */
  public readonly warnWriter: (message: string) => void;

  /**
   * Writer used for errors.
   */
  public readonly errorWriter: (message: string) => void;

  /**
   * Writer used for JSON output.
   */
  public readonly jsonWriter: (message: string) => void;

  /**
   * Writer used for yes/no prompts.
   */
  public readonly promptWriter: (message: string) => Promise<boolean>;

  /**
   * Writer used for text prompts.
   */
  public readonly textPromptWriter: (message: string) => Promise<string>;

  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Cached file name base.
   */
  private readonly _fileBaseName: string;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new logging context.
   *
   * @param options - Context initialization options.
   */
  public constructor(options: LoggingContextOptionsType) {
    this.rootPath = options.rootPath;
    this.commandFullName = `${PLUGIN_NAME}:${options.commandName}`;
    this.startTime = options.startTime ?? new Date();
    this.logLevel = resolveLogLevel(options.logLevelName);
    this.logLevelName = LOG_LEVEL_NAMES[this.logLevel] ?? LOG_LEVEL_NAMES[LOG_LEVELS.TRACE];
    this.jsonEnabled = Boolean(options.jsonEnabled);
    this.quiet = Boolean(options.quiet);
    this.silent = Boolean(options.silent);
    this.verbose = Boolean(options.verbose);
    const fileLogFlag = options.fileLogEnabled;
    this.fileLogEnabled = !(fileLogFlag === false || fileLogFlag === 0);
    this.anonymise = Boolean(options.anonymise);
    this.anonymiseValues = Array.isArray(options.anonymiseValues)
      ? options.anonymiseValues.filter((value) => typeof value === 'string' && value.trim().length > 0)
      : [];
    this.anonymiseEntries = Array.isArray(options.anonymiseEntries)
      ? options.anonymiseEntries.filter(
          (entry) =>
            typeof entry?.value === 'string' &&
            entry.value.trim().length > 0 &&
            typeof entry?.label === 'string' &&
            entry.label.trim().length > 0
        )
      : [];
    this.anonymiseSeed = typeof options.anonymiseSeed === 'string' ? options.anonymiseSeed : '';
    this.noWarnings = Boolean(options.noWarnings);
    const suppressPromptsByLogLevel = this.logLevel >= LOG_LEVELS.ERROR;
    this.noPrompt =
      Boolean(options.noPrompt) || this.jsonEnabled || this.silent || this.quiet || suppressPromptsByLogLevel;
    this.stdoutWriter = options.stdoutWriter ?? noopWriter;
    this.stderrWriter = options.stderrWriter ?? noopWriter;
    this.warnWriter = options.warnWriter ?? this.stdoutWriter;
    this.errorWriter = options.errorWriter ?? this.stderrWriter;
    this.jsonWriter = options.jsonWriter ?? this.stdoutWriter;
    this.promptWriter = options.promptWriter ?? noopPromptAsync;
    this.textPromptWriter = options.textPromptWriter ?? noopTextPromptAsync;

    this._fileBaseName = Common.formatFileDate(this.startTime);
    this.logFilePath = path.join(
      this.rootPath,
      FILE_LOG_SUBDIRECTORY,
      `${this._fileBaseName}.${FILE_LOG_FILEEXTENSION}`
    );
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Returns true when stdout should be written.
   *
   * @returns True when stdout is enabled.
   */
  public shouldWriteStdout(): boolean {
    return !this.quiet && !this.silent && !this.jsonEnabled;
  }
}
