#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { chmod, mkdir, open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const version = process.argv[2] ?? 'v1';
if (!/^[A-Za-z0-9._-]{1,32}$/.test(version)) {
  console.error('Version must be 1-32 characters: letters, digits, dot, underscore, or hyphen.');
  process.exit(2);
}

const directory = join(homedir(), '.local', 'share', 'starfetch-o2-secrets');
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
const path = join(directory, `hmac-keyring-${Date.now()}-${randomBytes(4).toString('hex')}.json`);
const secret = randomBytes(32);
const contents = `${JSON.stringify({ [version]: secret.toString('base64') })}\n`;
secret.fill(0);

const handle = await open(path, 'wx', 0o600);
try {
  await handle.writeFile(contents, { encoding: 'utf8' });
  await handle.sync();
} finally {
  await handle.close();
}
await chmod(path, 0o600);
console.log(`Created a 32-byte keyring for version ${version}.`);
console.log(`Secret file: ${path}`);
console.log('Treat this file as a secret; do not display it, commit it, or place it in frontend variables.');
