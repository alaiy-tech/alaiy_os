/** Ported from mulberry()/series() in the approved design - a small seeded PRNG for deterministic demo sparklines/charts. */
function mulberry32(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function series(seed: number, n: number, base: number, drift: number, noise: number) {
  const r = mulberry32(seed);
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v = v * (1 + drift) + (r() - 0.5) * noise;
    out.push(Math.max(v, base * 0.35));
  }
  return out;
}
