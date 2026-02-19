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
import { COMMAND_EXIT_STATUSES } from '../../../src/modules/constants/Constants.js';
import LoggingContext from '../../../src/modules/logging/LoggingContext.js';
import LoggingService from '../../../src/modules/logging/LoggingService.js';

describe('LoggingService', () => {
  const createTempDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'sfdmu-log-'));

  it('respects log levels for stdout and file logs', () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'WARN',
      fileLogEnabled: true,
      stdoutWriter: (message: string) => stdout.push(message),
      stderrWriter: (message: string) => stderr.push(message),
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);

    service.info('info message');
    service.warn('warn message');
    service.error('error message');

    assert.equal(stdout.length, 1);
    assert.equal(stderr.length, 1);
    assert.ok(stdout[0].includes('WARN'));
    assert.ok(stderr[0].includes('ERROR'));

    const fileContent = fs.readFileSync(context.logFilePath, 'utf8');
    assert.ok(fileContent.includes('warn message'));
    assert.ok(fileContent.includes('error message'));
    assert.ok(!fileContent.includes('info message'));
  });

  it('suppresses stdout when quiet or silent', () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      quiet: true,
      fileLogEnabled: true,
      stdoutWriter: (message: string) => stdout.push(message),
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);

    service.info('quiet message');

    assert.equal(stdout.length, 0);
    const fileContent = fs.readFileSync(context.logFilePath, 'utf8');
    assert.ok(fileContent.includes('quiet message'));
  });

  it('writes json output to stdout at command completion', () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      jsonEnabled: true,
      fileLogEnabled: true,
      stdoutWriter: (message: string) => stdout.push(message),
      stderrWriter: (message: string) => stderr.push(message),
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);

    service.info('json info');
    service.warn('json warn');
    service.finishCommand('commandSucceededResult', 0, 'SUCCESS');

    assert.equal(stdout.length, 1);
    assert.equal(stderr.length, 0);

    const jsonStdout = JSON.parse(stdout[0]) as {
      command: string;
      fullLog: string[];
      statusString: string;
    };
    assert.equal(jsonStdout.command, 'sfdmu:run');
    assert.equal(jsonStdout.statusString, 'SUCCESS');
    assert.ok(jsonStdout.fullLog.some((line) => line.includes('json info')));
    assert.ok(jsonStdout.fullLog.some((line) => line.includes('json warn')));
  });

  it('suppresses json stdout when quiet or silent', () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      jsonEnabled: true,
      quiet: true,
      fileLogEnabled: true,
      stdoutWriter: (message: string) => stdout.push(message),
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);

    service.finishCommand('commandSucceededResult', 0, 'SUCCESS');

    assert.equal(stdout.length, 0);
  });

  it('suppresses log file entries when file logging is disabled', () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      jsonEnabled: true,
      fileLogEnabled: false,
      stdoutWriter: (message: string) => stdout.push(message),
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);

    service.info('json info file');
    service.warn('json warn file');
    service.finishCommand('commandSucceededResult', 0, 'SUCCESS');

    assert.equal(fs.existsSync(context.logFilePath), false);
    assert.equal(stdout.length, 1);
  });

  it('includes error details in json output', () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      jsonEnabled: true,
      fileLogEnabled: true,
      stdoutWriter: (message: string) => stdout.push(message),
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);
    const error = new Error('boom');
    error.stack = 'Error: boom\nstack line';

    service.finishCommandWithError('commandExecutionErrorResult', 4, 'COMMAND_EXECUTION_ERROR', error);

    assert.equal(stdout.length, 1);
    const jsonStdout = JSON.parse(stdout[0]) as { message: string; stack: string[]; statusString: string };
    assert.equal(jsonStdout.statusString, 'COMMAND_EXECUTION_ERROR');
    assert.ok(jsonStdout.message.includes('boom'));
    assert.equal(jsonStdout.stack[0], 'Error: boom');
  });

  it('adds stack traces for unexpected non-error failures', () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      jsonEnabled: true,
      fileLogEnabled: true,
      stdoutWriter: (message: string) => stdout.push(message),
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);

    service.finishCommandWithError('commandAbortedDueUnexpectedErrorResult', 1, 'COMMAND_UNEXPECTED_ERROR', 'oops');

    assert.equal(stdout.length, 1);
    const jsonStdout = JSON.parse(stdout[0]) as { message: string; stack: string[]; statusString: string };
    assert.equal(jsonStdout.statusString, 'COMMAND_UNEXPECTED_ERROR');
    assert.ok(jsonStdout.message.includes('oops'));
    assert.ok(jsonStdout.stack[0]?.includes('oops'));
  });

  it('shows yellow failure guidance after exit code for non-zero status', () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      fileLogEnabled: true,
      stdoutWriter: (message: string) => stdout.push(message),
      stderrWriter: (message: string) => stderr.push(message),
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);

    service.finishCommandWithError(
      'commandExecutionErrorResult',
      COMMAND_EXIT_STATUSES.COMMAND_EXECUTION_ERROR,
      'COMMAND_EXECUTION_ERROR',
      new Error('boom')
    );

    const exitCodeLineIndex = stdout.findIndex((line) =>
      line.includes('Execution of the command sfdmu:run has been completed. Exit code 4 (COMMAND_EXECUTION_ERROR).')
    );
    const guidanceLineIndex = stdout.findIndex((line) =>
      line.includes('To localize the root cause of the issue, first check your migration configuration')
    );

    assert.ok(exitCodeLineIndex >= 0);
    assert.ok(guidanceLineIndex > exitCodeLineIndex);
    assert.equal(stdout[exitCodeLineIndex + 1], '');
    assert.ok(stdout[guidanceLineIndex].includes('\u001b[33m'));
    assert.ok(
      stdout[guidanceLineIndex].includes(
        'https://help.sfdmu.com/full-documentation/reports/the-execution-log#what-is-masked-and-what-is-not'
      )
    );
    assert.equal(stderr.length, 1);
  });

  it('does not show failure guidance for success and user-aborted statuses', () => {
    const rootPath = createTempDir();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      fileLogEnabled: true,
      stdoutWriter: (message: string) => stdout.push(message),
      stderrWriter: (message: string) => stderr.push(message),
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);

    service.finishCommand('commandSucceededResult', COMMAND_EXIT_STATUSES.SUCCESS, 'SUCCESS');
    service.finishCommand(
      'commandAbortedByUserErrorResult',
      COMMAND_EXIT_STATUSES.COMMAND_ABORTED_BY_USER,
      'COMMAND_ABORTED_BY_USER'
    );

    assert.equal(
      stdout.some((line) =>
        line.includes('To localize the root cause of the issue, first check your migration configuration')
      ),
      false
    );
    assert.equal(
      stdout.some((line) => line === ''),
      false
    );
    assert.ok(stderr.some((line) => line.includes('Execution of the command has aborted by the user.')));
  });

  it('uses default prompt answers when json is enabled', async () => {
    const rootPath = createTempDir();
    let promptCalls = 0;
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      jsonEnabled: true,
      fileLogEnabled: true,
      promptWriter: async () => {
        promptCalls += 1;
        return false;
      },
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);

    const result = await service.yesNoPromptAsync('prompt');
    assert.equal(result, true);
    assert.equal(promptCalls, 0);
  });

  it('auto-accepts prompts when quiet is enabled', async () => {
    const rootPath = createTempDir();
    let promptCalls = 0;
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      quiet: true,
      fileLogEnabled: false,
      promptWriter: async () => {
        promptCalls += 1;
        return false;
      },
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);

    const result = await service.yesNoPromptAsync('prompt');
    assert.equal(result, true);
    assert.equal(promptCalls, 0);
  });

  it('delegates prompts to the configured writer when enabled', async () => {
    const rootPath = createTempDir();
    const received: string[] = [];
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      fileLogEnabled: false,
      promptWriter: async (message: string) => {
        received.push(message);
        return true;
      },
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);

    const result = await service.yesNoPromptAsync('confirm prompt');
    assert.equal(result, true);
    assert.equal(received.length, 1);
    assert.ok(received[0].includes('confirm prompt'));
  });

  it('returns empty string for text prompts when prompts are suppressed', async () => {
    const rootPath = createTempDir();
    let promptCalls = 0;
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      jsonEnabled: true,
      fileLogEnabled: false,
      textPromptWriter: async () => {
        promptCalls += 1;
        return 'value';
      },
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);

    const result = await service.textPromptAsync('prompt');
    assert.equal(result, '');
    assert.equal(promptCalls, 0);
  });

  it('delegates text prompts to the configured writer when enabled', async () => {
    const rootPath = createTempDir();
    const received: string[] = [];
    const context = new LoggingContext({
      commandName: 'run',
      rootPath,
      logLevelName: 'INFO',
      fileLogEnabled: false,
      textPromptWriter: async (message: string) => {
        received.push(message);
        return 'typed';
      },
      startTime: new Date('2024-01-01T00:00:00Z'),
    });
    const service = new LoggingService(context);

    const result = await service.textPromptAsync('text prompt');
    assert.equal(result, 'typed');
    assert.equal(received.length, 1);
    assert.equal(received[0], '');
  });
});
