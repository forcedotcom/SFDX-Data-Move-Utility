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
    IUxLogger,
    IResourceBundle
} from "../../modules/components/common_components/logger";
import { RunCommand } from "../../modules/commands_processors/runCommand";
import ISfdmuCommand from '../../modules/models/common_models/ISfdxCommand';
import { IRunProcess } from '../../modules/commands_processors/IRunProcess';
import RunCommandExecutor from '../../modules/commands_processors/runCommandExecutor';



Messages.importMessagesDirectory(__dirname);

const commandMessages = Messages.loadMessages('sfdmu', 'run');
const resources = Messages.loadMessages('sfdmu', 'resources');

export default class Run extends SfdxCommand implements IRunProcess {

   
    m_flags: any;
    m_ux: IUxLogger;   

    cmd: ISfdmuCommand;
    command: RunCommand;

    commandMessages: IResourceBundle = commandMessages;
    resources: IResourceBundle = resources;

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

    public static readonly flagsConfig: FlagsConfig = {
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

        this.m_flags = this.flags;
        this.m_ux = this.ux;     

        await RunCommandExecutor.execute(this);

        return {};
    }

    runCommand(): Promise<any> {
        throw new Error('Method not implemented.');
    }
    
}


