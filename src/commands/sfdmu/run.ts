/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */



import { FlagsConfig, SfdxCommand, flags } from '@salesforce/command';
import { Messages } from '@salesforce/core';

import { AnyJson } from '@salesforce/ts-types';
import {
    Logger,
    RESOURCES,
    COMMAND_EXIT_STATUSES
} from "../../modules/components/common_components/logger";
import { RunCommand } from "../../modules/commands_processors/runCommand";
import { Common } from "../../modules/components/common_components/common";
import { CommandInitializationError, SuccessExit, OrgMetadataError, CommandExecutionError, UnresolvableWarning, CommandAbortedByUserError } from "../../modules/models/common_models/errors";
import { ADDON_MODULE_METHODS } from '../../modules/components/common_components/enumerations';
import { CONSTANTS } from '../../modules/components/common_components/statics';



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

    // TODO: Add deprecation to the command if neededsfdx sfdmu:
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
            // TODO: Add deprecation to the flag if needed
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
            // TODO: Add deprecation to the flag if needed
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
            // TODO: Add deprecation to the flag if needed
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
            // TODO: Add deprecation to the flag if needed
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
        canmodify: flags.string({
            char: "c",
            description: commandMessages.getMessage('canModifyFlagDescription'),
            longDescription: commandMessages.getMessage('canModifyFlagLongDescription'),
            default: '',
            // TODO: Add deprecation to the flag if needed
            // deprecated: {
            //     version: 43,
            //     to: 'force:package:create'
            // },
        })

    };


    public async run(): Promise<AnyJson> {

        this.ux["isOutputEnabled"] = true;

        this.flags.verbose = this.flags.verbose && !this.flags.json;
        this.flags.quiet = this.flags.quiet || this.flags.silent || this.flags.version;
        this.flags.filelog = this.flags.filelog && !this.flags.version;

        Common.logger = new Logger(
            resources,
            commandMessages,
            this.ux,
            this,
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

            let pinfo = Common.getPluginInfo(this);

            // Process --version flag
            if (this.flags.version) {

                // Exit - success
                Common.logger.commandExitMessage(
                    RESOURCES.pluginVersion,
                    COMMAND_EXIT_STATUSES.SUCCESS,
                    undefined,
                    pinfo.pluginName, pinfo.version);

                process.exit(COMMAND_EXIT_STATUSES.SUCCESS);
                // --
            }

            // At least one of the flags is required. 
            // The second is always the default one.
            if (!this.flags.sourceusername && !this.flags.targetusername) {
                throw new CommandInitializationError(commandMessages.getMessage('errorMissingRequiredFlag', ['--targetusername']));
            }

            if (!this.flags.sourceusername) {
                this.flags.sourceusername = CONSTANTS.DEFAULT_ORG_MEDIA_TYPE;
            }

            if (!this.flags.targetusername) {
                this.flags.targetusername = CONSTANTS.DEFAULT_ORG_MEDIA_TYPE;
            }

            let commandResult: any;
            this.command = new RunCommand(pinfo,
                Common.logger,
                this.flags.path,
                this.flags.sourceusername,
                this.flags.targetusername,
                this.flags.apiversion,
                this.flags.canmodify);

            await this.command.setupAsync();
            await this.command.createJobAsync();
            await this.command.processCSVFilesAsync();
            await this.command.prepareJobAsync();
            await this.command.runAddonEvent(ADDON_MODULE_METHODS.onBefore);
            await this.command.executeJobAsync();
            await this.command.runAddonEvent(ADDON_MODULE_METHODS.onAfter);

            // Exit - success
            Common.logger.commandExitMessage(
                commandResult || RESOURCES.successfullyCompletedResult,
                COMMAND_EXIT_STATUSES.SUCCESS);

            process.exit(COMMAND_EXIT_STATUSES.SUCCESS);
            // --

        } catch (e) {

            // Exit - errors
            switch (e.constructor) {

                case SuccessExit:
                    Common.logger.commandExitMessage(
                        RESOURCES.successfullyCompletedResult,
                        COMMAND_EXIT_STATUSES.SUCCESS);
                    process.exit(COMMAND_EXIT_STATUSES.SUCCESS);


                case CommandInitializationError:
                    Common.logger.commandExitMessage(
                        RESOURCES.commandInitializationErrorResult,
                        COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR);


                case OrgMetadataError:
                    Common.logger.commandExitMessage(
                        RESOURCES.orgMetadataErrorResult,
                        COMMAND_EXIT_STATUSES.ORG_METADATA_ERROR,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.ORG_METADATA_ERROR);


                case CommandExecutionError:
                    Common.logger.commandExitMessage(
                        RESOURCES.commandExecutionErrorResult,
                        COMMAND_EXIT_STATUSES.COMMAND_EXECUTION_ERROR,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.COMMAND_EXECUTION_ERROR);


                case UnresolvableWarning:
                    Common.logger.commandExitMessage(
                        RESOURCES.commandUnresolvableWarningResult,
                        COMMAND_EXIT_STATUSES.UNRESOLWABLE_WARNING, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.UNRESOLWABLE_WARNING);


                case CommandAbortedByUserError:
                    Common.logger.commandExitMessage(
                        RESOURCES.commandAbortedByUserErrorResult,
                        COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_USER,
                        e.stack, e.message);
                    process.exit(COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_USER);


                default:
                    Common.logger.commandExitMessage(
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


