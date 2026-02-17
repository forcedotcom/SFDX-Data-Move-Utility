/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createHmac } from 'node:crypto';
import { LOG_FILE_NO_ANONYMIZE_MARKER } from '../constants/Constants.js';

type LogFileAnonymizerOptionsType = {
  enabled: boolean;
  maskedValues?: string[];
  maskedEntries?: Array<{ value: string; label: string }>;
  seed?: string;
};

/**
 * Applies file-log-only anonymization rules when enabled.
 */
export default class LogFileAnonymizer {
  // ------------------------------------------------------//
  // -------------------- PUBLIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * True when anonymization is enabled.
   */
  public readonly enabled: boolean;

  // ------------------------------------------------------//
  // -------------------- PRIVATE FIELDS ----------------- //
  // ------------------------------------------------------//

  /**
   * Literal values that should always be anonymized.
   */
  private readonly _maskedValues: string[];

  /**
   * Labeled values that should be anonymized with explicit prefixes.
   */
  private readonly _maskedEntries: Array<{ value: string; label: string }>;

  /**
   * Run-scoped random seed used by deterministic hashing.
   */
  private readonly _seed: string;

  // ------------------------------------------------------//
  // ----------------------- CONSTRUCTOR ----------------- //
  // ------------------------------------------------------//

  /**
   * Creates a new file log anonymizer.
   *
   * @param options - Anonymizer options.
   */
  public constructor(options: LogFileAnonymizerOptionsType) {
    this.enabled = Boolean(options.enabled);
    this._maskedValues = Array.isArray(options.maskedValues)
      ? [...new Set(options.maskedValues.filter((value) => typeof value === 'string' && value.trim().length > 0))]
          .map((value) => value.trim())
          .sort((left, right) => right.length - left.length)
      : [];
    this._maskedEntries = this._buildMaskedEntries(options.maskedEntries);
    this._seed = typeof options.seed === 'string' && options.seed.length > 0 ? options.seed : 'default-seed';
  }

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Anonymizes a file log line according to the active contract.
   *
   * @param message - Raw file log line.
   * @returns Anonymized line.
   */
  public anonymize(message: string): string {
    if (!message) {
      return message;
    }

    const normalizedMessage = this._stripNoAnonymizeMarker(message);
    if (normalizedMessage.bypass || !this.enabled || !normalizedMessage.value) {
      return normalizedMessage.value;
    }

    if (this._isStackTraceMessage(normalizedMessage.value) || this._isValueMappingRuleLine(normalizedMessage.value)) {
      return normalizedMessage.value;
    }

    let output = normalizedMessage.value;
    output = this._maskPromptAnswers(output);
    output = this._maskKnownValues(output);
    output = this._maskSecretAssignments(output);
    output = this._maskBearerTokens(output);
    output = this._maskEmails(output);
    output = this._maskUrlsAndDomains(output);
    output = this._maskAbsolutePaths(output);
    output = this._maskSoqlLiterals(output);
    output = this._maskAddonLiteralPairs(output);

    return output;
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Masks configured literal values.
   *
   * @param message - Message to anonymize.
   * @returns Updated message.
   */
  private _maskKnownValues(message: string): string {
    let output = message;
    this._maskedEntries.forEach((entry) => {
      if (this._isSalesforceRecordId(entry.value)) {
        return;
      }
      const escaped = this._escapeRegExp(entry.value);
      if (!escaped) {
        return;
      }
      output = output.replace(new RegExp(escaped, 'g'), this._buildHashedToken(entry.label, entry.value));
    });
    return output;
  }

  /**
   * Masks known secret assignments.
   *
   * @param message - Message to anonymize.
   * @returns Updated message.
   */
  private _maskSecretAssignments(message: string): string {
    void this.enabled;
    let output = message;

    output = output.replace(
      /("?(accessToken|refreshToken|clientSecret|password|authorization|sessionId|token)"?\s*[:=]\s*")([^"]*)(")/giu,
      (_full, prefix: string, key: string, value: string, suffix: string) =>
        `${prefix}${this._buildHashedToken(key, value)}${suffix}`
    );
    output = output.replace(
      /('(?:accessToken|refreshToken|clientSecret|password|authorization|sessionId|token)'\s*:\s*')([^']*)(')/giu,
      (_full, prefix: string, value: string, suffix: string) =>
        `${prefix}${this._buildHashedToken('secret', value)}${suffix}`
    );
    output = output.replace(
      /(\b(accessToken|refreshToken|clientSecret|password|authorization|sessionId|token)\b\s*[=:]\s*)([^,\s;]+)/giu,
      (_full, prefix: string, key: string, value: string) => `${prefix}${this._buildHashedToken(key, value)}`
    );

    return output;
  }

  /**
   * Masks Bearer token values.
   *
   * @param message - Message to anonymize.
   * @returns Updated message.
   */
  private _maskBearerTokens(message: string): string {
    void this.enabled;
    return message.replace(
      /\bBearer\s+([A-Za-z0-9._~+\-/=]+)/giu,
      (_full, value: string) => `Bearer ${this._buildHashedToken('bearer', value)}`
    );
  }

  /**
   * Masks e-mail addresses.
   *
   * @param message - Message to anonymize.
   * @returns Updated message.
   */
  private _maskEmails(message: string): string {
    void this.enabled;
    return message.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gu, (value: string) =>
      this._buildHashedToken('email', value)
    );
  }

