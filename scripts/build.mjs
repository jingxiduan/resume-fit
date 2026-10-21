// 构建：src -> dist；前端 JS 混淆（可选域名锁定）；PDF/DOCX 解析库自托管到 dist/vendor
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const require = createRequire(import.meta.url);

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  for (const e of await fs.readdir(from, { withFileTypes: true })) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) await copyDir(a, b);
    else await fs.copyFile(a, b);
  }
}

export async function copyVendor(target) {
  const vendor = path.join(target, 'vendor');
  await fs.mkdir(vendor, { recursive: true });
  const pdfRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
  await fs.copyFile(path.join(pdfRoot, 'build/pdf.min.js'), path.join(vendor, 'pdf.min.js'));
  await fs.copyFile(path.join(pdfRoot, 'build/pdf.worker.min.js'), path.join(vendor, 'pdf.worker.min.js'));
  await copyDir(path.join(pdfRoot, 'cmaps'), path.join(vendor, 'cmaps'));
  const mamRoot = path.dirname(require.resolve('mammoth/package.json'));
  await fs.copyFile(path.join(mamRoot, 'mammoth.browser.min.js'), path.join(vendor, 'mammoth.browser.min.js'));
}

async function obfuscate(file) {
  let Obf;
  try {
    Obf = (await import('javascript-obfuscator')).default;
  } catch {
    console.warn('[build] 未安装 javascript-obfuscator，跳过混淆');
    return;
  }
  const code = await fs.readFile(file, 'utf8');
  const domains = (process.env.DOMAIN_LOCK || '').split(',').map((s) => s.trim()).filter(Boolean);
  const result = Obf.obfuscate(code, {
    compact: true,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.75,
    splitStrings: true,
    splitStringsChunkLength: 8,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.3,
    deadCodeInjection: false,
    selfDefending: true,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
    ...(domains.length ? { domainLock: domains, domainLockRedirectUrl: 'about:blank' } : {})
  });
  await fs.writeFile(file, result.getObfuscatedCode());
  console.log(`[build] 已混淆 ${path.basename(file)}${domains.length ? `，域名锁定：${domains.join(', ')}` : ''}`);
}

async function main() {
  await fs.rm(dist, { recursive: true, force: true });
  await copyDir(src, dist);
  await copyVendor(dist);
  if (process.env.SKIP_OBFUSCATE !== '1') await obfuscate(path.join(dist, 'app.js'));
  console.log('[build] 完成 -> dist/');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
