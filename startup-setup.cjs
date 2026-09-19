/* Run once on the SillyTavern server. No network, dependencies or core-file patches. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const readline = require('node:readline');
const { createRequire } = require('node:module');
const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
function cssTargets(root) {
  const legacy = path.join(root, 'public', 'css', 'user.css');
  if (!fs.existsSync(path.join(root, 'src', 'middleware', 'userCss.js'))) return [legacy];
  let dataRoot = './data';
  const configPath = path.join(root, 'config.yaml');
  if (fs.existsSync(configPath)) {
    let yaml;
    try { yaml = createRequire(path.join(root, 'package.json'))('yaml'); }
    catch { throw Error('실리의 YAML 모듈을 찾지 못했습니다. 실리 설치를 완료한 뒤 다시 실행하세요. 변경하지 않았습니다.'); }
    const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
    if (config?.dataRoot !== undefined) {
      if (typeof config.dataRoot !== 'string' || !config.dataRoot.trim()) throw Error('config.yaml의 dataRoot가 올바르지 않습니다.');
      dataRoot = config.dataRoot;
    }
  }
  return [path.resolve(root, dataRoot, '_css', 'user.css'), legacy];
}
function validRoot(folder) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'));
    const html = fs.readFileSync(path.join(folder, 'public', 'index.html'), 'utf8');
    return pkg.name.toLowerCase() === 'sillytavern' && /href=["']css\/user\.css["']/.test(html);
  } catch { return false; }
}
async function findRoot() {
  if (rootIndex >= 0) {
    if (!args[rootIndex + 1] || args[rootIndex + 1].startsWith('--')) throw Error('--root 뒤에 설치 폴더가 필요합니다.');
    const explicit = fs.realpathSync(args[rootIndex + 1]);
    if (!validRoot(explicit)) throw Error('선택한 폴더는 SillyTavern 설치 폴더가 아닙니다.');
    return explicit;
  }
  // Running from an installation or its subdirectory selects that installation.
  let current = fs.realpathSync(process.cwd());
  while (true) {
    if (validRoot(current)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  console.log('홈 폴더에서 SillyTavern을 찾는 중…');
  const candidates = [];
  const skip = new Set(['node_modules', '.git', '.cache', '.npm', '.local', 'data', 'backups', 'cache', 'storage', 'Android']);
  const queue = [{dir: os.homedir(), depth: 0}];
  let visited = 0;
  while (queue.length) {
    if (++visited > 20000) throw Error('검색 범위가 너무 넓습니다. 실리 폴더 안에서 같은 명령을 실행하세요.');
    const {dir, depth} = queue.shift();
    if (validRoot(dir)) { candidates.push(fs.realpathSync(dir)); continue; }
    if (depth >= 6) continue;
    let entries;
    try { entries = fs.readdirSync(dir, {withFileTypes: true}); } catch { continue; }
    for (const entry of entries) {
      if (entry.isDirectory() && !skip.has(entry.name) && !entry.name.startsWith('.')) queue.push({dir: path.join(dir, entry.name), depth: depth + 1});
    }
  }
  let found = [...new Set(candidates)].sort();
  if (args.includes('--remove')) {
    const patched = found.filter(dir => {
      return cssTargets(dir).some(file => {
        try { return fs.readFileSync(file, 'utf8').includes('/* QUIET-NOTES STARTUP BEGIN */'); } catch { return false; }
      });
    });
    if (patched.length) found = patched;
  }
  if (!found.length) throw Error('설치를 찾지 못했습니다. 실리 폴더 안에서 같은 명령을 실행하세요. 홈 밖이나 저장소 연결 경로는 자동 검색하지 않습니다.');
  if (found.length === 1) return found[0];
  console.log('설치가 여러 개 있습니다. 변경할 번호를 선택하세요.');
  found.forEach((dir, i) => console.log(`${i + 1}. ${dir}`));
  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  const answer = await new Promise((resolve, reject) => {
    rl.once('close', () => reject(Error('선택이 취소되었습니다. 변경하지 않았습니다.')));
    rl.question('번호: ', value => { resolve(value.trim()); rl.close(); });
  });
  if (!/^\d+$/.test(answer) || !found[Number(answer) - 1]) throw Error('올바른 번호가 아닙니다. 변경하지 않았습니다.');
  return found[Number(answer) - 1];
}
async function main() {
const root = await findRoot();
console.log(`선택한 설치: ${root}`);
const htmlPath = path.join(root, 'public', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
if (!/href=["']css\/user\.css["']/.test(html)) throw Error('This folder does not contain the expected SillyTavern public/index.html.');
const [destination, legacy] = cssTargets(root);
const before = fs.existsSync(destination) ? fs.readFileSync(destination, 'utf8') : '';
const start = '/* QUIET-NOTES STARTUP BEGIN */';
const end = '/* QUIET-NOTES STARTUP END */';
const block = /\/\* QUIET-NOTES STARTUP BEGIN \*\/[\s\S]*?\/\* QUIET-NOTES STARTUP END \*\/(?:\r?\n)?/g;
const existing = before.replace(block, '');
const remove = args.includes('--remove');
// Embedded so this installer can be downloaded and run as one file.
const css = "/* Neutral loader branding, including while the saved mode is being restored.\n   For coverage BEFORE extension loading, import this file from public/css/user.css. */\n#preloader { background: #f7f8fa !important; color: #506b87 !important; backdrop-filter: none !important; }\nhtml body #loader.splash-screen .splash-logo { display: none !important; }\nhtml body #loader.splash-screen .splash-message { font-size: 0 !important; }\nhtml body #loader.splash-screen .splash-message::after { content: '문서 준비 중'; font: 500 15px/1.6 system-ui, sans-serif; }\nhtml body #load-spinner { width: 40px !important; height: 48px !important; animation: none !important; }\nhtml body #load-spinner > * { display: none !important; }\nhtml body #load-spinner::before {\n  content: '' !important; display: block; width: 32px; height: 42px;\n  box-sizing: border-box; border: 2px solid #506b87; border-radius: 4px;\n  background: linear-gradient(#b9c6d4,#b9c6d4) 6px 12px / 16px 2px no-repeat,\n              linear-gradient(#b9c6d4,#b9c6d4) 6px 20px / 16px 2px no-repeat,\n              linear-gradient(#b9c6d4,#b9c6d4) 6px 28px / 11px 2px no-repeat;\n  animation: qn-loading 1.4s ease-in-out infinite;\n}\n@keyframes qn-loading { 50% { opacity: .4; } }\n@media (prefers-reduced-motion: reduce) { html body #load-spinner::before { animation: none; } }\n\r\n/* Newer versions render the splash inside a dialog rather than #preloader. */\nhtml body .popup:has(#loader.splash-screen) { background: #f7f8fa !important; color: #506b87 !important; box-shadow: none !important; border: 0 !important; }\nhtml body .popup:has(#loader.splash-screen)::backdrop { background: #f7f8fa !important; backdrop-filter: none !important; }\nhtml body #loader.splash-screen { gap: 24px !important; }\nhtml body #loader.splash-screen .splash-message::before { content: none !important; display: none !important; }\nhtml body #loader.splash-screen .splash-message::after { color: #506b87 !important; display: block !important; line-height: 1.6 !important; }\r\n";
const after = remove ? existing : `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${start}\n${css.trim()}\n${end}\n`;
function writeChanged(file, original, replacement) {
  if (original === replacement) return;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  const backup = file + '.quiet-notes-backup';
  if (fs.existsSync(file) && !fs.existsSync(backup)) fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
  fs.writeFileSync(file, replacement, 'utf8');
}
writeChanged(destination, before, after);
if (legacy && legacy !== destination && fs.existsSync(legacy)) {
  const old = fs.readFileSync(legacy, 'utf8');
  writeChanged(legacy, old, old.replace(block, ''));
}
console.log(`${remove ? 'Removed' : 'Installed'} startup CSS: ${destination}`);
console.log('Refresh SillyTavern. Other user.css rules were retained.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
