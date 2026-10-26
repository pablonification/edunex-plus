// The first run's sound (docs/design-system.md, Motion): calm and warm, on the moments that matter. Sines with a
// soft attack and a long tail, a quieter triangle an octave down for warmth, all through a lowpass that takes the
// edge off and a little room, in one key (D major's pentatonic), quiet enough to sit under a lecture hall's hum.
// No files: it is synthesised here. The welcome screen's speaker button turns it off. Where there is no Web Audio
// (tests), it is silent.

const NOTE = { D3: 146.83, A3: 220, D4: 293.66, E4: 329.63, Fs4: 369.99, A4: 440, B4: 493.88, D5: 587.33, E5: 659.25 } as const;
type Note = keyof typeof NOTE;

/** Noise for the room and the air: a small seeded generator (xorshift), the same every run, from −1 to 1. */
function noise(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 0x7fffffff - 1;
  };
}

let audio: AudioContext | null = null;
let bus: AudioNode | null = null;
let on = true;

export function soundOn(): boolean {
  return on;
}

export function setSound(value: boolean): void {
  on = value;
}

/** The context and its master chain (a lowpass, then a dry path and a short room), made on first use. */
function output(): { context: AudioContext; bus: AudioNode } | null {
  if (!on || typeof AudioContext === "undefined") return null;
  if (!audio || !bus) {
    audio = new AudioContext();
    const soften = audio.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = 1500;
    soften.Q.value = 0.4;
    const dry = audio.createGain();
    const wet = audio.createGain();
    const room = audio.createConvolver();
    dry.gain.value = 0.8;
    wet.gain.value = 0.35;
    const length = Math.round(audio.sampleRate * 2.4);
    const impulse = audio.createBuffer(2, length, audio.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      const next = noise(0x9e3779b9 + channel);
      for (let i = 0; i < length; i++) data[i] = next() * (1 - i / length) ** 3.2;
    }
    room.buffer = impulse;
    soften.connect(dry).connect(audio.destination);
    soften.connect(room).connect(wet).connect(audio.destination);
    bus = soften;
  }
  if (audio.state === "suspended") void audio.resume().catch(() => undefined);
  return { context: audio, bus };
}

/** One soft tone. */
function tone(frequency: number, { at = 0, gain = 0.03, attack = 0.04, release = 2.2 } = {}) {
  const out = output();
  if (!out) return;
  const t = out.context.currentTime + at;
  const envelope = out.context.createGain();
  envelope.gain.setValueAtTime(0, t);
  envelope.gain.linearRampToValueAtTime(gain, t + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  envelope.connect(out.bus);
  for (const [type, f, level] of [
    ["sine", frequency, 1],
    ["triangle", frequency / 2, 0.25],
  ] as const) {
    const oscillator = out.context.createOscillator();
    const amount = out.context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = f;
    amount.gain.value = level;
    oscillator.connect(amount).connect(envelope);
    oscillator.start(t);
    oscillator.stop(t + attack + release + 0.1);
  }
}

/** Notes one after another, like a soft strum. */
function chord(notes: Note[], { gain = 0.03, attack = 0.04, release = 2.2, spread = 0.07 } = {}) {
  notes.forEach((note, i) => {
    tone(NOTE[note], { at: i * spread, gain, attack, release });
  });
}

/** A chord that fades in rather than being struck. */
const swell = (notes: Note[], gain = 0.02) => chord(notes, { gain, attack: 0.9, release: 2.8, spread: 0.12 });

/** A breath of air between scenes: soft noise, low and filtered, rising a little and falling away. */
function air(gain = 0.018) {
  const out = output();
  if (!out) return;
  const { context } = out;
  const t = context.currentTime;
  const length = Math.round(context.sampleRate * 1.2);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  const next = noise(0x85ebca6b);
  for (let i = 0; i < length; i++) data[i] = next();
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const level = context.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.Q.value = 0.3;
  filter.frequency.setValueAtTime(250, t);
  filter.frequency.linearRampToValueAtTime(800, t + 0.5);
  filter.frequency.linearRampToValueAtTime(300, t + 1.2);
  level.gain.setValueAtTime(0, t);
  level.gain.linearRampToValueAtTime(gain, t + 0.45);
  level.gain.linearRampToValueAtTime(0, t + 1.2);
  source.connect(filter).connect(level).connect(out.bus);
  source.start(t);
}

/** Each part of the first read that comes in: a quiet note, a step higher than the last. */
const READ_NOTES: Note[] = ["D4", "E4", "Fs4", "A4", "B4", "D5"];

export const sound = {
  /** The light blooms. */
  open: () => swell(["D3", "A3", "D4"], 0.022),
  /** "from" turns to "for". */
  turn: () => tone(NOTE.A3, { gain: 0.014, attack: 0.25, release: 2 }),
  /** A press: a short, low, round tap. */
  tap() {
    const out = output();
    if (!out) return;
    const t = out.context.currentTime;
    const oscillator = out.context.createOscillator();
    const level = out.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(260, t);
    oscillator.frequency.exponentialRampToValueAtTime(170, t + 0.12);
    level.gain.setValueAtTime(0, t);
    level.gain.linearRampToValueAtTime(0.05, t + 0.006);
    level.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    oscillator.connect(level).connect(out.bus);
    oscillator.start(t);
    oscillator.stop(t + 0.2);
  },
  /** Between steps. */
  move: () => air(),
  /** A system connected. */
  connected: (source: "edunex" | "six") => chord(source === "edunex" ? ["D4", "A4"] : ["Fs4", "D5"], { gain: source === "edunex" ? 0.03 : 0.028 }),
  /** Both connected. */
  both: () => swell(["D4", "Fs4", "A4"], 0.02),
  /** The `n`th part of the read came in. */
  read: (n: number) => tone(NOTE[READ_NOTES[Math.min(n, READ_NOTES.length - 1)]], { gain: 0.012, attack: 0.03, release: 1.4 }),
  /** Home is ready. */
  ready: () => chord(["D4", "Fs4", "A4", "D5"], { gain: 0.026, attack: 0.08, release: 3, spread: 0.09 }),
  /** Into the app. */
  arrive() {
    air(0.024);
    swell(["A3", "D4", "E5"], 0.016);
  },
};
