/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as soqlParser from 'soql-parser-js';
import type { WhereClause } from 'soql-parser-js';
import { Common } from '../../../src/modules/common/Common.js';
import { CONSTANTS } from '../../../src/modules/common/Statics.js';
import { DATA_MEDIA_TYPE } from '../../../src/modules/common/Enumerations.js';
import { CommandAbortedByUserError } from '../../../src/modules/models/common/CommandAbortedByUserError.js';
import type { LoggerType } from '../../../src/modules/logging/LoggerType.js';
import type { SFieldDescribeType } from '../../../src/modules/models/common/SFieldDescribeType.js';

describe('Common utilities', () => {
  const { composeQuery, parseQuery } = soqlParser;
  const legacyStringHash = (input: string): number => {
    if (!input) {
      return 0;
    }
    return input.split('').reduce((accumulator, char) => {
      const next = (accumulator << 5) - accumulator + char.charCodeAt(0);
      return next & next;
    }, 0);
  };

  it('formats date strings consistently', () => {
    const date = new Date(2024, 0, 2, 3, 4, 5, 6);
    const result = Common.formatDateTime(date, true);
    assert.equal(result, '2024-01-02  03:04:05.006');
    const shortWithMs = Common.formatDateTimeShort(date, true);
    assert.ok(shortWithMs.endsWith(`.${date.getMilliseconds()}`));
    const shortNoMs = Common.formatDateTimeShort(date, false);
    assert.ok(!shortNoMs.includes(`.${date.getMilliseconds()}`));
    const fileDate = Common.formatFileDate(date);
    assert.ok(!fileDate.includes(':'));
    assert.ok(fileDate.includes('_'));
  });

  it('pads numbers and formats time diffs', () => {
    assert.equal(Common.addLeadnigZeros(7, 3), '007');
    const dateStart = new Date(0);
    const dateEnd = new Date(3_723_004);
    assert.equal(Common.timeDiffString(dateStart, dateEnd), '01h 02m 03s 004ms ');
  });

  it('builds the full command line', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'script', 'sfdmu:run', '--foo', 'bar'];
    assert.equal(Common.getFullCommandLine(), 'sfdx sfdmu:run --foo bar');
    process.argv = ['node', 'script'];
    assert.equal(Common.getFullCommandLine(), 'node script');
    process.argv = originalArgv;
  });

  it('converts UTC dates to local dates', () => {
    const utcDate = new Date(Date.UTC(2024, 0, 1, 12, 0, 0));
    const expected = new Date(utcDate.getTime() + utcDate.getTimezoneOffset() * 60 * 1000);
    expected.setHours(utcDate.getHours() - utcDate.getTimezoneOffset() / 60);
    const local = Common.convertUTCDateToLocalDate(utcDate);
    assert.equal(local.getTime(), expected.getTime());
  });

  it('builds chunked arrays', () => {
    const chunks = Common.chunkArray([1, 2, 3, 4, 5], 2);
    assert.equal(chunks.length, 3);
    assert.deepEqual(chunks[0], [1, 2]);
  });

  it('transforms arrays of arrays to objects', () => {
    const input: unknown[][] = [
      ['Id', 'Name'],
      ['1', 'Alpha'],
      ['2', 'Beta'],
    ];
    const output = Common.transformArrayOfArrays(input);
    assert.deepEqual(output, [
      { Id: '1', Name: 'Alpha' },
      { Id: '2', Name: 'Beta' },
    ]);
  });

  it('creates maps by hashcode and property', () => {
    const items = [{ a: 1 }, { a: 1 }];
    const hashMap = Common.arrayToMapByHashcode(items);
    assert.equal(hashMap.size, 2);
    const baseHash = String(Common.getObjectHashcode(items[0]));
    assert.ok(hashMap.has(baseHash));
    assert.ok(hashMap.has(`${baseHash}_0`));

    const propertyItems = [{ id: 'X' }, { id: 'X' }];
    const propMap = Common.arrayToMapByProperty(propertyItems, 'id');
    assert.ok(propMap.has('X'));
    assert.ok(propMap.has('X_0'));
  });

  it('compares arrays by hashcode and property', () => {
    const keys = [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
    ];
    const values = [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
    ];
    const hashResult = Common.compareArraysByHashcode(keys, values);
    assert.equal(hashResult.get(keys[0]), values[0]);
    assert.equal(hashResult.get(keys[1]), values[1]);

    const propResult = Common.compareArraysByProperty(keys, values, 'id');
    assert.equal(propResult.get(keys[0]), values[0]);
    assert.equal(propResult.get(keys[1]), values[1]);
  });

  it('filters, deduplicates, and removes array entries', () => {
    const distinct = Common.distinctArray([{ name: 'A' }, { name: 'a' }], 'name', true);
    assert.equal(distinct.length, 1);
    const result = Common.distinctStringArray(['A', 'a', 'B'], true);
    assert.equal(result.length, 2);

    const array = [
      { id: '1', name: 'Alpha' },
      { id: '2', name: 'Beta' },
    ];
    const removed = Common.removeBy(array, 'id', '1');
    assert.deepEqual(removed, [{ id: '1', name: 'Alpha' }]);
    assert.equal(array.length, 1);

    const sourceMap = new Map<string, number>([['a', 1]]);
    const filtered = Common.filterMapByArray(['a', 'b'], sourceMap, (key) => (key === 'b' ? 2 : 0), true);
    assert.equal(filtered.get('a'), 1);
    assert.equal(filtered.get('b'), 2);
    assert.equal(sourceMap.get('b'), 2);
  });

  it('hashes strings and objects', () => {
    assert.equal(Common.getStringHashcode('abc'), 96_354);
    assert.equal(Common.getString32FNV1AHashcode('hello'), 1_335_831_723);
    assert.equal(Common.getString32FNV1AHashcode('hello', true), '4f9f2cab');

    const object = { a: '1', b: 2, c: false };
    const expected = legacyStringHash('12false');
    assert.equal(Common.getObjectHashcode(object), expected);
    const excluded = Common.getObjectHashcode(object, ['b']);
    assert.equal(excluded, legacyStringHash('1false'));
  });

  it('handles string replacements and trimming', () => {
    assert.equal(Common.trimEndStr('file.txt', '.txt'), 'file');
    assert.equal(Common.replaceLast('file.txt', '.txt', '.csv'), 'file.csv');
    assert.equal(Common.trimChar('---value---', '-'), 'value');

    const formattedObject = Common.formatStringObject('Hello {name}', { name: 'Bob' });
    assert.equal(formattedObject, 'Hello Bob');
    const untouched = Common.formatStringObject('Hello {name}', { value: 'Bob' });
    assert.equal(untouched, 'Hello {name}');

    const formattedLog = Common.formatStringLog('Value %s is %s', 'A', 'B');
    assert.equal(formattedLog, 'Value A is B');
  });

  it('extracts domains from URLs', () => {
    assert.equal(Common.extractDomainFromUrlString('https://example.com/path'), 'example.com');
    assert.equal(Common.extractDomainFromUrlString(''), '');
  });

  it('maps arrays to multi-value maps and arrays', () => {
    const input = [
      { group: 'A', value: '1' },
      { group: 'A', value: '2' },
      { group: 'B', value: '3' },
    ];
    const multiMap = Common.arrayToMapMulti(input, ['group']);
    assert.equal(multiMap.get('A')?.length, 2);
    const multiValues = Common.arrayToMapMulti(input, ['group'], '|', '', ['value']);
    assert.deepEqual(multiValues.get('A'), [['1'], ['2']]);

    const map = Common.arrayToMap(input, ['group'], '|', '', ['value']);
    assert.deepEqual(map.get('B'), ['3']);

    const propsArray = Common.arrayToPropsArray(input, ['group', 'value'], '-');
    assert.deepEqual(propsArray, ['A-1', 'A-2', 'B-3']);
  });

  it('flattens arrays and clones objects', () => {
    const flattened = Common.flattenArrays([1, [2, [3, 4]], 5]);
    assert.deepEqual(flattened, [1, 2, 3, 4, 5]);

    const objects = [
      { id: '1', keep: 'yes', drop: 'no' },
      { id: '2', keep: 'yes', drop: 'no' },
    ];
    const cloneMap = Common.cloneArrayOfObjects(objects, ['id']);
    const clone = [...cloneMap.keys()][0];
    assert.notEqual(clone, objects[0]);
    assert.deepEqual(clone, { id: '1' });

    const include = Common.cloneObjectIncludeProps(objects[0], 'id');
    assert.deepEqual(include, { id: '1' });
    const exclude = Common.cloneObjectExcludeProps(objects[0], 'drop');
    assert.deepEqual(exclude, { id: '1', keep: 'yes' });
  });

  it('deduplicates string arrays (case-insensitive)', () => {
    const result = Common.distinctStringArray(['A', 'a', 'B'], true);
    assert.equal(result.length, 2);
  });

  it('creates and resolves complex fields', () => {
    const complex = Common.getComplexField('Account__r.Name;Account__r.Id');
    assert.ok(Common.isContainsComplexField(complex));
    const restored = Common.getFieldFromComplexField(complex);
    assert.equal(restored, 'Account__r.Name;Account__r.Id');
  });

  it('detects complex and relationship fields', () => {
    assert.ok(Common.is__rField('Account__r.Name'));
    assert.ok(!Common.is__rField('Id'));
    assert.ok(Common.isComplexField(CONSTANTS.COMPLEX_FIELDS_QUERY_PREFIX + 'Account__r.Name'));
    assert.ok(!Common.isComplexField('Parent.$$Account__r.Name$Account__r.Id'));
    assert.ok(Common.isContainsComplexField('Parent.$$Account__r.Name$Account__r.Id'));
    assert.ok(Common.isComplexOr__rField('Account__r.Name'));
    assert.ok(Common.isComplexOr__rField('$$Account__r.Name$Account__r.Id'));
  });

  it('matches description properties', () => {
    assert.ok(Common.isDescriptionPropertyMatching('type', 'type'));
    assert.ok(Common.isDescriptionPropertyMatching('type', undefined));
    assert.ok(Common.isDescriptionPropertyMatching('type', 'other', true));
    assert.ok(!Common.isDescriptionPropertyMatching('type', 'type', true));
  });

  it('handles field name transformations', () => {
    const describe: SFieldDescribeType = { name: 'Account__c', custom: true };
    assert.equal(Common.getFieldName__r(describe), 'Account__r');
    assert.equal(Common.getFieldName__r(undefined, 'OwnerId'), 'Owner');
    assert.equal(Common.getFieldName__r(undefined, 'Account__c'), 'Account__r');
    const standardDescribe: SFieldDescribeType = { name: 'Account.Name', custom: false };
    standardDescribe['is__r'] = true;
    assert.equal(Common.getFieldNameId(standardDescribe), 'AccountId');
    const relationshipDescribe: SFieldDescribeType = { name: 'Account__r.Name', custom: false };
    relationshipDescribe['is__r'] = true;
    assert.equal(Common.getFieldNameId(relationshipDescribe), 'Account__rId');
    assert.equal(Common.getFieldNameId(undefined, 'Account__r'), 'Account__r');
    assert.equal(Common.getFieldNameId(undefined, 'Owner'), 'OwnerId');
  });

  it('extracts object properties and members', () => {
    class Sample {
      public value = 'test';

      public run(): void {
        void this.value;
        return undefined;
      }
    }
    const sampleProto = Sample.prototype as Sample & { label: string };
    sampleProto.label = 'value';
    const instance = new Sample();
    const recordInstance = instance as unknown as Record<string, unknown>;
    const functions = Common.getObjectProperties(recordInstance, 'function');
    assert.ok(functions.includes('run'));
    const strings = Common.getObjectProperties(recordInstance, 'string');
    assert.ok(strings.includes('label'));

    const extracted = Common.extractObjectMembers({ a: 1, b: 2, c: 3 }, { a: true, b: null, c: true });
    assert.deepEqual(extracted, { a: 1, c: 3 });
  });

  it('builds CSV filenames', () => {
    assert.equal(Common.getCSVFilename('root', 'Account'), `${path.join('root', 'Account')}.csv`);
    assert.equal(Common.getCSVFilename('root', 'User', '_part'), `${path.join('root', 'User')}_part.csv`);
  });

  it('binds functions with metadata', () => {
    const fn = (...args: number[]): number => args.reduce((sum, value) => sum + value, 0);
    const bound = Common.bind<number[], number>(fn, null, 1);
    assert.equal(bound(2), 3);
    assert.ok((bound as unknown as { __boundArgs: number[] }).__boundArgs.length === 1);
  });

  it('parses custom object names and splits tokens', () => {
    assert.ok(Common.isCustomObject('Custom__c'));
    assert.ok(!Common.isCustomObject('Account'));
    assert.deepEqual(Common.splitMulti('Alpha or Beta and Gamma', ['or', 'and']), ['Alpha', 'Beta', 'Gamma']);
  });

  it('parses argv and enumerations', () => {
    Common.parseArgv('--foo', 'bar', '--flag');
    const values = Common.getEnumValues(DATA_MEDIA_TYPE);
    assert.ok(values.includes(DATA_MEDIA_TYPE.Org));
    assert.ok(values.includes(DATA_MEDIA_TYPE.File));
  });

  it('creates random ids', () => {
    const id = Common.makeId(12);
    assert.equal(id.length, 12);
  });

  it('extracts where clause', () => {
    const where = Common.extractWhereClause("SELECT Id FROM Account WHERE Name = 'Test'");
    assert.equal(where, "Name = 'Test'");
  });

  it('composes WHERE clauses', () => {
    const baseQuery = parseQuery("SELECT Id FROM Account WHERE Name = 'Test'");
    const updated = Common.composeWhereClause(baseQuery.where as WhereClause, 'Source__c', ['One', 'Two']);
    const updatedQuery = composeQuery({ ...baseQuery, where: updated });
    const normalized = updatedQuery.replace(/\s/g, '');
    assert.ok(normalized.includes("Source__cIN('One','Two')"));

    const emptyWhere = Common.composeWhereClause(undefined as unknown as WhereClause, 'Stage__c', 'Open');
    const emptyLeft = emptyWhere.left as unknown as { openParen?: number; closeParen?: number };
    assert.equal(emptyLeft.openParen, 1);
    assert.equal(emptyLeft.closeParen, 1);
  });

  it('merges WHERE clauses', () => {
    const where1 = parseQuery("SELECT Id FROM Account WHERE Name = 'A'").where as WhereClause;
    const where2 = parseQuery("SELECT Id FROM Account WHERE Type = 'B'").where as WhereClause;
    const merged = Common.mergeWhereClauses(where1, where2, 'AND');
    const query = parseQuery("SELECT Id FROM Account WHERE Name = 'A'");
    query.where = merged;
    const mergedQuery = composeQuery(query);
    assert.ok(mergedQuery.includes('WHERE'));
    assert.ok(mergedQuery.includes("Name = 'A'"));
    assert.ok(mergedQuery.includes("Type = 'B'"));
  });

  it('adds or removes query fields', () => {
    const query = parseQuery('SELECT Id, Name FROM Account');
    Common.addOrRemoveQueryFields(query, ['CreatedDate'], ['Name']);
    const updatedQuery = composeQuery(query);
    assert.ok(updatedQuery.includes('Id'));
    assert.ok(updatedQuery.includes('CreatedDate'));
    assert.ok(!updatedQuery.includes('Name'));
  });

  it('creates field-in queries', () => {
    const queries = Common.createFieldInQueries(['Id'], 'Id', 'Account', ['1', '2'], 'IsActive = true');
    assert.equal(queries.length, 1);
    assert.ok(queries[0].includes('WHERE'));
    assert.ok(queries[0].includes('Id IN'));
    assert.ok(queries[0].toLowerCase().includes('isactive = true'));
    assert.deepEqual(Common.createFieldInQueries(['Id'], 'Id', 'Account', []), []);
  });

  it('creates CSV strings from arrays', () => {
    const chunks = Common.createCsvStringsFromArray(
      [
        { b: '2', a: '1' },
        { b: '4', a: '3' },
      ],
      10_000,
      2
    );
    assert.equal(chunks.header.join(','), 'a,b');
    assert.equal(chunks.chunks.length, 1);
    assert.ok(chunks.chunks[0]?.csvString.includes('"a","b"'));
  });

  it('flat-maps arrays', () => {
    const result = Common.flatMap([1, 2], (value) => [value, value * 2]);
    assert.deepEqual(result, [1, 2, 2, 4]);
  });

  it('runs async helpers in parallel and serial modes', async () => {
    const tasks = [async () => 1, async () => 2, async () => 3];
    const parallelResults = await Common.parallelTasksAsync(tasks, 2);
    assert.deepEqual(parallelResults, [1, 2, 3]);

    const boundResults = await Common.parallelExecAsync(
      [
        async function (this: { value: number }): Promise<number> {
          return this.value;
        },
      ],
      { value: 7 }
    );
    assert.deepEqual(boundResults, [7]);

    const order: number[] = [];
    const serialResults = await Common.serialExecAsync([
      async () => {
        order.push(1);
        return 1;
      },
      async () => {
        order.push(2);
        return 2;
      },
    ]);
    assert.deepEqual(serialResults, [1, 2]);
    assert.deepEqual(order, [1, 2]);

    const serialThis = await Common.serialExecAsync(
      [
        async function (this: { value: number }): Promise<number> {
          return this.value;
        },
      ],
      { value: 5 }
    );
    assert.deepEqual(serialThis, [5]);
  });

  it('delays asynchronously', async () => {
    let resolved = false;
    const promise = Common.delayAsync(1).then(() => {
      resolved = true;
    });
    assert.equal(resolved, false);
    await promise;
    assert.equal(resolved, true);
  });

  it('writes UTF-8 BOM when csvUseUtf8Bom is enabled', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-common-'));
    const fileWithBom = path.join(rootPath, 'with-bom.csv');
    const fileWithoutBom = path.join(rootPath, 'without-bom.csv');
    const fileNonUtf8 = path.join(rootPath, 'non-utf8.csv');

    const previousEncoding = Common.csvFileEncoding;
    const previousUseUtf8Bom = Common.csvUseUtf8Bom;
    const previousAlwaysQuoted = Common.csvAlwaysQuoted;

    try {
      Common.csvFileEncoding = 'utf8';
      Common.csvUseUtf8Bom = true;
      Common.csvAlwaysQuoted = false;
      await Common.writeCsvFileAsync(fileWithBom, [{ Id: '001', Name: 'Acme' }], true, ['Id', 'Name'], true);

      const withBomContent = fs.readFileSync(fileWithBom, 'utf8');
      assert.equal(withBomContent.startsWith('\uFEFF'), true);

      Common.csvUseUtf8Bom = false;
      await Common.writeCsvFileAsync(fileWithoutBom, [{ Id: '001', Name: 'Acme' }], true, ['Id', 'Name'], true);

      const withoutBomContent = fs.readFileSync(fileWithoutBom, 'utf8');
      assert.equal(withoutBomContent.startsWith('\uFEFF'), false);

      Common.csvFileEncoding = 'latin1';
      Common.csvUseUtf8Bom = true;
      await Common.writeCsvFileAsync(fileNonUtf8, [{ Id: '001', Name: 'Acme' }], true, ['Id', 'Name'], true);

      const nonUtf8Buffer = fs.readFileSync(fileNonUtf8);
      assert.equal(nonUtf8Buffer.length > 2, true);
      assert.equal(nonUtf8Buffer[0], 0x49);
      assert.equal(nonUtf8Buffer[1], 0x64);
    } finally {
      Common.csvFileEncoding = previousEncoding;
      Common.csvUseUtf8Bom = previousUseUtf8Bom;
      Common.csvAlwaysQuoted = previousAlwaysQuoted;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('applies csvUseUtf8Bom on regular CSV read and ignores it for internal CSV read', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-common-'));
    const sourceFile = path.join(rootPath, 'bom-source.csv');
    fs.writeFileSync(sourceFile, '\uFEFFId,Name\n001,Acme\n', 'utf8');

    const previousDelimiter = Common.csvReadFileDelimiter;
    const previousEncoding = Common.csvFileEncoding;
    const previousUseUtf8Bom = Common.csvUseUtf8Bom;

    try {
      Common.csvReadFileDelimiter = ',';
      Common.csvFileEncoding = 'utf8';

      Common.csvUseUtf8Bom = true;
      const withBomHandling = await Common.readCsvFileAsync(sourceFile);
      assert.equal(withBomHandling[0]['Id'], '001');
      assert.equal(withBomHandling[0]['Name'], 'Acme');

      Common.csvUseUtf8Bom = false;
      const withoutBomHandling = await Common.readCsvFileAsync(sourceFile);
      assert.equal(withoutBomHandling[0]['\uFEFFId'], '001');
      assert.equal(withoutBomHandling[0]['Name'], 'Acme');

      const internalRead = await Common.readCsvFileAsync(sourceFile, 0, undefined, false, true);
      assert.equal(internalRead[0]['Id'], '001');
      assert.equal(internalRead[0]['Name'], 'Acme');
    } finally {
      Common.csvReadFileDelimiter = previousDelimiter;
      Common.csvFileEncoding = previousEncoding;
      Common.csvUseUtf8Bom = previousUseUtf8Bom;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('writes regular CSV values quoted when csvAlwaysQuoted is enabled', async () => {
    const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-common-'));
    const quotedFile = path.join(rootPath, 'quoted.csv');
    const unquotedFile = path.join(rootPath, 'unquoted.csv');

    const previousAlwaysQuoted = Common.csvAlwaysQuoted;
    const previousUseUtf8Bom = Common.csvUseUtf8Bom;
    const previousEncoding = Common.csvFileEncoding;
    const previousDelimiter = Common.csvWriteFileDelimiter;

    try {
      Common.csvUseUtf8Bom = false;
      Common.csvFileEncoding = 'utf8';
      Common.csvWriteFileDelimiter = ';';

      Common.csvAlwaysQuoted = true;
      await Common.writeCsvFileAsync(quotedFile, [{ Id: '001', Name: 'Acme' }], true, ['Id', 'Name'], true);
      const quotedContent = fs.readFileSync(quotedFile, 'utf8').split(/\r?\n/);
      assert.equal(quotedContent[0], '"Id";"Name"');
      assert.equal(quotedContent[1], '"001";"Acme"');

      Common.csvAlwaysQuoted = false;
      await Common.writeCsvFileAsync(unquotedFile, [{ Id: '001', Name: 'Acme' }], true, ['Id', 'Name'], true);
      const unquotedContent = fs.readFileSync(unquotedFile, 'utf8').split(/\r?\n/);
      assert.equal(unquotedContent[0], 'Id;Name');
      assert.equal(unquotedContent[1], '001;Acme');
    } finally {
      Common.csvAlwaysQuoted = previousAlwaysQuoted;
      Common.csvUseUtf8Bom = previousUseUtf8Bom;
      Common.csvFileEncoding = previousEncoding;
      Common.csvWriteFileDelimiter = previousDelimiter;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('aborts with user prompt', async () => {
    const originalLogger = Common.logger;
    const warnings: string[] = [];
    const logs: string[] = [];
    const logger: LoggerType = {
      log: (...args: string[]) => {
        logs.push(args.join(' '));
      },
      logColored: (...args: string[]) => {
        logs.push(args.join(' '));
      },
      warn: (...args: string[]) => {
        warnings.push(args.join(' '));
      },
      error: (...args: string[]) => {
        warnings.push(args.join(' '));
      },
      verboseFile: () => undefined,
      yesNoPromptAsync: async () => false,
      textPromptAsync: async () => '',
      getResourceString: () => '',
    };
    Common.logger = logger;

    let thrown = false;
    try {
      await Common.abortWithPrompt('warn', true, 'prompt', 'abort');
    } catch (error) {
      thrown = error instanceof CommandAbortedByUserError;
    }
    assert.equal(thrown, true);

    Common.logger = {
      ...logger,
      yesNoPromptAsync: async () => true,
    };
    await Common.abortWithPrompt('warn', true, 'prompt', 'abort');
    assert.ok(warnings.length > 0);

    Common.logger = originalLogger;
  });
});
