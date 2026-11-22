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
// Three looks: 1 문서 준비 중 (document), 2 불러오는 중 (pen), 3 앱 시작 화면 (book app icon).
const styleNames = { doc: '문서 준비 중', pen: '불러오는 중 (연필)', app: '앱 시작 화면 (책)' };
const chooseStyle = () => ask('로딩 화면을 고르세요.', styleNames, '--style', 'app');
// Two colours for each look: the blue-grey it was made in, or a soft beige (ivory paper, brown ink).
const colorNames = { blue: '푸른 회색', beige: '베이지' };
const beige = [
  ['#f7f8fa', '#faf6ef'], ['#ffffff', '#faf6ef'], ['#506b87', '#8a6b4e'], ['#b9c6d4', '#dccdb6'], ['#e3e8ee', '#e9dfcf'],
  ['%235f7c99', '%23b08d6c'], ['%234a6480', '%238f6e51'],
  ['rgba(74, 100, 128, .28)', 'rgba(143, 110, 81, .30)'], ['rgba(80, 107, 135, 0)', 'rgba(138, 107, 78, 0)'],
];
const paint = (css, color) => color === 'beige' ? beige.reduce((out, [from, to]) => out.split(from).join(to), css) : css;
async function ask(title, names, flag, fallback) {
  const index = args.indexOf(flag);
  if (index >= 0) {
    const name = args[index + 1];
    if (!names[name]) throw Error(`${flag} 뒤에는 ${Object.keys(names).join(', ')} 중 하나가 필요합니다. 변경하지 않았습니다.`);
    return name;
  }
  if (!process.stdin.isTTY) return fallback;
  const keys = Object.keys(names);
  console.log(title);
  keys.forEach((key, i) => console.log(`${i + 1}. ${names[key]}`));
  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  const answer = await new Promise((resolve, reject) => {
    rl.once('close', () => reject(Error('선택이 취소되었습니다. 변경하지 않았습니다.')));
    rl.question('번호: ', value => { resolve(value.trim()); rl.close(); });
  });
  if (!/^d+$/.test(answer) || !keys[Number(answer) - 1]) throw Error('올바른 번호가 아닙니다. 변경하지 않았습니다.');
  return keys[Number(answer) - 1];
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
const styles = {"doc":"/* First splash only. The standalone Termux installer adds these rules before extensions load. */\n#preloader:has(#loader.splash-screen) { background: #f7f8fa !important; color: #506b87 !important; backdrop-filter: none !important; }\nhtml body #loader.splash-screen .splash-logo { display: none !important; }\nhtml body #loader.splash-screen .splash-message { font-size: 0 !important; }\nhtml body #loader.splash-screen .splash-message::after { content: '문서 준비 중'; font: 500 15px/1.6 system-ui, sans-serif; }\nhtml body #loader.splash-screen #load-spinner { width: 40px !important; height: 48px !important; animation: none !important; }\nhtml body #loader.splash-screen #load-spinner > * { display: none !important; }\nhtml body #loader.splash-screen #load-spinner::before {\n  content: '' !important; display: block; width: 32px; height: 42px;\n  box-sizing: border-box; border: 2px solid #506b87; border-radius: 4px;\n  background: linear-gradient(#b9c6d4,#b9c6d4) 6px 12px / 16px 2px no-repeat,\n              linear-gradient(#b9c6d4,#b9c6d4) 6px 20px / 16px 2px no-repeat,\n              linear-gradient(#b9c6d4,#b9c6d4) 6px 28px / 11px 2px no-repeat;\n  animation: qn-loading 1.4s ease-in-out infinite;\n}\n@keyframes qn-loading { 50% { opacity: .4; } }\n@media (prefers-reduced-motion: reduce) { html body #loader.splash-screen #load-spinner::before { animation: none; } }\n\r\n/* Newer versions render the splash inside a dialog rather than #preloader. */\nhtml body .popup:has(#loader.splash-screen) { background: #f7f8fa !important; color: #506b87 !important; box-shadow: none !important; border: 0 !important; }\nhtml body .popup:has(#loader.splash-screen)::backdrop { background: #f7f8fa !important; backdrop-filter: none !important; }\nhtml body #loader.splash-screen { gap: 24px !important; }\nhtml body #loader.splash-screen .splash-message::before { content: none !important; display: none !important; }\nhtml body #loader.splash-screen .splash-message::after { color: #506b87 !important; display: block !important; line-height: 1.6 !important; }\r\n","pen":"/* First splash only. The standalone Termux installer adds these rules before extensions load. */\n#preloader:has(#loader.splash-screen) { background: #f7f8fa !important; color: #506b87 !important; backdrop-filter: none !important; }\nhtml body #loader.splash-screen .splash-logo { display: none !important; }\n/* \"불러오는 중\" with its dots appearing one by one; the dots keep their own width so the words stay still. */\nhtml body #loader.splash-screen .splash-message { font-size: 0 !important; display: flex !important; justify-content: center !important; align-items: baseline !important; }\nhtml body #loader.splash-screen .splash-message::after { content: '불러오는 중'; order: 1; font: 500 15px/1.6 system-ui, sans-serif; }\nhtml body #loader.splash-screen .splash-message::before {\n  content: ''; order: 2; display: inline-block !important; width: 1.2em; text-align: left;\n  font: 500 15px/1.6 system-ui, sans-serif !important; color: #506b87 !important; background: none !important; border: 0 !important;\n  margin: 0 !important; padding: 0 !important; position: static !important;\n  animation: qn-dots 1.2s steps(1) infinite;\n}\n@keyframes qn-dots { 0% { content: ''; } 25% { content: '.'; } 50% { content: '..'; } 75% { content: '...'; } }\n/* A pen drawing an underline. */\nhtml body #loader.splash-screen #load-spinner { position: relative !important; width: 48px !important; height: 40px !important; animation: none !important; font-size: 0 !important; }\nhtml body #loader.splash-screen #load-spinner > * { display: none !important; }\nhtml body #loader.splash-screen #load-spinner::before {\n  content: '' !important; position: absolute; left: 4px; top: 32px; width: 40px; height: 2px; border-radius: 2px;\n  background: #506b87; transform-origin: left center; animation: qn-underline 1.6s ease-in-out infinite;\n}\nhtml body #loader.splash-screen #load-spinner::after {\n  content: '' !important; position: absolute; left: 4px; top: 10px; width: 6px; height: 22px; border-radius: 1px 1px 0 0;\n  background: #506b87; clip-path: polygon(0 0, 100% 0, 100% 78%, 50% 100%, 0 78%);\n  transform: rotate(35deg); transform-origin: 50% 100%; animation: qn-pen 1.6s ease-in-out infinite;\n}\n@keyframes qn-underline { 0% { scale: 0 1; } 60%, 100% { scale: 1 1; } }\n@keyframes qn-pen { 0% { translate: 0 0; opacity: 1; } 60% { translate: 37px 0; opacity: 1; } 100% { translate: 37px 0; opacity: 0; } }\n@media (prefers-reduced-motion: reduce) {\n  html body #loader.splash-screen #load-spinner::before, html body #loader.splash-screen #load-spinner::after { animation: none; }\n  html body #loader.splash-screen .splash-message::before { animation: none; content: '...'; }\n}\n\n/* Newer versions render the splash inside a dialog rather than #preloader. */\nhtml body .popup:has(#loader.splash-screen) { background: #f7f8fa !important; color: #506b87 !important; box-shadow: none !important; border: 0 !important; }\nhtml body .popup:has(#loader.splash-screen)::backdrop { background: #f7f8fa !important; backdrop-filter: none !important; }\nhtml body #loader.splash-screen { gap: 24px !important; }\nhtml body #loader.splash-screen .splash-message::after { color: #506b87 !important; display: block !important; line-height: 1.6 !important; }\n","app":"/* First splash only: an app start screen. The standalone Termux installer adds these rules before extensions load. */\n#preloader:has(#loader.splash-screen) { background: #ffffff !important; color: #506b87 !important; backdrop-filter: none !important; }\n/* The app icon: a book on a rounded tile, drawn in place of the logo. */\nhtml body #loader.splash-screen .splash-logo {\n  content: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 76 76'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='.55' y2='1'%3E%3Cstop offset='0' stop-color='%235f7c99'/%3E%3Cstop offset='1' stop-color='%234a6480'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='76' height='76' rx='22' fill='url(%23g)'/%3E%3Cg transform='translate(15 15) scale(.9583)' fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M24 15c-4-3-9.5-3.6-15-2.4v22.2c5.5-1.2 11-.6 15 2.4 4-3 9.5-3.6 15-2.4V12.6C33.5 11.4 28 12 24 15z' fill='rgba(255,255,255,.16)' stroke='%23fff' stroke-width='2.4'/%3E%3Cpath d='M24 15v22.2' stroke='%23fff' stroke-width='2.4'/%3E%3Cpath d='M9 34.8c5.5-1.2 11-.6 15 2.4 4-3 9.5-3.6 15-2.4v2.6c-5.5-1.1-11-.4-15 2.4-4-2.8-9.5-3.5-15-2.4z' fill='%23fff' opacity='.9'/%3E%3C/g%3E%3C/svg%3E\") !important; display: block !important; width: 76px !important; height: 76px !important; max-width: none !important;\n  border-radius: 22px !important; filter: none !important; box-shadow: 0 6px 16px rgba(74, 100, 128, .28) !important; margin: 0 0 6vh !important;\n}\nhtml body #loader.splash-screen .splash-message { display: none !important; }\n/* A thin bar near the bottom with a soft light running one way along it. */\nhtml body #loader.splash-screen #load-spinner {\n  position: fixed !important; left: 50% !important; top: auto !important; bottom: 11% !important; width: 112px !important; height: 3px !important;\n  margin: 0 0 0 -56px !important; padding: 0 !important; border-radius: 3px !important; background: #e3e8ee !important;\n  overflow: hidden !important; animation: none !important; font-size: 0 !important; transform: none !important;\n}\nhtml body #loader.splash-screen #load-spinner > *, html body #loader.splash-screen #load-spinner::after { display: none !important; }\nhtml body #loader.splash-screen #load-spinner::before {\n  content: '' !important; position: absolute; top: 0; left: 0; width: 45%; height: 100%; border-radius: 3px;\n  background: linear-gradient(90deg, rgba(80, 107, 135, 0), #506b87 60%, rgba(80, 107, 135, 0));\n  animation: qn-flow 1.4s cubic-bezier(.45, 0, .55, 1) infinite;\n}\n@keyframes qn-flow { from { translate: -100% 0; } to { translate: 230% 0; } }\n@media (prefers-reduced-motion: reduce) { html body #loader.splash-screen #load-spinner::before { animation: none; translate: 60% 0; } }\n\n/* Newer versions render the splash inside a dialog rather than #preloader. */\nhtml body .popup:has(#loader.splash-screen) { background: #ffffff !important; color: #506b87 !important; box-shadow: none !important; border: 0 !important; }\nhtml body .popup:has(#loader.splash-screen)::backdrop { background: #ffffff !important; backdrop-filter: none !important; }\n"};
const css = remove ? '' : paint(styles[await chooseStyle()], await ask('색을 고르세요.', colorNames, '--color', 'blue'));
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
