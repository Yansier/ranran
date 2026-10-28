export function createAmbientAudio() {
  let context;
  let master;
  let enabled = false;

  function start() {
    context = context || new AudioContext();
    if (context.state === 'suspended') context.resume();
    if (master) return;
    master = context.createGain();
    master.gain.value = 0.035;
    master.connect(context.destination);

    const bufferSize = context.sampleRate * 2;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.35;
    const breeze = context.createGain();
    breeze.gain.value = 0.18;
    noise.connect(filter).connect(breeze).connect(master);
    noise.start();

    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 196;
    const toneGain = context.createGain();
    toneGain.gain.value = 0.03;
    osc.connect(toneGain).connect(master);
    osc.start();
  }

  function toggle() {
    enabled = !enabled;
    if (enabled) start();
    if (master) master.gain.setTargetAtTime(enabled ? 0.035 : 0, context.currentTime, 0.3);
    return enabled;
  }
  return { toggle };
}
