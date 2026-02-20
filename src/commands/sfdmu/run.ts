/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { FILE_LOG_DEFAULT, PLUGIN_NAME, RUN_MESSAGE_BUNDLE } from '../../modules/constants/Constants.js';
import SfdmuRunService from '../../modules/run/SfdmuRunService.js';
import type { SfdmuRunFlagsType } from '../../modules/run/models/SfdmuRunFlagsType.js';
import type { SfdmuRunRequestType } from '../../modules/run/models/SfdmuRunRequestType.js';
import type { SfdmuRunResultType } from '../../modules/run/models/SfdmuRunResultType.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages(PLUGIN_NAME, RUN_MESSAGE_BUNDLE);

/**
 * Normalize parsed CLI flags into a strictly typed object.
 *
 * @param flags - Parsed flags from oclif.
 * @returns Typed flags for the run service.
 */
const mapFlags = (flags: SfdmuRunFlagsType): SfdmuRunFlagsType => ({
  sourceusername: flags.sourceusername,
  targetusername: flags.targetusername,
  path: flags.path,
  silent: flags.silent,
  quiet: flags.quiet,
  diagnostic: flags.diagnostic,
  anonymise: flags.anonymise,
  verbose: false,
  concise: flags.concise,
  logfullquery: flags.logfullquery,
  apiversion: flags.apiversion,
  filelog: flags.filelog,
  json: flags.json,
  noprompt: flags.noprompt,
  nowarnings: flags.nowarnings,
  failonwarning: flags.failonwarning,
  canmodify: flags.canmodify,
  simulation: flags.simulation,
  loglevel: flags.loglevel,
  usesf: flags.usesf,
  version: flags.version,
});

/**
 * Normalize argv values into a string array for storage.
 *
 * @param argv - Raw argv values from oclif.
 * @returns Normalized argv values as strings.
 */
const normalizeArgv = (argv: unknown[]): string[] => argv.map((value) => String(value));

/**
 * sfdmu run command implementation.
 */
export default class Run extends SfCommand<SfdmuRunResultType> {
  // ------------------------------------------------------//
  // -------------------- STATIC MEMBERS ------------------ //
  // ------------------------------------------------------//

  /**
   * Summary text for CLI help.
   */
  public static readonly summary = messages.getMessage('summary');

  /**
   * Description text for CLI help.
   */
  public static readonly description = messages.getMessage('description');

  /**
   * Example usage snippets for CLI help.
   */
  public static readonly examples = messages.getMessages('examples');

  /**
   * CLI flags for the sfdmu run command.
   */
  public static readonly flags = {
    sourceusername: Flags.string({
      char: 's',
      summary: messages.getMessage('flags.sourceusername.summary'),
      description: messages.getMessage('flags.sourceusername.description'),
    }),
    targetusername: Flags.string({
      char: 'u',
      summary: messages.getMessage('flags.targetusername.summary'),
      description: messages.getMessage('flags.targetusername.description'),
    }),
    path: Flags.string({
      char: 'p',
      summary: messages.getMessage('flags.path.summary'),
      description: messages.getMessage('flags.path.description'),
    }),
    silent: Flags.boolean({
      summary: messages.getMessage('flags.silent.summary'),
      description: messages.getMessage('flags.silent.description'),
    }),
    quiet: Flags.boolean({
      summary: messages.getMessage('flags.quiet.summary'),
      description: messages.getMessage('flags.quiet.description'),
    }),
    diagnostic: Flags.boolean({
      summary: messages.getMessage('flags.diagnostic.summary'),
      description: messages.getMessage('flags.diagnostic.description'),
    }),
    anonymise: Flags.boolean({
      summary: messages.getMessage('flags.anonymise.summary'),
      description: messages.getMessage('flags.anonymise.description'),
    }),
    verbose: Flags.boolean({
      summary: messages.getMessage('flags.verbose.summary'),
      description: messages.getMessage('flags.verbose.description'),
    }),
    concise: Flags.boolean({
      summary: messages.getMessage('flags.concise.summary'),
      description: messages.getMessage('flags.concise.description'),
    }),
    logfullquery: Flags.boolean({
      summary: messages.getMessage('flags.logfullquery.summary'),
      description: messages.getMessage('flags.logfullquery.description'),
    }),
    apiversion: Flags.string({
      summary: messages.getMessage('flags.apiversion.summary'),
      description: messages.getMessage('flags.apiversion.description'),
    }),
    filelog: Flags.integer({
      char: 'l',
      summary: messages.getMessage('flags.filelog.summary'),
      description: messages.getMessage('flags.filelog.description'),
      default: FILE_LOG_DEFAULT,
    }),
    noprompt: Flags.boolean({
      char: 'n',
      summary: messages.getMessage('flags.noprompt.summary'),
      description: messages.getMessage('flags.noprompt.description'),
    }),
    nowarnings: Flags.boolean({
      char: 'w',
      summary: messages.getMessage('flags.nowarnings.summary'),
      description: messages.getMessage('flags.nowarnings.description'),
    }),
    failonwarning: Flags.boolean({
      summary: messages.getMessage('flags.failonwarning.summary'),
      description: messages.getMessage('flags.failonwarning.description'),
    }),
    canmodify: Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.canmodify.summary'),
      description: messages.getMessage('flags.canmodify.description'),
    }),
    simulation: Flags.boolean({
      char: 'm',
      summary: messages.getMessage('flags.simulation.summary'),
      description: messages.getMessage('flags.simulation.description'),
    }),
    loglevel: Flags.string({
      summary: messages.getMessage('flags.loglevel.summary'),
      description: messages.getMessage('flags.loglevel.description'),
    }),
    usesf: Flags.boolean({
      summary: messages.getMessage('flags.usesf.summary'),
      description: messages.getMessage('flags.usesf.description'),
    }),
    version: Flags.boolean({
      char: 'v',
      summary: messages.getMessage('flags.version.summary'),
      description: messages.getMessage('flags.version.description'),
    }),
  };

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ------------------ //
  // ------------------------------------------------------//

  /**
   * Command entry point required by oclif.
   *
   * @returns The command result payload.
   */
  public run(): Promise<SfdmuRunResultType> {
    return this._runAsync();
  }

  // ------------------------------------------------------//
  // ------------------- PRIVATE METHODS ------------------ //
  // ------------------------------------------------------//

  /**
   * Async command implementation.
   *
   * @returns The command result payload.
   */
  private async _runAsync(): Promise<SfdmuRunResultType> {
    const parsed = await this.parse(Run);
    const flags = mapFlags(parsed.flags);
    const jsonWriter = flags.json ? (): void => undefined : this.logJson.bind(this);
    const textPromptWriter = async (message: string): Promise<string> => {
      const rl = createInterface({ input, output });
      try {
        return await rl.question(message ?? '');
      } finally {
        rl.close();
      }
    };
    const request: SfdmuRunRequestType = {
      argv: normalizeArgv(parsed.argv),
      flags,
      stdoutWriter: this.log.bind(this),
      stderrWriter: this.logToStderr.bind(this),
      warnWriter: this.warn.bind(this),
      errorWriter: (message: string) => {
        this.logToStderr(message);
      },
      jsonWriter,
      promptWriter: (message: string) => this.confirm({ message }),
      textPromptWriter,
      tableWriter: this.table.bind(this),
    };
    const result = await SfdmuRunService.executeAsync(request);
    process.exitCode = result.status;
    return result;
  }
}
