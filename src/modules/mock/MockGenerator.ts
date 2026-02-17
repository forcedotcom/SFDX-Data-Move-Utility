/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { MOCK_EXPRESSION_ORIGINAL_VALUE } from '../constants/Constants.js';
import type { CasualModuleType } from '../dependencies/models/CasualModuleType.js';

type CasualGeneratorType = CasualModuleType & {
  define: (name: string, generator: (...args: unknown[]) => unknown) => void;
};

/**
 * Generates mock values based on configured patterns.
 */
export default class MockGenerator {
  // ------------------------------------------------------//
  // -------------------- STATIC FIELDS ------------------ //
  // ------------------------------------------------------//

  /**
   * Counter registry for sequential mock patterns.
   */
  private static _counter: { counter: Record<string, number | Date> } = { counter: {} };

  /**
   * Tracks whether custom generators were initialized.
   */
  private static _isInitialized = false;

  /**
   * Date step handlers for sequential date mocks.
   */
  private static _dateStepHandlers: Record<string, (current: Date) => Date> = {
    d: (current) => new Date(current.setDate(current.getDate() + 1)),
    '-d': (current) => new Date(current.setDate(current.getDate() - 1)),
    m: (current) => new Date(current.setMonth(current.getMonth() + 1)),
    '-m': (current) => new Date(current.setMonth(current.getMonth() - 1)),
    y: (current) => new Date(current.setFullYear(current.getFullYear() + 1)),
    '-y': (current) => new Date(current.setFullYear(current.getFullYear() - 1)),
    s: (current) => new Date(current.setSeconds(current.getSeconds() + 1)),
    '-s': (current) => new Date(current.setSeconds(current.getSeconds() - 1)),
    ms: (current) => new Date(current.setMilliseconds(current.getMilliseconds() + 1)),
    '-ms': (current) => new Date(current.setMilliseconds(current.getMilliseconds() - 1)),
  };

  // ------------------------------------------------------//
  // -------------------- PUBLIC METHODS ----------------- //
  // ------------------------------------------------------//

  /**
   * Resets all mock counters.
   */
  public static resetCounter(): void {
    this._counter.counter = {};
  }

  /**
   * Registers custom mock generators with the casual engine.
   *
   * @param casual - Casual instance.
   */
  public static createCustomGenerators(casual: CasualGeneratorType): void {
    if (this._isInitialized || !casual || typeof casual.define !== 'function') {
      return;
    }

    const counters = this._counter;

    try {
      casual.define('c_seq_number', (field?: unknown, prefix?: unknown, from?: unknown, step?: unknown) => {
        const fieldKey = String(field ?? '');
        if (!fieldKey) {
          return '';
        }
        if (typeof counters.counter[fieldKey] === 'undefined') {
          counters.counter[fieldKey] = Number(from) || 1;
        } else {
          const current = Number(counters.counter[fieldKey] ?? 0);
          counters.counter[fieldKey] = current + Number(step ?? 1);
        }
        const prefixText = typeof prefix === 'string' ? prefix : String(prefix ?? '');
        return `${prefixText}${String(counters.counter[fieldKey] ?? '')}`;
      });

      casual.define('c_set_value', (_field?: unknown, value: unknown = null, originalValue: unknown = null) => {
        if (typeof value === 'string') {
          return value.replace(MOCK_EXPRESSION_ORIGINAL_VALUE, String(originalValue ?? ''));
        }
        return value;
      });

      casual.define('c_seq_date', (field?: unknown, from?: unknown, step?: unknown) => {
        const fieldKey = String(field ?? '');
        if (!fieldKey) {
          return new Date();
        }
        const stepValue = typeof step === 'string' && step.length > 0 ? step : 'd';
        if (typeof counters.counter[fieldKey] === 'undefined') {
          const parsed = from instanceof Date ? from : new Date(Date.parse(String(from ?? '')));
          counters.counter[fieldKey] = parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
        } else {
          const current = counters.counter[fieldKey];
          if (current instanceof Date) {
            counters.counter[fieldKey] = MockGenerator._applyDateStep(current, stepValue);
          }
        }
        const next = counters.counter[fieldKey];
        return next instanceof Date ? new Date(next.getTime()) : new Date();
      });

      this._isInitialized = true;
    } catch {
      // Swallow initialization errors to avoid breaking the run.
    }
  }

  // ------------------------------------------------------//
  // -------------------- PRIVATE METHODS ---------------- //
  // ------------------------------------------------------//

  /**
   * Applies a date increment step to the provided date.
   *
   * @param current - Current date.
   * @param step - Step identifier.
   * @returns Updated date.
   */
  private static _applyDateStep(current: Date, step: string): Date {
    const handler = this._dateStepHandlers[step];
    return handler ? handler(current) : current;
  }
}
