/* Assembly After Hours — original adaptive score and mechanical sound design.
   Original score; locally hosted piano samples and synthesized accompaniment. Audio is opt-in. */
(function (root) {
  'use strict';
  const STEP = 60 / 96 / 4;
  const CHORDS = [[53,65,69], [50,65,69], [46,62,65], [48,64,67]];
  const THIRDS = [4, 3, 4, 4];
  // A 2:1 eighth-note swing for bass and ride only. Leads use straight timing.
  const SWING = STEP * 2 / 3;
  const LOOP_STEPS = 512;
  const PIANO_SAMPLES = [[66, 'Fs4.mp3'], [69, 'A4.mp3'], [72, 'C5.mp3'], [75, 'Ds5.mp3'], [78, 'Fs5.mp3']];
  const PIANO_BASE = root.document ? new URL('assets/audio/piano/', root.document.currentScript?.src || root.document.baseURI).href : null;
  // [sixteenth, MIDI note, duration in steps, touch]. A rising F-major hook,
  // mostly on quarter-note beats, ending in space for the rhythm section.
  const phrase = keys => new Map(keys.map(([at, ...note]) => [at, ['keys', ...note]]));
  const PHRASES = [
    // F: F–G–A opens upward; C answers and the phrase rests on the major third.
    phrase([[0,65,3.8,.8], [4,67,3.8,.75], [8,69,7.5,.87], [16,72,3.8,.88],
      [20,69,3.8,.76], [24,67,3.8,.72], [28,69,7.5,.82]]),
    // Dm is a passing color: keep the opening hook and reach up to D5.
    phrase([[0,65,3.8,.79], [4,67,3.8,.74], [8,69,7.5,.85], [16,74,7.5,.87],
      [24,72,3.8,.75], [28,69,7.5,.8]]),
    // Bb: the same ascending gesture, a high D rather than a low tonic ending.
    phrase([[0,65,3.8,.79], [4,67,3.8,.75], [8,70,7.5,.86], [16,74,3.8,.88],
      [20,72,3.8,.76], [24,70,3.8,.73], [28,74,7.5,.82]]),
    // C: a higher-register turnaround opens space for the next F-major phrase.
    phrase([[0,67,3.8,.79], [4,69,3.8,.74], [8,72,7.5,.85], [16,71,3.8,.77],
      [20,67,3.8,.73], [24,69,3.8,.75], [28,67,7.5,.8]]),
    // Second chorus: keep the recognizable opening; brighten the answers.
    phrase([[0,65,3.8,.8], [4,67,3.8,.75], [8,69,7.5,.87], [16,72,3.8,.86],
      [20,74,3.8,.89], [24,72,3.8,.76], [28,69,7.5,.82]]),
    phrase([[0,65,3.8,.79], [4,67,3.8,.74], [8,69,7.5,.85], [16,74,7.5,.88],
      [24,72,1.8,.73], [26,69,1.8,.7], [28,65,7.5,.79]]),
    phrase([[0,65,3.8,.79], [4,67,3.8,.75], [8,70,7.5,.86], [16,74,3.8,.86],
      [20,77,3.8,.9], [24,74,3.8,.76], [28,70,7.5,.81]]),
    phrase([[0,67,3.8,.79], [4,69,3.8,.74], [8,72,7.5,.85], [16,71,3.8,.77],
      [20,69,3.8,.75], [24,67,1.8,.7], [26,64,1.8,.67], [28,67,7.5,.8]])
  ];
  const hz = note => 440 * 2 ** ((note - 69) / 12);
  class WorkshopMusic {
    constructor(context = null) {
      this.context = context; this.master = null; this.timer = null;
      this.playing = false; this.volume = .35; this.effectsVolume = .65; this.step = 0;
      this.voices = new Set(); this.effectVoices = new Set(); this.generation = 0;
      this.scene = .25; this.chainUntil = 0; this.effectsEnabled = false;
      this.pianoBuffers = new Map(); this.pianoLoad = null;
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
      this.keysWave = ctx.createPeriodicWave(new Float32Array(5), new Float32Array([0,1,.18,.035,.012]));
      this.bassWave = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0,1,.42,.18,.065,.02]));
      // A small, dark room belongs only to the electric piano, not to the mix.
      this.keysBus = ctx.createGain();
      this.keysLowCut = ctx.createBiquadFilter(); this.keysLowCut.type = 'highpass';
      this.keysLowCut.frequency.value = 90; this.keysLowCut.Q.value = .5;
      this.keysBus.connect(this.keysLowCut); this.keysLowCut.connect(this.master);
      this.keysRoom = ctx.createConvolver(); this.keysRoom.normalize = false;
      this.keysRoom.buffer = this.keysRoomImpulse();
      this.keysWet = ctx.createGain(); this.keysWet.gain.value = .04;
      this.keysLowCut.connect(this.keysRoom); this.keysRoom.connect(this.keysWet); this.keysWet.connect(this.master);
      this.guitarBuffers = new Map();
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0); let seed = 719;
      for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; data[i] = (seed >>> 0) / 2147483648 - 1; }
    }
    async preparePiano() {
      this.ensure();
      if (this.pianoBuffers.size === PIANO_SAMPLES.length) return true;
      if (!PIANO_BASE || !root.fetch) return false;
      if (this.pianoLoad) return this.pianoLoad;
      this.pianoLoad = (async () => {
        const controller = new AbortController(); let timer;
        try {
          const loading = Promise.all(PIANO_SAMPLES.map(async ([note, file]) => {
            const response = await root.fetch(PIANO_BASE + file, { signal: controller.signal });
            if (!response.ok) throw new Error('Piano sample unavailable');
            const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
            let peak = 0, onset = buffer.length;
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
              const samples = buffer.getChannelData(channel);
              for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
            }
            if (peak < .001) throw new Error('Piano sample is silent');
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
              const samples = buffer.getChannelData(channel);
              const first = samples.findIndex(sample => Math.abs(sample) > peak * .01);
              if (first >= 0) onset = Math.min(onset, first);
            }
            return [note, { buffer, gain: .8 / peak, offset: Math.max(0, onset / buffer.sampleRate - .003) }];
          }));
          const timeout = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Piano loading timed out')); }, 5000); });
          // Publish the bank atomically: late/partial downloads never change
          // timbre mid-phrase. Failed loading uses the existing FM instrument.
          const samples = await Promise.race([loading, timeout]);
          this.pianoBuffers = new Map(samples); return true;
        } catch (_) { controller.abort(); return false; }
        finally { clearTimeout(timer); this.pianoLoad = null; }
      })();
      return this.pianoLoad;
    }
    keysRoomImpulse() {
      const ctx = this.context, rate = ctx.sampleRate;
      const buffer = ctx.createBuffer(2, Math.ceil(rate * .24), rate);
      for (let channel = 0; channel < 2; channel++) {
        const samples = buffer.getChannelData(channel); let seed = 319 + channel * 701, low = 0;
        // Deterministic, low-passed reflections; no rhythmic delay or long wash.
        const smoothing = 1 - Math.exp(-2 * Math.PI * 2200 / rate);
        const level = Math.sqrt(44100 / rate) * .085;
        for (let i = Math.floor(rate * .009); i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
          low += smoothing * ((seed >>> 0) / 2147483648 - 1 - low);
          samples[i] = low * level * Math.exp(-i / (rate * .041));
        }
      }
      return buffer;
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
      if (options.sampledKeys) {
        // The recording supplies the hammer and string decay. Only damp the
        // sample at note-off, so held notes retain their natural resonance.
        envelope.gain.setValueAtTime(strength, time + length);
      } else if (options.keys) {
        // A struck tine settles into its body, then damps at note-off. Long
        // notes keep their body instead of becoming either a beep or a click.
        envelope.gain.exponentialRampToValueAtTime(strength * .8, time + Math.min(.16, length * .3));
        envelope.gain.exponentialRampToValueAtTime(strength * .67, time + length * .78);
      } else if (options.hold) envelope.gain.linearRampToValueAtTime(Math.max(.0002, strength * .85), time + Math.min(length * .7, options.hold));
      const end = time + length + (options.sampledKeys ? .12 : 0);
      envelope.gain.exponentialRampToValueAtTime(.0001, end);
      source.connect(filter); filter.connect(envelope); envelope.connect(options.keys ? this.keysBus : options.effect ? this.effectBus : this.master);
      set.add(source);
      source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); set.delete(source); };
      if (options.offset !== undefined) source.start(time, options.offset); else source.start(time);
      source.stop(end + .025);
    }
    tone(note, time, length, strength, type = 'triangle', options = {}) {
      const source = this.context.createOscillator(); source.type = type;
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
    electricPiano(note, time, length, touch) {
      // Two-operator FM: touch changes tine brightness, which decays faster
      // than the body. Both oscillators are owned by the music lifecycle.
      const ctx = this.context;
      if (!ctx.startRendering && this.voices.size > 125) return;
      const frequency = hz(note), velocity = Math.max(.1, Math.min(1, touch));
      const carrier = ctx.createOscillator(), tine = ctx.createOscillator(), depth = ctx.createGain();
      carrier.setPeriodicWave(this.keysWave); carrier.frequency.setValueAtTime(frequency, time);
      tine.type = 'sine'; tine.frequency.setValueAtTime(frequency, time);
      depth.gain.setValueAtTime(frequency * (.7 + velocity * velocity * .65), time);
      depth.gain.exponentialRampToValueAtTime(frequency * .24, time + Math.min(.23, length * .4));
      depth.gain.exponentialRampToValueAtTime(frequency * .09, time + length);
      tine.connect(depth); depth.connect(carrier.frequency);
      this.voices.add(tine);
      tine.onended = () => { tine.disconnect(); depth.disconnect(); this.voices.delete(tine); };
      tine.start(time); tine.stop(time + length + .025);
      this.voice(carrier, time, length, .17 * velocity,
        { keys: true, attack: .004, cutoff: 2400 + velocity * 900 });
    }
    sampledPiano(note, time, length, touch) {
      const nearest = PIANO_SAMPLES.reduce((best, sample) => Math.abs(sample[0] - note) < Math.abs(best[0] - note) ? sample : best)[0];
      const sample = this.pianoBuffers.get(nearest);
      if (!sample) { this.electricPiano(note, time, length, touch); return; }
      const source = this.context.createBufferSource(); source.buffer = sample.buffer;
      source.playbackRate.setValueAtTime(2 ** ((note - nearest) / 12), time);
      this.voice(source, time, length, .3 * touch * sample.gain,
        { keys: true, sampledKeys: true, offset: sample.offset, attack: .002, cutoff: 3800 + touch * 1800 });
    }
    melody(instrument, note, time, duration, touch) {
      const length = duration * STEP;
      if (instrument === 'guitar') {
        const source = this.context.createBufferSource(); source.buffer = this.guitarBuffer(note);
        this.voice(source, time, length, .23 * touch,
          { attack: .004, hold: length * .65, cutoff: 3200 });
      } else {
        this.sampledPiano(note, time, length, touch);
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
        : phraseBar === 2 ? [rootNote, rootNote + THIRDS[chordIndex], rootNote + 7, rootNote + (chordIndex === 0 || chordIndex === 2 ? 11 : 10)]
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
        if (generation !== this.generation || !this.playing) return false;
        await this.preparePiano();
        if (generation !== this.generation || !this.playing) return false;
        if (this.context.state !== 'running' || root.document?.hidden) return false;
        this.master.gain.setTargetAtTime(this.volume * .7, this.context.currentTime, .03);
        clearInterval(this.timer); this.next = this.context.currentTime + .04;
        this.schedule(); this.timer = setInterval(() => this.schedule(), 50);
        return true;
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
