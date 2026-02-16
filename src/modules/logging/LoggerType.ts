/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Logger contract required by shared utilities.
 */
export type LoggerType = {
  /**
   * Log a message with optional tokens.
   *
   * @param message - Base message or key.
   * @param tokens - Optional token values.
   */
  log(message: string, ...tokens: string[]): void;

  /**
   * Log a message with a specific color.
   *
   * @param message - Base message or key.
   * @param color - Color name.
   * @param tokens - Optional token values.
   */
  logColored(message: string, color: LogColorType, ...tokens: string[]): void;

  /**
   * Log a warning with optional tokens.
   *
   * @param message - Base message or key.
   * @param tokens - Optional token values.
   */
  warn(message: string, ...tokens: string[]): void;

  /**
   * Log an error with optional tokens.
   *
   * @param message - Base message or key.
   * @param tokens - Optional token values.
   */
  error(message: string, ...tokens: string[]): void;

  /**
   * Log a verbose file-only message.
   *
   * @param message - Base message or key.
   * @param tokens - Optional token values.
   */
  verboseFile(message: string, ...tokens: string[]): void;

  /**
   * Prompt for a yes/no confirmation.
   *
   * @param message - Prompt message.
   * @returns True when confirmed.
   */
  yesNoPromptAsync(message: string): Promise<boolean>;

  /**
   * Prompt for a text input value.
   *
   * @param message - Prompt message.
   * @returns User input string.
   */
  textPromptAsync(message: string): Promise<string>;

  /**
   * Resolve a resource string with tokens.
   *
   * @param resource - Resource key.
   * @param tokens - Optional token values.
   * @returns Formatted message.
   */
  getResourceString(resource: string, ...tokens: string[]): string;
};

/**
 * Supported log colors for console output.
 */
export type LogColorType = 'green' | 'blue' | 'yellow' | 'red' | 'none';
