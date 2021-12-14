/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import { IResourceBundle, IUxLogger } from "../components/common_components/logger";
import ISfdmuCommand from "../models/common_models/ISfdxCommand";
import { RunCommand } from "./runCommand";

export interface IRunProcess {
    argv: Array<string>;
    command: RunCommand;
    cmd: ISfdmuCommand;
    m_ux: IUxLogger;
    m_flags: any;
    commandMessages: IResourceBundle;
    resources: IResourceBundle;
    runCommand(): Promise<any>;
}