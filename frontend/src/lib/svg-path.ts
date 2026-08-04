/** Ported from path()/areaPath() in the approved design - turns a value series into an SVG path string. */
export function linePath(vals: number[], w: number, h: number, pad: number) {
  if (vals.length === 0) return "";
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  return vals
    .map((v, i) => {
      const x = (i / Math.max(vals.length - 1, 1)) * w;
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function areaPath(vals: number[], w: number, h: number, pad: number) {
  if (vals.length === 0) return "";
  return `${linePath(vals, w, h, pad)} L${w} ${h} L0 ${h} Z`;
}
