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
import { Common } from '../../../src/modules/common/Common.js';
import { DATA_MEDIA_TYPE } from '../../../src/modules/common/Enumerations.js';
import {
  CSV_ISSUES_ERRORS_FILENAME,
  CSV_SOURCE_FILE_SUFFIX,
  VALUE_MAPPING_CSV_FILENAME,
} from '../../../src/modules/constants/Constants.js';
import LoggingContext from '../../../src/modules/logging/LoggingContext.js';
import LoggingService from '../../../src/modules/logging/LoggingService.js';
import { SuccessExit } from '../../../src/modules/models/common/SuccessExit.js';
import type { IMetadataProvider } from '../../../src/modules/models/job/IMetadataProvider.js';
import MigrationJob from '../../../src/modules/models/job/MigrationJob.js';
import type MigrationJobTask from '../../../src/modules/models/job/MigrationJobTask.js';
import Script from '../../../src/modules/models/script/Script.js';
import ScriptOrg from '../../../src/modules/models/script/ScriptOrg.js';
import SFieldDescribe from '../../../src/modules/models/sf/SFieldDescribe.js';
import SObjectDescribe from '../../../src/modules/models/sf/SObjectDescribe.js';
import OrgConnectionAdapter from '../../../src/modules/org/OrgConnectionAdapter.js';
import ScriptLoader from '../../../src/modules/script/ScriptLoader.js';
import type { CsvIssueRowType } from '../../../src/modules/csv/models/CsvIssueRowType.js';

type FieldInitType = Partial<SFieldDescribe> & { name: string };
type OrgConnectionStubType = {
  accessToken?: string;
  instanceUrl?: string;
  baseUrl?: () => string;
  getAuthInfoFields?: () => { username?: string; instanceUrl?: string };
  singleRecordQuery?: <T>(query: string) => Promise<T>;
  query?: <T>(query: string) => Promise<{ records: T[] }>;
};

type MigrationJobCsvPrivateApiType = {
  _getCsvTasks: () => MigrationJobTask[];
  _addMissingIdColumnFinalPass: (csvTasks: MigrationJobTask[]) => Array<Record<string, string | null>>;
  _addMissingIdColumn: (
    objectName: string,
    sourceCsvFilename: string,
    currentFileMap: Map<string, Record<string, unknown>>,
    firstRow: Record<string, unknown>
  ) => void;
  cachedCsvContent: {
    csvDataCacheMap: Map<string, Map<string, Record<string, unknown>>>;
    updatedFilenames: Set<string>;
  };
};

const createTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-csv-'));

const createLoggingService = (
  rootPath: string,
  options?: { diagnostic?: boolean; anonymise?: boolean; anonymiseSeed?: string }
): LoggingService => {
  const diagnostic = Boolean(options?.diagnostic);
  const context = new LoggingContext({
    commandName: 'run',
    rootPath,
    fileLogEnabled: diagnostic,
    verbose: diagnostic,
    anonymise: Boolean(options?.anonymise),
    anonymiseSeed: options?.anonymiseSeed ?? '',
  });
  return new LoggingService(context);
};

const createDescribe = (objectName: string, fields: FieldInitType[]): SObjectDescribe => {
  const describe = new SObjectDescribe({ name: objectName, createable: true, updateable: true });
  fields.forEach((field) => {
    describe.addField(
      new SFieldDescribe({
        ...field,
        isDescribed: true,
      })
    );
  });
  return describe;
};

const createMetadataProvider = (describes: Map<string, SObjectDescribe>): IMetadataProvider => ({
  describeSObjectAsync: async (objectName: string): Promise<SObjectDescribe> => {
    const describe = describes.get(objectName);
    if (!describe) {
      throw new Error(`Missing describe for ${objectName}`);
    }
    return describe;
  },
});

const createOrg = (script: Script, name: string, media: DATA_MEDIA_TYPE): ScriptOrg => {
  const org = new ScriptOrg();
  org.name = name;
  org.media = media;
  org.script = script;
  return org;
};

