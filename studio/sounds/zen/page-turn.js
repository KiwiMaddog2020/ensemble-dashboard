// Page turn: short noise sweep with a slight pitch envelope, 400 ms
export async function play(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    const envelope = Math.sin(Math.PI * t / 0.4);
    data[i] = (Math.random() * 2 - 1) * envelope * 0.5;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
  await new Promise(r => setTimeout(r, 400));
}
