// Tape mechanism click: transient noise burst + low thump, 100 ms
export async function play(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.004));
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowshelf';
  filter.frequency.value = 200;
  filter.gain.value = 8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.22, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start();
  await new Promise(r => setTimeout(r, 100));
}
