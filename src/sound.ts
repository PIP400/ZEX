import { GameSettings } from "./types";

let audioCtx: AudioContext | null = null;
let currentSettings: GameSettings = {
  sfxEnabled: true,
  bgmEnabled: true,
  brightness: 1.0,
  difficulty: "Medium"
};

let bgmInterval: any = null;
let bgmSynthNodes: AudioNode[] = [];

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function updateSoundSettings(settings: GameSettings) {
  currentSettings = settings;
  if (!settings.bgmEnabled) {
    stopBgm();
  } else if (!bgmInterval) {
    startBgm();
  }
}

export function playSfx(type: "shoot" | "hurt" | "pickup" | "dash" | "spell" | "wave" | "spawn" | "click") {
  if (!currentSettings.sfxEnabled) return;
  try {
    const ctx = getAudioContext();
    const time = ctx.currentTime;

    switch (type) {
      case "click": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, time);
        osc.frequency.exponentialRampToValueAtTime(150, time + 0.08);
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.08);
        break;
      }
      case "shoot": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(800, time);
        osc.frequency.exponentialRampToValueAtTime(100, time + 0.15);
        gain.gain.setValueAtTime(0.08, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.15);
        break;
      }
      case "dash": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(1200, time + 0.12);
        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.12);
        break;
      }
      case "hurt": {
        // Synthesis of noise-based explosion/rumble for taking damage or hitting enemy
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(120, time);
        osc.frequency.linearRampToValueAtTime(30, time + 0.25);
        
        // Let's add an LFO or quick envelope distortion
        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + 0.25);
        break;
      }
      case "pickup": {
        // Dual-tone ascending shiny chime
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(440, time);
        osc1.frequency.setValueAtTime(554, time + 0.08);
        osc1.frequency.setValueAtTime(659, time + 0.16);
        osc1.frequency.setValueAtTime(880, time + 0.24);

        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(880, time);
        osc2.frequency.setValueAtTime(1108, time + 0.08);
        osc2.frequency.setValueAtTime(1318, time + 0.16);
        osc2.frequency.setValueAtTime(1760, time + 0.24);

        gain.gain.setValueAtTime(0.06, time);
        gain.gain.exponentialRampToValueAtTime(0.005, time + 0.35);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + 0.35);
        osc2.stop(time + 0.35);
        break;
      }
      case "spell": {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(250, time);
        osc.frequency.exponentialRampToValueAtTime(800, time + 0.25);

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(400, time);
        filter.frequency.exponentialRampToValueAtTime(2000, time + 0.25);

        gain.gain.setValueAtTime(0.08, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.25);
        break;
      }
      case "spawn": {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(80, time);
        osc.frequency.linearRampToValueAtTime(40, time + 0.8);
        
        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + 0.8);
        break;
      }
      case "wave": {
        // Epic arpeggio fanfare
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, time + idx * 0.1);
          
          gain.gain.setValueAtTime(0.08, time + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.01, time + idx * 0.1 + 0.2);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(time + idx * 0.1);
          osc.stop(time + idx * 0.1 + 0.2);
        });
        break;
      }
    }
  } catch (e) {
    console.error("SFX Synth Error:", e);
  }
}

export function startBgm() {
  if (!currentSettings.bgmEnabled) return;
  stopBgm();
  try {
    const ctx = getAudioContext();
    let index = 0;
    
    // retro 8-bit minor key fantasy progression arpeggio
    // A-minor scale arpeggios
    const progressions = [
      [220, 261.63, 329.63, 392], // Am7
      [174.61, 220, 261.63, 349.23], // Fmaj7
      [196, 246.94, 293.66, 392], // G
      [164.81, 196, 246.94, 329.63]  // Em
    ];

    bgmInterval = setInterval(() => {
      if (!currentSettings.bgmEnabled) return;
      const progressIndex = Math.floor(index / 8) % progressions.length;
      const noteIndex = index % 8;
      const notes = progressions[progressIndex];
      // map noteIndex to a pattern: 0 1 2 3 2 1 0 3
      const pattern = [0, 1, 2, 3, 2, 1, 0, 3];
      const freq = notes[pattern[noteIndex]];

      const time = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.02, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.25);

      index++;
    }, 250);
  } catch (err) {
    console.error("BGM Synth Error:", err);
  }
}

export function stopBgm() {
  if (bgmInterval) {
    clearInterval(bgmInterval);
    bgmInterval = null;
  }
}
