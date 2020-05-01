/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as models from "../../modules/models";

import { FlagsConfig, SfdxCommand, flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';

import { AnyJson } from '@salesforce/ts-types';
import {
    MessageUtils,
    RESOURCES,
    COMMAND_EXIT_STATUSES
} from "../../modules/components/messages";
import { RunCommand } from "../../modules/commands_processors/runCommand";
import { CommonUtils } from "../../modules/components/commonUtils";


Messages.importMessagesDirectory(__dirname);

const commandMessages = Messages.loadMessages('sfdmu', 'run');
const resources = Messages.loadMessages('sfdmu', 'resources');


export default class Run extends SfdxCommand {

    command: RunCommand;

    protected static supportsUsername = true;
    protected static requiresUsername = false;
    protected static varargs = false;

    public static description = commandMessages.getMessage('commandDescription');
    public static longDescription = commandMessages.getMessage('commandLongDescription');

    // NOTE: Add deprecation to the command if neededsfdx sfdmu:
    // public static deprecated = {
    //     version: 47,
    //     to: 'force:package:create'
    // };

    protected static flagsConfig: FlagsConfig = {
        sourceusername: flags.string({
            char: "s",
            description: commandMessages.getMessage('sourceusernameFlagDescription'),
            longDescription: commandMessages.getMessage('sourceusernameFlagLongDescription'),
            default: '',
            // NOTE: Add deprecation to the flag if needed
            // deprecated: {
            //     version: 43,
            //     to: 'force:package:create'
            // },
        }),
        path: flags.directory({
            char: 'p',
            description: commandMessages.getMessage('pathFlagDescription'),
            longDescription: commandMessages.getMessage('pathFlagLongDescription'),
            default: '',
            // NOTE: Add deprecation to the flag if needed
            // deprecated: {
            //     version: 43,
            //     to: 'force:package:create'
            // },
        }),
        encryptkey: flags.string({
            description: commandMessages.getMessage('encryptKeyFlagDescription'),
            longDescription: commandMessages.getMessage('encryptKeyFlagLongDescription'),
            default: '',
            // NOTE: Add deprecation to the flag if needed
            // deprecated: {
            //     version: 43,
            //     to: 'force:package:create'
            // },
        }),
        verbose: flags.builtin({
            description: commandMessages.getMessage('verboseFlagDescription'),
            longDescription: commandMessages.getMessage('verboseFlagLongDescription')
        }),
        concise: flags.builtin({
            description: commandMessages.getMessage('conciseFlagDescription'),
            longDescription: commandMessages.getMessage('conciseFlagLongDescription'),
        }),
        quiet: flags.builtin({
            description: commandMessages.getMessage('quietFlagDescription'),
            longDescription: commandMessages.getMessage('quietFlagLongDescription'),
        }),
        silent: flags.boolean({
            description: commandMessages.getMessage("silentFlagDescription"),
            longDescription: commandMessages.getMessage("silentFlagLongDescription")
        }),
        version: flags.boolean({
            description: commandMessages.getMessage("versionFlagDescription"),
            longDescription: commandMessages.getMessage("versionFlagLongDescription"),
            // NOTE: Add deprecation to the flag if needed
            // deprecated: {
            //     version: 43,
            //     to: 'force:package:create'
            // },
        }),
        apiversion: flags.builtin({
            description: commandMessages.getMessage("apiversionFlagDescription"),
            longDescription: commandMessages.getMessage("apiversionFlagLongDescription")
        }),
        filelog: flags.boolean({
            description: commandMessages.getMessage("filelogFlagDescription"),
            longDescription: commandMessages.getMessage("filelogFlagLongDescription"),
            // NOTE: Add deprecation to the flag if needed
            // deprecated: {
            //     version: 43,
            //     to: 'force:package:create'
            // },
        }),
        noprompt: flags.boolean({
            description: commandMessages.getMessage("nopromptFlagDescription"),
            longDescription: commandMessages.getMessage("nopromptLongFlagDescription")
        }),
        json: flags.boolean({
            description: commandMessages.getMessage("jsonFlagDescription"),
            longDescription: commandMessages.getMessage("jsonLongFlagDescription"),
            default: false
        }),
        nowarnings: flags.boolean({
            description: commandMessages.getMessage("nowarningsFlagDescription"),
            longDescription: commandMessages.getMessage("nowarningsLongFlagDescription")
        }),

    };


    public async run(): Promise<AnyJson> {

        this.ux["isOutputEnabled"] = true;

        this.flags.verbose = this.flags.verbose && !this.flags.json;
        this.flags.quiet = this.flags.quiet || this.flags.silent || this.flags.version;
        this.flags.filelog = this.flags.filelog && !this.flags.version;

        let logger = new MessageUtils(
            resources,
            commandMessages,
            this.ux,
            this.statics,
            this.flags.loglevel,
            this.flags.path,
            this.flags.verbose,
            this.flags.concise,
            this.flags.quiet,
            this.flags.json,
            this.flags.noprompt,
            this.flags.nowarnings,
            this.flags.filelog);

        try {

            // Process --version flag
            if (this.flags.version) {

                let pinfo = CommonUtils.getPluginInfo(this.statics);

                // Exit - success
                logger.commandExitMessage(
                    RESOURCES.pluginVersion,
                    COMMAND_EXIT_STATUSES.SUCCESS,
                    undefined,
                    pinfo.pluginName, pinfo.version);

                process.exit(COMMAND_EXIT_STATUSES.SUCCESS);
                // --
            }

            if (!this.flags.sourceusername) {
                throw new models.CommandInitializationError(commandMessages.getMessage('errorMissingRequiredFlag', ['--sourceusername']));
            }

            if (!this.flags.targetusername) {
                throw new models.CommandInitializationError(commandMessages.getMessage('errorMissingRequiredFlag', ['--targetusername']));
            }

            let commandResult: any;
            this.command = new RunCommand(logger, this.flags.path, this.flags.sourceusername, this.flags.targetusername, this.flags.apiversion);

            await this.command.setupAsync();
            await this.command.createJobAsync();
            await this.command.validateCSVFiles();

            // Exit - success
            logger.commandExitMessage(
                commandResult || RESOURCES.successfullyCompletedResult,
                COMMAND_EXIT_STATUSES.SUCCESS);

            process.exit(COMMAND_EXIT_STATUSES.SUCCESS);
            // --

        } catch (e) {

            // Exit - error
            switch (e.constructor) {

                case models.SuccessExit:
                    logger.commandExitMessage(
                        RESOURCES.successfullyCompletedResult,
                        COMMAND_EXIT_STATUSES.SUCCESS);
                    process.exit(COMMAND_EXIT_STATUSES.SUCCESS);


                case models.CommandInitializationError:
                    logger.commandExitMessage(
                        RESOURCES.commandInitializationErrorResult,
                        COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR);


                case models.OrgMetadataError:
                    logger.commandExitMessage(
                        RESOURCES.orgMetadataErrorResult,
                        COMMAND_EXIT_STATUSES.ORG_METADATA_ERROR,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.ORG_METADATA_ERROR);


                case models.CommandExecutionError:
                    logger.commandExitMessage(
                        RESOURCES.commandExecutionErrorResult,
                        COMMAND_EXIT_STATUSES.COMMAND_EXECUTION_ERROR,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.COMMAND_EXECUTION_ERROR);


                case models.UnresolvableWarning:
                    logger.commandExitMessage(
                        RESOURCES.commandUnresolvableWarningResult,
                        COMMAND_EXIT_STATUSES.UNRESOLWABLE_WARNING, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.UNRESOLWABLE_WARNING);


                case models.CommandAbortedByUserError:
                    logger.commandExitMessage(
                        RESOURCES.commandAbortedByUserErrorResult,
                        COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_USER,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_USER);


                default:
                    logger.commandExitMessage(
                        RESOURCES.commandUnexpectedErrorResult,
                        COMMAND_EXIT_STATUSES.COMMAND_UNEXPECTED_ERROR,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.COMMAND_UNEXPECTED_ERROR);

            }
            // --
        }

        return {};
    }
}


