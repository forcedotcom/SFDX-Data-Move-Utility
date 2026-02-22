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
import {
  COMMAND_EXIT_STATUSES,
  CSV_FILE_ORG_NAME,
  FILE_LOG_SUBDIRECTORY,
  SCRIPT_FILE_NAME,
} from '../../../src/modules/constants/Constants.js';
import OrgConnectionAdapter from '../../../src/modules/org/OrgConnectionAdapter.js';
import SfdmuRunService from '../../../src/modules/run/SfdmuRunService.js';
import type { SfdmuRunFlagsType } from '../../../src/modules/run/models/SfdmuRunFlagsType.js';
import type { SfdmuRunRequestType } from '../../../src/modules/run/models/SfdmuRunRequestType.js';

const PACKAGE_VERSION = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) as {
  version?: string;
};
const EXPECTED_VERSION = `v${PACKAGE_VERSION.version ?? ''}`;

type ScriptPayloadType = {
  apiVersion?: string;
  objectSets: Array<{ objects: Array<{ name: string; query: string }> }>;
};

type DescribeFieldStubType = {
  name: string;
  label?: string;
  type?: string;
  nameField?: boolean;
  unique?: boolean;
  custom?: boolean;
  updateable?: boolean;
  createable?: boolean;
  calculated?: boolean;
  cascadeDelete?: boolean;
  referenceTo?: string[];
  length?: number;
  autoNumber?: boolean;
};

type DescribeObjectStubType = {
  name: string;
  label?: string;
  createable?: boolean;
  updateable?: boolean;
  custom?: boolean;
  fields: DescribeFieldStubType[];
};

type ConnectionStubType = {
  sobject: (name: string) => {
    describe: () => Promise<DescribeObjectStubType>;
  };
  query: <T>(query: string) => Promise<{ records: T[]; done: boolean }>;
};

const createTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-run-'));

const writeExportJson = (dir: string, payload: ScriptPayloadType): void => {
  const filePath = path.join(dir, SCRIPT_FILE_NAME);
  fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
};

const getLatestLogFilePath = (rootPath: string): string => {
  const logsDir = path.join(rootPath, FILE_LOG_SUBDIRECTORY);
  const logFiles = fs
    .readdirSync(logsDir)
    .filter((file) => file.endsWith('.log'))
    .map((file) => path.join(logsDir, file))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  if (logFiles.length === 0) {
    throw new Error('No log files found.');
  }
  return logFiles[0];
};

const buildRequest = (
  flags: SfdmuRunFlagsType,
  argv: string[] = [],
  stdoutWriter?: (message: string) => void,
  stderrWriter?: (message: string) => void,
  warnWriter?: (message: string) => void,
  jsonWriter?: (message: string) => void
): SfdmuRunRequestType => ({
  argv,
  flags,
  stdoutWriter,
  stderrWriter,
  warnWriter,
  jsonWriter,
});

const createDescribeConnection = (): ConnectionStubType => {
  const describeResult: DescribeObjectStubType = {
    name: 'Account',
    label: 'Account',
    createable: true,
    updateable: true,
    custom: false,
    fields: [
      { name: 'Id', type: 'id', label: 'Id', createable: false, updateable: false },
      { name: 'Name', type: 'string', label: 'Name', createable: true, updateable: true, nameField: true },
    ],
  };

  return {
    sobject: () => ({
      describe: async () => describeResult,
    }),
    query: async <T>(query: string) => {
      if (query.includes('FROM Organization')) {
        return { records: [{ OrganizationType: 'Developer Edition', IsSandbox: false } as T], done: true };
      }
      if (query.includes('FROM Account')) {
        return { records: [{ IsPersonAccount: false } as T], done: true };
      }
      return { records: [] as T[], done: true };
    },
  };
};

