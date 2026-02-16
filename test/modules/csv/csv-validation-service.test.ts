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
import { CSV_ISSUE_REPORT_COLUMNS } from '../../../src/modules/constants/Constants.js';
import CsvReportService from '../../../src/modules/csv/CsvReportService.js';
import CsvValidationService from '../../../src/modules/csv/CsvValidationService.js';

describe('CsvValidationService', () => {
  it('reports missing csv file when ids are not excluded', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-csv-'));
    const missingFile = path.join(tempDir, 'Missing.csv');
    const issues = await CsvValidationService.validateCsvAsync({
      sourceCsvFilename: missingFile,
      sObjectName: 'Account',
      requiredFields: ['Name'],
      excludeIdsFromCsvFiles: false,
      missingCsvFileErrorMessage: 'Missing CSV file',
      missingColumnErrorMessage: 'Missing column',
      dateProvider: () => new Date('2024-01-01T00:00:00.000Z'),
    });

    assert.equal(issues.length, 1);
    assert.equal(issues[0]['Error'], 'Missing CSV file');
    assert.equal(fs.existsSync(missingFile), false);
  });

  it('does not report missing csv file when ids are excluded', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-csv-'));
    const missingFile = path.join(tempDir, 'Missing.csv');
    const issues = await CsvValidationService.validateCsvAsync({
      sourceCsvFilename: missingFile,
      sObjectName: 'Account',
      requiredFields: ['Id'],
      excludeIdsFromCsvFiles: true,
      skipMissingFieldsWhenIdsExcluded: ['Id'],
      missingCsvFileErrorMessage: 'Missing CSV file',
      missingColumnErrorMessage: 'Missing column',
      dateProvider: () => new Date('2024-01-01T00:00:00.000Z'),
    });

    assert.equal(issues.length, 0);
    assert.equal(fs.existsSync(missingFile), false);
  });

  it('reports missing required columns', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-csv-'));
    const csvFile = path.join(tempDir, 'Account.csv');
    await Common.writeCsvFileAsync(csvFile, [{ Name: 'Acme' }], true);

    const issues = await CsvValidationService.validateCsvAsync({
      sourceCsvFilename: csvFile,
      sObjectName: 'Account',
      requiredFields: ['Name', 'OwnerId'],
      excludeIdsFromCsvFiles: false,
      missingCsvFileErrorMessage: 'Missing CSV file',
      missingColumnErrorMessage: 'Missing column',
      dateProvider: () => new Date('2024-01-01T00:00:00.000Z'),
    });

    assert.equal(issues.length, 1);
    assert.equal(issues[0]['Field name'], 'OwnerId');
    assert.equal(issues[0]['Error'], 'Missing column');
  });

  it('matches quoted csv headers without case sensitivity', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-csv-'));
    const csvFile = path.join(tempDir, 'Account.csv');
    const csvContent = '\uFEFF"ID","NAME","TYPE"\n"001000000000001","Acme","Customer"';
    fs.writeFileSync(csvFile, csvContent, 'utf8');

    const issues = await CsvValidationService.validateCsvAsync({
      sourceCsvFilename: csvFile,
      sObjectName: 'Account',
      requiredFields: ['Id', 'Name', 'Type'],
      excludeIdsFromCsvFiles: false,
      missingCsvFileErrorMessage: 'Missing CSV file',
      missingColumnErrorMessage: 'Missing column',
      dateProvider: () => new Date('2024-01-01T00:00:00.000Z'),
    });

    assert.equal(issues.length, 0);
  });

  it('does not report missing lookup reference column when id column exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-csv-'));
    const csvFile = path.join(tempDir, 'Account.csv');
    await Common.writeCsvFileAsync(csvFile, [{ Name: 'Acme', 'Account__c': '001000000000001' }], true);

    const issues = await CsvValidationService.validateCsvAsync({
      sourceCsvFilename: csvFile,
      sObjectName: 'Account',
      requiredFields: ['Name', 'Account__c'],
      lookupFieldPairs: [
        {
          idFieldName: 'Account__c',
          externalIdFieldName: 'Name',
        },
      ],
      excludeIdsFromCsvFiles: false,
      missingCsvFileErrorMessage: 'Missing CSV file',
      missingColumnErrorMessage: 'Missing column',
      dateProvider: () => new Date('2024-01-01T00:00:00.000Z'),
    });

    assert.equal(issues.length, 0);
  });

  it('reports missing lookup id column when reference column exists', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-csv-'));
    const csvFile = path.join(tempDir, 'Account.csv');
    await Common.writeCsvFileAsync(csvFile, [{ Name: 'Acme', 'Account__r.Name': 'Acme' }], true);

    const issues = await CsvValidationService.validateCsvAsync({
      sourceCsvFilename: csvFile,
      sObjectName: 'Account',
      requiredFields: ['Name', 'Account__r.Name'],
      lookupFieldPairs: [
        {
          idFieldName: 'Account__c',
          externalIdFieldName: 'Name',
        },
      ],
      excludeIdsFromCsvFiles: false,
      missingCsvFileErrorMessage: 'Missing CSV file',
      missingColumnErrorMessage: 'Missing column',
      dateProvider: () => new Date('2024-01-01T00:00:00.000Z'),
    });

    assert.equal(issues.length, 1);
    assert.equal(issues[0]['Field name'], 'Account__c');
    assert.equal(issues[0]['Error'], 'Missing column');
  });

  it('skips missing lookup id column when ids are excluded', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-csv-'));
    const csvFile = path.join(tempDir, 'Account.csv');
    await Common.writeCsvFileAsync(csvFile, [{ Name: 'Acme', 'Account__r.Name': 'Acme' }], true);

    const issues = await CsvValidationService.validateCsvAsync({
      sourceCsvFilename: csvFile,
      sObjectName: 'Account',
      requiredFields: ['Name', 'Account__r.Name'],
      lookupFieldPairs: [
        {
          idFieldName: 'Account__c',
          externalIdFieldName: 'Name',
        },
      ],
      excludeIdsFromCsvFiles: true,
      skipMissingFieldsWhenIdsExcluded: ['Account__c'],
      missingCsvFileErrorMessage: 'Missing CSV file',
      missingColumnErrorMessage: 'Missing column',
      dateProvider: () => new Date('2024-01-01T00:00:00.000Z'),
    });

    assert.equal(issues.length, 0);
  });
});

describe('CsvReportService', () => {
  it('writes csv issues report with legacy headers', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-csv-'));
    const issues = [
      {
        'Date update': '2024-01-01 00:00:00.000',
        'sObject name': 'Account',
        'Field name': 'Name',
        'Field value': null,
        'Parent SObject name': null,
        'Parent field name': null,
        'Parent field value': null,
        Error: 'Missing column',
      },
    ];

    const reportPath = await CsvReportService.writeCsvIssuesReportAsync(tempDir, issues, true);
    const reportContent = fs.readFileSync(reportPath, 'utf8');
    assert.equal(reportContent.startsWith('\uFEFF'), true);
    const headerLine = (reportContent.split(/\r?\n/)[0] ?? '').replace(/^\uFEFF/, '');

    assert.equal(headerLine, `"${CSV_ISSUE_REPORT_COLUMNS.join('","')}"`);
  });
});
