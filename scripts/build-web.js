'use strict';
const fs = require('node:fs/promises'), path = require('node:path');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
async function buildWeb(out = path.join(root, 'dist', 'web')) {
  await fs.mkdir(out, { recursive: true });
  const read = file => fs.readFile(path.join(root, file), 'utf8');
  const html = (await read('web/index.html')).replace('<!-- SHARED_UI -->', await read('media/ui.html'));
  await esbuild.build({
    absWorkingDir: root, entryPoints: ['web/main.js'], outfile: path.join(out, 'app.js'),
    bundle: true, platform: 'browser', format: 'iife', target: 'es2022',
    // jsonc-parser's UMD factory hides require() calls from static bundlers.
    // Prefer its published ESM entry, also when imported by the CommonJS core.
    mainFields: ['module', 'main'],
    loader: { '.jsonc': 'text' }, charset: 'utf8', legalComments: 'inline', logLevel: 'warning'
  });
  await fs.writeFile(path.join(out, 'index.html'), html);
  for (const [from, to] of [
    ['media/style.css', 'shared.css'], ['web/style.css', 'web.css'],
    ['web/README.md', 'README.md'], ['web/README-ja.md', 'README-ja.md'],
    ['LICENSE', 'LICENSE.txt'], ['node_modules/jsonc-parser/LICENSE.md', 'jsonc-parser-LICENSE.txt'],
    ['examples/characters.relations.jsonc', 'characters.relations.jsonc']
  ]) await fs.copyFile(path.join(root, from), path.join(out, to));
  return out;
}
if (require.main === module) buildWeb().then(out => console.log(`Web build: ${out}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { buildWeb };
