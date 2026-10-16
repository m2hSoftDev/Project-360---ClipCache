import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json';

const { version } = packageJson;

export default defineManifest({
  manifest_version: 3,
  name: 'ClipCache',
  version,
  description: 'Capture, auto-save, view, edit, compare, and export screenshots from a side panel.',
  permissions: [
    'sidePanel',
    'activeTab',
    'tabs',
    'offscreen',
    'storage',
    'scripting',
    'unlimitedStorage',
  ],
  host_permissions: ['<all_urls>'],
  action: {
    default_title: 'Open ClipCache',
    default_icon: {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
  },
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  icons: {
    '16': 'icons/icon16.png',
    '32': 'icons/icon32.png',
    '48': 'icons/icon48.png',
    '128': 'icons/icon128.png',
  },
  commands: {
    capture_visible: {
      suggested_key: {
        default: 'Alt+Shift+S',
        mac: 'Alt+Shift+S',
      },
      description: 'Capture visible tab without picker',
    },
  },
});
