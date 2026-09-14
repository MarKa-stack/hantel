// Barcode-Scanner über die Kamera: native BarcodeDetector-API, sonst ZXing (vom CDN, nur bei Bedarf geladen).
// Erkennt EAN-13/EAN-8/UPC (Lebensmittel) und Code-128.
import { h, openSheet, toast, haptic } from './util.js';

const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js';
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

let zxingPromise = null;
function loadZXing() {
  if (window.ZXingBrowser) return Promise.resolve(window.ZXingBrowser);
  if (!zxingPromise) {
    zxingPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = ZXING_URL; s.async = true;
      s.onload = () => window.ZXingBrowser ? resolve(window.ZXingBrowser) : reject(new Error('ZXing nicht geladen'));
      s.onerror = () => reject(new Error('Scanner-Bibliothek konnte nicht geladen werden (Netz?)'));
      document.head.append(s);
    });
  }
  return zxingPromise;
}

export function scannerAvailable() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && (location.protocol === 'https:' || location.hostname === 'localhost');
}

/**
 * Öffnet den Scanner als Sheet; ruft onCode(code) einmal auf und schließt sich.
 */
export function openScanner(onCode) {
  if (!scannerAvailable()) { toast('Kamera nicht verfügbar – EAN eintippen'); return; }
  openSheet((sheet, close) => {
    const video = h('video', { playsinline: true, muted: true, autoplay: true });
    video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
    const status = h('div.small.muted.center.mt', { text: 'Kamera wird gestartet …' });
    const torchBtn = h('button.btn.sm.ghost', { text: 'Licht', hidden: true });
    let stream = null, track = null, controls = null, raf = 0, done = false;

    const stopAll = () => {
      cancelAnimationFrame(raf);
      try { controls?.stop(); } catch { /* egal */ }
      try { stream?.getTracks().forEach(t => t.stop()); } catch { /* egal */ }
      stream = null; track = null;
    };
    const finish = (code) => {
      if (done) return; done = true;
      haptic(30);
      stopAll(); close(); onCode(String(code).replace(/\D/g, ''));
    };
    const closeAll = () => { stopAll(); close(); };

    const setupTorch = () => {
      const caps = track?.getCapabilities?.();
      if (caps && caps.torch) {
        torchBtn.hidden = false;
        let on = false;
        torchBtn.onclick = async () => { on = !on; try { await track.applyConstraints({ advanced: [{ torch: on }] }); torchBtn.textContent = on ? 'Licht aus' : 'Licht'; } catch { /* egal */ } };
      }
    };

    const startNative = async () => {
      const detector = new window.BarcodeDetector({ formats: FORMATS });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      video.srcObject = stream; await video.play();
      track = stream.getVideoTracks()[0]; setupTorch();
      status.textContent = 'Barcode in den Rahmen halten';
      const tick = async () => {
        if (done || !stream) return;
        try {
          const codes = await detector.detect(video);
          const hit = codes.find(c => c.rawValue && /^\d{8,14}$/.test(c.rawValue));
          if (hit) { finish(hit.rawValue); return; }
        } catch { /* Frame übersprungen */ }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const startZXing = async () => {
      status.textContent = 'Scanner wird geladen …';
      const ZX = await loadZXing();
      const reader = new ZX.BrowserMultiFormatReader();
      status.textContent = 'Barcode in den Rahmen halten';
      controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video, (result) => {
        if (result && !done) {
          const text = result.getText?.() ?? result.text;
          if (/^\d{8,14}$/.test(String(text))) finish(text);
        }
      });
      stream = video.srcObject; track = stream?.getVideoTracks?.()[0] || null; setupTorch();
    };

    (async () => {
      try {
        if ('BarcodeDetector' in window) {
          try {
            const supported = await window.BarcodeDetector.getSupportedFormats?.();
            if (!supported || supported.includes('ean_13')) { await startNative(); return; }
          } catch { /* auf ZXing ausweichen */ }
        }
        await startZXing();
      } catch (e) {
        status.textContent = e.name === 'NotAllowedError' ? 'Kamera-Zugriff verweigert – in den iOS-Einstellungen unter Safari bzw. für die App erlauben.'
          : (e.name === 'NotFoundError' || /not found/i.test(e.message || '')) ? 'Keine Kamera gefunden – EAN unten eintippen.'
          : 'Kamera-Fehler: ' + (e.message || e);
      }
    })();

    sheet.append(
      h('div.row.between', {}, [h('h2', { text: 'Barcode scannen', style: { marginBottom: 0 } }), torchBtn]),
      h('div.scanner', {}, [video, h('div.frame')]),
      status,
      h('p.small.faint.center', { style: { marginTop: '6px' }, text: 'EAN-Strichcode auf der Packung. Alternativ die Ziffern unter dem Code eintippen.' }),
      h('div.actions', {}, [h('button.btn.block', { text: 'Abbrechen', onclick: closeAll })]),
    );
    // Sheet über Backdrop/Route geschlossen → Kamera freigeben
    const obs = new MutationObserver(() => { if (!document.body.contains(sheet)) { stopAll(); obs.disconnect(); } });
    obs.observe(document.getElementById('modal-root'), { childList: true });
  });
}
