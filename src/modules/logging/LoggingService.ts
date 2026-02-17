/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Messages } from '@salesforce/core';
import { Common } from '../common/Common.js';
import {
  DEFAULT_USER_PROMPT_TEXT_ENTER_TIMEOUT_MS,
  DEFAULT_USER_PROMPT_TIMEOUT_MS,
  LOGGING_MESSAGE_BUNDLE,
  LOG_LEVELS,
  PLUGIN_NAME,
} from '../constants/Constants.js';
import type { LogColorType } from './LoggerType.js';
import FileLoggingService from './FileLoggingService.js';
import LogFileAnonymizer from './LogFileAnonymizer.js';
import LoggingContext from './LoggingContext.js';
import type { FinishMessageType } from './models/FinishMessageType.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const loggingMessages = Messages.loadMessages(PLUGIN_NAME, LOGGING_MESSAGE_BUNDLE);

type LogTokensType = Array<string | number | boolean | null | undefined>;
type LogLevelType = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

/**
 * Logging service with legacy formatting.
 */
export default class LoggingService {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Bound logging context.
   */
  public readonly context: LoggingContext;

  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * File logger for plain log output.
   */
  private readonly _fileLogger: FileLoggingService | null;

  /**
   * Numeric log level threshold.
   */
  private readonly _logLevelValue: LogLevelType;

  /**
   * Cached log lines for JSON output.
   */
  private readonly _messageCache: string[] = [];

  /**
   * Messages bundle for logging.
   */
  private readonly _messages = loggingMessages;

