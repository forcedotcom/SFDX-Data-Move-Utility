/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as SfdmModels from "../../modules/models";
import { flags, SfdxCommand, FlagsConfig } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { Application } from '../../modules/app';


Messages.importMessagesDirectory(__dirname);
const messages = Messages.loadMessages('sfdmu', 'move');

export default class Move extends SfdxCommand {

    protected static supportsUsername = true;
    protected static requiresUsername = false;

    protected static varargs = false;

    public static description = messages.getMessage('commandDescription');

    protected static flagsConfig: FlagsConfig = {
        sourceusername: flags.string({
            char: "s",
            description: messages.getMessage('sourceusernameFlagDescription'),
            required: true
        }),
        path: flags.directory({
            char: "f",
            description: messages.getMessage('pathFlagDescription'),
            default: ''
        }),
        password: flags.string({
            char: "p",
            description: messages.getMessage('passwordFlagDescription'),
            default: ''
        })
    };

    app: Application;

    public async run(): Promise<AnyJson> {

        try {

            this.app = new Application(this.ux);

            this.app.uxLogStart();

            if (!this.flags.targetusername) {
                throw new SfdmModels.PluginInitError(messages.getMessage('errorMissinRequiredFlag', ['--targetusername']));
            }

            await this.app.initApplication(this.flags.path, this.flags.targetusername, this.flags.sourceusername, this.flags.password);

            await this.app.initJob();

            await this.app.executeJob();

            this.app.uxLogEnd();

            this.ux.stopSpinner("Processing");

        } catch (e) {

            var errorString = e.toString().replace("Error:", "");

            switch (e.constructor) {
                case SfdmModels.MetadataError: this.app.uxLog(`Org metadata error: ${errorString}`, false, true); break;
                case SfdmModels.ScriptError: this.app.uxLog(`Script error: ${errorString}`, false, true); break;
                case SfdmModels.FileSystemError: this.app.uxLog(`File error: ${errorString}`, false, true); break;
                case SfdmModels.PluginInitError: this.app.uxLog(`Plugin initialization error: ${errorString}`, false, true); break;
                case SfdmModels.JobError: this.app.uxLog(`Job execution error: ${errorString}`, false, true); break;
                case SfdmModels.JobAbortedByUser: this.app.uxLog(`Job was aborted by the user: ${errorString}`, false, true); break;
                default: this.app.uxLog(`Unexpected runtime error: ${errorString}`, false, true);
            }

            this.app.uxLogEnd();

        } finally {
            process.exit();
        }

        return {};
    }

}
