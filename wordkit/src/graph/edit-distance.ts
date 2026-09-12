// Build-time graph primitive: one-letter-change adjacency (for word-morph).
// Two words are adjacent iff they are the same length and differ at exactly one
// position. Uses a wildcard-bucket algorithm: O(sum of word lengths), not O(n^2).

export function buildEditDistanceGraph(words: readonly string[]): Map<string, string[]> {
  const buckets = new Map<string, string[]>();
  for (const w of words) {
    for (let i = 0; i < w.length; i++) {
      const pattern = `${w.length}:${i}:${w.slice(0, i)}*${w.slice(i + 1)}`;
      const list = buckets.get(pattern);
      if (list) list.push(w);
      else buckets.set(pattern, [w]);
    }
  }

  const adj = new Map<string, Set<string>>();
  for (const w of words) adj.set(w, new Set());
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        adj.get(list[i])!.add(list[j]);
        adj.get(list[j])!.add(list[i]);
      }
    }
  }

  const out = new Map<string, string[]>();
  for (const [w, set] of adj) out.set(w, [...set].sort());
  return out;
}
