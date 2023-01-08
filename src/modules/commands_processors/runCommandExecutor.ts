/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Common } from '../components/common_components/common';
import { ADDON_EVENTS } from '../components/common_components/enumerations';
import {
  COMMAND_EXIT_STATUSES,
  LOG_MESSAGE_TYPE,
  LOG_MESSAGE_VERBOSITY,
  Logger,
  RESOURCES,
} from '../components/common_components/logger';
import {
  CommandAbortedByAddOnError,
  CommandAbortedByUserError,
  CommandExecutionError,
  CommandInitializationError,
  OrgMetadataError,
  SuccessExit,
  UnresolvableWarning,
} from '../models';
import ISfdmuCommand from '../models/common_models/ISfdxCommand';
import { IRunProcess } from './IRunProcess';
import { RunCommand } from './runCommand';

export default class RunCommandExecutor {

  static async execute(runProcess: IRunProcess): Promise<any> {

    runProcess.m_flags.verbose = runProcess.m_flags.verbose && !runProcess.m_flags.json;
    runProcess.m_flags.quiet = runProcess.m_flags.quiet || runProcess.m_flags.silent || runProcess.m_flags.version;
    runProcess.m_flags.filelog = !!runProcess.m_flags.filelog && !runProcess.m_flags.version;
    runProcess.m_flags.commandoutput = runProcess.m_flags.version;

    runProcess.cmd = {
      statics: runProcess["statics"],
      argv: runProcess.argv
    } as ISfdmuCommand;

    Common.logger = new Logger(
      runProcess.resources,
      runProcess.commandMessages,
      runProcess.m_ux,
      runProcess.cmd,
      runProcess.m_flags.loglevel,
      runProcess.m_flags.path,
      runProcess.m_flags.verbose,
      runProcess.m_flags.concise,
      runProcess.m_flags.quiet,
      runProcess.m_flags.json,
      runProcess.m_flags.noprompt,
      runProcess.m_flags.nowarnings,
      runProcess.m_flags.filelog,
      runProcess.m_flags.commandoutput);

    try {

      let pinfo = Common.getPluginInfo(runProcess.cmd);

      // Process --version flag
      if (runProcess.m_flags.version) {

        // Exit - success
        Common.logger.log(
          RESOURCES.pluginVersion,
          LOG_MESSAGE_TYPE.STDOUT_ONLY,
          LOG_MESSAGE_VERBOSITY.ALWAYS,
          pinfo.pluginName, pinfo.version);
        Common.logger.commandFinishMessage("", COMMAND_EXIT_STATUSES.SUCCESS);

        runProcess.exitProcess && process.exit(COMMAND_EXIT_STATUSES.SUCCESS);
        // --
      }

      // At least one of the orgs is required to be specified.
      // If missing, the second org will be the same one.
      if (!runProcess.m_flags.sourceusername && !runProcess.m_flags.targetusername) {
        throw new CommandInitializationError(runProcess.commandMessages.getMessage('errorMissingRequiredFlag', ['--sourceusername, --targetusername']));
      }

      if (!runProcess.m_flags.sourceusername) {
        runProcess.m_flags.sourceusername = runProcess.m_flags.targetusername;
      }

      if (!runProcess.m_flags.targetusername) {
        runProcess.m_flags.targetusername = runProcess.m_flags.sourceusername;
      }

      let commandResult: any;
      runProcess.command = new RunCommand(pinfo,
        Common.logger,
        runProcess.m_flags.path,
        runProcess.m_flags.sourceusername,
        runProcess.m_flags.targetusername,
        runProcess.m_flags.apiversion,
        runProcess.m_flags.canmodify,
        runProcess.m_flags.simulation,
        runProcess.exportJson);

      const objectSetsAmount = await runProcess.command.loadAsync();

      for (let objectSetIndex = 0; objectSetIndex < objectSetsAmount; objectSetIndex++) {
        await runProcess.command.setupObjectSetAsync(objectSetIndex);
        await runProcess.command.createJobAsync();
        await runProcess.command.processCSVFilesAsync();
        await runProcess.command.prepareJobAsync();
        await runProcess.command.runAddonEventAsync(ADDON_EVENTS.onBefore);
        await runProcess.command.executeJobAsync();
        await runProcess.command.runAddonEventAsync(ADDON_EVENTS.onAfter);
      }

      // Exit - success
      Common.logger.commandFinishMessage(
        commandResult || RESOURCES.commandSucceededResult,
        COMMAND_EXIT_STATUSES.SUCCESS);

      runProcess.exitProcess && process.exit(COMMAND_EXIT_STATUSES.SUCCESS);
      // --

    } catch (e: any) {

      // Exit - errors
      switch (e.constructor) {

        case SuccessExit:
          Common.logger.commandFinishMessage(
            RESOURCES.commandSucceededResult,
            COMMAND_EXIT_STATUSES.SUCCESS);
          runProcess.exitProcess && process.exit(COMMAND_EXIT_STATUSES.SUCCESS);


        case CommandInitializationError:
          Common.logger.commandFinishMessage(
            RESOURCES.commandInitializationErrorResult,
            COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR,
            e.stack, e.message);
          runProcess.exitProcess && process.exit(COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR);


        case OrgMetadataError:
          Common.logger.commandFinishMessage(
            RESOURCES.commandOrgMetadataErrorResult,
            COMMAND_EXIT_STATUSES.ORG_METADATA_ERROR,
            e.stack, e.message);
          runProcess.exitProcess && process.exit(COMMAND_EXIT_STATUSES.ORG_METADATA_ERROR);


        case CommandExecutionError:
          Common.logger.commandFinishMessage(
            RESOURCES.commandExecutionErrorResult,
            COMMAND_EXIT_STATUSES.COMMAND_EXECUTION_ERROR,
            e.stack, e.message);
          runProcess.exitProcess && process.exit(COMMAND_EXIT_STATUSES.COMMAND_EXECUTION_ERROR);


        case UnresolvableWarning:
          Common.logger.commandFinishMessage(
            RESOURCES.commandAbortedDueWarningErrorResult,
            COMMAND_EXIT_STATUSES.UNRESOLWABLE_WARNING, e.message);
          runProcess.exitProcess && process.exit(COMMAND_EXIT_STATUSES.UNRESOLWABLE_WARNING);


        case CommandAbortedByUserError:
          Common.logger.commandFinishMessage(
            RESOURCES.commandAbortedByUserErrorResult,
            COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_USER,
            e.stack, e.message);
          runProcess.exitProcess && process.exit(COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_USER);

        case CommandAbortedByAddOnError:
          Common.logger.commandFinishMessage(
            RESOURCES.commandAbortedByAddOnErrorResult,
            COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_ADDON,
            e.stack, e.message);
          runProcess.exitProcess && process.exit(COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_ADDON);


        default:
          Common.logger.commandFinishMessage(
            RESOURCES.commandAbortedDueUnexpectedErrorResult,
            COMMAND_EXIT_STATUSES.COMMAND_UNEXPECTED_ERROR,
            e.stack, e.message);
          runProcess.exitProcess && process.exit(COMMAND_EXIT_STATUSES.COMMAND_UNEXPECTED_ERROR);

      }
      // --
    }

    return {};
  }

}
