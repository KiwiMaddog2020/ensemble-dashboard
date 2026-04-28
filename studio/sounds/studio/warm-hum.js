// Warm amp hum: 60 Hz sine + 2nd + 3rd harmonics, soft onset/offset, 1000 ms
export async function play(ctx) {
  const freqs = [60, 120, 180];
  const amps  = [0.12, 0.05, 0.02];
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.08);
  master.gain.setValueAtTime(1, ctx.currentTime + 0.88);
  master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
  master.connect(ctx.destination);
  const oscs = freqs.map((f, i) => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.value = amps[i];
    osc.connect(g).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + 1.05);
    return osc;
  });
  await new Promise(r => setTimeout(r, 1000));
}
