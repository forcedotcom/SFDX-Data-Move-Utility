/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ISfdmuRunCustomAddonCommandRunInfo,
} from '../../../addons/modules/sfdmu-run/custom-addons/package';
import IPluginInfo from './IPluginInfo';

type ICommandRunInfoBase = ISfdmuRunCustomAddonCommandRunInfo;


/**
 * The information about currently running SFDMU command
 */
export default interface ICommandRunInfo extends ICommandRunInfoBase {

    /**
     * the information about the Plugin and the framework
     */
    readonly pinfo: IPluginInfo
}
