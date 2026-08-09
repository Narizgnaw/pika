import {access, copyFile, cp, mkdir, rm} from 'node:fs/promises';
import {resolve} from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const adminDist = resolve(repoRoot, 'web/.dist');
const portalDist = resolve(repoRoot, 'portal/dist');
const output = resolve(repoRoot, 'web/dist');

await access(resolve(adminDist, 'index.html'));
await access(resolve(portalDist, 'index.html'));
await rm(output, {recursive: true, force: true});
await mkdir(resolve(output, 'default-theme'), {recursive: true});
await cp(adminDist, resolve(output, 'admin'), {recursive: true});
await cp(portalDist, resolve(output, 'default-theme/dist'), {recursive: true});
await copyFile(resolve(repoRoot, 'portal/pika-theme.json'), resolve(output, 'default-theme/pika-theme.json'));
await copyFile(resolve(repoRoot, 'portal/public/logo.png'), resolve(output, 'logo.png'));
