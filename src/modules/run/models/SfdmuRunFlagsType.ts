/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Parsed CLI flags for the sfdmu run command.
 */
export type SfdmuRunFlagsType = {
  /**
   * Username or alias for the source org, or 'csvfile'.
   */
  sourceusername?: string;

  /**
   * Username or alias for the target org, or 'csvfile'.
   */
  targetusername?: string;

  /**
   * Path to the directory that contains export.json.
   */
  path?: string;

  /**
   * Suppress standard output.
   */
  silent?: boolean;

  /**
   * Suppress standard output while still logging to file.
   */
  quiet?: boolean;

  /**
   * Enables diagnostic file logging.
   */
  diagnostic?: boolean;

  /**
   * Masks sensitive values in file logs.
   */
  anonymise?: boolean;

  /**
   * Legacy verbose flag retained for backward compatibility (unused).
   */
  verbose?: boolean;

  /**
   * Legacy concise flag retained for backward compatibility.
   */
  concise?: boolean;

  /**
   * Output the full SOQL query in logs.
   */
  logfullquery?: boolean;

  /**
   * Override the API version.
   */
  apiversion?: string;

  /**
   * Enable or disable file logging.
   */
  filelog?: number;

  /**
   * Output JSON result payload.
   */
  json?: boolean;

  /**
   * Suppress prompts.
   */
  noprompt?: boolean;

  /**
   * Suppress warnings.
   */
  nowarnings?: boolean;

  /**
   * Abort execution on the first warning and return warning-as-error status.
   */
  failonwarning?: boolean;

  /**
   * Allow modifications in production without prompt.
   */
  canmodify?: string;

  /**
   * Run in simulation mode.
   */
  simulation?: boolean;

  /**
   * Set the log level for file output.
   */
  loglevel?: string;

  /**
   * Legacy SFDX/SF switch retained for backward compatibility.
   */
  usesf?: boolean;

  /**
   * Display the CLI version.
   */
  version?: boolean;
};
