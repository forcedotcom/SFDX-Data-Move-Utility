/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Recursively clones values while preserving object graphs and prototypes.
 *
 * @param value - The value to clone.
 * @param seen - Previously cloned object references for circular graph handling.
 * @returns The deep cloned value.
 */
function cloneValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return seen.get(value);
  }

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags);
  }

  if (value instanceof Map) {
    const clonedMap = new Map<unknown, unknown>();
    seen.set(value, clonedMap);
    value.forEach((mapValue, mapKey) => {
      clonedMap.set(cloneValue(mapKey, seen), cloneValue(mapValue, seen));
    });
    return clonedMap;
  }

  if (value instanceof Set) {
    const clonedSet = new Set<unknown>();
    seen.set(value, clonedSet);
    value.forEach((setValue) => {
      clonedSet.add(cloneValue(setValue, seen));
    });
    return clonedSet;
  }

  if (Array.isArray(value)) {
    const clonedArray: unknown[] = [];
    seen.set(value, clonedArray);
    value.forEach((item) => {
      clonedArray.push(cloneValue(item, seen));
    });
    return clonedArray;
  }

  if (value instanceof ArrayBuffer) {
    return value.slice(0);
  }

  if (Buffer.isBuffer(value)) {
    return Buffer.from(value);
  }

  const sourceObject = value as Record<PropertyKey, unknown>;
  const prototype = Object.getPrototypeOf(sourceObject) as object | null;
  const clonedObject = Object.create(prototype) as Record<PropertyKey, unknown>;
  seen.set(sourceObject, clonedObject);

  Reflect.ownKeys(sourceObject).forEach((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(sourceObject, key);
    if (!descriptor) {
      return;
    }

    if ('value' in descriptor) {
      descriptor.value = cloneValue(descriptor.value, seen);
    }

    Object.defineProperty(clonedObject, key, descriptor);
  });

  return clonedObject;
}

/**
 * Creates a synchronous deep clone of the given value.
 *
 * @param value - The value to clone.
 * @returns The deep cloned value.
 */
export function deepCloneSync<T>(value: T): T {
  return cloneValue(value, new WeakMap<object, unknown>()) as T;
}

/**
 * Creates an asynchronous deep clone of the given value.
 *
 * @param value - The value to clone.
 * @returns A promise resolving to the deep cloned value.
 */
export function deepCloneAsync<T>(value: T): Promise<T> {
  return Promise.resolve(deepCloneSync(value));
}
