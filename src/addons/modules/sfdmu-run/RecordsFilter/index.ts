/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import SfdmuRunAddonModule from "../../../components/sfdmu-run/sfdmuRunAddonModule";
import AddonResult from "../../../components/common/addonResult";
import IAddonContext from "../../../components/common/IAddonContext";
import { ADDON_EVENTS } from "../../../../modules/components/common_components/enumerations";
import { SFDMU_RUN_ADDON_MESSAGES } from "../../../messages/sfdmuRunAddonMessages";



interface IOnExecuteArguments {

}

const CONST = {
  SUPPORTED_EVENTS: [
    ADDON_EVENTS.onTargetDataFiltering
  ]
};

export default class RecordsFilter extends SfdmuRunAddonModule {

  async onExecute(context: IAddonContext, args: IOnExecuteArguments): Promise<AddonResult> {

    // Output startup message
    this.runtime.logAddonExecutionStarted(this);

    // Verify the current event
    if (!this.runtime.validateSupportedEvents(this, CONST.SUPPORTED_EVENTS)) {
      this.runtime.logFormattedWarning(this,
        SFDMU_RUN_ADDON_MESSAGES.General_EventNotSupported,
        context.eventName,
        context.moduleDisplayName,
        CONST.SUPPORTED_EVENTS.join());
      return null;
    }



    // Output shoutdown message
    this.runtime.logAddonExecutionFinished(this);

    return null;
  }

}
