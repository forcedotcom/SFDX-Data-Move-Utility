import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const CURRENT_FILE = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(CURRENT_FILE), '..');
const CUSTOM_ADDON_ROOT = path.join(ROOT_DIR, 'custom-addon-sdk', 'custom-modules');
const SDK_TSCONFIG = path.join(ROOT_DIR, 'custom-addon-sdk', 'tsconfig.build.json');

/**
 * Wraps an argument in quotes when it contains spaces.
 *
 * @param {string} value - Argument value.
 * @returns {string} Quoted argument.
 */
const quoteArg = (value) => (value.includes(' ') ? `"${value}"` : value);

/**
 * Runs a CLI command and exits when it fails.
 *
 * @param {string} command - Command to execute.
 * @param {string[]} args - Command arguments.
 * @param {string} cwd - Working directory.
 */
const runCommand = (command, args, cwd) => {
  const normalizedArgs = args.map(quoteArg);
  const result = spawnSync(command, normalizedArgs, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

/**
 * Checks if a path exists.
 *
 * @param {string} targetPath - Path to check.
 * @returns {Promise<boolean>} True when the path exists.
 */
const pathExistsAsync = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Checks if a folder contains a tsconfig.json file.
 *
 * @param {string} folderPath - Folder to check.
 * @returns {Promise<boolean>} True when tsconfig exists.
 */
const hasTsconfigAsync = async (folderPath) => pathExistsAsync(path.join(folderPath, 'tsconfig.json'));

/**
 * Resolves all add-on directories.
 *
 * @returns {Promise<string[]>} Add-on directories.
 */
const resolveAllAddonsAsync = async () => {
  if (!(await pathExistsAsync(CUSTOM_ADDON_ROOT))) {
    return [];
  }
  const entries = await fs.readdir(CUSTOM_ADDON_ROOT, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(CUSTOM_ADDON_ROOT, entry.name));
  const results = [];
  for (const dir of dirs) {
    if (await hasTsconfigAsync(dir)) {
      results.push(dir);
    }
  }
  return results;
};

/**
 * Compiles an add-on by folder.
 *
 * @param {string} addonDir - Add-on folder.
 */
const compileAddon = async (addonDir) => {
  const tsconfigPath = path.join(addonDir, 'tsconfig.json');
  let config;
  try {
    const raw = await fs.readFile(tsconfigPath, 'utf8');
    config = JSON.parse(raw);
  } catch {
    config = undefined;
  }

  const compilerOptions = config?.compilerOptions ?? {};
  const args = ['-p', addonDir, '--pretty'];

  if (!compilerOptions.outDir) {
    args.push('--outDir', path.join(addonDir, 'dist'));
  }

  if (!compilerOptions.rootDir) {
    args.push('--rootDir', addonDir);
  }

  runCommand('tsc', args, ROOT_DIR);
};

/**
 * Compiles the add-on SDK interfaces.
 */
const compileSdk = () => {
  runCommand('tsc', ['-p', SDK_TSCONFIG, '--pretty'], ROOT_DIR);
};

/**
 * Runs add-on compilation.
 */
const runAsync = async () => {
  compileSdk();
  const allAddons = await resolveAllAddonsAsync();
  for (const addonDir of allAddons) {
    await compileAddon(addonDir);
  }
};

await runAsync();
