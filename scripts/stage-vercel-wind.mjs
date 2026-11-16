import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const assets = new URL('../server/vercel/assets/', import.meta.url);
const wasm = await readFile(
  new URL(
    '../node_modules/@meri-imperiumi/eccodes-wasm/build/eccodes/eccodes.wasm',
    import.meta.url,
  ),
);
await mkdir(assets, { recursive: true });
await writeFile(
  new URL('eccodes-binary.cjs', assets),
  `module.exports = '${gzipSync(wasm).toString('base64')}';\n`,
);
