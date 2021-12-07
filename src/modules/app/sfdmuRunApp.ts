/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


//import { RunCommand } from "./modules/commands_processors/runCommand";
//import { Logger } from "./modules/components/common_components/logger";
//import { Common } from "./modules/components/common_components/common";

import ISfdmuCommand from "../models/common_models/ISfdxCommand";
import { RunCommand } from "../commands_processors/runCommand";
import JsonMessages from './JsonMessages';
import ConsoleLogger from './consoleUxLogger';

import * as path from 'path';
import { IRunProcess } from "../commands_processors/IRunProcess";
import { IResourceBundle, IUxLogger } from "../components/common_components/logger";
import ISfdmuStatics from "../models/common_models/ISfdmuStatics";
import RunCommandExecutor from "../commands_processors/runCommandExecutor";

const root = path.resolve(__dirname, '../../../');
const commandMessages = new JsonMessages(root, "run");
const resources = new JsonMessages(root, "resources");
const minimist = require('minimist');


export default class SfdmuRunApp implements IRunProcess {

    argv: Array<string>;

    cmd: ISfdmuCommand;
    command: RunCommand;
    statics: ISfdmuStatics;

    m_ux: IUxLogger = new ConsoleLogger();
    m_flags: any = {};

    commandMessages: IResourceBundle = commandMessages;
    resources: IResourceBundle = resources;

    constructor(argv: Array<string>) {
        this.argv = argv.splice(2);
        let flags = minimist(this.argv);
        Object.assign(this.m_flags, flags);
        this.statics = {
            name: "Run",
            plugin: {
                name: "sfdmu",
                root
            }
        };
        this.cmd = {
            statics: this.statics,
            argv: this.argv
        };
    }

    async runCommand(): Promise<any> {
        await RunCommandExecutor.execute(this);
    }

}