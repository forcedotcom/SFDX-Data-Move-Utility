/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ADDON_EVENTS } from '../../../../common/Enumerations.js';
import type {
  ISfdmuRunCustomAddonContext,
  ISfdmuRunCustomAddonModule,
  ISfdmuRunCustomAddonResult,
  ISfdmuRunCustomAddonRuntime,
} from '../../../../../../custom-addon-sdk/interfaces/index.js';
import AddonResult from '../../../models/AddonResult.js';
import BadWordsFilter from './BadWordsFilter.js';
import type { IRecordsFilter, IRecordsFilterArgs } from './IRecordsFilter.js';

type OnExecuteArgumentsType = IRecordsFilterArgs;

type FilterFactoryType = (args: OnExecuteArgumentsType, module: ISfdmuRunCustomAddonModule) => IRecordsFilter;

const SUPPORTED_EVENTS: ADDON_EVENTS[] = [ADDON_EVENTS.filterRecordsAddons];

const createBadWordsFilter = (args: OnExecuteArgumentsType, module: ISfdmuRunCustomAddonModule): IRecordsFilter =>
  new BadWordsFilter(args, module);

const FILTER_FACTORY_MAP = new Map<string, FilterFactoryType>([['BadWords', createBadWordsFilter]]);

/**
 * Core records filter add-on.
 */
export default class RecordsFilter implements ISfdmuRunCustomAddonModule {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Execution context assigned by the add-on manager.
   */
  public context: ISfdmuRunCustomAddonContext;

  /**
   * Runtime instance provided by the add-on manager.
   */
  public runtime: ISfdmuRunCustomAddonRuntime;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new records filter add-on.
   *
   * @param runtime - Runtime instance provided by the plugin.
   */
  public constructor(runtime: ISfdmuRunCustomAddonRuntime) {
    this.runtime = runtime;
    this.context = {
      eventName: '',
      moduleDisplayName: '',
      objectName: '',
      objectDisplayName: '',
      description: '',
    };
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Executes the filter add-on.
   *
   * @param context - Add-on context.
   * @param args - Add-on arguments.
   * @returns Add-on result.
   */
  public async onExecute(
    context: ISfdmuRunCustomAddonContext,
    args: Record<string, unknown>
  ): Promise<ISfdmuRunCustomAddonResult> {
    this.runtime.logAddonExecutionStarted(this);

    if (!this.runtime.validateSupportedEvents(this, SUPPORTED_EVENTS)) {
      this.runtime.logFormattedWarning(
        this,
        'General_EventNotSupported',
        context.eventName,
        context.moduleDisplayName,
        SUPPORTED_EVENTS.join()
      );
      this.runtime.logAddonExecutionFinished(this);
      return new AddonResult();
    }

    const normalizedArgs = this._normalizeArgs(args);
    if (!normalizedArgs) {
      this.runtime.logFormattedWarning(this, 'General_ArgumentsCannotBeParsed');
      this.runtime.logAddonExecutionFinished(this);
      return new AddonResult();
    }

    const filterFactory = FILTER_FACTORY_MAP.get(normalizedArgs.filterType);
    if (!filterFactory) {
      this.runtime.logFormattedError(this, 'FilterUnknown', normalizedArgs.filterType);
      this.runtime.logAddonExecutionFinished(this);
      return new AddonResult();
    }

    try {
      const filterInstance = filterFactory(normalizedArgs, this);
      if (filterInstance.isInitialized) {
        const task = this._getTask(context.objectName);
        if (task) {
          task.tempRecords = await filterInstance.filterRecords(task.tempRecords);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.runtime.logFormattedError(this, 'FilterOperationError', normalizedArgs.filterType, message);
    }

    this.runtime.logAddonExecutionFinished(this);
    return new AddonResult();
  }

  /**
   * Updates module display name during initialization.
   *
   * @param context - Add-on context.
   * @param args - Add-on arguments.
   * @returns Add-on result.
   */
  public onInit(
    context: ISfdmuRunCustomAddonContext,
    args: Record<string, unknown>
  ): Promise<ISfdmuRunCustomAddonResult> {
    const normalizedArgs = this._normalizeArgs(args);
    const suffix = normalizedArgs?.filterType ?? 'UnknownFilter';
    this.context.moduleDisplayName = `${this.context.moduleDisplayName}:${suffix}`;
    void context;
    return Promise.resolve(new AddonResult());
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Returns the current task for the provided object name.
   *
   * @param objectName - Object API name.
   * @returns Migration job task.
   */
  private _getTask(objectName: string): { tempRecords: Array<Record<string, unknown>> } | undefined {
    const job = this.runtime.getScript().job;
    if (!job) {
      return undefined;
    }
    return job.tasks.find((task) => task.sObjectName === objectName);
  }

  /**
   * Normalizes raw add-on arguments.
   *
   * @param args - Raw arguments.
   * @returns Parsed arguments or undefined.
   */
  private _normalizeArgs(args: Record<string, unknown>): OnExecuteArgumentsType | undefined {
    void this;
    const candidate = args as Partial<IRecordsFilterArgs>;
    if (!candidate.filterType || typeof candidate.filterType !== 'string') {
      return undefined;
    }
    if (!candidate.settings || typeof candidate.settings !== 'object') {
      return undefined;
    }
    return candidate as OnExecuteArgumentsType;
  }
}
