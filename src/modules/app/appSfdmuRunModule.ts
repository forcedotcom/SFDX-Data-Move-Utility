/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import IAppSfdmuRunModuleArgs from "./IAppSfdmuRunModuleArgs";
import AppSfdmuRunApp from "./appSfdmuRunApp";


export class AppSfdmuRunModule {

    public static async runCommand(args: IAppSfdmuRunModuleArgs) {
        args.runProcess = new AppSfdmuRunApp(args);
        await args.runProcess.runCommand();
    }

}
