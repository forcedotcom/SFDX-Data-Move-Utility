/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */


import SfdmuRunApp from "./modules/app/sfdmuRunApp";

const application = new SfdmuRunApp(process.argv);
(async () => await application.runCommand())();





