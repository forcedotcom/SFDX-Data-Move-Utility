/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import ISfdmuRunModuleArgs from "./modules/app/ISfdmuRunModuleArgs";
import SfdmuRunApp from "./modules/app/sfdmuRunApp";

const args: ISfdmuRunModuleArgs = {
    argv: process.argv
};

const application = new SfdmuRunApp(args);
(async () => await application.runCommand())();





