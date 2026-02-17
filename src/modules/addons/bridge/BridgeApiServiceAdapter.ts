/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import ProcessedData from '../../models/job/ProcessedData.js';
import type AddonModule from '../AddonModule.js';
import type SfdmuRunAddonRuntime from '../SfdmuRunAddonRuntime.js';
import type MigrationJob from '../../models/job/MigrationJob.js';
import type MigrationJobTask from '../../models/job/MigrationJobTask.js';
import type { PluginInfoType } from '../../models/common/PluginInfoType.js';
import type {
  ISfdmuAddonInfo,
  ISFdmuRunCustomAddonJob,
  ISFdmuRunCustomAddonTask,
  ISfdmuRunCustomAddonApiService,
  ISfdmuRunCustomAddonCommandRunInfo,
  ISfdmuRunCustomAddonContext,
  ISfdmuRunCustomAddonModule,
  ISfdmuRunCustomAddonPluginInfo,
  ISfdmuRunCustomAddonProcessedData,
} from '../../../../custom-addon-sdk/interfaces/index.js';

type BridgeMessageType = 'INFO' | 'WARNING' | 'ERROR' | 'JSON';

/**
 * Bridge API service adapter for custom add-ons.
 */
export default class BridgeApiServiceAdapter implements ISfdmuRunCustomAddonApiService {
  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Underlying runtime instance.
   */
  private readonly _runtime: SfdmuRunAddonRuntime;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new Bridge API service adapter.
   *
   * @param runtime - Runtime instance to wrap.
   */
  public constructor(runtime: SfdmuRunAddonRuntime) {
    this._runtime = runtime;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Logs a Bridge add-on message.
   *
   * @param module - Add-on module instance.
   * @param message - Message payload.
   * @param messageType - Optional message type.
   * @param tokens - Optional message tokens.
   */
  public log(
    module: ISfdmuRunCustomAddonModule,
    message: string | object,
    messageType: BridgeMessageType = 'INFO',
    ...tokens: string[]
  ): void {
    if (typeof message === 'string') {
      const resolvedType = this._resolveFormattedMessageType(messageType);
      this._runtime.logFormatted(module as unknown as AddonModule, message, resolvedType, ...tokens);
      return;
    }

    const payload = this._stringifyPayload(message, messageType === 'JSON');
    const logType = messageType === 'JSON' ? 'JSON' : 'OBJECT';
    this._runtime.log(payload, logType, ...tokens);
  }

  /**
   * Returns processed data for the current task.
   *
   * @param context - Execution context.
   * @returns Processed data container.
   */
  public getProcessedData(context: ISfdmuRunCustomAddonContext): ISfdmuRunCustomAddonProcessedData {
    const task = this._getMigrationTask(context);
    return task?.processedData ?? new ProcessedData();
  }

  /**
   * Returns Bridge command run metadata.
   *
   * @returns Command run info.
   */
  public getPluginRunInfo(): ISfdmuRunCustomAddonCommandRunInfo {
    const runInfo = this._runtime.runInfo;
    const scriptBasePath = this._runtime.getScript().basePath;
    const pinfo = this._createBridgePluginInfo(runInfo?.pluginInfo);
    return {
      apiVersion: runInfo?.apiVersion ?? '',
      sourceUsername: runInfo?.sourceUsername ?? '',
      targetUsername: runInfo?.targetUsername ?? '',
      basePath: runInfo?.basePath ?? scriptBasePath ?? '',
      pinfo,
    };
  }

  /**
   * Returns the current migration job.
   *
   * @returns Migration job instance.
   */
  public getPluginJob(): ISFdmuRunCustomAddonJob {
    const job = this._getMigrationJob();
    if (job) {
      return job as ISFdmuRunCustomAddonJob;
    }
    return this._createEmptyJob();
  }

  /**
   * Returns the migration task for the current context.
   *
   * @param context - Execution context.
   * @returns Migration task.
   */
  public getPluginTask(context: ISfdmuRunCustomAddonContext): ISFdmuRunCustomAddonTask | null {
    const task = this._getMigrationTask(context);
    return task ?? null;
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Resolves the active migration job.
   *
   * @returns Migration job or undefined.
   */
  private _getMigrationJob(): MigrationJob | undefined {
    return this._runtime.getScript().job;
  }

  /**
   * Resolves the migration task for the given context.
   *
   * @param context - Execution context.
   * @returns Migration task or undefined.
   */
  private _getMigrationTask(context: ISfdmuRunCustomAddonContext): MigrationJobTask | undefined {
    const job = this._getMigrationJob();
    return job?.tasks.find((task) => task.sObjectName === context.objectName);
  }

  /**
   * Builds a Bridge plugin info payload.
   *
   * @param pluginInfo - Runtime plugin info.
   * @returns Bridge plugin info.
   */
  private _createBridgePluginInfo(pluginInfo?: PluginInfoType): ISfdmuRunCustomAddonPluginInfo {
    void this;
    const runAddOnApiInfo: ISfdmuAddonInfo = {
      version: pluginInfo?.runAddOnApiInfo?.version ?? '',
    };
    return {
      pluginName: pluginInfo?.pluginName ?? '',
      commandName: pluginInfo?.commandName ?? '',
      version: pluginInfo?.version ?? '',
      path: pluginInfo?.path ?? '',
      commandString: pluginInfo?.commandString ?? '',
      argv: pluginInfo?.argv ?? [],
      runAddOnApiInfo,
    };
  }

  /**
   * Returns a default Bridge job placeholder.
   *
   * @returns Empty job instance.
   */
  private _createEmptyJob(): ISFdmuRunCustomAddonJob {
    void this;
    return {
      tasks: [],
      getTaskByFieldPath: (fieldPath: string) => ({
        task: null,
        field: fieldPath.split('.').pop() ?? '',
      }),
    };
  }

  /**
   * Normalizes message types for formatted logging.
   *
   * @param messageType - Bridge message type.
   * @returns Runtime message type.
   */
  private _resolveFormattedMessageType(messageType: BridgeMessageType): 'INFO' | 'WARNING' | 'ERROR' {
    void this;
    if (messageType === 'WARNING' || messageType === 'ERROR') {
      return messageType;
    }
    return 'INFO';
  }

  /**
   * Formats non-string payloads for logging.
   *
   * @param message - Message payload.
   * @param pretty - When true, stringify with indentation.
   * @returns Serialized message.
   */
  private _stringifyPayload(message: object, pretty: boolean): string {
    void this;
    try {
      return JSON.stringify(message, null, pretty ? 2 : 0);
    } catch {
      return String(message);
    }
  }
}
