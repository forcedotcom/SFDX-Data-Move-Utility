/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Structured command completion payload for JSON output.
 */
export type FinishMessageType = {
  /**
   * Fully qualified command name.
   */
  command: string;

  /**
   * CLI command line string.
   */
  cliCommandString: string;

  /**
   * Summary message.
   */
  message: string;

  /**
   * Full log output captured during execution.
   */
  fullLog: string[];

  /**
   * Stack trace lines when present.
   */
  stack: string[];

  /**
   * Numeric status code.
   */
  status: number;

  /**
   * Status string.
   */
  statusString: string;

  /**
   * Command start time.
   */
  startTime: Date;

  /**
   * Command start time in UTC.
   */
  startTimeUTC: Date;

  /**
   * Command end time.
   */
  endTime: Date;

  /**
   * Command end time in UTC.
   */
  endTimeUTC: Date;

  /**
   * Human readable duration.
   */
  timeElapsedString: string;
};
