#!/usr/bin/env node

// eslint-disable-next-line node/shebang
async function main() {
  const { execute } = await import('@oclif/core');
  await execute({ dir: import.meta.url });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
