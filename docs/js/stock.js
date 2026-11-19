// Quy tắc kho (thuần): số đáng lẽ còn, trừ kho khi bán.

// Mốc = lần đếm mới nhất có hàng này; rồi cộng nhập / hoàn, trừ bán xảy ra sau mốc.
export function expectedQty(stockItemId, moves, counts) {
  let base = 0, since = -Infinity;
  for (const c of counts || []) {
    const it = (c.items || []).find((x) => x.stockItemId === stockItemId);
    if (it && c.at > since) { since = c.at; base = Number(it.counted) || 0; }
  }
  return (moves || []).reduce((n, m) => {
    if (m.stockItemId !== stockItemId || !(m.at > since)) return n;
    if (m.kind === 'nhap' || m.kind === 'hoan') return n + m.qty;
    if (m.kind === 'ban') return n - m.qty;
    return n;
  }, base);
}

// Dòng phiếu → số cần trừ cho từng hàng kho (chỉ hàng bán nguyên có gắn món)
export function deductions(lines, stockItems) {
  const byMenu = new Map((stockItems || []).filter((s) => s.menuItemId).map((s) => [s.menuItemId, s.id]));
  const out = new Map();
  const add = (menuItemId, qty) => { const k = byMenu.get(menuItemId); if (k && qty > 0) out.set(k, (out.get(k) || 0) + qty); };
  for (const l of lines || []) {
    if (l.voided) continue;
    const q = Number(l.qty) || 0;
    if (l.kind === 'combo') (l.picks || []).forEach((p) => add(p.menuItemId, q));
    else add(l.menuItemId, q);
  }
  return [...out].map(([stockItemId, qty]) => ({ stockItemId, qty }));
}
