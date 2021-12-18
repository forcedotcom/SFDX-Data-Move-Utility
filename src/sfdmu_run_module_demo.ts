/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import ISfdmuRunModuleArgs from "./modules/app/ISfdmuRunModuleArgs";
import SfdmuRunApp from "./modules/app/sfdmuRunApp";

const args: ISfdmuRunModuleArgs = {
    argv: [
         // The 2 first members of the array should always be empty
    "", 
    "",
    
    // list of the CLI flags
    "--path",
    "C:\\PathToExportJson",
    "--sourceusername",
    "source@mymail.com",
    "--targetusername",
    "target@mymail.com",
    "--verbose"
    ]
};

const app = new SfdmuRunApp(args);
(async () => await app.runCommand())();