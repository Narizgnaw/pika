import {access, readFile, stat} from 'node:fs/promises';
import {resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
const requiredFiles = [
    'dist/admin/index.html',
    'dist/default-theme/pika-theme.json',
    'dist/default-theme/dist/index.html',
];
const requiredDirectories = ['dist/admin/assets', 'dist/default-theme/dist/assets'];

for (const relative of requiredFiles) {
    const target = resolve(root, relative);
    await access(target);
    if (!(await stat(target)).isFile()) throw new Error(`构建产物不是文件: ${relative}`);
}
for (const relative of requiredDirectories) {
    const target = resolve(root, relative);
    await access(target);
    if (!(await stat(target)).isDirectory()) throw new Error(`构建产物不是目录: ${relative}`);
}

const adminHTML = await readFile(resolve(root, 'dist/admin/index.html'), 'utf8');
const portalHTML = await readFile(resolve(root, 'dist/default-theme/dist/index.html'), 'utf8');
if (!adminHTML.includes('/admin/assets/') || adminHTML.includes('/theme-assets/')) {
    throw new Error('管理 SPA 的资源前缀未与公开主题隔离');
}
if (!portalHTML.includes('/theme-assets/') || portalHTML.includes('/admin/assets/')) {
    throw new Error('默认公开主题的资源前缀未与管理 SPA 隔离');
}

console.log('admin SPA 与 default-theme SPA 构建产物校验通过');
