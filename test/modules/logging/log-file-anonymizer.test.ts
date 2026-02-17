/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: BSD-3-Clause
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { strict as assert } from 'node:assert';
import { LOG_FILE_NO_ANONYMIZE_MARKER } from '../../../src/modules/constants/Constants.js';
import LogFileAnonymizer from '../../../src/modules/logging/LogFileAnonymizer.js';

describe('LogFileAnonymizer', () => {
  it('uses deterministic 16-hex hash tokens for known values', () => {
    const anonymizer = new LogFileAnonymizer({
      enabled: true,
      seed: 'seed-1',
      maskedValues: ['DEMO-SOURCE', 'C:\\Users\\john\\workspace'],
    });

    const output = anonymizer.anonymize('SOURCE: DEMO-SOURCE. path=C:\\Users\\john\\workspace');

    assert.match(output, /SOURCE:\sorg<[A-F0-9]{16}>\./u);
    assert.match(output, /path=path<[A-F0-9]{16}>/u);
  });

  it('returns same tokens for same input and same seed', () => {
    const left = new LogFileAnonymizer({
      enabled: true,
      seed: 'same-seed',
      maskedValues: ['DEMO-SOURCE'],
    });
    const right = new LogFileAnonymizer({
      enabled: true,
      seed: 'same-seed',
      maskedValues: ['DEMO-SOURCE'],
    });

    const leftOutput = left.anonymize('SOURCE: DEMO-SOURCE');
    const rightOutput = right.anonymize('SOURCE: DEMO-SOURCE');

    assert.equal(leftOutput, rightOutput);
  });

  it('returns different tokens for different seeds', () => {
    const left = new LogFileAnonymizer({
      enabled: true,
      seed: 'seed-a',
      maskedValues: ['DEMO-SOURCE'],
    });
    const right = new LogFileAnonymizer({
      enabled: true,
      seed: 'seed-b',
      maskedValues: ['DEMO-SOURCE'],
    });

    const leftOutput = left.anonymize('SOURCE: DEMO-SOURCE');
    const rightOutput = right.anonymize('SOURCE: DEMO-SOURCE');

    assert.notEqual(leftOutput, rightOutput);
  });

  it('hashes secret assignment values with a labeled token', () => {
    const anonymizer = new LogFileAnonymizer({
      enabled: true,
      seed: 'secret-seed',
    });

    const output = anonymizer.anonymize('accessToken=00Dxx00000001ABC!AQw');

    assert.match(output, /^accessToken=accessToken<[A-F0-9]{16}>$/u);
  });

  it('hashes prompt answers as prompt tokens', () => {
    const anonymizer = new LogFileAnonymizer({
      enabled: true,
      seed: 'prompt-seed',
    });

    const output = anonymizer.anonymize('PROMPT ANSWER: hknokh-220913-164-demo.my.salesforce.com');

    assert.match(output, /^PROMPT ANSWER:\sprompt<[A-F0-9]{16}>$/u);
  });

  it('bypasses masking and strips marker for no-anonymize lines', () => {
    const anonymizer = new LogFileAnonymizer({
      enabled: true,
      seed: 'seed',
    });
    const input = `${LOG_FILE_NO_ANONYMIZE_MARKER}Value mapping rules: A -> B`;

    const output = anonymizer.anonymize(input);

    assert.equal(output, 'Value mapping rules: A -> B');
  });

  it('does not hash standard field literals outside IN clause', () => {
    const anonymizer = new LogFileAnonymizer({
      enabled: true,
      seed: 'soql-seed',
    });
    const input = "{Group} Final source query: SELECT Id FROM Group WHERE Type = 'Queue'";

    const output = anonymizer.anonymize(input);

    assert.equal(output, input);
  });

  it('hashes literals in IN clause', () => {
    const anonymizer = new LogFileAnonymizer({
      enabled: true,
      seed: 'soql-seed',
    });
    const output = anonymizer.anonymize(
      "{Group} Final source query: SELECT Id FROM Group WHERE Type IN ('Queue','Regular')"
    );

    assert.match(output, /\bType IN \('soql<[A-F0-9]{16}>','soql<[A-F0-9]{16}>'\)/u);
  });

  it('keeps Salesforce record Id values unmasked in IN clause', () => {
    const anonymizer = new LogFileAnonymizer({
      enabled: true,
      seed: 'soql-seed',
    });
    const output = anonymizer.anonymize(
      "{Account} Final source query: SELECT Id FROM Account WHERE Id IN ('001000000000001AAA','Sensitive')"
    );

    assert.match(output, /\bId IN \('001000000000001AAA','soql<[A-F0-9]{16}>'\)/u);
  });

  it('hashes literals for comparisons on custom fields', () => {
    const anonymizer = new LogFileAnonymizer({
      enabled: true,
      seed: 'soql-seed',
    });
    const output = anonymizer.anonymize(
      "{Account} Final source query: SELECT Id FROM Account WHERE Custom_Flag__c = 'SensitiveValue'"
    );

    assert.match(output, /\bCustom_Flag__c = 'soql<[A-F0-9]{16}>'/u);
  });

  it('keeps Salesforce record Id values unmasked for custom field comparisons', () => {
    const anonymizer = new LogFileAnonymizer({
      enabled: true,
      seed: 'soql-seed',
    });
    const output = anonymizer.anonymize(
      "{CustomObject__c} Final source query: SELECT Id FROM CustomObject__c WHERE Parent_Record__c = '001000000000001AAA'"
    );

    assert.match(output, /\bParent_Record__c = '001000000000001AAA'/u);
  });

  it('keeps field API names unmasked when SOQL literals are hashed', () => {
    const anonymizer = new LogFileAnonymizer({
      enabled: true,
      seed: 'field-seed',
    });
    const output = anonymizer.anonymize(
      "{CustomObject__c} Final source query: SELECT Id, Secret_Field__c FROM CustomObject__c WHERE Secret_Field__c IN ('Sensitive')"
    );

    assert.match(output, /\bSELECT Id, Secret_Field__c FROM CustomObject__c\b/u);
    assert.match(output, /\bWHERE Secret_Field__c IN \('soql<[A-F0-9]{16}>'\)/u);
  });

  it('keeps object API names unmasked in object-scoped log prefixes', () => {
    const anonymizer = new LogFileAnonymizer({
      enabled: true,
      seed: 'object-seed',
      maskedValues: ['DEMO-SOURCE'],
    });
    const output = anonymizer.anonymize('{TestObject4__c} Fetching metadata (DEMO-SOURCE) ...');

    assert.match(output, /^\{TestObject4__c\} Fetching metadata \(org<[A-F0-9]{16}>\) \.\.\.$/u);
  });

  it('uses detailed labels for explicit masked entry categories', () => {
    const anonymizer = new LogFileAnonymizer({
      enabled: true,
      seed: 'labels-seed',
      maskedEntries: [
        { value: 'DEMO-SOURCE', label: 'sourceOrg' },
        { value: 'DEMO-TARGET', label: 'targetOrg' },
        { value: 'source@name.com', label: 'sourceUser' },
        { value: 'hknokh-220913-164-demo.my.salesforce.com', label: 'canModify' },
        { value: 'C:\\repo\\project', label: 'cwd' },
      ],
    });

    const output = anonymizer.anonymize(
      'SOURCE DEMO-SOURCE TARGET DEMO-TARGET USER source@name.com CANMOD hknokh-220913-164-demo.my.salesforce.com PATH C:\\repo\\project'
    );

    assert.match(output, /sourceOrg<[A-F0-9]{16}>/u);
    assert.match(output, /targetOrg<[A-F0-9]{16}>/u);
    assert.match(output, /sourceUser<[A-F0-9]{16}>/u);
    assert.match(output, /canModify<[A-F0-9]{16}>/u);
    assert.match(output, /cwd<[A-F0-9]{16}>/u);
  });
});
