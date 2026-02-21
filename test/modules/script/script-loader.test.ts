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
import { DATA_CACHE_TYPES, OPERATION } from '../../../src/modules/common/Enumerations.js';
import {
  CSV_SOURCE_SUB_DIRECTORY,
  CSV_TARGET_SUB_DIRECTORY,
  OBJECT_SET_SUBDIRECTORY_PREFIX,
  RAW_SOURCE_SUB_DIRECTORY,
  REPORTS_SUB_DIRECTORY,
  SCRIPT_FILE_NAME,
} from '../../../src/modules/constants/Constants.js';
import LoggingContext from '../../../src/modules/logging/LoggingContext.js';
import LoggingService from '../../../src/modules/logging/LoggingService.js';
import Script from '../../../src/modules/models/script/Script.js';
import ScriptAddonManifestDefinition from '../../../src/modules/models/script/ScriptAddonManifestDefinition.js';
import ScriptMappingItem from '../../../src/modules/models/script/ScriptMappingItem.js';
import ScriptObject from '../../../src/modules/models/script/ScriptObject.js';
import ScriptObjectSet from '../../../src/modules/models/script/ScriptObjectSet.js';
import ScriptOrg from '../../../src/modules/models/script/ScriptOrg.js';
import ScriptLoader from '../../../src/modules/script/ScriptLoader.js';

type ScriptPayloadType = Record<string, unknown>;

const createTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-script-'));

const writeExportJson = (dir: string, payload: ScriptPayloadType): void => {
  const filePath = path.join(dir, SCRIPT_FILE_NAME);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
};

const writeExportJsonString = (dir: string, payload: string): void => {
  const filePath = path.join(dir, SCRIPT_FILE_NAME);
  fs.writeFileSync(filePath, payload, 'utf8');
};

const createLogger = (rootPath: string): LoggingService =>
  new LoggingService(
    new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      fileLogEnabled: false,
      startTime: new Date('2024-01-01T00:00:00Z'),
    })
  );

const TEST_POLLING_INTERVAL_MS = Number('1234');
const TEST_POLLING_QUERY_TIMEOUT_MS = Number('5678');
const TEST_QUERY_BULK_THRESHOLD = Number('45000');
const TEST_BULK_V1_BATCH_SIZE = Number('9000');

