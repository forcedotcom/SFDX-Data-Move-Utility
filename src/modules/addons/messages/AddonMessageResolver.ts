/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Messages } from '@salesforce/core';
import { PLUGIN_NAME, RUN_CORE_ADDON_MESSAGE_BUNDLE } from '../../constants/Constants.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const coreAddonMessages = Messages.loadMessages(PLUGIN_NAME, RUN_CORE_ADDON_MESSAGE_BUNDLE);

type LoggerAdapterType = {
  getResourceString: (message: string, ...tokens: string[]) => string;
};

type MessageMapType = Map<string, string>;
type ModuleContextType = {
  context?: {
    isCore?: boolean;
  };
};

/**
 * Resolves add-on messages from custom, core, and logging bundles.
 */
export default class AddonMessageResolver {
  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Logger adapter for logging bundle lookups.
   */
  private readonly _logger: LoggerAdapterType;

  /**
   * Cache of parsed custom message files.
   */
  private readonly _customMessagesCache: Map<string, MessageMapType> = new Map();

  /**
   * Module-specific message maps.
   */
  private readonly _moduleMessages: WeakMap<object, MessageMapType> = new WeakMap();

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new add-on message resolver.
   *
   * @param logger - Logger adapter for logging bundle lookups.
   */
  public constructor(logger: LoggerAdapterType) {
    this._logger = logger;
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Registers module-specific messages from a custom bundle.
   *
   * @param module - Add-on module instance.
   * @param messagesPath - Optional path to messages.md.
   */
  public async registerAddonMessagesAsync(module: object, messagesPath?: string): Promise<void> {
    if (!messagesPath) {
      return;
    }

    const normalizedPath = path.normalize(messagesPath);
    let cached = this._customMessagesCache.get(normalizedPath);
    if (!cached) {
      cached = await this._loadMessagesFromFileAsync(normalizedPath);
      this._customMessagesCache.set(normalizedPath, cached);
    }

    if (cached.size > 0) {
      this._moduleMessages.set(module, cached);
    }
  }

  /**
   * Resolves a message key for the given add-on module.
   *
   * @param module - Add-on module instance.
   * @param message - Message key or literal string.
   * @returns Resolved message string.
   */
  public resolveMessage(module: object, message: string): string {
    if (!message) {
      return '';
    }

    const customMessage = this._getCustomMessage(module, message);
    if (typeof customMessage !== 'undefined') {
      return customMessage;
    }

    if (this._isCoreModule(module)) {
      const coreMessage = this._getCoreMessage(message);
      if (typeof coreMessage !== 'undefined') {
        return coreMessage;
      }
    }

    const loggingMessage = this._getLoggingMessage(message);
    if (typeof loggingMessage !== 'undefined') {
      return loggingMessage;
    }

    return message;
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Reads and parses messages from a markdown bundle.
   *
   * @param filePath - Absolute path to the messages file.
   * @returns Parsed messages map.
   */
  private async _loadMessagesFromFileAsync(filePath: string): Promise<MessageMapType> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return this._parseMessagesContent(content);
    } catch {
      return new Map();
    }
  }

  /**
   * Resolves a message from the module-specific bundle.
   *
   * @param module - Add-on module instance.
   * @param key - Message key.
   * @returns Message value or undefined.
   */
  private _getCustomMessage(module: object, key: string): string | undefined {
    const moduleMessages = this._moduleMessages.get(module);
    if (!moduleMessages) {
      return undefined;
    }
    if (!moduleMessages.has(key)) {
      return undefined;
    }
    return moduleMessages.get(key) ?? '';
  }

  /**
   * Resolves a message from the core add-on bundle.
   *
   * @param key - Message key.
   * @returns Message value or undefined.
   */
  private _getCoreMessage(key: string): string | undefined {
    void this;
    try {
      return coreAddonMessages.getMessage(key);
    } catch {
      return undefined;
    }
  }

  /**
   * Resolves a message from the logging bundle.
   *
   * @param key - Message key.
   * @returns Message value or undefined.
   */
  private _getLoggingMessage(key: string): string | undefined {
    const resolved = this._logger.getResourceString(key);
    if (!resolved || resolved === key) {
      return undefined;
    }
    return resolved;
  }

  /**
   * Determines whether a module is marked as core.
   *
   * @param module - Add-on module instance.
   * @returns True when module is core.
   */
  private _isCoreModule(module: object): boolean {
    void this;
    const candidate = module as ModuleContextType;
    return Boolean(candidate.context?.isCore);
  }

  /**
   * Parses markdown message content into a map.
   *
   * @param content - Raw markdown content.
   * @returns Parsed message map.
   */
  private _parseMessagesContent(content: string): MessageMapType {
    const lines = content.split(/\r?\n/);
    const messages = new Map<string, string>();

    let currentKey: string | null = null;
    let buffer: string[] = [];

    const flush = (): void => {
      if (!currentKey) {
        return;
      }
      const value = this._normalizeMessageLines(buffer);
      messages.set(currentKey, value);
    };

    for (const line of lines) {
      if (line.trimStart().startsWith('# ')) {
        flush();
        currentKey = line.replace(/^#\s*/, '').trim();
        buffer = [];
        continue;
      }
      if (currentKey) {
        buffer.push(line);
      }
    }

    flush();
    return messages;
  }

  /**
   * Normalizes message lines by trimming empty boundaries.
   *
   * @param lines - Raw message lines.
   * @returns Normalized message value.
   */
  private _normalizeMessageLines(lines: string[]): string {
    const normalized = this._trimEmptyLines(lines);
    return normalized.join('\n');
  }

  /**
   * Trims leading and trailing empty lines.
   *
   * @param lines - Raw message lines.
   * @returns Trimmed lines.
   */
  private _trimEmptyLines(lines: string[]): string[] {
    void this;
    let start = 0;
    let end = lines.length;

    while (start < end && lines[start].trim().length === 0) {
      start += 1;
    }
    while (end > start && lines[end - 1].trim().length === 0) {
      end -= 1;
    }

    return lines.slice(start, end);
  }
}