  /**
   * File log anonymizer.
   */
  private readonly _fileLogAnonymizer: LogFileAnonymizer;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a logging service instance.
   *
   * @param context - Logging context configuration.
   */
  public constructor(context: LoggingContext) {
    this.context = context;
    this._logLevelValue = context.logLevel;
    this._fileLogger = context.fileLogEnabled ? new FileLoggingService(context.logFilePath) : null;
    this._fileLogAnonymizer = new LogFileAnonymizer({
      enabled: context.anonymise,
      maskedValues: context.anonymiseValues,
      maskedEntries: context.anonymiseEntries,
      seed: context.anonymiseSeed,
    });
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Logs a message using info level.
   *
   * @param message - Message key or text.
   * @param tokens - Optional token values.
   */
  public log(message: string, ...tokens: string[]): void {
    this.logColored(message, 'blue', ...tokens);
  }

  /**
   * Logs a message using info level with a custom color.
   *
   * @param message - Message key or text.
   * @param color - Color override.
   * @param tokens - Optional token values.
   */
  public logColored(message: string, color: LogColorType, ...tokens: string[]): void {
    this._writeLog(LOG_LEVELS.INFO, message, tokens, color);
  }

  /**
   * Logs an informational message.
   *
   * @param message - Message key or text.
   * @param tokens - Optional token values.
   */
  public info(message: string, ...tokens: LogTokensType): void {
    this._writeLog(LOG_LEVELS.INFO, message, tokens, 'blue');
  }

  /**
   * Logs a warning message.
   *
   * @param message - Message key or text.
   * @param tokens - Optional token values.
   */
  public warn(message: string, ...tokens: LogTokensType): void {
    this._writeLog(LOG_LEVELS.WARN, message, tokens);
  }

  /**
   * Logs an error message.
   *
   * @param message - Message key or text.
   * @param tokens - Optional token values.
   */
  public error(message: string, ...tokens: LogTokensType): void {
    this._writeLog(LOG_LEVELS.ERROR, message, tokens);
  }

  /**
   * Logs a message only to the file log and JSON cache (no stdout).
   *
   * @param message - Message key or text.
   * @param tokens - Optional token values.
   */
  public logFileOnly(message: string, ...tokens: LogTokensType): void {
    if (!this._fileLogger || !this.context.fileLogEnabled) {
      return;
    }

    const resolvedMessage = this.getMessage(message, ...tokens);
    if (!resolvedMessage) {
      return;
    }

    const date = this.getMessage('formattedDateLogTemplate', Common.formatDateTimeShort(new Date()));
    const formattedFile = this._formatFileLine(LOG_LEVELS.INFO, date, resolvedMessage);
    const formattedStdout = this._formatLogLine(LOG_LEVELS.INFO, date, resolvedMessage);

    this._writeToFile(formattedFile, resolvedMessage);
    this._cacheMessage(LOG_LEVELS.INFO, formattedStdout);
  }

  /**
   * Logs a verbose message only to the file log (no stdout).
   *
   * @param message - Message key or text.
   * @param tokens - Optional token values.
   */
  public verboseFile(message: string, ...tokens: LogTokensType): void {
    if (!this.context.verbose || !this._fileLogger || !this.context.fileLogEnabled) {
      return;
    }

    const resolvedMessage = this.getMessage(message, ...tokens);
    if (!resolvedMessage) {
      return;
    }
    if (resolvedMessage === '\n') {
      this._fileLogger.appendLine('\n');
      return;
    }

    const date = this.getMessage('formattedDateLogTemplate', Common.formatDateTimeShort(new Date()));
    const formattedFile = this._formatFileLine(LOG_LEVELS.INFO, date, resolvedMessage);
    this._writeToFile(formattedFile, resolvedMessage);
  }

  /**
   * Resolves a message key using the logging bundle.
   *
   * @param key - Message key or literal text.
   * @param tokens - Optional token values.
   * @returns Resolved message.
   */
  public getResourceString(key: string, ...tokens: string[]): string {
    return this.getMessage(key, ...tokens);
  }

  /**
   * Returns default answer for yes/no prompts when prompting is suppressed.
   *
   * @param message - Prompt message.
   * @returns True when the prompt is accepted.
   */
  public async yesNoPromptAsync(message: string): Promise<boolean> {
    const promptMessage = this._formatConfirmPrompt(message);
    if (this.context.noPrompt) {
      const defaultAnswer = this.getMessage('defaultNopromptOption');
      this.warn(`${promptMessage} ${defaultAnswer}`.trim());
      this._logPromptMessageToFile(promptMessage);
      this._logPromptAnswerToFile(defaultAnswer);
      return true;
    }
    this._logPromptMessageToFile(promptMessage);
    const response = await this._runPromptWithTimeoutAsync(
      () => this.context.promptWriter(promptMessage),
      DEFAULT_USER_PROMPT_TIMEOUT_MS,
      true
    );
    const answer = response ? this.getMessage('defaultNopromptOption') : this.getMessage('defaultPromptNoOption');
    this._logPromptAnswerToFile(answer);
    return response;
  }

  /**
   * Prompts the user for a text input value.
   *
   * @param message - Prompt message key or text.
   * @returns User input string.
   */
  public async textPromptAsync(message: string): Promise<string> {
    const promptMessage = this._formatTextPrompt(message);
    if (this.context.noPrompt) {
      this.warn(promptMessage);
      this._logPromptMessageToFile(promptMessage);
      this._logPromptAnswerToFile('');
      return '';
    }
    this.warn(promptMessage);
    const response = await this._runPromptWithTimeoutAsync(
      () => this.context.textPromptWriter(''),
      DEFAULT_USER_PROMPT_TEXT_ENTER_TIMEOUT_MS,
      ''
    );
    this._logPromptAnswerToFile(response);
    return response;
  }

  /**
   * Completes the command and writes JSON output when enabled.
   *
   * @param message - Result message key or text.
   * @param status - Numeric status code.
   * @param statusString - Status string.
   * @param stack - Optional stack trace.
   * @param tokens - Optional token values.
   * @returns Completion payload.
   */
  public finishCommand(
    message: string,
    status: number,
    statusString: string,
    stack?: string,
    ...tokens: LogTokensType
  ): FinishMessageType {
    return this._finishCommandInternal(message, status, statusString, stack, false, tokens);
  }

  /**
   * Completes the command and logs the result as info.
   *
   * @param message - Result message key or text.
   * @param status - Numeric status code.
   * @param statusString - Status string.
   * @param stack - Optional stack trace.
   * @param tokens - Optional token values.
   * @returns Completion payload.
   */
  public finishCommandInfo(
    message: string,
    status: number,
    statusString: string,
    stack?: string,
    ...tokens: LogTokensType
  ): FinishMessageType {
    return this._finishCommandInternal(message, status, statusString, stack, true, tokens);
  }

  /**
   * Completes the command and logs the result as error without a stack trace.
   *
   * @param message - Result message key or text.
   * @param status - Numeric status code.
   * @param statusString - Status string.
   * @param tokens - Optional token values.
   * @returns Completion payload.
   */
  public finishCommandErrorNoStack(
    message: string,
    status: number,
    statusString: string,
    ...tokens: LogTokensType
  ): FinishMessageType {
    return this._finishCommandInternal(message, status, statusString, undefined, false, tokens, LOG_LEVELS.ERROR);
  }

  /**
   * Completes the command using exception details.
   *
   * @param message - Result message key or text.
   * @param status - Numeric status code.
   * @param statusString - Status string.
   * @param error - Exception instance.
   * @returns Completion payload.
   */
  public finishCommandWithError(
    message: string,
    status: number,
    statusString: string,
    error: unknown
  ): FinishMessageType {
    const errorInfo = this._normalizeError(error);
    return this.finishCommand(message, status, statusString, errorInfo.stack, errorInfo.message);
  }

  public getMessage(key: string, ...tokens: LogTokensType): string {
    if (!key) {
      return '';
    }
    try {
      const normalizedTokens = tokens.map((token) => this._sanitizeLogToken(token));
      return this._messages.getMessage(key, normalizedTokens).replace(/\\n/g, '\n');
    } catch {
      return key;
    }
  }

  /**
   * Returns captured log lines.
   *
   * @returns Cached log lines.
   */
  public getCachedMessages(): string[] {
    return [...this._messageCache];
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Executes a prompt with a timeout and default fallback.
   *
   * @param action - Prompt callback.
   * @param timeoutMs - Timeout in milliseconds.
   * @param defaultValue - Value returned on timeout.
   * @returns Prompt result.
   */
  private async _runPromptWithTimeoutAsync<T>(
    action: () => Promise<T>,
    timeoutMs: number,
    defaultValue: T
  ): Promise<T> {
    void this;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return action();
    }
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutHandle = setTimeout(() => resolve(defaultValue), timeoutMs);
    });
    try {
      return await Promise.race([action(), timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Builds the finish payload and logs the result message.
   *
   * @param message - Result message key or text.
   * @param status - Numeric status code.
   * @param statusString - Status string.
   * @param stack - Optional stack trace.
   * @param forceInfo - True to always log info.
   * @param tokens - Optional token values.
   * @returns Completion payload.
   */
  private _finishCommandInternal(
    message: string,
    status: number,
    statusString: string,
    stack: string | undefined,
    forceInfo: boolean,
    tokens: LogTokensType,
    forceLevel?: LogLevelType
  ): FinishMessageType {
    const endTime = new Date();
    const resolvedMessage = this.getMessage(message, ...tokens);
    const timeElapsedString = Common.timeDiffString(this.context.startTime, endTime);

    const resultLevel = forceLevel ?? (status === 0 || forceInfo ? LOG_LEVELS.INFO : LOG_LEVELS.ERROR);
    this._writeLog(LOG_LEVELS.INFO, 'jobCompletedHeader', [], 'green');

    if (resultLevel === LOG_LEVELS.WARN) {
      this.warn(resolvedMessage);
    } else if (status === 0 || forceInfo) {
      this.info(resolvedMessage);
    } else {
      this.error(resolvedMessage);
    }
    if (stack && status !== 0) {
      this.logFileOnly(this.getMessage('traceLogTemplate', stack));
    }
    this._writeLog(
      LOG_LEVELS.INFO,
      this.getMessage('commandFinishTemplate', this.context.commandFullName, String(status), statusString),
      [],
      'blue'
    );
    this._writeLog(LOG_LEVELS.INFO, this.getMessage('timeElapsedLogTemplate', timeElapsedString), [], 'blue');

    const result: FinishMessageType = {
      command: this.context.commandFullName,
      cliCommandString: Common.getFullCommandLine(),
      message: resolvedMessage,
      fullLog: [...this._messageCache],
      stack: stack ? stack.split('\n') : [],
      status,
      statusString,
      startTime: Common.convertUTCDateToLocalDate(this.context.startTime),
      startTimeUTC: this.context.startTime,
      endTime: Common.convertUTCDateToLocalDate(endTime),
      endTimeUTC: endTime,
      timeElapsedString,
    };

    if (this.context.jsonEnabled) {
      const jsonPayload = JSON.stringify(result, null, 3);
      if (this._shouldWriteJsonStdout()) {
        this.context.jsonWriter(jsonPayload);
      }
      return result;
    }

    return result;
  }

  /**
   * Sanitizes token values before logging to avoid platform-specific escape sequences.
   *
   * @param token - Token to sanitize.
   * @returns Sanitized token.
   */
  private _sanitizeLogToken(token: LogTokensType[number]): LogTokensType[number] {
    void this;
    if (typeof token !== 'string') {
      return token;
    }
    if (!token.includes('\\') && !token.includes('\n') && !token.includes('\r') && !token.includes('\t')) {
      return token;
    }
    const normalized = token.replace(/\\/g, '/');
    const collapsed = normalized.replace(/\/{2,}/g, '/');
    return collapsed.replace(/\r?\n/g, ' ').replace(/\t/g, ' ');
  }

  /**
   * Writes a formatted log entry.
   *
   * @param level - Log level.
   * @param message - Message key or literal text.
   * @param tokens - Optional token values.
   */
  private _writeLog(level: LogLevelType, message: string, tokens: LogTokensType, color?: LogColorType): void {
    if (!this._shouldLog(level)) {
      return;
    }

    const resolvedMessage = this.getMessage(message, ...tokens);
    const date = resolvedMessage
      ? this.getMessage('formattedDateLogTemplate', Common.formatDateTimeShort(new Date()))
      : '';
    const formattedStdout = this._formatLogLine(level, date, resolvedMessage, color);
    const formattedFile = this._formatFileLine(level, date, resolvedMessage);

    this._writeToStdout(level, formattedStdout);
    this._writeToFile(formattedFile, resolvedMessage);
    this._cacheMessage(level, formattedStdout);
  }

  /**
   * Formats log entry for stdout.
   *
   * @param level - Log level.
   * @param date - Formatted date.
   * @param message - Resolved message.
   * @returns Formatted message.
   */
  private _formatLogLine(level: LogLevelType, date: string, message: string, color?: LogColorType): string {
    if (!message) {
      return '';
    }
    let formatted: string;
    switch (level) {
      case LOG_LEVELS.ERROR:
        formatted = this.getMessage('errorLogTemplate', date, message);
        break;
      case LOG_LEVELS.WARN:
        formatted = this.getMessage('warnLogTemplate', date, message);
        break;
      default:
        formatted = this.getMessage('infoLogTemplate', date, message);
        break;
    }

    if (this.context.jsonEnabled) {
      return formatted;
    }

    const resolvedColor = color ?? this._resolveDefaultColor(level);
    const colorCode = this._resolveColorCode(resolvedColor);
    if (!colorCode) {
      return formatted;
    }
    return `${colorCode}${formatted}\u001b[0m`;
  }

  /**
   * Resolves the default color for a log level.
   *
   * @param level - Log level.
   * @returns Color name or undefined.
   */
  private _resolveDefaultColor(level: LogLevelType): LogColorType | undefined {
    void this;
    if (level === LOG_LEVELS.ERROR) {
      return 'red';
    }
    if (level === LOG_LEVELS.WARN) {
      return 'yellow';
    }
    return 'blue';
  }

  /**
   * Resolves ANSI color code for a color name.
   *
   * @param color - Color name.
   * @returns ANSI code or undefined.
   */
  private _resolveColorCode(color?: LogColorType): string | undefined {
    void this;
    switch (color) {
      case 'none':
        return undefined;
      case 'green':
        return '\u001b[32m';
      case 'yellow':
        return '\u001b[33m';
      case 'red':
        return '\u001b[31m';
      case 'blue':
        return '\u001b[34m';
      default:
        return undefined;
    }
  }

  /**
   * Formats log entry for the file logger.
   *
   * @param level - Log level.
   * @param date - Formatted date.
   * @param message - Resolved message.
   * @returns Formatted file line.
   */
  private _formatFileLine(level: LogLevelType, date: string, message: string): string {
    if (!message) {
      return '\n';
    }
    switch (level) {
      case LOG_LEVELS.ERROR:
        return this.getMessage('errorFileLogTemplate', date, message);
      case LOG_LEVELS.WARN:
        return this.getMessage('warnFileLogTemplate', date, message);
      default:
        return this.getMessage('infoFileLogTemplate', date, message);
    }
  }

  /**
   * Writes to stdout or stderr based on level.
   *
   * @param level - Log level.
   * @param message - Formatted message.
   */
  private _writeToStdout(level: LogLevelType, message: string): void {
    if (!message || !this.context.shouldWriteStdout()) {
      return;
    }
    if (level === LOG_LEVELS.WARN) {
      if (this.context.noWarnings) {
        return;
      }
      this.context.warnWriter(message);
      return;
    }
    if (level >= LOG_LEVELS.ERROR) {
      this.context.errorWriter(message);
      return;
    }
    this.context.stdoutWriter(message);
  }

  /**
   * Writes to the file logger when enabled.
   *
   * @param message - Formatted file line.
   * @param resolvedMessage - Resolved log message.
   */
  private _writeToFile(message: string, resolvedMessage: string): void {
    if (!this._fileLogger || !this.context.fileLogEnabled) {
      return;
    }
    const fileMessage = this._fileLogAnonymizer.anonymize(message);
    if (!resolvedMessage) {
      this._fileLogger.appendLine(fileMessage);
      return;
    }
    this._fileLogger.appendLine(fileMessage);
  }

  /**
   * Appends the log line to the JSON cache when allowed.
   *
   * @param level - Log level.
   * @param message - Formatted message.
   */
  private _cacheMessage(level: LogLevelType, message: string): void {
    if (!message) {
      return;
    }
    if (level === LOG_LEVELS.WARN && this.context.noWarnings) {
      return;
    }
    this._messageCache.push(message);
  }

  /**
   * Determines whether JSON should be written to stdout.
   *
   * @returns True when JSON should be written.
   */
  private _shouldWriteJsonStdout(): boolean {
    return this.context.jsonEnabled && !this.context.quiet && !this.context.silent;
  }

  /**
   * Evaluates log level against the configured threshold.
   *
   * @param level - Log level to evaluate.
   * @returns True when the log should be recorded.
   */
  private _shouldLog(level: LogLevelType): boolean {
    return level >= this._logLevelValue;
  }

  /**
   * Normalizes an exception into message and stack data.
   *
   * @param error - Exception instance.
   * @returns Normalized error info.
   */
  private _normalizeError(error: unknown): { message: string; stack?: string } {
    void this.context;
    if (error instanceof Error) {
      return {
        message: error.message || error.name,
        stack: error.stack,
      };
    }
    let message = 'Unknown error';
    let stack: string | undefined;

    if (typeof error === 'string') {
      message = error;
    } else if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
      message = String(error);
    } else if (typeof error === 'object' && error !== null) {
      const candidate = error as { message?: unknown; stack?: unknown };
      if (typeof candidate.message === 'string' && candidate.message) {
        message = candidate.message;
      }
      if (typeof candidate.stack === 'string' && candidate.stack) {
        stack = candidate.stack;
      }
      if (message === 'Unknown error') {
        try {
          message = JSON.stringify(error);
        } catch {
          message = 'Unknown error';
        }
      }
    }

    if (!stack) {
      stack = new Error(message).stack;
    }
    return {
      message,
      stack,
    };
  }

  /**
   * Formats a yes/no prompt message with legacy templates.
   *
   * @param message - Prompt message key or text.
   * @returns Formatted prompt message.
   */
  private _formatConfirmPrompt(message: string): string {
    const date = this.getMessage('formattedDateLogTemplate', Common.formatDateTimeShort(new Date()));
    const baseMessage = this.getMessage(message);
    const options = this.getMessage('defaultPromptOptions');
    const composed = `${date} ${baseMessage}`.trim();
    return this.getMessage('userConfirmTemplate', composed, options);
  }

  /**
   * Formats a text input prompt message with legacy templates.
   *
   * @param message - Prompt message key or text.
   * @returns Formatted prompt message.
   */
  private _formatTextPrompt(message: string): string {
    const date = this.getMessage('formattedDateLogTemplate', Common.formatDateTimeShort(new Date()));
    const baseMessage = this.getMessage(message);
    const composed = `${date} ${baseMessage}`.trim();
    return this.getMessage('userTextInputTemplate', composed);
  }

  /**
   * Writes a prompt message to the file log.
   *
   * @param promptMessage - Formatted prompt message.
   */
  private _logPromptMessageToFile(promptMessage: string): void {
    const safeMessage = String(this._sanitizeLogToken(promptMessage) ?? '');
    this._logPromptLine(LOG_LEVELS.WARN, `PROMPT: ${safeMessage}`);
  }

  /**
   * Writes a prompt answer to the file log.
   *
   * @param answer - Answer value to log.
   */
  private _logPromptAnswerToFile(answer: string): void {
    const safeAnswer = String(this._sanitizeLogToken(answer) ?? '');
    this._logPromptLine(LOG_LEVELS.WARN, `PROMPT ANSWER: ${safeAnswer}`);
  }

  /**
   * Writes a prompt-related line to the file log and JSON cache.
   *
   * @param level - Log level to record.
   * @param message - Prompt log message.
   */
  private _logPromptLine(level: LogLevelType, message: string): void {
    if (!this._fileLogger || !this.context.fileLogEnabled) {
      return;
    }

    const date = this.getMessage('formattedDateLogTemplate', Common.formatDateTimeShort(new Date()));
    const formattedFile = this._formatFileLine(level, date, message);
    const formattedStdout = this._formatLogLine(level, date, message);

    this._writeToFile(formattedFile, message);
    this._cacheMessage(level, formattedStdout);
  }
}
