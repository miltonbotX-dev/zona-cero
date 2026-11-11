/* ============================================================================
   ZCero — audio procedural
   Contrato: Web Audio sintético, silenciable (ZC.muted). No usa archivos de sonido. toggleMute y sfx.
   Depende de: js/zc.js
   Edición en paralelo: una persona en este archivo. Sin Git no hay fusión automática.
   ========================================================================== */
(function (global) {
  "use strict";
  var ZC = global.ZC;
  if (!ZC) throw new Error("Carga js/zc.js antes que js/audio.js");

  ZC.unlockAudio = function () {
    if (!ZC.audioCtx && global.AudioContext) {
      try { ZC.audioCtx = new AudioContext(); } catch (e) { ZC.audioCtx = null; }
    }
    if (ZC.audioCtx && ZC.audioCtx.state === "suspended") ZC.audioCtx.resume();
  };
  ZC.toggleMute = function () {
    ZC.muted = !ZC.muted;
    if (ZC.hudMuteBtn) {
      // Ícono SVG: el CSS (.off) cambia el parlante por el parlante tachado
      if (ZC.hudMuteBtn.classList) ZC.hudMuteBtn.classList.toggle("off", !!ZC.muted);
      if (ZC.hudMuteBtn.setAttribute) {
        ZC.hudMuteBtn.setAttribute("aria-label", ZC.muted ? "Activar sonido" : "Silenciar");
        ZC.hudMuteBtn.setAttribute("title", ZC.muted ? "Activar sonido (M)" : "Silenciar audio (M)");
      }
    }
    if (!ZC.muted) ZC.unlockAudio();
  }
  ZC.sfx = function (kind, extra) {
    if (ZC.muted || !ZC.audioCtx) return;
    const t = ZC.audioCtx.currentTime;
    const osc = ZC.audioCtx.createOscillator();
    const gain = ZC.audioCtx.createGain();
    const filter = ZC.audioCtx.createBiquadFilter();
    osc.connect(filter); filter.connect(gain); gain.connect(ZC.audioCtx.destination);
    filter.type = "lowpass";
    if (kind === "shoot") {
      osc.type = extra === "shotgun" ? "square" : "sawtooth";
      osc.frequency.setValueAtTime(extra === "shotgun" ? 140 : 320, t);
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.09);
      filter.frequency.value = 1800;
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
      osc.start(t); osc.stop(t + 0.12);
      // ruido corto
      ZC.noiseBurst(0.045, extra === "shotgun" ? 0.06 : 0.03);
    } else if (kind === "jump") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(240, t);
      osc.frequency.exponentialRampToValueAtTime(420, t + 0.08);
      filter.frequency.value = 2200;
      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t); osc.stop(t + 0.1);
    } else if (kind === "loot") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, t);
      osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
      filter.frequency.value = 4000;
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.start(t); osc.stop(t + 0.14);
    } else if (kind === "reload") {
      osc.type = "square";
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(120, t + 0.08);
      filter.frequency.value = 900;
      gain.gain.setValueAtTime(0.03, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.start(t); osc.stop(t + 0.1);
    } else if (kind === "die") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.22);
      filter.frequency.value = 800;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.start(t); osc.stop(t + 0.24);
    } else if (kind === "tick") {
      // Cuenta regresiva del despliegue
      osc.type = "square";
      osc.frequency.setValueAtTime(660, t);
      filter.frequency.value = 2400;
      gain.gain.setValueAtTime(0.035, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      osc.start(t); osc.stop(t + 0.09);
    } else if (kind === "land") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(60, t + 0.18);
      filter.frequency.value = 900;
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t); osc.stop(t + 0.2);
      ZC.noiseBurst(0.08, 0.04);
    } else if (kind === "win") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, t);
      osc.frequency.exponentialRampToValueAtTime(660, t + 0.2);
      filter.frequency.value = 3000;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t); osc.stop(t + 0.35);
    } else {
      osc.type = "sine";
      osc.frequency.value = 200;
      gain.gain.setValueAtTime(0.02, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.start(t); osc.stop(t + 0.08);
    }
  }
  ZC.noiseBurst = function (dur, vol) {
    if (!ZC.audioCtx) return;
    const n = ZC.audioCtx.createBuffer(1, Math.max(1, ZC.audioCtx.sampleRate * dur), ZC.audioCtx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.8;
    const src = ZC.audioCtx.createBufferSource();
    const g = ZC.audioCtx.createGain();
    src.buffer = n; src.connect(g); g.connect(ZC.audioCtx.destination);
    g.gain.setValueAtTime(vol, ZC.audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ZC.audioCtx.currentTime + dur);
    src.start();
  }

})(typeof window !== "undefined" ? window : globalThis);
