export async function play(ctx) {
  const fundamental = ctx.createOscillator();
  const harmonic = ctx.createOscillator();
  const gainA = ctx.createGain();
  const gainB = ctx.createGain();
  const master = ctx.createGain();
  fundamental.type = 'sine';
  fundamental.frequency.value = 432;
  harmonic.type = 'sine';
  harmonic.frequency.value = 864;
  gainA.gain.setValueAtTime(0.18, ctx.currentTime);
  gainA.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
  gainB.gain.setValueAtTime(0.06, ctx.currentTime);
  gainB.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
  master.gain.value = 0.8;
  fundamental.connect(gainA).connect(master);
  harmonic.connect(gainB).connect(master);
  master.connect(ctx.destination);
  fundamental.start();
  harmonic.start();
  fundamental.stop(ctx.currentTime + 1.1);
  harmonic.stop(ctx.currentTime + 1.1);
  await new Promise(r => setTimeout(r, 1000));
}
