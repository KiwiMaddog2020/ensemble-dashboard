// Gentle wind: pink-ish noise through narrow bandpass, slow fade, 1200 ms
export async function play(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    data[i] = (b0 + b1 + b2) * 0.11;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 800;
  filter.Q.value = 0.5;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.25, ctx.currentTime + 0.9);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
  await new Promise(r => setTimeout(r, 1200));
}
