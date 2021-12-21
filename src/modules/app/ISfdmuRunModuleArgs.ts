/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { IRunProcess } from "../commands_processors/IRunProcess";
import { IResourceBundle, IUxLogger } from "../components/common_components/logger";

export default interface ISfdmuRunModuleArgs {
    argv: Array<string>;
    runProcess?: IRunProcess;
    logger?: IUxLogger;
    exportJson?: string; 
    commandMessages?: IResourceBundle;
    resources?: IResourceBundle;
    exitProcess?: boolean;
}