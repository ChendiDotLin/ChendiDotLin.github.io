/* Workshop Nocturne — original note sequence and synthesis for Rain Match.
   No samples, streams, libraries or network requests. Playback is opt-in. */
(function (root) {
  'use strict';
  class WorkshopMusic {
    constructor() {
      this.context = null; this.master = null; this.timer = null;
      this.playing = false; this.volume = .35; this.step = 0; this.voices = new Set();
      this.generation = 0;
    }
    async play() {
      const generation = ++this.generation;
      this.playing = true;
      try {
        if (!this.context) {
          this.context = new (root.AudioContext || root.webkitAudioContext)();
          this.master = this.context.createGain();
          this.master.gain.value = this.volume * .32;
          this.master.connect(this.context.destination);
        }
        await this.context.resume();
        if (generation !== this.generation || !this.playing) return;
        clearInterval(this.timer);
        this.next = this.context.currentTime + .06;
        this.schedule();
        this.timer = setInterval(() => this.schedule(), 100);
      } catch (error) {
        if (generation === this.generation) this.stop();
        throw error;
      }
    }
    tone(note, time, length, strength, type = 'sine') {
      const oscillator = this.context.createOscillator(), envelope = this.context.createGain();
      oscillator.type = type; oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(strength, time + .025);
      envelope.gain.exponentialRampToValueAtTime(.0001, time + length);
      oscillator.connect(envelope); envelope.connect(this.master);
      this.voices.add(oscillator);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); this.voices.delete(oscillator); };
      oscillator.start(time); oscillator.stop(time + length + .02);
    }
    schedule() {
      if (!this.playing || this.context.state !== 'running') return;
      // Sixteen bars at 80 BPM, with alternating sparse melody and soft arpeggios.
      const chords = [[48,55,59,64],[45,52,55,62],[53,57,60,64],[50,57,60,65],
        [48,55,60,67],[47,54,57,62],[45,52,59,64],[43,50,57,62]];
      const melody = [76,0,79,0,74,76,0,71, 72,0,76,79,0,74,0,72,
        77,0,76,0,72,69,0,74, 74,0,77,76,0,72,0,69];
      if (this.next < this.context.currentTime) this.next = this.context.currentTime + .04;
      while (this.next < this.context.currentTime + .3) {
        const beat = this.step % 8, bar = Math.floor(this.step / 8) % 16;
        const chord = chords[Math.floor(bar / 2)];
        if (beat === 0) this.tone(chord[0] - 12, this.next, 2.6, .32);
        this.tone(chord[[0,2,1,3,2,1,3,1][beat]] + 12, this.next, .7, beat % 2 ? .10 : .17, 'triangle');
        const lead = melody[(bar % 4) * 8 + beat];
        if (lead && bar % 2 === 0) this.tone(lead, this.next, 1.15, .16);
        this.next += .375; this.step = (this.step + 1) % 128;
      }
    }
    setVolume(value) {
      this.volume = Math.max(0, Math.min(1, value));
      if (this.master) this.master.gain.setTargetAtTime(this.volume * .32, this.context.currentTime, .04);
    }
    stop() {
      this.playing = false; this.generation++; clearInterval(this.timer); this.timer = null;
      for (const voice of this.voices) { try { voice.stop(); } catch (_) { /* Already ended. */ } }
      this.voices.clear();
      // Keep the context for later clicks; there are no live sources while stopped.
    }
    async visibility(hidden) {
      if (!this.playing || !this.context) return;
      if (hidden) { clearInterval(this.timer); this.timer = null; await this.context.suspend(); }
      else await this.play();
    }
  }
  root.RainMusic = WorkshopMusic;
})(typeof window !== 'undefined' ? window : globalThis);
