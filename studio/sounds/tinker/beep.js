export async function play(ctx) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
  gain.gain.setValueAtTime(0.18, ctx.currentTime + 0.16);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.21);
  await new Promise(r => setTimeout(r, 210));
}
