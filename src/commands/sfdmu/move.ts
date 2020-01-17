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

export default class Move extends SfdxCommand {

    protected static supportsUsername = true;
    protected static varargs = true;

    app: Application;

    protected static flagsConfig: FlagsConfig = {
        sourceusername: flags.string({
            char: "s",
            description: "User name for the source org",
            default: ''
        }),
        password:  flags.string({
            char: "p",
            description: "Password to encrypt/decrypt the credentials",
            default: ''
        })
    };

    public async run(): Promise<AnyJson> {

        try {

            this.app = new Application(this.ux);

            this.varargs.path = this.varargs.path || "";
            
            this.app.uxLogStart();

            if (!this.flags.sourceusername) {
                throw new SfdmModels.PluginInitError("Missing --sourceusername flag");
            }

            let baseDir = this.varargs.path.toString();

            await this.app.initApplication(baseDir, this.flags.targetusername, this.flags.sourceusername, this.flags.password);

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

        } finally{
            process.exit();
        }
        
        return {};
    }

}