let ctx;

// A short beep plus vibration, so a new order or ride offer is noticed. Browsers only allow sound after the user has
// tapped something on the page, which the "Go online" button and normal admin clicks provide.
export function beep() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch { /* sound is a bonus, never an error */ }
  navigator.vibrate?.([250, 120, 250]);
}
