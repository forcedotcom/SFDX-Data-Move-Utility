/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DATA_MEDIA_TYPE, DATA_CACHE_TYPES } from '../../../src/modules/common/Enumerations.js';
import { Common } from '../../../src/modules/common/Common.js';
import { SOURCE_RECORDS_FILE_CACHE_TEMPLATE } from '../../../src/modules/constants/Constants.js';
import Script from '../../../src/modules/models/script/Script.js';
import ScriptOrg from '../../../src/modules/models/script/ScriptOrg.js';
import OrgConnectionAdapter from '../../../src/modules/org/OrgConnectionAdapter.js';
import OrgDataService from '../../../src/modules/org/OrgDataService.js';

type ConnectionStubType = {
  query: <T>(query: string) => Promise<{ records: T[]; done: boolean }>;
};

const createTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-org-'));

describe('OrgDataService', () => {
  it('reads CSV data when org media is file', async () => {
    const tempDir = createTempDir();
    const csvFile = path.join(tempDir, 'Account.csv');
    fs.writeFileSync(csvFile, 'Id,Name\n001,Acme', 'utf8');

    const script = new Script();
    script.basePath = tempDir;
    const org = new ScriptOrg();
    org.media = DATA_MEDIA_TYPE.File;
    org.name = 'csvfile';
    org.script = script;

    try {
      const service = new OrgDataService(script);
      const records = await service.queryOrgOrCsvAsync('SELECT Id FROM Account', org, csvFile, false);

      assert.equal(records.length, 1);
      assert.equal(records[0].Id, '001');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reads internal *_source CSV files in fixed comma/utf8 format', async () => {
    const tempDir = createTempDir();
    const csvFile = path.join(tempDir, 'Account_source.csv');
    fs.writeFileSync(csvFile, '"Id","Name"\n"001","Acme"\n', 'utf8');

    const previousDelimiter = Common.csvReadFileDelimiter;
    const previousEncoding = Common.csvFileEncoding;
    Common.csvReadFileDelimiter = ';';
    Common.csvFileEncoding = 'utf16le';

    const script = new Script();
    script.basePath = tempDir;
    const org = new ScriptOrg();
    org.media = DATA_MEDIA_TYPE.File;
    org.name = 'csvfile';
    org.script = script;

    try {
      const service = new OrgDataService(script);
      const records = await service.queryOrgOrCsvAsync('SELECT Id FROM Account', org, csvFile, false, {
        useInternalCsvFormat: true,
      });

      assert.equal(records.length, 1);
      assert.equal(records[0].Id, '001');
      assert.equal(records[0].Name, 'Acme');
    } finally {
      Common.csvReadFileDelimiter = previousDelimiter;
      Common.csvFileEncoding = previousEncoding;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('trims trailing carriage return in last CSV column values', async () => {
    const tempDir = createTempDir();
    const csvFile = path.join(tempDir, 'Contact_source.csv');
    fs.writeFileSync(csvFile, '"Id","AccountId","Account.Name"\r\n"003","001\r","#N/A"\r\n', 'utf8');

    const script = new Script();
    script.basePath = tempDir;
    const org = new ScriptOrg();
    org.media = DATA_MEDIA_TYPE.File;
    org.name = 'csvfile';
    org.script = script;

    try {
      const service = new OrgDataService(script);
      const records = await service.queryOrgOrCsvAsync('SELECT Id FROM Contact', org, csvFile, false, {
        useInternalCsvFormat: true,
      });

      assert.equal(records.length, 1);
      assert.equal(records[0].AccountId, '001');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('casts CSV field values using column type map', async () => {
    const tempDir = createTempDir();
    const csvFile = path.join(tempDir, 'Account.csv');
    const previousEuropeanDateFormat = Common.csvUseEuropeanDateFormat;
    const previousInsertNulls = Common.csvInsertNulls;
    Common.csvUseEuropeanDateFormat = true;
    Common.csvInsertNulls = true;
    const csvContent = [
      'Id,ISACTIVE,employees,AnnualRevenue,Name,NullToken,DateValue,DateTimeValue,Toggle',
      '001,TRUE,42,12345.67,Acme,NULL,31/12/2025,31.12.2025 14:05:06,yes',
      '002,false,-7,-12.5,Zen,#N/A,01.01.26,01/01/26 00:00,off',
    ].join('\n');
    fs.writeFileSync(csvFile, csvContent, 'utf8');

    const script = new Script();
    script.basePath = tempDir;
    const org = new ScriptOrg();
    org.media = DATA_MEDIA_TYPE.File;
    org.name = 'csvfile';
    org.script = script;

    const csvColumnDataTypeMap = new Map<string, string>([
      ['IsActive', 'boolean'],
      ['Employees', 'int'],
      ['AnnualRevenue', 'currency'],
      ['Name', 'string'],
      ['NullToken', 'string'],
      ['DateValue', 'date'],
      ['DateTimeValue', 'datetime'],
      ['Toggle', 'boolean'],
    ]);

    try {
      const service = new OrgDataService(script);
      const records = await service.queryOrgOrCsvAsync('SELECT Id FROM Account', org, csvFile, false, {
        csvColumnDataTypeMap,
      });

      assert.equal(records.length, 2);
      assert.equal(typeof records[0].ISACTIVE, 'boolean');
      assert.equal(records[0].ISACTIVE, true);
      assert.equal(typeof records[0].employees, 'number');
      assert.equal(records[0].employees, 42);
      assert.equal(typeof records[0].AnnualRevenue, 'number');
      assert.equal(records[0].AnnualRevenue, 12_345.67);
      assert.equal(records[0].Name, 'Acme');
      assert.equal(records[0].NullToken, null);
      assert.equal(records[0].DateValue, '2025-12-31');
      assert.equal(records[0].DateTimeValue, '2025-12-31T14:05:06.000Z');
      assert.equal(records[0].Toggle, true);

      assert.equal(records[1].ISACTIVE, false);
      assert.equal(records[1].employees, -7);
      assert.equal(records[1].AnnualRevenue, -12.5);
      assert.equal(records[1].Name, 'Zen');
      assert.equal(records[1].NullToken, null);
      assert.equal(records[1].DateValue, '2026-01-01');
      assert.equal(records[1].DateTimeValue, '2026-01-01T00:00:00.000Z');
      assert.equal(records[1].Toggle, false);
    } finally {
      Common.csvUseEuropeanDateFormat = previousEuropeanDateFormat;
      Common.csvInsertNulls = previousInsertNulls;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('combines user and group records using group query override', async () => {
    const script = new Script();
    script.groupQuery = "Type = 'Regular'";

    const org = new ScriptOrg();
    org.name = 'source';
    org.media = DATA_MEDIA_TYPE.Org;
    org.script = script;

    const queries: string[] = [];
    const connection: ConnectionStubType = {
      query: async <T>(query: string) => {
        queries.push(query);
        if (query.includes('FROM User')) {
          return { records: [{ Id: '005', Name: 'User' }] as T[], done: true };
        }
        return { records: [{ Id: '00G', Name: 'Group' }] as T[], done: true };
      },
    };

    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => connection as never;

    try {
      const service = new OrgDataService(script);
      const records = await service.queryUserGroupAsync('SELECT Id, Name FROM User WHERE IsActive = true', org);

      assert.equal(records.length, 2);
      assert.ok(queries.some((query) => query.includes("FROM Group WHERE Type = 'Regular'")));
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }
  });

  it('skips attachment blob download in core when attachment blob fields are disabled', async () => {
    const tempDir = createTempDir();
    const script = new Script();
    script.basePath = tempDir;
    script.binaryDataCache = DATA_CACHE_TYPES.FileCache;

    const org = new ScriptOrg();
    org.name = 'source';
    org.media = DATA_MEDIA_TYPE.Org;
    org.orgUserName = 'source@example.com';
    org.orgId = '00D000000000001';
    org.script = script;
    script.sourceOrg = org;

    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => {
      throw new Error('Connection should not be used.');
    };

    try {
      const service = new OrgDataService(script);
      const records = await service.downloadBlobFieldsAsync(org, 'Attachment', [{ Id: '001' }]);

      assert.equal(records[0].Body, undefined);
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('uses queryAll REST endpoint fallback when queryAll is not available', async () => {
    const script = new Script();

    const org = new ScriptOrg();
    org.name = 'target';
    org.media = DATA_MEDIA_TYPE.Org;
    org.script = script;

    let requestUrl = '';
    const connection = {
      query: async (query: string) => {
        void query;
        throw new Error('query() should not be called when queryAll fallback is used.');
      },
      request: async <T>(request: { method: string; url: string }) => {
        requestUrl = request.url;
        return { records: [{ Id: '001' }], done: true } as T;
      },
    };

    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => connection as never;

    try {
      const service = new OrgDataService(script);
      const records = await service.queryOrgAsync("SELECT Id FROM Account WHERE Name = 'A'", org, {
        useQueryAll: true,
      });

      assert.equal(records.length, 1);
      assert.ok(requestUrl.includes('/queryAll?q='));
      assert.ok(requestUrl.includes(encodeURIComponent("SELECT Id FROM Account WHERE Name = 'A'")));
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }
  });

  it('handles bulk query streams returned as promises', async () => {
    const script = new Script();

    const org = new ScriptOrg();
    org.name = 'source';
    org.media = DATA_MEDIA_TYPE.Org;
    org.script = script;

    const connection = {
      query: async (query: string) => {
        void query;
        throw new Error('REST query should not be used when bulk is requested.');
      },
      bulk: {
        pollInterval: 0,
        pollTimeout: 0,
        query: async (query: string) => {
          void query;
          const stream = new EventEmitter();
          setImmediate(() => {
            stream.emit('record', { Id: '001' });
            stream.emit('record', { Id: '002' });
            stream.emit('end');
          });
          return stream;
        },
      },
    };

    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => connection as never;

    try {
      const service = new OrgDataService(script);
      const records = await service.queryOrgAsync('SELECT Id FROM Account', org, { useBulk: true });

      assert.equal(records.length, 2);
      assert.equal(records[0].Id, '001');
      assert.equal(records[1].Id, '002');
      assert.equal(connection.bulk.pollInterval, script.pollingIntervalMs);
      assert.equal(connection.bulk.pollTimeout, script.pollingQueryTimeoutMs);
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
    }
  });

  it('returns cached source records without querying the org', async () => {
    const tempDir = createTempDir();
    const script = new Script();
    script.basePath = tempDir;
    script.sourceRecordsCache = DATA_CACHE_TYPES.FileCache;

    const org = new ScriptOrg();
    org.name = 'source';
    org.media = DATA_MEDIA_TYPE.Org;
    org.orgUserName = 'source@example.com';
    org.script = script;
    org.isSource = true;
    script.sourceOrg = org;

    const query = 'SELECT Id FROM Account';
    const hash = String(Common.getString32FNV1AHashcode(query, true));
    const cacheDir = script.sourceRecordsCacheDirectoryPath;
    fs.mkdirSync(cacheDir, { recursive: true });
    const cacheFile = path.join(cacheDir, SOURCE_RECORDS_FILE_CACHE_TEMPLATE(hash));
    fs.writeFileSync(cacheFile, JSON.stringify({ query, records: [{ Id: '001' }] }), 'utf8');

    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => {
      throw new Error('Connection should not be used.');
    };

    try {
      const service = new OrgDataService(script);
      const records = await service.queryOrgAsync(query, org);

      assert.equal(records.length, 1);
      assert.equal(records[0].Id, '001');
    } finally {
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
