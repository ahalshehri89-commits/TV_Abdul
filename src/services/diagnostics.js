/**
 * TV_Abdul: on-device diagnostics, run only in debug builds.
 * Logs what the TV actually supports so findings come from the device, not from documentation.
 */

import { fileBrowserService } from './fileBrowserService.js';

export async function runDiagnostics() {
  const tizen = window.tizen;
  console.log('[diag] tizen:', Boolean(tizen), 'avplay:', Boolean(window.webapis && window.webapis.avplay));
  console.log('[diag] location:', window.location.href, 'origin:', window.location.origin);
  try {
    if (tizen && tizen.systeminfo) {
      console.log('[diag] platform:', tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version'));
    }
  } catch (e) {
    console.log('[diag] platform version unavailable:', e && e.message);
  }

  try {
    if (tizen && tizen.filesystem) {
      tizen.filesystem.listStorages((storages) => {
        console.log('[diag] storages:', storages.map((s) => `${s.label}/${s.type}/${s.state}`).join(', '));
      });
    }
    const drives = await fileBrowserService.listDrives();
    console.log('[diag] usb drives:', drives);
    for (const drive of drives) {
      try {
        const entries = await fileBrowserService.listAll(drive.label);
        console.log(`[diag] ${drive.label}: ${entries.length} entries`, entries.slice(0, 5).map((e) => `${e.kind}:${e.path} -> ${e.uri}`));
      } catch (e) {
        console.log(`[diag] ${drive.label} list failed:`, e && e.message);
      }
    }
  } catch (e) {
    console.log('[diag] filesystem check failed:', e && e.message);
  }
}
