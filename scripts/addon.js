import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(CURRENT_FILE), '..');
const TEMPLATE_SCRIPT_PATH = path.join(ROOT_DIR, 'scripts', 'create-custom-addon-template.js');

/**
 * Wraps an argument in quotes when it contains spaces.
 *
 * @param {string} value - Argument value.
 * @returns {string} Quoted argument.
 */
const quoteArg = (value) => (value.includes(' ') ? `"${value}"` : value);

/**
 * Normalizes CLI args by removing npm's separator.
 *
 * @param {string[]} args - Raw args.
 * @returns {string[]} Normalized args.
 */
const normalizeArgs = (args) => (args[0] === '--' ? args.slice(1) : args);

/**
 * Resolves CLI args from direct argv.
 *
 * @returns {string[]} Resolved args.
 */
const getCliArgs = () => normalizeArgs(process.argv.slice(2));

/**
 * Runs a CLI command and exits when it fails.
 *
 * @param {string} command - Command to execute.
 * @param {string[]} args - Command arguments.
 * @param {string} cwd - Working directory.
 */
const runCommand = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

/**
 * Creates a new add-on template.
 *
 * @param {string} name - Add-on name.
 */
const createAddon = (name) => {
  runCommand('node', [quoteArg(TEMPLATE_SCRIPT_PATH), name], ROOT_DIR);
};

/**
 * Runs the add-on command.
 */
const runAsync = async () => {
  const args = getCliArgs();
  if (args.length === 0) {
    console.error('Usage: npm run addon create <name> | npm run addon compile');
    process.exit(1);
  }

  if (args[0] === 'create') {
    const name = args[1]?.trim();
    if (!name) {
      console.error('Missing add-on name. Usage: npm run addon create <name>');
      process.exit(1);
    }
    createAddon(name);
    return;
  }

  if (args[0] === 'compile') {
    runCommand('npm', ['run', 'addon:compile'], ROOT_DIR);
    return;
  }

  console.error(`Unknown option: ${args[0]}`);
  process.exit(1);
};

await runAsync();