describe('SfdmuRunService', () => {
  it('short-circuits for version and emits only the version string', async () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest(
          {
            path: rootPath,
            version: true,
            json: true,
            filelog: 1,
          },
          [],
          (message: string) => stdout.push(message)
        )
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.SUCCESS);
      assert.equal(result.statusString, 'SUCCESS');
      assert.ok(stdout.length > 0);
      assert.equal(stdout.join('').trim(), EXPECTED_VERSION);
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('emits only the version string regardless of loglevel', async () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest(
          {
            path: rootPath,
            version: true,
            json: true,
            loglevel: 'error',
            filelog: 0,
          },
          [],
          (message: string) => stdout.push(message)
        )
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.SUCCESS);
      assert.ok(stdout.length > 0);
      assert.equal(stdout.join('').trim(), EXPECTED_VERSION);
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('outputs version even when quiet is enabled', async () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest(
          {
            path: rootPath,
            version: true,
            json: true,
            quiet: true,
            filelog: 0,
          },
          [],
          (message: string) => stdout.push(message)
        )
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.SUCCESS);
      assert.equal(stdout.join('').trim(), EXPECTED_VERSION);
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('outputs version even when silent is enabled', async () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest(
          {
            path: rootPath,
            version: true,
            json: true,
            silent: true,
            filelog: 0,
          },
          [],
          (message: string) => stdout.push(message)
        )
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.SUCCESS);
      assert.equal(stdout.join('').trim(), EXPECTED_VERSION);
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('returns legacy missing required flag message', async () => {
    const rootPath = createTempDir();

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest({
          path: rootPath,
          filelog: 0,
        })
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR);
      assert.ok(result.message.includes('Missing required flag(s): --sourceusername, --targetusername'));
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('rejects csvfile to csvfile even when silent is enabled', async () => {
    const rootPath = createTempDir();

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest({
          path: rootPath,
          sourceusername: CSV_FILE_ORG_NAME,
          targetusername: CSV_FILE_ORG_NAME,
          silent: true,
          quiet: false,
          filelog: 0,
        })
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR);
      assert.equal(result.statusString, 'COMMAND_INITIALIZATION_ERROR');
      assert.ok(result.message.toLowerCase().includes('cannot migrate data between csv files'));
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('writes stdout using the provided writer for non-json output', async () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];
    const payload: ScriptPayloadType = {
      objectSets: [
        {
          objects: [{ name: 'Account', query: 'SELECT Id FROM Account' }],
        },
      ],
    };
    writeExportJson(rootPath, payload);

    const originalResolve = OrgConnectionAdapter.resolveOrgPairAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgPairAsync = async () => ({
      sourceOrg: undefined,
      targetOrg: undefined,
    });
    const originalResolveOrg = OrgConnectionAdapter.resolveOrgAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgAsync = async () => ({} as never);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => createDescribeConnection() as never;

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest(
          {
            path: rootPath,
            sourceusername: 'source',
            targetusername: 'target',
            filelog: 0,
          },
          [],
          (message: string) => stdout.push(message)
        )
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.SUCCESS);
      assert.ok(stdout.some((line) => line.includes('OBJECT SET #1 STARTED')));
    } finally {
      OrgConnectionAdapter.resolveOrgPairAsync = originalResolve;
      OrgConnectionAdapter.resolveOrgAsync = originalResolveOrg;
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('routes errors to stderr when loglevel permits', async () => {
    const rootPath = createTempDir();
    const stderr: string[] = [];

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest(
          {
            path: rootPath,
            sourceusername: CSV_FILE_ORG_NAME,
            targetusername: CSV_FILE_ORG_NAME,
            loglevel: 'error',
            filelog: 0,
          },
          [],
          undefined,
          (message: string) => stderr.push(message)
        )
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.COMMAND_INITIALIZATION_ERROR);
      assert.ok(stderr.length > 0);
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('creates log files when file logging is enabled', async () => {
    const rootPath = createTempDir();
    const logsDir = path.join(rootPath, FILE_LOG_SUBDIRECTORY);
    const payload: ScriptPayloadType = {
      objectSets: [
        {
          objects: [{ name: 'Account', query: 'SELECT Id FROM Account' }],
        },
      ],
    };
    writeExportJson(rootPath, payload);

    const originalResolve = OrgConnectionAdapter.resolveOrgPairAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgPairAsync = async () => ({
      sourceOrg: undefined,
      targetOrg: undefined,
    });
    const originalResolveOrg = OrgConnectionAdapter.resolveOrgAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgAsync = async () => ({} as never);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => createDescribeConnection() as never;

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest({
          path: rootPath,
          sourceusername: 'source',
          targetusername: 'target',
          filelog: 1,
        })
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.SUCCESS);
      assert.ok(fs.existsSync(logsDir));
      const logFiles = fs.readdirSync(logsDir).filter((file) => file.endsWith('.log'));
      assert.ok(logFiles.length > 0);
    } finally {
      OrgConnectionAdapter.resolveOrgPairAsync = originalResolve;
      OrgConnectionAdapter.resolveOrgAsync = originalResolveOrg;
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('loads export.json from --file and keeps runtime folders under --path', async () => {
    const rootPath = createTempDir();
    const customScriptDir = createTempDir();
    const payload: ScriptPayloadType = {
      objectSets: [
        {
          objects: [{ name: 'Account', query: 'SELECT Id FROM Account' }],
        },
      ],
    };
    writeExportJson(customScriptDir, payload);
    const customScriptPath = path.join(customScriptDir, SCRIPT_FILE_NAME);

    const originalResolve = OrgConnectionAdapter.resolveOrgPairAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgPairAsync = async () => ({
      sourceOrg: undefined,
      targetOrg: undefined,
    });
    const originalResolveOrg = OrgConnectionAdapter.resolveOrgAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgAsync = async () => ({} as never);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => createDescribeConnection() as never;

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest({
          path: rootPath,
          file: customScriptPath,
          sourceusername: 'source',
          targetusername: 'target',
          filelog: 1,
          quiet: true,
        })
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.SUCCESS);
      assert.equal(fs.existsSync(path.join(rootPath, FILE_LOG_SUBDIRECTORY)), true);
      assert.equal(fs.existsSync(path.join(customScriptDir, FILE_LOG_SUBDIRECTORY)), false);
    } finally {
      OrgConnectionAdapter.resolveOrgPairAsync = originalResolve;
      OrgConnectionAdapter.resolveOrgAsync = originalResolveOrg;
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
      fs.rmSync(rootPath, { recursive: true, force: true });
      fs.rmSync(customScriptDir, { recursive: true, force: true });
    }
  });

  it('writes anonymised diagnostic export.json path with preserved relative segment for --file', async () => {
    const rootPath = createTempDir();
    const customScriptDir = createTempDir();
    const payload: ScriptPayloadType = {
      objectSets: [
        {
          objects: [{ name: 'Account', query: 'SELECT Id FROM Account' }],
        },
      ],
    };
    writeExportJson(customScriptDir, payload);
    const customScriptPath = path.join(customScriptDir, SCRIPT_FILE_NAME);

    const originalResolve = OrgConnectionAdapter.resolveOrgPairAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgPairAsync = async () => ({
      sourceOrg: undefined,
      targetOrg: undefined,
    });
    const originalResolveOrg = OrgConnectionAdapter.resolveOrgAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgAsync = async () => ({} as never);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => createDescribeConnection() as never;

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest({
          path: rootPath,
          file: customScriptPath,
          sourceusername: 'source',
          targetusername: 'target',
          diagnostic: true,
          anonymise: true,
          filelog: 0,
          quiet: true,
        })
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.SUCCESS);
      const latestLogPath = getLatestLogFilePath(rootPath);
      const logContent = fs.readFileSync(latestLogPath, 'utf8');
      const expectedPath = customScriptPath.replace(/\\/g, '/');
      const expectedRelative = path.relative(rootPath, customScriptPath).replace(/\\/g, '/');
      assert.ok(logContent.includes('[diagnostic] export.json path:'));
      assert.ok(logContent.includes(`<masked-path>/${expectedRelative}`));
      assert.equal(logContent.includes(expectedPath), false);
      assert.ok(logContent.includes('[diagnostic] export.json path differs from --path root.'));
    } finally {
      OrgConnectionAdapter.resolveOrgPairAsync = originalResolve;
      OrgConnectionAdapter.resolveOrgAsync = originalResolveOrg;
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
      fs.rmSync(rootPath, { recursive: true, force: true });
      fs.rmSync(customScriptDir, { recursive: true, force: true });
    }
  });

  it('skips log file creation when filelog is disabled', async () => {
    const rootPath = createTempDir();
    const logsDir = path.join(rootPath, FILE_LOG_SUBDIRECTORY);

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest({
          path: rootPath,
          version: true,
          filelog: 0,
        })
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.SUCCESS);
      assert.equal(fs.existsSync(logsDir), false);
    } finally {
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('processes each object set in order', async () => {
    const rootPath = createTempDir();
    const payload: ScriptPayloadType = {
      objectSets: [
        {
          objects: [{ name: 'Account', query: 'SELECT Id FROM Account' }],
        },
        {
          objects: [{ name: 'Contact', query: 'SELECT Id FROM Contact' }],
        },
      ],
    };
    writeExportJson(rootPath, payload);

    const originalResolve = OrgConnectionAdapter.resolveOrgPairAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgPairAsync = async () => ({
      sourceOrg: undefined,
      targetOrg: undefined,
    });
    const originalResolveOrg = OrgConnectionAdapter.resolveOrgAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgAsync = async () => ({} as never);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => createDescribeConnection() as never;

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest({
          path: rootPath,
          sourceusername: 'source',
          targetusername: 'target',
          quiet: true,
          filelog: 0,
        })
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.SUCCESS);
      assert.ok(result.fullLog.some((line) => line.includes('OBJECT SET #1 STARTED')));
      assert.ok(result.fullLog.some((line) => line.includes('OBJECT SET #2 STARTED')));
    } finally {
      OrgConnectionAdapter.resolveOrgPairAsync = originalResolve;
      OrgConnectionAdapter.resolveOrgAsync = originalResolveOrg;
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('returns warning-as-error status when failonwarning is enabled', async () => {
    const rootPath = createTempDir();
    const payload: ScriptPayloadType = {
      objectSets: [
        {
          objects: [],
        },
      ],
    };
    writeExportJson(rootPath, payload);

    const originalResolve = OrgConnectionAdapter.resolveOrgPairAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgPairAsync = async () => ({
      sourceOrg: undefined,
      targetOrg: undefined,
    });
    const originalResolveOrg = OrgConnectionAdapter.resolveOrgAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgAsync = async () => ({} as never);
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async () => createDescribeConnection() as never;

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest({
          path: rootPath,
          sourceusername: 'source',
          targetusername: 'target',
          failonwarning: true,
          filelog: 0,
        })
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.WARNING_AS_ERROR);
      assert.equal(result.statusString, 'WARNING_AS_ERROR');
      assert.ok(result.message.includes('aborted due to warning'));
    } finally {
      OrgConnectionAdapter.resolveOrgPairAsync = originalResolve;
      OrgConnectionAdapter.resolveOrgAsync = originalResolveOrg;
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('auto-resolves default apiVersion as min(source max, target max)', async () => {
    const rootPath = createTempDir();
    const payload: ScriptPayloadType = {
      objectSets: [
        {
          objects: [{ name: 'Account', query: 'SELECT Id FROM Account' }],
        },
      ],
    };
    writeExportJson(rootPath, payload);

    const capturedVersions: string[] = [];
    const originalResolve = OrgConnectionAdapter.resolveOrgPairAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgPairAsync = async () => ({
      sourceOrg: undefined,
      targetOrg: undefined,
    });
    const originalResolveOrg = OrgConnectionAdapter.resolveOrgAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgAsync = async () => ({} as never);
    const originalResolveMaxApi = OrgConnectionAdapter.resolveMaxApiVersionAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveMaxApiVersionAsync = async (aliasOrUsername: string) =>
      aliasOrUsername === 'source' ? '65.0' : '63.0';
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async (_aliasOrUsername: string, apiVersion?: string) => {
      if (apiVersion) {
        capturedVersions.push(apiVersion);
      }
      return createDescribeConnection() as never;
    };

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest({
          path: rootPath,
          sourceusername: 'source',
          targetusername: 'target',
          filelog: 0,
        })
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.SUCCESS);
      assert.ok(capturedVersions.length > 0);
      assert.ok(capturedVersions.every((version) => version === '63.0'));
    } finally {
      OrgConnectionAdapter.resolveOrgPairAsync = originalResolve;
      OrgConnectionAdapter.resolveOrgAsync = originalResolveOrg;
      OrgConnectionAdapter.resolveMaxApiVersionAsync = originalResolveMaxApi;
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('keeps export.json apiVersion and skips auto-resolve', async () => {
    const rootPath = createTempDir();
    const payload: ScriptPayloadType = {
      apiVersion: '61.0',
      objectSets: [
        {
          objects: [{ name: 'Account', query: 'SELECT Id FROM Account' }],
        },
      ],
    };
    writeExportJson(rootPath, payload);

    const capturedVersions: string[] = [];
    let resolveMaxCallCount = 0;
    const originalResolve = OrgConnectionAdapter.resolveOrgPairAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgPairAsync = async () => ({
      sourceOrg: undefined,
      targetOrg: undefined,
    });
    const originalResolveOrg = OrgConnectionAdapter.resolveOrgAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgAsync = async () => ({} as never);
    const originalResolveMaxApi = OrgConnectionAdapter.resolveMaxApiVersionAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveMaxApiVersionAsync = async () => {
      resolveMaxCallCount += 1;
      return '65.0';
    };
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async (_aliasOrUsername: string, apiVersion?: string) => {
      if (apiVersion) {
        capturedVersions.push(apiVersion);
      }
      return createDescribeConnection() as never;
    };

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest({
          path: rootPath,
          sourceusername: 'source',
          targetusername: 'target',
          filelog: 0,
        })
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.SUCCESS);
      assert.equal(resolveMaxCallCount, 0);
      assert.ok(capturedVersions.length > 0);
      assert.ok(capturedVersions.every((version) => version === '61.0'));
    } finally {
      OrgConnectionAdapter.resolveOrgPairAsync = originalResolve;
      OrgConnectionAdapter.resolveOrgAsync = originalResolveOrg;
      OrgConnectionAdapter.resolveMaxApiVersionAsync = originalResolveMaxApi;
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });

  it('keeps CLI --apiversion and skips auto-resolve', async () => {
    const rootPath = createTempDir();
    const payload: ScriptPayloadType = {
      objectSets: [
        {
          objects: [{ name: 'Account', query: 'SELECT Id FROM Account' }],
        },
      ],
    };
    writeExportJson(rootPath, payload);

    const capturedVersions: string[] = [];
    let resolveMaxCallCount = 0;
    const originalResolve = OrgConnectionAdapter.resolveOrgPairAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgPairAsync = async () => ({
      sourceOrg: undefined,
      targetOrg: undefined,
    });
    const originalResolveOrg = OrgConnectionAdapter.resolveOrgAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveOrgAsync = async () => ({} as never);
    const originalResolveMaxApi = OrgConnectionAdapter.resolveMaxApiVersionAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.resolveMaxApiVersionAsync = async () => {
      resolveMaxCallCount += 1;
      return '65.0';
    };
    const originalConnection = OrgConnectionAdapter.getConnectionForAliasAsync.bind(OrgConnectionAdapter);
    OrgConnectionAdapter.getConnectionForAliasAsync = async (_aliasOrUsername: string, apiVersion?: string) => {
      if (apiVersion) {
        capturedVersions.push(apiVersion);
      }
      return createDescribeConnection() as never;
    };

    try {
      const result = await SfdmuRunService.executeAsync(
        buildRequest({
          path: rootPath,
          sourceusername: 'source',
          targetusername: 'target',
          apiversion: '62.0',
          filelog: 0,
        })
      );

      assert.equal(result.status, COMMAND_EXIT_STATUSES.SUCCESS);
      assert.equal(resolveMaxCallCount, 0);
      assert.ok(capturedVersions.length > 0);
      assert.ok(capturedVersions.every((version) => version === '62.0'));
    } finally {
      OrgConnectionAdapter.resolveOrgPairAsync = originalResolve;
      OrgConnectionAdapter.resolveOrgAsync = originalResolveOrg;
      OrgConnectionAdapter.resolveMaxApiVersionAsync = originalResolveMaxApi;
      OrgConnectionAdapter.getConnectionForAliasAsync = originalConnection;
      fs.rmSync(rootPath, { recursive: true, force: true });
    }
  });
});
