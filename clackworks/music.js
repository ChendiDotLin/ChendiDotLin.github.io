/* Assembly After Hours — original adaptive score and mechanical sound design.
   Synthesized locally; no recordings or external samples. Audio is opt-in. */
(function (root) {
  'use strict';
  const STEP = 60 / 96 / 4;
  const CHORDS = [[50,65,69], [46,62,65], [53,60,65], [48,64,67]];
  // F–A–G / F–D: one two-bar phrase, then two bars of breathing room.
  // The closing phrase resolves to C; intensity never adds competing melodies.
  const THEME = new Map([[0,[65,3]], [4,[69,3]], [8,[67,6]], [16,[65,3]], [20,[62,8]]]);
  const hz = note => 440 * 2 ** ((note - 69) / 12);
  class WorkshopMusic {
    constructor(context = null) {
      this.context = context; this.master = null; this.timer = null;
      this.playing = false; this.volume = .35; this.effectsVolume = .65; this.step = 0;
      this.voices = new Set(); this.effectVoices = new Set(); this.generation = 0;
      this.scene = .25; this.chainUntil = 0; this.effectsEnabled = false;
    }
    ensure() {
      if (this.master) return;
      this.context ||= new (root.AudioContext || root.webkitAudioContext)();
      const ctx = this.context;
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -16;
      this.compressor.knee.value = 18; this.compressor.ratio.value = 4;
      this.compressor.attack.value = .004; this.compressor.release.value = .16;
      this.compressor.connect(ctx.destination);
      this.master = ctx.createGain(); this.master.gain.value = this.volume * .7;
      this.master.connect(this.compressor);
      this.effectBus = ctx.createGain(); this.effectBus.gain.value = this.effectsVolume * .65;
      this.effectBus.connect(this.compressor);
      this.leadWave = ctx.createPeriodicWave(new Float32Array(5), new Float32Array([0,1,.12,.03,0]));
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0); let seed = 719;
      for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; data[i] = (seed >>> 0) / 2147483648 - 1; }
    }
    voice(source, time, length, strength, options = {}) {
      const ctx = this.context, set = options.effect ? this.effectVoices : this.voices;
      if (!ctx.startRendering && set.size >= (options.effect ? 80 : 128)) return;
      const envelope = ctx.createGain(), filter = ctx.createBiquadFilter();
      filter.type = options.filterType || 'lowpass'; filter.frequency.value = Math.min(ctx.sampleRate * .45, options.cutoff || 5000);
      filter.Q.value = options.q || .7;
      const attack = Math.min(options.attack || .003, length / 3);
      envelope.gain.setValueAtTime(.0001, time);
      envelope.gain.exponentialRampToValueAtTime(Math.max(.0002, strength), time + attack);
      if (options.hold) envelope.gain.linearRampToValueAtTime(Math.max(.0002, strength * .85), time + Math.min(length * .7, options.hold));
      envelope.gain.exponentialRampToValueAtTime(.0001, time + length);
      source.connect(filter); filter.connect(envelope); envelope.connect(options.effect ? this.effectBus : this.master);
      set.add(source);
      source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); set.delete(source); };
      source.start(time); source.stop(time + length + .025);
    }
    tone(note, time, length, strength, type = 'triangle', options = {}) {
      const source = this.context.createOscillator(); source.type = type;
      if (options.theme) source.setPeriodicWave(this.leadWave);
      source.frequency.setValueAtTime(hz(note), time);
      if (options.endNote !== undefined) source.frequency.exponentialRampToValueAtTime(hz(options.endNote), time + length * .8);
      if (options.detune) source.detune.value = options.detune;
      this.voice(source, time, length, strength, options);
    }
    noise(time, length, strength, cutoff, options = {}) {
      const source = this.context.createBufferSource(); source.buffer = this.noiseBuffer;
      this.voice(source, time, length, strength, { filterType: 'bandpass', cutoff, ...options });
    }
    kick(time, strength = .35, effect = false) {
      this.tone(47, time, .26, strength, 'sine', { endNote: 25, effect, cutoff: 800 });
      this.noise(time, .025, strength * .15, 1800, { effect });
    }
    renderStep(step, time, energy = this.scene) {
      const beat = step % 16, bar = Math.floor(step / 16) % 16;
      const chord = CHORDS[Math.floor(bar / 4)];
      if (beat === 0) {
        chord.slice(1).forEach(note => this.tone(note, time, STEP * 15, .04, 'sine', { attack: .18, cutoff: 1100 }));
        this.tone(chord[0] - 12, time, STEP * 9, .2, 'triangle', { attack: .025, cutoff: 450 });
      }
      if (beat === 0 || beat === 8) this.kick(time, .12 + energy * .055);
      if (beat === 4 || beat === 12) this.noise(time, .025, .035 + energy * .012, 1250, { q: .6 });
      if (beat === 14 && bar % 2 === 1) this.noise(time, .035, .018, 3000, { q: .5 });
      const phraseStep = (bar % 4) * 16 + beat, theme = THEME.get(phraseStep);
      if (theme) {
        const [note, duration] = theme, length = duration * STEP;
        this.tone(bar >= 12 && phraseStep === 20 ? 60 : note, time, length, .15, 'sine',
          { theme: true, attack: .035, hold: length * .45, cutoff: 1600 });
      }
    }
    schedule() {
      if (!this.playing || this.context.state !== 'running') return;
      if (this.next < this.context.currentTime) this.next = this.context.currentTime + .04;
      while (this.next < this.context.currentTime + .18) {
        this.renderStep(this.step, this.next, Math.max(this.scene, this.next < this.chainUntil ? .9 : 0));
        this.next += STEP; this.step = (this.step + 1) % 256;
      }
    }
    async play() {
      const generation = ++this.generation; this.playing = true;
      try {
        this.ensure(); await this.context.resume();
        if (generation !== this.generation || !this.playing) return;
        this.master.gain.setTargetAtTime(this.volume * .7, this.context.currentTime, .03);
        clearInterval(this.timer); this.next = this.context.currentTime + .04;
        this.schedule(); this.timer = setInterval(() => this.schedule(), 50);
      } catch (error) { if (generation === this.generation) this.stop(); throw error; }
    }
    setScene(stage = 1, boss = false, danger = false) { this.scene = Math.min(.8, .2 + stage * .025 + (boss ? .3 : 0) + (danger ? .12 : 0)); }
    setVolume(value) {
      this.volume = Math.max(0, Math.min(1, value));
      if (this.master && this.playing) this.master.gain.setTargetAtTime(this.volume * .7, this.context.currentTime, .03);
    }
    setEffects(enabled) { this.effectsEnabled = enabled; if (!enabled) this.cancelEffects(); }
    setEffectsVolume(value) {
      this.effectsVolume = Math.max(0, Math.min(1, value));
      if (this.effectBus) this.effectBus.gain.setTargetAtTime(this.effectsVolume * .65, this.context.currentTime, .02);
    }
    effectAt(kind, time, strength = 1, index = 0) {
      const e = { effect: true }, notes = [74,77,79,81,84];
      const ping = (note, length = .18, gain = .16, offset = 0) => this.tone(note, time + offset, length, gain * strength, 'sine', e);
      if (kind === 'pick') {
        this.noise(time, .028, .15 * strength, 1500, { ...e, q: 2 }); ping(62, .045, .08);
      } else if (kind === 'match' || kind === 'reclaim' || kind === 'win') {
        const chord = kind === 'win' ? [62,69,74,77,81] : [74,77,81];
        chord.forEach((note, i) => ping(note, .35, .13, i * .055));
        this.noise(time, .035, .07, 2500, e);
      } else if (kind === 'behemoth') {
        this.kick(time, .6 * strength, true);
        this.noise(time, .34, .32 * strength, 650, { ...e, filterType: 'lowpass' });
        this.noise(time, .075, .14 * strength, 2400, e);
      } else if (kind === 'gasoline') {
        this.noise(time, .26, .22 * strength, 1900, { ...e, q: .6 }); ping(48, .12, .12);
      } else if (kind === 'ukulele') {
        this.tone(notes[index % notes.length], time, .19, .13 * strength, 'triangle', { ...e, endNote: 86, cutoff: 3200 });
        this.noise(time, .06, .09 * strength, 3600, { ...e, q: 2 });
      } else if (kind === 'blackhole' || kind === 'shuffle' || kind === 'restart') {
        this.tone(43, time, .5, .22 * strength, 'triangle', { ...e, endNote: kind === 'blackhole' ? 67 : 55, cutoff: 1200 });
        this.noise(time + .12, .24, .1 * strength, 1500, e);
      } else if (kind === 'lose' || kind === 'boss') {
        [57,53,50].forEach((n, i) => ping(n, .28, .15, i * .10));
        this.noise(time, .16, .13, 400, e);
      } else if (kind === 'shield') {
        [62,74].forEach(note => ping(note, .45, .13)); this.noise(time, .09, .1, 2300, e);
      } else { ping(notes[index % notes.length], .22, .14); ping(86, .10, .03, .05); }
    }
    sound(kind, delay = 0, strength = 1, index = 0) {
      if (!this.effectsEnabled || root.document?.hidden) return;
      try {
        this.ensure();
        if (this.context.state === 'suspended') this.context.resume().catch(() => {});
        this.effectAt(kind, this.context.currentTime + .012 + delay, strength, index);
      } catch (_) { /* Sound must never interrupt the game. */ }
    }
    chain(events, count, reducedMotion = false) {
      if (this.context && count >= 6) this.chainUntil = this.context.currentTime + 7;
      const step = events.length > 1 ? Math.min(.18, 1.6 / (events.length - 1)) : 0;
      // Keep the attack audible instead of piling every recovered tile into noise.
      const audible = events.map((event, index) => ({ ...event, index })).filter(e => !['sealEnergy','bossBreak'].includes(e.kind));
      const stride = Math.max(1, Math.ceil(audible.length / 10));
      audible.filter((_, i) => i % stride === 0).forEach((event, i) => {
        const delay = reducedMotion ? Math.min(i * .045, .3) : event.index * step + (event.kind === 'behemoth' ? .26 : event.kind === 'ukulele' ? .2 : .08);
        this.sound(event.kind, delay, audible.length > 8 ? .65 : .85, i);
      });
    }
    cancelEffects() {
      for (const voice of this.effectVoices) { try { voice.stop(); } catch (_) {} }
      this.effectVoices.clear();
    }
    stop() {
      this.playing = false; this.generation++; clearInterval(this.timer); this.timer = null;
      for (const voice of this.voices) { try { voice.stop(); } catch (_) {} }
      this.voices.clear();
      if (this.master) this.master.gain.setValueAtTime(0, this.context.currentTime);
    }
    async visibility(hidden) {
      if (!this.context) return;
      if (hidden) { this.cancelEffects(); clearInterval(this.timer); this.timer = null; await this.context.suspend(); }
      else if (this.playing) await this.play();
      // Effects-only playback resumes on the next intentional game action.
    }
  }
  WorkshopMusic.stepDuration = STEP;
  root.RainMusic = WorkshopMusic;
})(typeof window !== 'undefined' ? window : globalThis);