const createOrgConnectionStub = (): OrgConnectionStubType => ({
  accessToken: 'token',
  instanceUrl: 'https://example.com',
  getAuthInfoFields: () => ({
    username: 'test@example.com',
    instanceUrl: 'https://example.com',
  }),
  singleRecordQuery: async <T>(query: string): Promise<T> => {
    if (query.includes('FROM Organization')) {
      return { OrganizationType: 'Developer Edition', IsSandbox: false } as T;
    }
    if (query.includes('FROM Account')) {
      return { IsPersonAccount: false } as T;
    }
    return {} as T;
  },
});

const loadScriptAsync = async (rootPath: string, logger: LoggingService, payload: unknown): Promise<Script> => {
  const exportPath = path.join(rootPath, 'export.json');
  fs.writeFileSync(exportPath, JSON.stringify(payload, null, 2), 'utf8');
  const script = await ScriptLoader.loadFromPathAsync(rootPath, logger);
  script.logger = logger;
  script.sourceOrg = createOrg(script, 'csvfile', DATA_MEDIA_TYPE.File);
  script.targetOrg = createOrg(script, 'target', DATA_MEDIA_TYPE.Org);
  return script;
};

describe('MigrationJob CSV processing', () => {
  let originalLogger: typeof Common.logger;
  let originalConnection: typeof OrgConnectionAdapter.getConnectionForAliasAsync;

  beforeEach(() => {
    originalLogger = Common.logger;
    originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => createOrgConnectionStub() as never;
  });

  afterEach(() => {
    Common.logger = originalLogger;
    OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
  });

  it('copies raw CSV and adds missing Id column', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Name FROM Account',
          operation: 'Upsert',
        },
      ],
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    await Common.writeCsvFileAsync(path.join(script.rawSourceDirectoryPath, 'Account.csv'), [{ Name: 'Acme' }], true);

    await job.processCsvAsync();

    const sourceFile = Common.getCSVFilename(script.sourceDirectoryPath, 'Account', CSV_SOURCE_FILE_SUFFIX);
    const rows = await Common.readCsvFileAsync(sourceFile);
    assert.equal(rows.length, 1);
    assert.ok(Object.prototype.hasOwnProperty.call(rows[0], 'Id'));
    assert.equal(typeof rows[0]['Id'], 'string');
    assert.ok(String(rows[0]['Id']).length > 0);
    assert.equal(rows[0]['Name'], 'Acme');
  });

  it('fills empty Id values during final csv repair pass', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Id, Name FROM Account',
          operation: 'Upsert',
          externalId: 'Name',
        },
      ],
      excludeIdsFromCSVFiles: false,
      promptOnIssuesInCSVFiles: false,
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: false, creatable: false },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    fs.writeFileSync(path.join(script.rawSourceDirectoryPath, 'Account.csv'), 'Id,Name\n,Acme\n', 'utf8');

    await job.processCsvAsync();

    const sourceFile = Common.getCSVFilename(script.sourceDirectoryPath, 'Account', CSV_SOURCE_FILE_SUFFIX);
    const rows = await Common.readCsvFileAsync(sourceFile);
    assert.equal(rows.length, 1);
    assert.equal(typeof rows[0]['Id'], 'string');
    assert.ok(String(rows[0]['Id']).length > 0);
    assert.equal(rows[0]['Name'], 'Acme');
  });

  it('adds random Id values in final CSV repair pass and reports the issue', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Name FROM Account',
          operation: 'Upsert',
        },
      ],
      excludeIdsFromCSVFiles: true,
      promptOnIssuesInCSVFiles: false,
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    await Common.writeCsvFileAsync(path.join(script.rawSourceDirectoryPath, 'Account.csv'), [{ Name: 'Acme' }], true);

    const privateApi = job as unknown as MigrationJobCsvPrivateApiType;
    const csvTasks = privateApi._getCsvTasks();
    assert.equal(csvTasks.length, 1);
    const task = csvTasks[0];
    const sourceFile = Common.getCSVFilename(script.sourceDirectoryPath, 'Account', CSV_SOURCE_FILE_SUFFIX);

    privateApi.cachedCsvContent.csvDataCacheMap.set(sourceFile, new Map([['row-1', { Name: 'Acme' }]]));
    const issues = privateApi._addMissingIdColumnFinalPass([task]);

    const fileMap = privateApi.cachedCsvContent.csvDataCacheMap.get(sourceFile);
    assert.ok(fileMap);
    const row = fileMap?.values().next().value as Record<string, unknown> | undefined;
    assert.ok(row);
    assert.equal(typeof row?.['Id'], 'string');
    assert.ok(String(row?.['Id']).length > 0);
    assert.equal(row?.['Name'], 'Acme');
    assert.ok(privateApi.cachedCsvContent.updatedFilenames.has(sourceFile));

    assert.equal(issues.length, 1);
    assert.equal(issues[0]['sObject name'], 'Account');
    assert.equal(issues[0]['Field name'], 'Id');
    assert.ok(String(issues[0]['Error']).toUpperCase().includes('MISSING COLUMN'));
  });

  it('adds missing Id by post-processing when initial Id fix is skipped', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;
    const warnCalls: string[] = [];
    const originalWarn = logger.warn.bind(logger) as (...args: unknown[]) => void;
    (logger as unknown as { warn: (...args: unknown[]) => void }).warn = (...args: unknown[]): void => {
      const firstArg = args[0];
      warnCalls.push(typeof firstArg === 'string' ? firstArg : String(firstArg));
      originalWarn(...args);
    };

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Name FROM Account',
          operation: 'Upsert',
        },
      ],
      excludeIdsFromCSVFiles: true,
      promptOnIssuesInCSVFiles: false,
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    await Common.writeCsvFileAsync(path.join(script.rawSourceDirectoryPath, 'Account.csv'), [{ Name: 'Acme' }], true);

    const privateApi = job as unknown as MigrationJobCsvPrivateApiType;
    const originalAddMissingIdColumn = privateApi._addMissingIdColumn.bind(privateApi);
    privateApi._addMissingIdColumn = (): void => {
      // Intentionally disable the first-pass Id repair to validate the final post-processing pass.
    };

    try {
      await job.processCsvAsync();
    } finally {
      privateApi._addMissingIdColumn = originalAddMissingIdColumn;
    }

    const sourceFile = Common.getCSVFilename(script.sourceDirectoryPath, 'Account', CSV_SOURCE_FILE_SUFFIX);
    const sourceRows = await Common.readCsvFileAsync(sourceFile);
    assert.equal(sourceRows.length, 1);
    assert.equal(typeof sourceRows[0]['Id'], 'string');
    assert.ok(String(sourceRows[0]['Id']).length > 0);
    assert.equal(sourceRows[0]['Name'], 'Acme');

    const reportPath = path.join(script.reportsDirectoryPath, CSV_ISSUES_ERRORS_FILENAME);
    const reportRows = await Common.readCsvFileAsync(reportPath);
    const idIssue = reportRows.find(
      (row) =>
        row['sObject name'] === 'Account' &&
        row['Field name'] === 'Id' &&
        String(row['Error']).toUpperCase().includes('MISSING COLUMN')
    );
    assert.ok(idIssue);
    assert.ok(warnCalls.includes('incorrectCsvFiles'));
  });

  it('writes normalized source CSV headers using canonical field casing', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT ID, NAME, TYPE FROM Account',
          operation: 'Upsert',
          externalId: 'Name',
        },
      ],
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: false, creatable: false },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
          { name: 'Type', updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    fs.writeFileSync(
      path.join(script.rawSourceDirectoryPath, 'Account.csv'),
      '"ID","NAME","TYPE"\n"001000000000001AAA","Acme","Customer"\n',
      'utf8'
    );

    await job.processCsvAsync();

    const sourceFile = Common.getCSVFilename(script.sourceDirectoryPath, 'Account', CSV_SOURCE_FILE_SUFFIX);
    const sourceContent = fs.readFileSync(sourceFile, 'utf8');
    const sourceHeader = (sourceContent.split(/\r?\n/)[0] ?? '').replace(/^\uFEFF/, '');
    assert.equal(sourceHeader, '"Id","Name","Type"');

    const rows = await Common.readCsvFileAsync(sourceFile);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]['Id'], '001000000000001AAA');
    assert.equal(rows[0]['Name'], 'Acme');
    assert.equal(rows[0]['Type'], 'Customer');
  });

  it('writes *_source CSV files using internal comma/quoted/utf8 format', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Id, Name, Type FROM Account',
          operation: 'Upsert',
        },
      ],
      promptOnIssuesInCSVFiles: false,
      csvFileDelimiter: ';',
      csvFileEncoding: 'utf16le',
      csvWriteUpperCaseHeaders: true,
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
          { name: 'Type', updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    try {
      await job.loadAsync();
      await job.setupAsync();

      fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
      fs.writeFileSync(
        path.join(script.rawSourceDirectoryPath, 'Account.csv'),
        'Name;Type\nAcme;Customer\n',
        'utf16le'
      );

      await job.processCsvAsync();

      const sourceFile = Common.getCSVFilename(script.sourceDirectoryPath, 'Account', CSV_SOURCE_FILE_SUFFIX);
      const sourceContent = fs.readFileSync(sourceFile, 'utf8');
      const sourceHeader = (sourceContent.split(/\r?\n/)[0] ?? '').replace(/^\uFEFF/, '');

      assert.ok(sourceHeader.startsWith('"') && sourceHeader.endsWith('"'), 'source header must be quoted');
      assert.ok(sourceHeader.includes(','), 'source header must use comma delimiter');
      assert.equal(sourceContent.includes('\u0000'), false, 'source file must be UTF-8 text');

      const rows = await Common.readCsvFileAsync(sourceFile, 0, undefined, false, true);
      assert.equal(rows.length, 1, 'source row count mismatch');
      assert.equal(rows[0]['Name'], 'Acme', 'source Name value mismatch');
      assert.equal(rows[0]['Type'], 'Customer', 'source Type value mismatch');
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('writes CSV issues report when a source CSV file is missing', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Name FROM Account',
          operation: 'Upsert',
        },
      ],
      promptOnIssuesInCSVFiles: false,
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    await job.processCsvAsync();

    const reportPath = path.join(script.reportsDirectoryPath, CSV_ISSUES_ERRORS_FILENAME);
    const reportContent = fs.readFileSync(reportPath, 'utf8');
    assert.ok(reportContent.includes('MISSING CSV FILE'));
  });

  it('writes CSV issues report when a source CSV file is missing in validate-only mode', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Name FROM Account',
          operation: 'Upsert',
        },
      ],
      promptOnIssuesInCSVFiles: false,
    });
    script.validateCSVFilesOnly = true;

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    await assert.rejects(
      async () => job.processCsvAsync(),
      (error: unknown) => {
        assert.ok(error instanceof SuccessExit);
        return true;
      }
    );

    const reportPath = path.join(script.reportsDirectoryPath, CSV_ISSUES_ERRORS_FILENAME);
    const reportContent = fs.readFileSync(reportPath, 'utf8');
    assert.ok(reportContent.includes('MISSING CSV FILE'));
  });

  it('splits UserAndGroup CSV into missing User sources', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'User',
          query: 'SELECT Id, Name FROM User',
          operation: 'Readonly',
        },
      ],
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'User',
        createDescribe('User', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    await Common.writeCsvFileAsync(
      path.join(script.rawSourceDirectoryPath, 'UserAndGroup.csv'),
      [
        { Id: '005000000000001', Name: 'User One' },
        { Id: '00G000000000001', Name: 'Group One' },
      ],
      true
    );

    await job.processCsvAsync();

    const rawUserPath = Common.getCSVFilename(script.rawSourceDirectoryPath, 'User');
    const rawGroupPath = Common.getCSVFilename(script.rawSourceDirectoryPath, 'Group');
    assert.ok(fs.existsSync(rawUserPath));
    assert.ok(!fs.existsSync(rawGroupPath));

    const sourceUserPath = Common.getCSVFilename(script.sourceDirectoryPath, 'User', CSV_SOURCE_FILE_SUFFIX);
    const rows = await Common.readCsvFileAsync(sourceUserPath);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]['Id'], '005000000000001');

    const userAndGroupSourcePath = Common.getCSVFilename(
      script.sourceDirectoryPath,
      'UserAndGroup',
      CSV_SOURCE_FILE_SUFFIX
    );
    assert.ok(!fs.existsSync(userAndGroupSourcePath));
  });

  it('applies value mapping during update processing for CSV sources', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Name, Type FROM Account',
          operation: 'Upsert',
          useValuesMapping: true,
        },
      ],
    });
    script.simulationMode = true;

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
          { name: 'Type', updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    await Common.writeCsvFileAsync(
      path.join(script.basePath, VALUE_MAPPING_CSV_FILENAME),
      [
        {
          ObjectName: 'Account',
          FieldName: 'Type',
          RawValue: 'Customer',
          Value: 'Client',
        },
      ],
      true
    );

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    await Common.writeCsvFileAsync(
      path.join(script.rawSourceDirectoryPath, 'Account.csv'),
      [{ Id: '001000000000001', Name: 'Acme', Type: 'Customer' }],
      true
    );

    await job.processCsvAsync();

    const sourceFile = Common.getCSVFilename(script.sourceDirectoryPath, 'Account', CSV_SOURCE_FILE_SUFFIX);
    const rows = await Common.readCsvFileAsync(sourceFile);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]['Type'], 'Customer');

    await job.prepareAsync();
    const task = job.getTaskBySObjectName('Account');
    assert.ok(task);
    await task?.retrieveRecordsAsync('forwards', false);
    await task?.updateRecordsAsync();

    const sourceRecord = task?.sourceData.records[0];
    const targetRecord = sourceRecord ? task?.sourceToTargetRecordMap.get(sourceRecord) : undefined;
    assert.ok(targetRecord);
    assert.equal(targetRecord?.['Type'], 'Client');
  });

  it('counts CSV records during prepare', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Name FROM Account',
          operation: 'Upsert',
        },
      ],
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    await Common.writeCsvFileAsync(
      path.join(script.rawSourceDirectoryPath, 'Account.csv'),
      [{ Name: 'Acme' }, { Name: 'Globex' }],
      true
    );

    await job.processCsvAsync();
    await job.prepareAsync();

    assert.equal(job.recordCounts.get('Account'), 2);
    assert.equal(job.totalRecordCount, 2);
  });

  it('supports regex and eval value mapping conversions', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query:
            'SELECT Name, Type, Status__c, Flag__c, Notes__c, Expr__c, Fallback__c, MessageExpr__c, BoolExpr__c FROM Account',
          operation: 'Upsert',
          useValuesMapping: true,
        },
      ],
    });
    script.simulationMode = true;

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
          { name: 'Type', updateable: true, creatable: true },
          { name: 'Status__c', updateable: true, creatable: true, custom: true },
          { name: 'Flag__c', updateable: true, creatable: true, custom: true, type: 'boolean' },
          { name: 'Notes__c', updateable: true, creatable: true, custom: true },
          { name: 'Expr__c', updateable: true, creatable: true, custom: true },
          { name: 'Fallback__c', updateable: true, creatable: true, custom: true },
          { name: 'MessageExpr__c', updateable: true, creatable: true, custom: true },
          { name: 'BoolExpr__c', updateable: true, creatable: true, custom: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    await Common.writeCsvFileAsync(
      path.join(script.basePath, VALUE_MAPPING_CSV_FILENAME),
      [
        {
          ObjectName: 'Account',
          FieldName: 'Type',
          RawValue: '/Customer/',
          Value: 'Client',
        },
        {
          ObjectName: 'Account',
          FieldName: 'Status__c',
          RawValue: 'Enterprise',
          Value: 'eval("RAW_VALUE" + "-X")',
        },
        {
          ObjectName: 'Account',
          FieldName: 'Flag__c',
          RawValue: '1',
          Value: 'true',
        },
        {
          ObjectName: 'Account',
          FieldName: 'Notes__c',
          RawValue: 'NA',
          Value: '#N/A',
        },
        {
          ObjectName: 'Account',
          FieldName: 'Expr__c',
          RawValue: 'TOKEN',
          Value: 'eval(BROKEN + RAW_VALUE)',
        },
        {
          ObjectName: 'Account',
          FieldName: 'Fallback__c',
          RawValue: 'BROKEN_SYNTAX',
          Value: 'eval(RAW_VALUE + )',
        },
        {
          ObjectName: 'Account',
          FieldName: 'MessageExpr__c',
          RawValue: 'Source value',
          Value: "eval('RAW_VALUE was replaced')",
        },
        {
          ObjectName: 'Account',
          FieldName: 'BoolExpr__c',
          RawValue: 'false',
          Value: 'eval(!RAW_VALUE)',
        },
      ],
      true
    );

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    await Common.writeCsvFileAsync(
      path.join(script.rawSourceDirectoryPath, 'Account.csv'),
      [
        {
          Id: '001000000000001',
          Name: 'Acme',
          Type: 'Customer',
          'Status__c': 'Enterprise',
          'Flag__c': '1',
          'Notes__c': 'NA',
          'Expr__c': 'TOKEN',
          'Fallback__c': 'BROKEN_SYNTAX',
          'MessageExpr__c': 'Source value',
          'BoolExpr__c': 'false',
        },
      ],
      true
    );

    await job.processCsvAsync();
    await job.prepareAsync();

    const task = job.getTaskBySObjectName('Account');
    assert.ok(task);
    await task?.retrieveRecordsAsync('forwards', false);
    await task?.updateRecordsAsync();

    const sourceRecord = task?.sourceData.records[0];
    const targetRecord = sourceRecord ? task?.sourceToTargetRecordMap.get(sourceRecord) : undefined;
    assert.ok(targetRecord);
    assert.equal(targetRecord?.Type, 'Client');
    assert.equal(targetRecord?.['Status__c'], 'Enterprise-X');
    assert.equal(targetRecord?.['Flag__c'], true);
    assert.equal(targetRecord?.['Notes__c'], null);
    assert.equal(targetRecord?.['Expr__c'], 'BROKENTOKEN');
    assert.equal(targetRecord?.['Fallback__c'], 'BROKEN_SYNTAX');
    assert.equal(targetRecord?.['MessageExpr__c'], 'Source value was replaced');
    assert.equal(targetRecord?.['BoolExpr__c'], true);
  });

  it('loads value mapping for org-based processing', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Name, Type FROM Account',
          operation: 'Upsert',
          useValuesMapping: true,
        },
      ],
    });

    script.sourceOrg = createOrg(script, 'source', DATA_MEDIA_TYPE.Org);
    script.targetOrg = createOrg(script, 'target', DATA_MEDIA_TYPE.Org);

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
          { name: 'Type', updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    await Common.writeCsvFileAsync(
      path.join(script.basePath, VALUE_MAPPING_CSV_FILENAME),
      [
        {
          ObjectName: 'Account',
          FieldName: 'Type',
          RawValue: 'Customer',
          Value: 'Client',
        },
      ],
      true
    );

    await job.processCsvAsync();

    const key = 'AccountType';
    const map = job.valueMapping.get(key);
    assert.ok(map);
    assert.equal(map?.get('Customer'), 'Client');
  });

  it('writes CSV issues report when required columns are missing', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Name, Type FROM Account',
          operation: 'Upsert',
        },
      ],
      promptOnIssuesInCSVFiles: false,
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
          { name: 'Type', updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    await Common.writeCsvFileAsync(path.join(script.rawSourceDirectoryPath, 'Account.csv'), [{ Name: 'Acme' }], true);

    await job.processCsvAsync();

    const reportPath = path.join(script.reportsDirectoryPath, CSV_ISSUES_ERRORS_FILENAME);
    const reportContent = fs.readFileSync(reportPath, 'utf8');
    assert.ok(reportContent.includes('MISSING COLUMN IN THE CSV FILE'));
  });

  it('anonymizes CSV issues diagnostic dump lines when anonymise is enabled', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath, {
      diagnostic: true,
      anonymise: true,
      anonymiseSeed: 'csv-issues-seed',
    });
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Name FROM Account',
          operation: 'Upsert',
        },
      ],
      promptOnIssuesInCSVFiles: false,
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    job.csvIssues = [
      {
        'Date update': '01/01/2026 00:00',
        'sObject name': 'Account',
        'Field name': 'Name',
        'Field value': 'user@example.com',
        'Parent SObject name': '',
        'Parent field name': '',
        'Parent field value': '',
        Error: 'MISSING CSV FILE',
      },
    ] as CsvIssueRowType[];

    fs.mkdirSync(script.reportsDirectoryPath, { recursive: true });
    await (job as unknown as { _writeCsvIssuesReportAsync: () => Promise<void> })._writeCsvIssuesReportAsync();

    const logContent = fs.readFileSync(logger.context.logFilePath, 'utf8');
    assert.equal(logContent.includes('user@example.com'), false);
    assert.match(logContent, /email<[A-F0-9]{16}>/u);
  });

  it('skips readonly lookup fields during CSV missing-parent validation and repair', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Parent__c',
          query: 'SELECT Id, Name FROM Parent__c',
          operation: 'Readonly',
        },
        {
          name: 'Child__c',
          query: 'SELECT Id, Name, Parent__c FROM Child__c',
          operation: 'Insert',
        },
      ],
      promptOnIssuesInCSVFiles: false,
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'Parent__c',
        createDescribe('Parent__c', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
      [
        'Child__c',
        createDescribe('Child__c', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
          {
            name: 'Parent__c',
            custom: true,
            lookup: true,
            referenceTo: ['Parent__c'],
            referencedObjectType: 'Parent__c',
            updateable: false,
            creatable: false,
          },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    await Common.writeCsvFileAsync(
      path.join(script.rawSourceDirectoryPath, 'Parent__c.csv'),
      [{ Id: 'a010000000000001AA', Name: 'Parent One' }],
      true
    );
    await Common.writeCsvFileAsync(
      path.join(script.rawSourceDirectoryPath, 'Child__c.csv'),
      [{ Id: 'a020000000000001AA', Name: 'Child One', 'Parent__c': 'a010000000000999AA' }],
      true
    );

    await job.processCsvAsync();

    const reportPath = path.join(script.reportsDirectoryPath, CSV_ISSUES_ERRORS_FILENAME);
    assert.equal(fs.existsSync(reportPath), false);

    const sourcePath = Common.getCSVFilename(script.sourceDirectoryPath, 'Child__c', CSV_SOURCE_FILE_SUFFIX);
    const rows = await Common.readCsvFileAsync(sourcePath);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]['Parent__c'], 'a010000000000999AA');
    assert.equal(Object.prototype.hasOwnProperty.call(rows[0], 'Parent__r.Name'), false);
  });

  it('removes stale CSV issues report before validation', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Id, Name, Type FROM Account',
          operation: 'Upsert',
        },
      ],
      promptOnIssuesInCSVFiles: false,
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
          { name: 'Type', updateable: true, creatable: true },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    await Common.writeCsvFileAsync(
      path.join(script.rawSourceDirectoryPath, 'Account.csv'),
      [{ Id: '001000000000001', Name: 'Acme', Type: 'Customer' }],
      true
    );

    fs.mkdirSync(script.reportsDirectoryPath, { recursive: true });
    const reportPath = path.join(script.reportsDirectoryPath, CSV_ISSUES_ERRORS_FILENAME);
    fs.writeFileSync(reportPath, 'stale', 'utf8');

    await job.processCsvAsync();

    assert.ok(!fs.existsSync(reportPath));
  });

  it('builds legacy RecordType lookup key with NamespacePrefix and SobjectType', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'RecordType',
          query: 'SELECT Id, DeveloperName, NamespacePrefix, SobjectType FROM RecordType',
          operation: 'Readonly',
        },
        {
          name: 'Account',
          query: 'SELECT Name, RecordTypeId FROM Account',
          operation: 'Upsert',
        },
      ],
      promptOnIssuesInCSVFiles: false,
      excludeIdsFromCSVFiles: true,
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'RecordType',
        createDescribe('RecordType', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'DeveloperName', updateable: true, creatable: true },
          { name: 'NamespacePrefix', updateable: true, creatable: true },
          { name: 'SobjectType', updateable: true, creatable: true },
        ]),
      ],
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
          {
            name: 'RecordTypeId',
            updateable: true,
            creatable: true,
            lookup: true,
            referenceTo: ['RecordType'],
            referencedObjectType: 'RecordType',
          },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    await Common.writeCsvFileAsync(
      path.join(script.rawSourceDirectoryPath, 'RecordType.csv'),
      [
        {
          Id: '012000000000001',
          DeveloperName: 'TestAccountRT',
          NamespacePrefix: 'nmsp',
          SobjectType: 'Account',
        },
      ],
      true
    );
    await Common.writeCsvFileAsync(
      path.join(script.rawSourceDirectoryPath, 'Account.csv'),
      [
        {
          Name: 'Acme',
          'RecordType.DeveloperName': 'TestAccountRT',
          'RecordType.NamespacePrefix': 'nmsp',
          'RecordType.SobjectType': 'Account',
        },
      ],
      true
    );

    await job.processCsvAsync();

    const accountSourcePath = Common.getCSVFilename(script.sourceDirectoryPath, 'Account', CSV_SOURCE_FILE_SUFFIX);
    const rows = await Common.readCsvFileAsync(accountSourcePath);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]['RecordType.$$DeveloperName$NamespacePrefix$SobjectType'], 'TestAccountRT;nmsp;Account');
    assert.equal(rows[0]['RecordTypeId'], '012000000000001');
  });

  it('resolves lookup conflicts when id and reference mismatch', async () => {
    const rootPath = createTempDir();
    const logger = createLoggingService(rootPath);
    Common.logger = logger;

    const script = await loadScriptAsync(rootPath, logger, {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Id, Name FROM Account',
          operation: 'Upsert',
        },
        {
          name: 'TestObject2__c',
          query: 'SELECT Id, Name, Account__c FROM TestObject2__c',
          operation: 'Insert',
        },
      ],
      promptOnIssuesInCSVFiles: false,
    });

    const describes = new Map<string, SObjectDescribe>([
      [
        'Account',
        createDescribe('Account', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', nameField: true, updateable: true, creatable: true },
        ]),
      ],
      [
        'TestObject2__c',
        createDescribe('TestObject2__c', [
          { name: 'Id', updateable: true, creatable: true },
          { name: 'Name', updateable: true, creatable: true },
          {
            name: 'Account__c',
            updateable: true,
            creatable: true,
            lookup: true,
            custom: true,
            referenceTo: ['Account'],
            referencedObjectType: 'Account',
          },
        ]),
      ],
    ]);
    const metadataProvider = createMetadataProvider(describes);
    const job = new MigrationJob({ script, metadataProvider });

    await job.loadAsync();
    await job.setupAsync();

    fs.mkdirSync(script.rawSourceDirectoryPath, { recursive: true });
    await Common.writeCsvFileAsync(
      path.join(script.rawSourceDirectoryPath, 'Account.csv'),
      [
        { Id: 'A000000000000001', Name: 'Acme One' },
        { Id: 'A000000000000002', Name: 'Acme Two' },
      ],
      true
    );
    await Common.writeCsvFileAsync(
      path.join(script.rawSourceDirectoryPath, 'TestObject2__c.csv'),
      [
        {
          Id: 'TO2A0000000000001',
          Name: 'TO2 One',
          'Account__c': 'A000000000000001',
          'Account__r.Name': 'Acme Two',
        },
      ],
      true
    );

    await job.processCsvAsync();

    const sourcePath = Common.getCSVFilename(script.sourceDirectoryPath, 'TestObject2__c', CSV_SOURCE_FILE_SUFFIX);
    const rows = await Common.readCsvFileAsync(sourcePath);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]['Account__r.Name'], 'Acme One');
  });
});
