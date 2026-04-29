export async function play(ctx) {
  const duration = 1.5;
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, sr * duration, sr);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.004;
  }
  const popCount = Math.floor(duration * 12);
  for (let p = 0; p < popCount; p++) {
    const onset = Math.floor(Math.random() * (data.length - 80));
    const amp = 0.04 + Math.random() * 0.06;
    for (let j = 0; j < 80; j++) {
      data[onset + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / 12);
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
  src.connect(gain).connect(ctx.destination);
  src.start();
  await new Promise(r => setTimeout(r, duration * 1000));
}
