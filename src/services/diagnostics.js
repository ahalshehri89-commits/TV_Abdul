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

/**
 * Probe whether YouTube's embedded player works from this app's origin.
 * Embeds a video in a small frame for 25 seconds and logs every message the player sends.
 */
export function probeYouTubeEmbed(videoId) {
  const frame = document.createElement('iframe');
  frame.id = 'yt-probe';
  frame.allow = 'autoplay; encrypted-media';
  frame.style.cssText = 'position:fixed;right:20px;bottom:20px;width:640px;height:360px;z-index:9999;border:2px solid red';
  frame.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&controls=0&rel=0&playsinline=1`;
  const post = (payload) => {
    try {
      frame.contentWindow.postMessage(JSON.stringify({ ...payload, id: 'probe', channel: 'widget' }), '*');
    } catch (e) {
      console.log('[yt-probe] post failed', e && e.message);
    }
  };
  let seen = 0;
  const onMessage = (event) => {
    if (!/youtube/.test(event.origin)) return;
    seen += 1;
    let data = event.data;
    try {
      data = JSON.parse(event.data);
    } catch (e) {}
    const info = data && data.info;
    if (data.event === 'infoDelivery' && info && info.currentTime === undefined && info.playerState === undefined) return;
    console.log(
      `[yt-probe ${videoId}] ${data.event}`,
      info && typeof info === 'object'
        ? JSON.stringify({ state: info.playerState, t: info.currentTime, d: info.duration, q: info.playbackQuality, err: info.errorCode, title: info.videoData && info.videoData.title })
        : JSON.stringify(info)
    );
  };
  window.addEventListener('message', onMessage);
  frame.onload = () => {
    console.log(`[yt-probe ${videoId}] frame loaded`);
    let tries = 0;
    const hello = setInterval(() => {
      post({ event: 'listening' });
      ['onReady', 'onStateChange', 'onError'].forEach((name) => post({ event: 'command', func: 'addEventListener', args: [name] }));
      tries += 1;
      if (seen > 0 || tries > 20) clearInterval(hello);
    }, 500);
  };
  document.body.appendChild(frame);
  setTimeout(() => {
    console.log(`[yt-probe ${videoId}] finished, messages seen: ${seen}`);
    window.removeEventListener('message', onMessage);
    frame.remove();
  }, 25000);
}

/**
 * Try a list of YouTube titles through the hosted player page, one after another, and log
 * for each whether it plays in the app or which error it gives.
 * @param {string} wrapperUrl hosted player page
 * @param {string[]} specs entries like "v:<videoId>" or "list:<playlistId>"
 */
export async function probeYouTubeBatch(wrapperUrl, specs) {
  for (const spec of specs) {
    const [kind, id] = spec.split(':');
    const outcome = await new Promise((resolve) => {
      const frame = document.createElement('iframe');
      frame.allow = 'autoplay; encrypted-media';
      frame.style.cssText = 'position:fixed;right:20px;bottom:20px;width:1280px;height:720px;z-index:9999;border:0';
      frame.src = `${wrapperUrl}?${kind === 'list' ? 'list' : 'v'}=${id}`;
      const startedAt = Date.now();
      let last = null;
      const finish = (result) => {
        window.removeEventListener('message', onMessage);
        clearTimeout(timer);
        frame.remove();
        resolve(`${result} after ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
      };
      const onMessage = (event) => {
        if (event.source !== frame.contentWindow) return;
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        if (message.type !== 'tick') console.log(`[yt-batch] ${spec} message:`, JSON.stringify(message));
        if (message.type === 'error') finish(`ERROR ${message.code}`);
        if (message.type === 'tick') {
          if (!last || last.state !== message.state) console.log(`[yt-batch] ${spec} state ${message.state} t=${message.time} count=${message.count}`);
          last = message;
          if (message.state === 1 && message.time > 3) finish(`PLAYS quality=${message.quality} duration=${Math.round(message.duration)} count=${message.count}`);
        }
      };
      const timer = setTimeout(() => finish(`NO START (last state ${last ? last.state : 'none'}, t=${last ? last.time : 0})`), 25000);
      window.addEventListener('message', onMessage);
      document.body.appendChild(frame);
    });
    console.log(`[yt-batch] ${spec}: ${outcome}`);
  }
  console.log('[yt-batch] done');
}
