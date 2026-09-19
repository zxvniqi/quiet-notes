/* Run once on the SillyTavern server. No network, dependencies or core-file patches. */
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const rootIndex = args.indexOf('--root');
if (rootIndex < 0 || !args[rootIndex + 1]) {
  console.error('Usage: node startup-setup.cjs --root "SillyTavern folder" [--remove]');
  process.exit(1);
}
const root = fs.realpathSync(args[rootIndex + 1]);
const htmlPath = path.join(root, 'public', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
if (!/href=["']css\/user\.css["']/.test(html)) throw Error('This folder does not contain the expected SillyTavern public/index.html.');
const destination = path.join(root, 'public', 'css', 'user.css');
const before = fs.existsSync(destination) ? fs.readFileSync(destination, 'utf8') : '';
const start = '/* QUIET-NOTES STARTUP BEGIN */';
const end = '/* QUIET-NOTES STARTUP END */';
const block = /\/\* QUIET-NOTES STARTUP BEGIN \*\/[\s\S]*?\/\* QUIET-NOTES STARTUP END \*\/(?:\r?\n)?/g;
const existing = before.replace(block, '');
const remove = args.includes('--remove');
// Embedded so this installer can be downloaded and run as one file.
const css = "/* Neutral loader branding, including while the saved mode is being restored.\n   For coverage BEFORE extension loading, import this file from public/css/user.css. */\n#preloader { background: #f7f8fa !important; color: #506b87 !important; backdrop-filter: none !important; }\nhtml body #loader.splash-screen .splash-logo { display: none !important; }\nhtml body #loader.splash-screen .splash-message { font-size: 0 !important; }\nhtml body #loader.splash-screen .splash-message::after { content: '문서 준비 중'; font: 500 15px/1.6 system-ui, sans-serif; }\nhtml body #load-spinner { width: 40px !important; height: 48px !important; animation: none !important; }\nhtml body #load-spinner > * { display: none !important; }\nhtml body #load-spinner::before {\n  content: '' !important; display: block; width: 32px; height: 42px;\n  box-sizing: border-box; border: 2px solid #506b87; border-radius: 4px;\n  background: linear-gradient(#b9c6d4,#b9c6d4) 6px 12px / 16px 2px no-repeat,\n              linear-gradient(#b9c6d4,#b9c6d4) 6px 20px / 16px 2px no-repeat,\n              linear-gradient(#b9c6d4,#b9c6d4) 6px 28px / 11px 2px no-repeat;\n  animation: qn-loading 1.4s ease-in-out infinite;\n}\n@keyframes qn-loading { 50% { opacity: .4; } }\n@media (prefers-reduced-motion: reduce) { html body #load-spinner::before { animation: none; } }\n\r\n/* Newer versions render the splash inside a dialog rather than #preloader. */\nhtml body .popup:has(#loader.splash-screen) { background: #f7f8fa !important; color: #506b87 !important; box-shadow: none !important; border: 0 !important; }\nhtml body .popup:has(#loader.splash-screen)::backdrop { background: #f7f8fa !important; backdrop-filter: none !important; }\nhtml body #loader.splash-screen { gap: 24px !important; }\nhtml body #loader.splash-screen .splash-message::before { content: none !important; display: none !important; }\nhtml body #loader.splash-screen .splash-message::after { color: #506b87 !important; display: block !important; line-height: 1.6 !important; }\r\n";
const after = remove ? existing : `${existing}${existing && !existing.endsWith('\n') ? '\n' : ''}${start}\n${css.trim()}\n${end}\n`;
if (before === after) { console.log('Already configured.'); process.exit(0); }
const backup = destination + '.quiet-notes-backup';
if (fs.existsSync(destination) && !fs.existsSync(backup)) fs.copyFileSync(destination, backup, fs.constants.COPYFILE_EXCL);
fs.writeFileSync(destination, after, 'utf8');
console.log(`${remove ? 'Removed' : 'Installed'} startup CSS: ${destination}`);
console.log('Refresh SillyTavern. Other user.css rules were retained.');
