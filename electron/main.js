/**
 * Piano Teacher as a desktop app (PLAN.md milestone 3.5): an Electron window around the built
 * web app (dist/), served from app://piano-teacher/. That address is a secure origin with its
 * own storage, kept in the app's profile, so the app works offline and without a server.
 *
 * The web version is unchanged and still runs on its own (npm run dev, npm run preview).
 *
 * PIANO_TEACHER_URL loads another address instead (e.g. the dev server, http://localhost:5173);
 * PIANO_TEACHER_SMOKE=1 opens the app, prints what it found and quits (a quick check).
 */
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
  net,
  protocol,
  session,
  shell,
} from 'electron';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const SCHEME = 'app';
const START_URL = process.env.PIANO_TEACHER_URL ?? `${SCHEME}://piano-teacher/`;
const SMOKE = process.env.PIANO_TEACHER_SMOKE === '1';

/** What the app may use without asking: the MIDI keyboard and the microphone. */
const ALLOWED = new Set(['midi', 'midiSysex', 'media']);

/** Menu languages (locales/<language>/desktop.json); others fall back to English. */
const MENU_LANGUAGES = ['en', 'es'];

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

// A practice app should make sound as soon as it's asked to, without a first click.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

/** The app's files; any other path (an app page such as /learn) gets the page itself. */
function serveApp(request) {
  const { pathname } = new URL(request.url);
  const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
  const isFile = file.startsWith(DIST + path.sep) && existsSync(file) && statSync(file).isFile();
  return net.fetch(pathToFileURL(isFile ? file : path.join(DIST, 'index.html')).toString());
}

function menuTexts(language) {
  const base = language.split('-')[0];
  const chosen = MENU_LANGUAGES.includes(base) ? base : 'en';
  const read = (lang) =>
    JSON.parse(readFileSync(path.join(ROOT, 'locales', lang, 'desktop.json'), 'utf8')).menu;
  return { ...read('en'), ...read(chosen) };
}

function setMenu(language) {
  const text = menuTexts(language);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: text.app,
        submenu: [
          { label: text.reload, role: 'reload' },
          { label: text.fullScreen, role: 'togglefullscreen' },
          { type: 'separator' },
          { label: text.quit, role: 'quit' },
        ],
      },
      {
        label: text.view,
        submenu: [
          { label: text.zoomIn, role: 'zoomIn' },
          { label: text.zoomOut, role: 'zoomOut' },
          { label: text.actualSize, role: 'resetZoom' },
          { type: 'separator' },
          { label: text.devTools, role: 'toggleDevTools' },
        ],
      },
    ]),
  );
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 560,
    title: 'Piano Teacher',
    // The page's background while it loads (styles.css › --bg).
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#161614' : '#f6f5f2',
    icon: path.join(ROOT, 'build', 'icon.png'),
    autoHideMenuBar: true, // Alt shows it
    show: !SMOKE,
    webPreferences: {
      preload: path.join(ROOT, 'electron', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  // Links to other sites open in the browser, not in the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  void window.loadURL(START_URL);
  return window;
}

/** Opens the app hidden, reports what works, and quits. */
async function smokeTest(window) {
  await new Promise((resolve) => window.webContents.once('did-finish-load', resolve));
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const report = await window.webContents.executeJavaScript(`(async () => {
    const midi = await navigator.requestMIDIAccess().then(
      (access) => 'granted, ' + access.inputs.size + ' input(s)',
      (error) => 'refused: ' + error.name,
    );
    const storage = await new Promise((resolve) => {
      const request = indexedDB.open('piano-teacher');
      request.onsuccess = () => resolve('ok, ' + request.result.objectStoreNames.length + ' tables');
      request.onerror = () => resolve('failed');
    });
    const microphone = await navigator.permissions
      .query({ name: 'microphone' })
      .then((status) => status.state, () => 'unknown');
    return {
      url: location.href,
      title: document.title,
      secure: isSecureContext,
      heading: document.querySelector('h1')?.textContent ?? null,
      midi,
      microphone,
      storage,
    };
  })()`);
  console.log(JSON.stringify(report, null, 2));
  app.quit();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows();
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });

  app.whenReady().then(() => {
    protocol.handle(SCHEME, serveApp);
    session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) =>
      callback(ALLOWED.has(permission)),
    );
    session.defaultSession.setPermissionCheckHandler((_contents, permission) =>
      ALLOWED.has(permission),
    );
    setMenu(app.getLocale());
    // The menu follows the language chosen in the app.
    ipcMain.on('desktop:language', (_event, language) => {
      if (typeof language === 'string') setMenu(language);
    });
    // The window's frame and title bar follow the theme chosen in the app.
    ipcMain.on('desktop:theme', (_event, theme) => {
      if (theme === 'system' || theme === 'light' || theme === 'dark') {
        nativeTheme.themeSource = theme;
      }
    });

    const window = createWindow();
    if (SMOKE) void smokeTest(window);
  });

  app.on('window-all-closed', () => app.quit());
}
