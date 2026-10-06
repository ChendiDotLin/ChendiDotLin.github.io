/* Assembly After Hours — original adaptive score and mechanical sound design.
   Synthesized locally; no recordings or external samples. Audio is opt-in. */
(function (root) {
  'use strict';
  const STEP = 60 / 96 / 4;
  const CHORDS = [[50,65,69], [46,62,65], [53,60,65], [48,64,67]];
  const THIRDS = [3, 4, 4, 4];
  // A 2:1 eighth-note swing for bass and ride only. Leads use straight timing.
  const SWING = STEP * 2 / 3;
  const LOOP_STEPS = 512;
  // [sixteenth, MIDI note, duration in steps, touch]. One composed keyboard
  // theme: repeated anchor, falling third, neighbor-note turn, chord-tone close.
  // Guitar answers after the completed sentence; the last bar can breathe.
  const phrase = (keys, guitar) => new Map([
    ...keys.map(([at, ...note]) => [at, ['keys', ...note]]),
    ...guitar.map(([at, ...note]) => [at, ['guitar', ...note]])
  ]);
  const PHRASES = [
    // Dm: A–A–G–F / E–F–D. The short neighbor turn leads home to D.
    phrase([[0,69,7.5,.86], [8,69,3.8,.73], [12,67,3.8,.76], [16,65,7.5,.82],
      [24,64,1.8,.65], [26,65,1.8,.72], [28,62,7.5,.8]],
      [[40,57,3.5,.64], [44,62,3.5,.7]]),
    // Bb: same rhythm and contour, landing on the third before a tonic reply.
    phrase([[0,65,7.5,.84], [8,65,3.8,.72], [12,64,3.8,.7], [16,62,7.5,.82],
      [24,60,3.8,.67], [28,62,7.5,.78]],
      [[40,60,3.5,.62], [44,58,3.5,.7]]),
    // F: the theme opens upward to its only high point, then returns to F.
    phrase([[0,72,7.5,.88], [8,72,3.8,.75], [12,70,3.8,.76], [16,69,7.5,.84],
      [24,67,3.8,.7], [28,65,7.5,.8]],
      [[40,64,3.5,.62], [44,65,3.5,.7]]),
    // C: a falling answer with a clear C cadence, not an unrelated new riff.
    phrase([[0,67,7.5,.84], [8,67,3.8,.72], [12,65,3.8,.73], [16,64,7.5,.8],
      [24,62,3.8,.68], [28,60,7.5,.78]],
      [[40,59,3.5,.6], [44,60,3.5,.68]]),
    // Second chorus keeps the hook. Small changes in note length and the final
    // answer develop it without replacing the melody every four bars.
    phrase([[0,69,3.8,.85], [4,69,3.8,.72], [8,67,7.5,.78], [16,65,7.5,.82],
      [24,64,3.8,.66], [28,62,7.5,.79]],
      [[40,64,3.5,.63], [44,65,3.5,.7]]),
    phrase([[0,65,7.5,.84], [8,65,3.8,.72], [12,64,3.8,.7], [16,62,7.5,.8],
      [24,65,3.8,.77], [28,62,7.5,.78]],
      [[40,60,3.5,.62], [44,58,3.5,.7]]),
    phrase([[0,72,7.5,.88], [8,72,3.8,.75], [12,70,3.8,.76], [16,69,7.5,.83],
      [24,67,1.8,.68], [26,69,1.8,.74], [28,65,7.5,.8]],
      [[40,67,3.5,.63], [44,65,3.5,.69]]),
    phrase([[0,67,3.8,.83], [4,67,3.8,.71], [8,65,7.5,.76], [16,64,7.5,.8],
      [24,62,3.8,.67], [28,60,7.5,.77]],
      [[40,59,3.5,.6], [44,60,3.5,.67]])
  ];
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
      this.leadWave = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0,1,.2,.035,.055,.009]));
      this.bassWave = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0,1,.42,.18,.065,.02]));
      this.guitarBuffers = new Map();
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
      if (options.bass) source.setPeriodicWave(this.bassWave);
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
    guitarBuffer(note) {
      if (this.guitarBuffers.has(note)) return this.guitarBuffers.get(note);
      const rate = this.context.sampleRate;
      const buffer = this.context.createBuffer(1, Math.ceil(rate * 1.4), rate);
      const samples = buffer.getChannelData(0), frequency = hz(note);
      // A plucked string: pluck position colors the partials; upper harmonics
      // decay faster. Recurrence avoids per-sample trig; cache each pitch.
      for (let partial = 1; partial <= 10 && frequency * partial < rate * .45; partial++) {
        const angle = 2 * Math.PI * frequency * partial / rate;
        const rotateSin = Math.sin(angle), rotateCos = Math.cos(angle);
        const decay = Math.exp(-1 / (rate * (.55 / (1 + .18 * (partial - 1)))));
        let sine = 0, cosine = 1, amplitude = Math.sin(Math.PI * .23 * partial) / partial ** 1.5;
        for (let i = 0; i < samples.length; i++) {
          samples[i] += sine * amplitude;
          const nextSin = sine * rotateCos + cosine * rotateSin;
          cosine = cosine * rotateCos - sine * rotateSin; sine = nextSin; amplitude *= decay;
        }
      }
      this.guitarBuffers.set(note, buffer);
      return buffer;
    }
    melody(instrument, note, time, duration, touch) {
      const length = duration * STEP;
      if (instrument === 'guitar') {
        const source = this.context.createBufferSource(); source.buffer = this.guitarBuffer(note);
        this.voice(source, time, length, .23 * touch,
          { attack: .004, hold: length * .65, cutoff: 3200 });
      } else {
        // A rounded electric-key attack with a very quiet, short tine overtone.
        this.tone(note, time, length, .15 * touch, 'sine',
          { theme: true, attack: .009, hold: length * .7, cutoff: 2100 });
        this.tone(note + 19, time, Math.min(.12, length), .009 * touch, 'sine', { attack: .003, cutoff: 3200 });
      }
    }
    renderStep(step, time, energy = this.scene) {
      const beat = step % 16, bar = Math.floor(step / 16) % 16;
      const chordIndex = Math.floor(bar / 4), chord = CHORDS[chordIndex];
      const phraseBar = bar % 4, rootNote = chord[0] - 12;
      const swungTime = time + (beat % 4 === 2 ? SWING : 0);
      if (beat === 0) {
        chord.slice(1).forEach(note => this.tone(note, time, STEP * 15, .04, 'sine', { attack: .18, cutoff: 1100 }));
      }
      // Sparse first two bars; a quarter-note walk under the cadence and reply.
      // The last note approaches the next chord from a semitone below.
      const bassBeats = phraseBar < 2 ? [0, 6, 12] : [0, 4, 8, 12];
      const bassNotes = phraseBar < 2 ? [rootNote, rootNote + 7, rootNote + (phraseBar ? THIRDS[chordIndex] : 12)]
        : phraseBar === 2 ? [rootNote, rootNote + THIRDS[chordIndex], rootNote + 7, rootNote + (chordIndex === 1 || chordIndex === 2 ? 11 : 10)]
        : [rootNote + 12, rootNote + 7, rootNote + THIRDS[chordIndex], CHORDS[(chordIndex + 1) % 4][0] - 13];
      const bassIndex = bassBeats.indexOf(beat);
      if (bassIndex !== -1) this.tone(bassNotes[bassIndex], swungTime, STEP * (phraseBar < 2 ? 3.2 : 2.8),
        beat === 0 ? .32 : .28, 'sine', { bass: true, attack: .012, hold: .07, cutoff: 1100 });

      // Quiet jazz ride: ding, ding-da, ding, ding-da. Brushes on 2 and 4.
      // Intensity changes touch, never the density of the arrangement.
      if (beat % 4 === 0 || beat === 6 || beat === 14) {
        const offbeat = beat % 4 === 2;
        this.noise(swungTime, offbeat ? .10 : .18, (offbeat ? .017 : .026) + energy * .006, 6400, { q: .8, attack: .008 });
      }
      if (beat === 0 || beat === 8) this.kick(time, .075 + energy * .025);
      if (beat === 4 || beat === 12) {
        this.noise(time, .16, .037 + energy * .012, 1800, { q: .5, attack: .018 });
        this.noise(time, .04, .021, 4200, { q: .6 });
      }
      const melody = PHRASES[Math.floor(step / 64) % PHRASES.length].get(step % 64);
      if (melody) {
        const [instrument, note, duration, touch] = melody;
        this.melody(instrument, note, time, duration, touch);
      }
    }
    schedule() {
      if (!this.playing || this.context.state !== 'running') return;
      if (this.next < this.context.currentTime) this.next = this.context.currentTime + .04;
      while (this.next < this.context.currentTime + .18) {
        this.renderStep(this.step, this.next, Math.max(this.scene, this.next < this.chainUntil ? .9 : 0));
        this.next += STEP; this.step = (this.step + 1) % LOOP_STEPS;
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
  WorkshopMusic.loopSteps = LOOP_STEPS;
  root.RainMusic = WorkshopMusic;
})(typeof window !== 'undefined' ? window : globalThis);
