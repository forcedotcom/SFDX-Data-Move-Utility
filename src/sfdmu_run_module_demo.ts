/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import SfdmuRunApp from "./modules/app/sfdmuRunApp";

const app = new SfdmuRunApp([
    // The 2 first members of the array should always be empty
    "", 
    "",
    
    // list of the CLI flags
    "--path",
    "C:\\Path_To_The_Export_Json",
    "--sourceusername",
    "source@mail.com",
    "--targetusername",
    "target@mail.com"
]);
(async () => await app.runCommand())();