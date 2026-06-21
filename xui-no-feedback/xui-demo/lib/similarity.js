export function isNearDuplicate(a, b) {
  if (!a || !b) return false;
  const aTrim = String(a).trim();
  const bTrim = String(b).trim();
  if (!aTrim || !bTrim) return false;
  if (aTrim === bTrim) return true;
  const wa = new Set(aTrim.toLowerCase().split(/\s+/));
  const wb = new Set(bTrim.toLowerCase().split(/\s+/));
  if (!wa.size || !wb.size) return false;
  const inter = [...wa].filter((w) => wb.has(w)).length;
  const overlapA = inter / wa.size;
  const overlapB = inter / wb.size;
  return Math.max(overlapA, overlapB) >= 0.7;
}


