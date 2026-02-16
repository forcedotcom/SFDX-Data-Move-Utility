/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { TableOptions } from '@oclif/table';
import type { OrgConnectionPairType } from '../../org/models/OrgConnectionPairType.js';
import type { SfdmuRunFlagsType } from './SfdmuRunFlagsType.js';

/**
 * Input payload for the sfdmu run command service.
 */
export type SfdmuRunRequestType = {
  /**
   * Raw argv values passed to the command.
   */
  argv: string[];

  /**
   * Parsed command flags.
   */
  flags: SfdmuRunFlagsType;

  /**
   * Resolved orgs for the run command.
   */
  orgs?: OrgConnectionPairType;

  /**
   * Optional stdout writer for command output.
   */
  stdoutWriter?: (message: string) => void;

  /**
   * Optional stderr writer for command output.
   */
  stderrWriter?: (message: string) => void;

  /**
   * Optional warning writer for command output.
   */
  warnWriter?: (message: string) => void;

  /**
   * Optional error writer for command output.
   */
  errorWriter?: (message: string) => void;

  /**
   * Optional JSON writer for command output.
   */
  jsonWriter?: (message: string) => void;

  /**
   * Optional yes/no prompt writer for command output.
   */
  promptWriter?: (message: string) => Promise<boolean>;

  /**
   * Optional text prompt writer for command output.
   */
  textPromptWriter?: (message: string) => Promise<string>;

  /**
   * Optional table writer for command output.
   */
  tableWriter?: <RowType extends Record<string, unknown>>(options: TableOptions<RowType>) => void;
};