describe('ScriptLoader', () => {
  it('parses export.json into Script model instances', async () => {
    const rootPath = createTempDir();
    const previousReadDelimiter = Common.csvReadFileDelimiter;
    const previousWriteDelimiter = Common.csvWriteFileDelimiter;
    const payload: ScriptPayloadType = {
      keepObjectOrderWhileExecute: true,
      csvReadFileDelimiter: ';',
      csvWriteFileDelimiter: ';',
      orgs: [{ name: 'source' }, { name: 'target' }],
      objectSets: [
        {
          objects: [
            {
              name: 'Account',
              query: 'SELECT Id, Name FROM Account',
              fieldMapping: [
                {
                  targetObject: 'Account',
                  sourceField: 'Name',
                  targetField: 'Name',
                },
              ],
            },
            {
              name: 'Contact',
            },
          ],
        },
      ],
    };
    writeExportJson(rootPath, payload);
    const logger = createLogger(rootPath);

    try {
      const script = await ScriptLoader.loadFromPathAsync(rootPath, logger);

      assert.ok(script instanceof Script);
      assert.equal(script.keepObjectOrderWhileExecute, true);
      assert.equal(script.csvReadFileDelimiter, ';');
      assert.equal(script.csvWriteFileDelimiter, ';');
      assert.equal(Common.csvReadFileDelimiter, ';');
      assert.equal(Common.csvWriteFileDelimiter, ';');
      assert.equal(script.objectSets.length, 1);
      assert.ok(script.objectSets[0] instanceof ScriptObjectSet);
      assert.equal(script.objectSets[0].objects.length, 1);
      assert.ok(script.objectSets[0].objects[0] instanceof ScriptObject);
      assert.ok(script.objectSets[0].objects[0].fieldMapping[0] instanceof ScriptMappingItem);
      assert.equal(script.objectSets[0].objects[0].name, '');
      assert.ok(script.orgs[0] instanceof ScriptOrg);
      assert.ok(script.workingJson);
    } finally {
      Common.csvReadFileDelimiter = previousReadDelimiter;
      Common.csvWriteFileDelimiter = previousWriteDelimiter;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('creates an object set from a flat objects array', async () => {
    const rootPath = createTempDir();
    const payload: ScriptPayloadType = {
      objects: [
        {
          name: 'Opportunity',
          query: 'SELECT Id FROM Opportunity',
        },
      ],
    };
    writeExportJson(rootPath, payload);
    const logger = createLogger(rootPath);

    try {
      const script = await ScriptLoader.loadFromPathAsync(rootPath, logger);

      assert.equal(script.objectSets.length, 1);
      assert.equal(script.objects.length, 0);
      assert.equal(script.objectSets[0].objects.length, 1);
      assert.equal(script.objectSets[0].objects[0].name, '');
      assert.equal(script.objectSets[0].objects[0].query, 'SELECT Id FROM Opportunity');
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('applies csvFileDelimiter and shared CSV options', async () => {
    const rootPath = createTempDir();
    const previousReadDelimiter = Common.csvReadFileDelimiter;
    const previousWriteDelimiter = Common.csvWriteFileDelimiter;
    const previousEncoding = Common.csvFileEncoding;
    const previousInsertNulls = Common.csvInsertNulls;
    const previousEuropeanDate = Common.csvUseEuropeanDateFormat;
    const previousUpperHeaders = Common.csvWriteUpperCaseHeaders;
    const previousUseUtf8Bom = Common.csvUseUtf8Bom;
    const previousAlwaysQuoted = Common.csvAlwaysQuoted;
    const payload: ScriptPayloadType = {
      csvFileDelimiter: 'tab',
      csvReadFileDelimiter: ';',
      csvWriteFileDelimiter: ';',
      csvFileEncoding: 'latin1',
      csvInsertNulls: true,
      csvUseEuropeanDateFormat: true,
      csvWriteUpperCaseHeaders: true,
      csvUseUtf8Bom: false,
      csvAlwaysQuoted: false,
      objects: [
        {
          query: 'SELECT Id FROM Account',
        },
      ],
    };
    writeExportJson(rootPath, payload);
    const logger = createLogger(rootPath);

    try {
      const script = await ScriptLoader.loadFromPathAsync(rootPath, logger);

      assert.equal(script.csvReadFileDelimiter, '\t');
      assert.equal(script.csvWriteFileDelimiter, '\t');
      assert.equal(Common.csvReadFileDelimiter, '\t');
      assert.equal(Common.csvWriteFileDelimiter, '\t');
      assert.equal(script.csvFileEncoding, 'latin1');
      assert.equal(Common.csvFileEncoding, 'latin1');
      assert.equal(script.csvInsertNulls, true);
      assert.equal(Common.csvInsertNulls, true);
      assert.equal(script.csvUseEuropeanDateFormat, true);
      assert.equal(Common.csvUseEuropeanDateFormat, true);
      assert.equal(script.csvWriteUpperCaseHeaders, true);
      assert.equal(Common.csvWriteUpperCaseHeaders, true);
      assert.equal(script.csvUseUtf8Bom, false);
      assert.equal(Common.csvUseUtf8Bom, false);
      assert.equal(script.csvAlwaysQuoted, false);
      assert.equal(Common.csvAlwaysQuoted, false);
    } finally {
      Common.csvReadFileDelimiter = previousReadDelimiter;
      Common.csvWriteFileDelimiter = previousWriteDelimiter;
      Common.csvFileEncoding = previousEncoding;
      Common.csvInsertNulls = previousInsertNulls;
      Common.csvUseEuropeanDateFormat = previousEuropeanDate;
      Common.csvWriteUpperCaseHeaders = previousUpperHeaders;
      Common.csvUseUtf8Bom = previousUseUtf8Bom;
      Common.csvAlwaysQuoted = previousAlwaysQuoted;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('defaults csvInsertNulls to true when omitted in export.json', async () => {
    const rootPath = createTempDir();
    const previousInsertNulls = Common.csvInsertNulls;
    Common.csvInsertNulls = false;
    const payload: ScriptPayloadType = {
      csvFileDelimiter: 'comma',
      objects: [
        {
          query: 'SELECT Id FROM Account',
        },
      ],
    };
    writeExportJson(rootPath, payload);
    const logger = createLogger(rootPath);

    try {
      const script = await ScriptLoader.loadFromPathAsync(rootPath, logger);

      assert.equal(script.csvInsertNulls, true);
      assert.equal(Common.csvInsertNulls, true);
    } finally {
      Common.csvInsertNulls = previousInsertNulls;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('preserves explicit null or empty values from export.json', async () => {
    const rootPath = createTempDir();
    const previousReadDelimiter = Common.csvReadFileDelimiter;
    const previousWriteDelimiter = Common.csvWriteFileDelimiter;
    const previousEncoding = Common.csvFileEncoding;
    const previousInsertNulls = Common.csvInsertNulls;
    const previousEuropeanDate = Common.csvUseEuropeanDateFormat;
    const previousUpperHeaders = Common.csvWriteUpperCaseHeaders;
    const previousUseUtf8Bom = Common.csvUseUtf8Bom;
    const previousAlwaysQuoted = Common.csvAlwaysQuoted;
    const payload: ScriptPayloadType = {
      pollingIntervalMs: null,
      createTargetCSVFiles: null,
      csvFileDelimiter: '',
      csvReadFileDelimiter: null,
      csvWriteFileDelimiter: '',
      csvFileEncoding: null,
      csvInsertNulls: null,
      csvUseEuropeanDateFormat: null,
      csvWriteUpperCaseHeaders: null,
      csvUseUtf8Bom: null,
      csvAlwaysQuoted: null,
      excludedObjects: null,
      beforeAddons: null,
      afterAddons: null,
      dataRetrievedAddons: null,
      objects: [
        {
          query: 'SELECT Id FROM Account',
          useFieldMapping: null,
          deleteOldData: null,
          master: null,
          beforeAddons: null,
          excludedFields: null,
        },
      ],
    };
    writeExportJson(rootPath, payload);
    const logger = createLogger(rootPath);

    try {
      const script = await ScriptLoader.loadFromPathAsync(rootPath, logger);

      assert.equal(script.pollingIntervalMs, null);
      assert.equal(script.createTargetCSVFiles, null);
      assert.equal(script.csvFileDelimiter, '');
      assert.equal(script.csvReadFileDelimiter, '');
      assert.equal(script.csvWriteFileDelimiter, '');
      assert.equal(script.csvFileEncoding, null);
      assert.equal(script.csvInsertNulls, null);
      assert.equal(script.csvUseEuropeanDateFormat, null);
      assert.equal(script.csvWriteUpperCaseHeaders, null);
      assert.equal(script.csvUseUtf8Bom, null);
      assert.equal(script.csvAlwaysQuoted, null);
      assert.equal(script.excludedObjects, null);
      assert.equal(script.beforeAddons, null);
      assert.equal(script.afterAddons, null);
      assert.equal(script.dataRetrievedAddons, null);

      assert.equal(Common.csvReadFileDelimiter, '');
      assert.equal(Common.csvWriteFileDelimiter, '');
      assert.equal(Common.csvFileEncoding, null);
      assert.equal(Common.csvInsertNulls, null);
      assert.equal(Common.csvUseEuropeanDateFormat, null);
      assert.equal(Common.csvWriteUpperCaseHeaders, null);
      assert.equal(Common.csvUseUtf8Bom, null);
      assert.equal(Common.csvAlwaysQuoted, null);

      assert.equal(script.objectSets.length, 1);
      const object = script.objectSets[0].objects[0];
      assert.equal(object.useFieldMapping, null);
      assert.equal(object.deleteOldData, null);
      assert.equal(object.master, null);
      assert.equal(object.beforeAddons, null);
      assert.equal(object.excludedFields, null);
    } finally {
      Common.csvReadFileDelimiter = previousReadDelimiter;
      Common.csvWriteFileDelimiter = previousWriteDelimiter;
      Common.csvFileEncoding = previousEncoding;
      Common.csvInsertNulls = previousInsertNulls;
      Common.csvUseEuropeanDateFormat = previousEuropeanDate;
      Common.csvWriteUpperCaseHeaders = previousUpperHeaders;
      Common.csvUseUtf8Bom = previousUseUtf8Bom;
      Common.csvAlwaysQuoted = previousAlwaysQuoted;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('uses defaults when runtime workingJson contains undefined values', () => {
    const baseScript = new Script();
    baseScript.workingJson = {
      pollingIntervalMs: undefined,
      createTargetCSVFiles: undefined,
      csvFileDelimiter: undefined,
      csvReadFileDelimiter: undefined,
      csvWriteFileDelimiter: undefined,
      csvFileEncoding: undefined,
      csvInsertNulls: undefined,
      csvUseEuropeanDateFormat: undefined,
      csvWriteUpperCaseHeaders: undefined,
      csvUseUtf8Bom: undefined,
      csvAlwaysQuoted: undefined,
      excludedObjects: undefined,
      beforeAddons: undefined,
      afterAddons: undefined,
      dataRetrievedAddons: undefined,
      objects: [
        {
          query: 'SELECT Id FROM Account',
          master: false,
          useFieldMapping: undefined,
          deleteOldData: undefined,
          beforeAddons: undefined,
          excludedFields: undefined,
        },
      ],
    } as unknown as ScriptPayloadType;

    const script = ScriptLoader.createScriptForObjectSet(baseScript, 0);
    const object = script.objectSets[0].objects[0];

    assert.equal(script.pollingIntervalMs > 0, true);
    assert.equal(typeof script.pollingIntervalMs, 'number');
    assert.equal(script.createTargetCSVFiles, true);
    assert.equal(script.csvFileDelimiter, ',');
    assert.equal(script.csvReadFileDelimiter, ',');
    assert.equal(script.csvWriteFileDelimiter, ',');
    assert.equal(script.csvFileEncoding, 'utf8');
    assert.equal(script.csvInsertNulls, true);
    assert.equal(script.csvUseEuropeanDateFormat, false);
    assert.equal(script.csvWriteUpperCaseHeaders, false);
    assert.equal(script.csvUseUtf8Bom, true);
    assert.equal(script.csvAlwaysQuoted, true);
    assert.deepEqual(script.excludedObjects, []);
    assert.deepEqual(script.beforeAddons, []);
    assert.deepEqual(script.afterAddons, []);
    assert.deepEqual(script.dataRetrievedAddons, []);
    assert.equal(object.useFieldMapping, false);
    assert.equal(object.deleteOldData, false);
    assert.equal(object.master, false);
    assert.deepEqual(object.beforeAddons, []);
    assert.deepEqual(object.excludedFields, []);
  });

  it('prepends flat objects to objectSets index 0 when both are present', async () => {
    const rootPath = createTempDir();
    const payload: ScriptPayloadType = {
      objects: [
        {
          query: 'SELECT Id FROM Opportunity',
        },
      ],
      objectSets: [
        {
          objects: [
            {
              query: 'SELECT Id FROM Account',
            },
          ],
        },
      ],
    };
    writeExportJson(rootPath, payload);
    const logger = createLogger(rootPath);

    try {
      const script = await ScriptLoader.loadFromPathAsync(rootPath, logger);

      assert.equal(script.objectSets.length, 2);
      assert.equal(script.objectSets[0].objects.length, 1);
      assert.equal(script.objectSets[0].objects[0].query, 'SELECT Id FROM Opportunity');
      assert.equal(script.objectSets[1].objects.length, 1);
      assert.equal(script.objectSets[1].objects[0].query, 'SELECT Id FROM Account');
      assert.equal(script.objects.length, 0);
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('parses a large export.json string payload', async () => {
    const rootPath = createTempDir();
    const exportJson = `{
      "objects": [
        {
          "fieldMapping": [
            {
              "targetObject": "Account"
            },
            {
              "sourceField": "Id",
              "targetField": "ExternalID__c"
            }
          ],
          "query": "SELECT Id, Name, OwnerId, ParentId, Phone, RecordTypeId, TEST__c, TestObject3__c FROM Account WHERE (Name LIKE 'ACC_%') OR (Name LIKE 'Rams%')",
          "operation": "Upsert",
          "deleteOldData": true,
          "useCSVValuesMapping": true,
          "useFieldMapping": true,
          "externalId": "Name"
        },
        {
          "query": "SELECT Account__c, Id, Name, TestObject5__c, TestObject__c FROM TestObject2__c",
          "operation": "Insert",
          "deleteOldData": true,
          "updateWithMockData": true,
          "externalId": "Name"
        },
        {
          "query": "SELECT Id, Name FROM Language__c",
          "operation": "Upsert",
          "externalId": "Name"
        },
        {
          "mockFields": [
            {
              "name": "Name",
              "pattern": "name",
              "locale": "ru_RU",
              "excludedRegex": "test"
            },
            {
              "name": "an__c",
              "pattern": "ids"
            },
            {
              "name": "Date__c",
              "pattern": "date()"
            },
            {
              "name": "Test__c",
              "pattern": "sentence"
            }
          ],
          "query": "SELECT Date__c, Name, OwnerId, TestObject2__c, Test__c, an__c FROM TestObject3__c",
          "operation": "Insert",
          "deleteOldData": true,
          "updateWithMockData": true,
          "externalId": "an__c"
        },
        {
          "query": "SELECT Data__c, Language__c, Name, OwnerId, TestObject__c FROM TestObject_Description__c",
          "operation": "Insert",
          "deleteOldData": true,
          "externalId": "Language__r.LangCode__c;TestObject__r.Name"
        },
        {
          "mockFields": [
            {
              "name": "Name",
              "pattern": "c_seq_number('TestObject_',1,1)"
            },
            {
              "name": "Name",
              "pattern": "name"
            }
          ],
          "query": "SELECT Account__c, Name, OwnerId, RecordTypeId, TestObject3__c FROM TestObject__c",
          "operation": "Insert",
          "deleteOldData": true,
          "updateWithMockData": true,
          "externalId": "Name"
        },
        {
          "query": "SELECT Account__c, Name, TEST__c, TestObject3__c, TestObject_Descr__c FROM TestObject4__c",
          "operation": "Insert",
          "deleteOldData": true,
          "externalId": "Name"
        },
        {
          "query": "SELECT Id, Name, Status__c, TestObject4__c FROM TestObject5__c",
          "operation": "Insert",
          "deleteOldData": true,
          "externalId": "Name"
        },
        {
          "query": "SELECT Body, ContentType, Description, IsPrivate, Name, ParentId FROM Attachment",
          "operation": "Insert",
          "deleteOldData": true,
          "excluded": true,
          "externalId": "Name"
        },
        {
          "query": "SELECT Body, IsPrivate, ParentId, Title FROM Note",
          "operation": "Insert",
          "deleteOldData": true,
          "excluded": true,
          "externalId": "Title"
        }
      ],
      "allOrNone": true,
      "promptOnMissingParentObjects": false,
      "promptOnIssuesInCSVFiles": false,
      "apiVersion": "47.0",
      "allowFieldTruncation": true,
      "bulkApiVersion": "1.0"
    }`;
    writeExportJsonString(rootPath, exportJson);
    const logger = createLogger(rootPath);

    try {
      const script = await ScriptLoader.loadFromPathAsync(rootPath, logger);

      assert.equal(script.objectSets.length, 1);
      assert.equal(script.objectSets[0].objects.length, 10);
      assert.equal(script.allOrNone, true);
      assert.equal(script.promptOnMissingParentObjects, false);
      assert.equal(script.promptOnIssuesInCSVFiles, false);
      assert.equal(script.apiVersion, '47.0');
      assert.equal(script.allowFieldTruncation, true);
      assert.equal(script.bulkApiVersion, '1.0');

      const accountObject = script.objectSets[0].objects[0];
      assert.equal(accountObject.operation, OPERATION.Upsert);
      assert.equal(accountObject.deleteOldData, true);
      assert.equal(accountObject.useCSVValuesMapping, true);
      assert.equal(accountObject.useFieldMapping, true);
      assert.equal(accountObject.externalId, 'Name');
      assert.equal(accountObject.fieldMapping.length, 2);
      assert.equal(accountObject.fieldMapping[0].targetObject, 'Account');
      assert.equal(accountObject.fieldMapping[1].sourceField, 'Id');
      assert.equal(accountObject.fieldMapping[1].targetField, 'ExternalID__c');

      const mockObject = script.objectSets[0].objects[3];
      assert.equal(mockObject.operation, OPERATION.Insert);
      assert.equal(mockObject.updateWithMockData, true);
      assert.equal(mockObject.mockFields.length, 4);
      assert.equal(mockObject.mockFields[0].name, 'Name');
      assert.equal(mockObject.mockFields[0].locale, 'ru_RU');

      const excludedObject = script.objectSets[0].objects[8];
      assert.equal(excludedObject.excluded, true);
      assert.equal(excludedObject.externalId, 'Name');
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('parses script-level settings and add-on manifests', async () => {
    const rootPath = createTempDir();
    const payload: ScriptPayloadType = {
      excludedObjects: ['Account', 'Contact'],
      pollingIntervalMs: TEST_POLLING_INTERVAL_MS,
      pollingQueryTimeoutMs: TEST_POLLING_QUERY_TIMEOUT_MS,
      concurrencyMode: 'Serial',
      bulkThreshold: 250,
      queryBulkApiThreshold: TEST_QUERY_BULK_THRESHOLD,
      bulkApiVersion: '2.0',
      bulkApiV1BatchSize: TEST_BULK_V1_BATCH_SIZE,
      restApiBatchSize: 500,
      validateCSVFilesOnly: true,
      createTargetCSVFiles: false,
      importCSVFilesAsIs: true,
      excludeIdsFromCSVFiles: true,
      alwaysUseRestApiToUpdateRecords: true,
      simulationMode: true,
      useSeparatedCSVFiles: true,
      binaryDataCache: DATA_CACHE_TYPES.FileCache,
      sourceRecordsCache: DATA_CACHE_TYPES.CleanFileCache,
      parallelBinaryDownloads: 12,
      parallelBulkJobs: 3,
      parallelRestJobs: 4,
      beforeAddons: [
        {
          module: 'core:mock',
          event: 'onBefore',
        },
      ],
      afterAddons: [
        {
          path: './custom/post-addon.js',
          event: 'onAfter',
        },
      ],
      dataRetrievedAddons: [
        {
          module: 'custom:retrieved',
          event: 'onDataRetrieved',
        },
      ],
    };
    writeExportJson(rootPath, payload);
    const logger = createLogger(rootPath);

    try {
      const script = await ScriptLoader.loadFromPathAsync(rootPath, logger);

      assert.deepEqual(script.excludedObjects, ['Account', 'Contact']);
      assert.equal(script.pollingIntervalMs, TEST_POLLING_INTERVAL_MS);
      assert.equal(script.pollingQueryTimeoutMs, TEST_POLLING_QUERY_TIMEOUT_MS);
      assert.equal(script.concurrencyMode, 'Serial');
      assert.equal(script.bulkThreshold, 250);
      assert.equal(script.queryBulkApiThreshold, TEST_QUERY_BULK_THRESHOLD);
      assert.equal(script.bulkApiVersion, '2.0');
      assert.equal(script.bulkApiV1BatchSize, TEST_BULK_V1_BATCH_SIZE);
      assert.equal(script.restApiBatchSize, 500);
      assert.equal(script.validateCSVFilesOnly, true);
      assert.equal(script.createTargetCSVFiles, false);
      assert.equal(script.importCSVFilesAsIs, true);
      assert.equal(script.excludeIdsFromCSVFiles, true);
      assert.equal(script.alwaysUseRestApiToUpdateRecords, true);
      assert.equal(script.simulationMode, true);
      assert.equal(script.useSeparatedCSVFiles, true);
      assert.equal(script.binaryDataCache, DATA_CACHE_TYPES.FileCache);
      assert.equal(script.sourceRecordsCache, DATA_CACHE_TYPES.CleanFileCache);
      assert.equal(script.parallelBinaryDownloads, 12);
      assert.equal(script.parallelBulkJobs, 3);
      assert.equal(script.parallelRestJobs, 4);
      assert.equal(script.beforeAddons.length, 1);
      assert.ok(script.beforeAddons[0] instanceof ScriptAddonManifestDefinition);
      assert.equal(script.beforeAddons[0].module, 'core:mock');
      assert.equal(script.beforeAddons[0].path, 'core:mock');
      assert.equal(script.afterAddons.length, 1);
      assert.ok(script.afterAddons[0] instanceof ScriptAddonManifestDefinition);
      assert.equal(script.afterAddons[0].module, '');
      assert.equal(script.afterAddons[0].path, './custom/post-addon.js');
      assert.equal(script.dataRetrievedAddons.length, 1);
      assert.ok(script.dataRetrievedAddons[0] instanceof ScriptAddonManifestDefinition);
      assert.equal(script.basePath, rootPath);
      assert.equal(script.objectSetIndex, 0);
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('parses object-level add-on manifests', async () => {
    const rootPath = createTempDir();
    const payload: ScriptPayloadType = {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Id FROM Account',
          beforeAddons: [
            {
              path: './object/before-addon.js',
              event: 'onBefore',
            },
          ],
          afterAddons: [
            {
              module: 'custom:post',
              event: 'onAfter',
            },
          ],
        },
      ],
    };
    writeExportJson(rootPath, payload);
    const logger = createLogger(rootPath);

    try {
      const script = await ScriptLoader.loadFromPathAsync(rootPath, logger);
      const object = script.objectSets[0].objects[0];

      assert.equal(object.beforeAddons.length, 1);
      assert.ok(object.beforeAddons[0] instanceof ScriptAddonManifestDefinition);
      assert.equal(object.beforeAddons[0].module, '');
      assert.equal(object.beforeAddons[0].path, './object/before-addon.js');
      assert.equal(object.afterAddons.length, 1);
      assert.ok(object.afterAddons[0] instanceof ScriptAddonManifestDefinition);
      assert.equal(object.afterAddons[0].module, 'custom:post');
      assert.equal(object.afterAddons[0].path, 'custom:post');
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('parses object-level API override flags', async () => {
    const rootPath = createTempDir();
    const payload: ScriptPayloadType = {
      objects: [
        {
          name: 'Account',
          query: 'SELECT Id FROM Account',
          respectOrderByOnDeleteRecords: true,
          alwaysUseBulkApiToUpdateRecords: true,
          alwaysUseRestApi: false,
          alwaysUseBulkApi: true,
        },
      ],
    };
    writeExportJson(rootPath, payload);
    const logger = createLogger(rootPath);

    try {
      const script = await ScriptLoader.loadFromPathAsync(rootPath, logger);
      const object = script.objectSets[0].objects[0];

      assert.equal(object.respectOrderByOnDeleteRecords, true);
      assert.equal(object.alwaysUseBulkApiToUpdateRecords, true);
      assert.equal(object.alwaysUseRestApi, false);
      assert.equal(object.alwaysUseBulkApi, true);
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('rehydrates a specific object set from workingJson', async () => {
    const rootPath = createTempDir();
    const payload: ScriptPayloadType = {
      keepObjectOrderWhileExecute: true,
      useSeparatedCSVFiles: true,
      objectSets: [
        {
          objects: [
            {
              name: 'Account',
              query: 'SELECT Id FROM Account',
            },
          ],
        },
        {
          objects: [
            {
              name: 'Contact',
              query: 'SELECT Id FROM Contact',
            },
          ],
        },
      ],
    };
    writeExportJson(rootPath, payload);
    const logger = createLogger(rootPath);

    try {
      const baseScript = await ScriptLoader.loadFromPathAsync(rootPath, logger);
      const script = ScriptLoader.createScriptForObjectSet(baseScript, 1);
      const objectSetFolder = `${OBJECT_SET_SUBDIRECTORY_PREFIX.replace(/^[\\/]+/, '')}2`;

      assert.equal(script.objectSets.length, 1);
      assert.equal(script.objectSets[0].objects.length, 1);
      assert.equal(script.objectSets[0].objects[0].query, 'SELECT Id FROM Contact');
      assert.equal(script.keepObjectOrderWhileExecute, true);
      assert.equal(script.basePath, rootPath);
      assert.equal(script.objectSetIndex, 1);
      assert.equal(script.sourceDirectoryPath, path.join(rootPath, CSV_SOURCE_SUB_DIRECTORY, objectSetFolder));
      assert.equal(script.rawSourceDirectoryPath, path.join(rootPath, RAW_SOURCE_SUB_DIRECTORY, objectSetFolder));
      assert.equal(script.targetDirectoryPath, path.join(rootPath, CSV_TARGET_SUB_DIRECTORY, objectSetFolder));
      assert.equal(script.reportsDirectoryPath, path.join(rootPath, REPORTS_SUB_DIRECTORY, objectSetFolder));
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });
});
