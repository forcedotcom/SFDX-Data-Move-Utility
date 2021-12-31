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
import { BadWordsFilter } from "./BadWordsFilter";
import { IRecordsFilter, IRecordsFilterArgs } from "./IRecordsFilter";



// Arguments passed from the export.json
export interface IOnExecuteArguments extends IRecordsFilterArgs { }

// Supported events
const CONST = {
  SUPPORTED_EVENTS: [
    ADDON_EVENTS.onTargetDataFiltering
  ]
};

// The mapping between the string filter type to the proper fitler class type
type Constructor<T> = new (...args: any[]) => T;

const filterFactory = <T>(
  args: IOnExecuteArguments,
  module: SfdmuRunAddonModule,
  RecordsFilterConstructor: Constructor<T>
): T => new RecordsFilterConstructor(args, module);


const filterFactoryMap: Map<string, (args: IOnExecuteArguments, module: SfdmuRunAddonModule) => IRecordsFilter> = new Map<string, (args: IOnExecuteArguments, module: SfdmuRunAddonModule) => IRecordsFilter>([
  ['BadWords', (args, module) => filterFactory(args, module, BadWordsFilter)]
])


// Module
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

    // Create filter factory
    const filterFactory = filterFactoryMap.get(args.filterType);
    if (!filterFactory) {
      this.runtime.logFormattedError(this, SFDMU_RUN_ADDON_MESSAGES.FilterUnknown, args.filterType);
      return null;
    }


    // Create filter
    try {
      let filterInstance: IRecordsFilter = filterFactory(args, this);

      // Ensure filter initialized
      if (filterInstance.isInitialized) {
        // Execute filter
        const task = this.runtime.getPluginTask(this);
        if (task) {
          task.tempRecords = await filterInstance.filterRecords(task.tempRecords);
        }
      }
    } catch (ex: any) {
      this.runtime.logFormattedError(this, SFDMU_RUN_ADDON_MESSAGES.FilterOperationError, args.filterType, ex.message);
    }

    // Output shoutdown message
    this.runtime.logAddonExecutionFinished(this);

    return null;
  }

  async onInit(context: IAddonContext, args: IOnExecuteArguments): Promise<AddonResult> {
    this.context.moduleDisplayName += ':' + (args.filterType || 'UnknownFilter');
    return null;
  }


}