  /**
   * Masks URL and domain values.
   *
   * @param message - Message to anonymize.
   * @returns Updated message.
   */
  private _maskUrlsAndDomains(message: string): string {
    void this.enabled;
    let output = message.replace(/\bhttps?:\/\/[^\s'")]+/giu, (value: string) => this._buildHashedToken('url', value));
    output = output.replace(/\b(?:[a-z0-9-]+\.)+(?:my\.)?salesforce\.com\b/giu, (value: string) =>
      this._buildHashedToken('domain', value)
    );
    output = output.replace(/\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|dev|app|cloud|local)\b/giu, (value: string) =>
      this._buildHashedToken('domain', value)
    );
    return output;
  }

  /**
   * Masks absolute filesystem paths and keeps relative paths untouched.
   *
   * @param message - Message to anonymize.
   * @returns Updated message.
   */
  private _maskAbsolutePaths(message: string): string {
    void this.enabled;
    let output = message.replace(/\b[A-Za-z]:[\\/][^\s'"]+/g, (value: string) => this._buildHashedToken('path', value));
    output = output.replace(/\\\\[^\s'"]+[\\/][^\s'"]+(?:[\\/][^\s'"]+)*/g, (value: string) =>
      this._buildHashedToken('path', value)
    );
    return output;
  }

  /**
   * Masks prompt answers, because they can include arbitrary user input.
   *
   * @param message - Message to anonymize.
   * @returns Updated message.
   */
  private _maskPromptAnswers(message: string): string {
    void this.enabled;
    return message.replace(/(\bPROMPT ANSWER:\s*)(.*)$/giu, (_full, prefix: string, answer: string) => {
      if (!answer || answer.trim().length === 0) {
        return `${prefix}${answer}`;
      }
      return `${prefix}${this._buildHashedTokenPreserveSalesforceId('prompt', answer.trim())}`;
    });
  }

  /**
   * Masks SOQL literal values only in query-related log lines.
   *
   * @param message - Message to anonymize.
   * @returns Updated message.
   */
  private _maskSoqlLiterals(message: string): string {
    if (!this._shouldMaskSoqlLiterals(message)) {
      return message;
    }

    let output = this._maskSoqlInClauseLiterals(message);
    output = this._maskSoqlCustomFieldComparisonLiterals(output);
    return output;
  }

  /**
   * Masks quoted values inside SOQL IN (...) clauses.
   *
   * @param message - Query-related log line.
   * @returns Updated message.
   */
  private _maskSoqlInClauseLiterals(message: string): string {
    return message.replace(/(\bIN\s*\()([^)]*)(\))/giu, (_full, prefix: string, body: string, suffix: string) => {
      const maskedBody = this._maskQuotedSoqlValues(body);
      return `${prefix}${maskedBody}${suffix}`;
    });
  }

  /**
   * Masks quoted values for comparisons on custom fields only.
   *
   * @param message - Query-related log line.
   * @returns Updated message.
   */
  private _maskSoqlCustomFieldComparisonLiterals(message: string): string {
    return message.replace(
      /(\b[A-Za-z_][A-Za-z0-9_.]*(?:__c|__r(?:\.[A-Za-z_][A-Za-z0-9_]*)?)\b\s*(?:=|!=|<>|LIKE|NOT\s+LIKE)\s*)(('(?:\\.|[^'])*')|("(?:\\.|[^"])*"))/giu,
      (_full, prefix: string, literal: string) => `${prefix}${this._maskQuotedSoqlValues(literal)}`
    );
  }

  /**
   * Masks quoted SOQL string values using the soql hash label.
   *
   * @param value - SOQL fragment.
   * @returns Fragment with hashed quoted strings.
   */
  private _maskQuotedSoqlValues(value: string): string {
    let output = value.replace(
      /'((?:\\.|[^'])*)'/g,
      (_full, literalValue: string) => `'${this._buildHashedTokenPreserveSalesforceId('soql', literalValue)}'`
    );
    output = output.replace(
      /"((?:\\.|[^"])*)"/g,
      (_full, literalValue: string) => `"${this._buildHashedTokenPreserveSalesforceId('soql', literalValue)}"`
    );
    return output;
  }

  /**
   * Masks badwords add-on payload values while leaving definitions untouched.
   *
   * @param message - Message to anonymize.
   * @returns Updated message.
   */
  private _maskAddonLiteralPairs(message: string): string {
    void this.enabled;
    return message.replace(
      /(\]\s\{[^}]+\}\s+-\s*[^:]{1,200}:\s*)(.+?)(\.)?$/u,
      (_full, prefix: string, payload: string, suffix?: string) =>
        `${prefix}${this._buildHashedTokenPreserveSalesforceId('value', payload.trim())}${suffix ?? ''}`
    );
  }

  /**
   * Returns true when the line is query-related and should have literals masked.
   *
   * @param message - Candidate log line.
   * @returns True when query literal masking is required.
   */
  private _shouldMaskSoqlLiterals(message: string): boolean {
    void this.enabled;
    const lower = message.toLowerCase();
    if (
      lower.includes('query string:') ||
      lower.includes('final source query:') ||
      lower.includes('final target query:') ||
      lower.includes('final delete query:') ||
      lower.includes('[diagnostic] delete query:') ||
      lower.includes('malformed query string:') ||
      lower.includes('malformed delete query string:') ||
      lower.includes('failed to parse soql query.') ||
      lower.includes('sourcerecordsfilter')
    ) {
      return true;
    }

    return /\bselect\b[\s\S]*\bfrom\b/iu.test(message);
  }

  /**
   * Escapes a value for usage inside RegExp.
   *
   * @param value - Raw value.
   * @returns Escaped RegExp value.
   */
  private _escapeRegExp(value: string): string {
    void this.enabled;
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Resolves a human-readable label for hashed literal replacements.
   *
   * @param value - Raw literal value.
   * @returns Label for replacement token.
   */
  private _resolveKnownValueLabel(value: string): string {
    void this.enabled;
    if (this._isAbsolutePath(value)) {
      return 'path';
    }
    if (/^https?:\/\//iu.test(value)) {
      return 'url';
    }
    if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/u.test(value)) {
      return 'user';
    }
    if (/\b(?:[a-z0-9-]+\.)+(?:my\.)?salesforce\.com\b/iu.test(value)) {
      return 'domain';
    }
    return 'org';
  }

  /**
   * Builds normalized masked entry list from explicit and fallback values.
   *
   * @param explicitEntries - Explicit labeled entries.
   * @returns Normalized and sorted entries.
   */
  private _buildMaskedEntries(
    explicitEntries?: Array<{ value: string; label: string }>
  ): Array<{ value: string; label: string }> {
    const keySeparator = '\u0000';
    const result = new Map<string, { value: string; label: string }>();
    const append = (value: string, label: string): void => {
      const normalizedValue = value.trim();
      const normalizedLabel = label.trim();
      if (!normalizedValue || !normalizedLabel) {
        return;
      }
      const key = `${normalizedValue}${keySeparator}${normalizedLabel}`;
      if (!result.has(key)) {
        result.set(key, { value: normalizedValue, label: normalizedLabel });
      }
    };

    if (Array.isArray(explicitEntries)) {
      explicitEntries.forEach((entry) => {
        if (entry && typeof entry.value === 'string' && typeof entry.label === 'string') {
          append(entry.value, entry.label);
        }
      });
    }

    this._maskedValues.forEach((value) => {
      append(value, this._resolveKnownValueLabel(value));
    });

    return [...result.values()].sort((left, right) => right.value.length - left.value.length);
  }

  /**
   * Returns true when the value is an absolute filesystem path.
   *
   * @param value - Candidate value.
   * @returns True when absolute path.
   */
  private _isAbsolutePath(value: string): boolean {
    void this.enabled;
    return /^[A-Za-z]:[\\/]/u.test(value) || /^\\\\[^\\]+\\[^\\]+/u.test(value);
  }

  /**
   * Builds labeled anonymized token using deterministic run-scoped hashing.
   *
   * @param label - Output label.
   * @param value - Raw value to hash.
   * @returns Labeled hash token.
   */
  private _buildHashedToken(label: string, value: string): string {
    const prefix = (label || 'value').trim() || 'value';
    return `${prefix}<${this._hash16(value)}>`;
  }

  /**
   * Builds a hash token unless the value is a Salesforce record Id.
   *
   * @param label - Output label.
   * @param value - Raw value.
   * @returns Hashed token or original Salesforce record Id.
   */
  private _buildHashedTokenPreserveSalesforceId(label: string, value: string): string {
    const normalized = value.trim();
    if (this._isSalesforceRecordId(normalized)) {
      return normalized;
    }
    return this._buildHashedToken(label, normalized);
  }

  /**
   * Returns 16-char HEX hash for the value using the run seed.
   *
   * @param value - Raw value.
   * @returns 16-char uppercase hex hash.
   */
  private _hash16(value: string): string {
    const digest = createHmac('sha256', this._seed)
      .update(value ?? '', 'utf8')
      .digest('hex')
      .toUpperCase();
    return digest.slice(0, 16);
  }

  /**
   * Returns true when value looks like a Salesforce record Id (15 or 18 chars).
   *
   * @param value - Candidate value.
   * @returns True when value matches Salesforce record Id format.
   */
  private _isSalesforceRecordId(value: string): boolean {
    void this.enabled;
    return /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/u.test(value);
  }

  /**
   * Removes no-anonymize marker and reports whether this line should bypass masking.
   *
   * @param message - Raw file log line.
   * @returns Normalized value and bypass flag.
   */
  private _stripNoAnonymizeMarker(message: string): { value: string; bypass: boolean } {
    void this.enabled;
    if (!message.includes(LOG_FILE_NO_ANONYMIZE_MARKER)) {
      return { value: message, bypass: false };
    }
    return {
      value: message.split(LOG_FILE_NO_ANONYMIZE_MARKER).join(''),
      bypass: true,
    };
  }

  /**
   * Returns true when the log line contains stack trace details.
   *
   * @param message - Candidate line.
   * @returns True when masking must be skipped.
   */
  private _isStackTraceMessage(message: string): boolean {
    void this.enabled;
    return message.includes('[STACK TRACE]') || /\n\s*at\s+/u.test(message) || /\sat\s+[^(]+\([^)]+\)/u.test(message);
  }

  /**
   * Returns true when the line is a value-mapping definition/rule summary.
   *
   * @param message - Candidate line.
   * @returns True when masking must be skipped.
   */
  private _isValueMappingRuleLine(message: string): boolean {
    void this.enabled;
    const lower = message.toLowerCase();
    return lower.includes('value mapping rules:') || lower.includes('value mapping rule "');
  }
}
