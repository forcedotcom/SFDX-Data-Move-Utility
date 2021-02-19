/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export default interface IPluginInfo {
    // The Plugin name (f.ex. sfdmu)
    pluginName: string,
    // The executed command (f.ex. run)
    commandName: string,
    // Version of the Plugin (f.ex. 5.0.0)
    version: string,
    // Path to the directory where the Sfdmu Plugin is installed
    path: string,
    // Full CLI string used to run the command (sfdx sfdmu:run --sourceusername a@mail.com --targetusername b@mail.com)
    commandString: string,
    // The array of CLI arguments ('--sourceusername', 'a@mail.com', '--targetusername', 'b@mail.com')
    argv: string[]
}