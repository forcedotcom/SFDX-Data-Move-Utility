/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ISfdmuAddonInfo } from ".";




/**
 * Contains the information about the Sfdmu Plugin.
 */
export default interface ISfdmuRunCustomAddonPluginInfo {

      /**
      *  The Plugin name (f.ex. ```sfdmu```).
      */
      pluginName: string,

      /**
       * The executed command (f.ex. ```run```).
       */
      commandName: string,

      /**
       * The current version of the running Plugin (f.ex. ```5.0.0```).
       */
      version: string,

      /**
       * Path to the directory where the Sfdmu Plugin is installed.
       */
      path: string,

      /**
       * Full CLI command string used to run the command (f.ex ```sfdx sfdmu:run --sourceusername my-source@mail.com --targetusername my-target@mail.com```)
       */
      commandString: string,

      /**
       * The array of CLI arguments
       * @example
       * ```ts
       * ['--sourceusername', 'my-source@mail.com', '--targetusername', 'my-target@mail.com'];
       * ```
       */
      argv: string[],

      /**
       * Contains the information about the current version of the Add-On Api 
       * related to the sfdmu:run command.
       *
       * @type {ISfdmuAddonApiInfo}
       * @memberof ISfdmuRunCustomAddonPluginInfo
       */
      runAddOnApiInfo: ISfdmuAddonInfo
}