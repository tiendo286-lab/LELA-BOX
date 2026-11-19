// Tab Kho: nhập hàng, kiểm kê. Nhân viên đếm "mù" (không thấy số đáng lẽ còn / chênh lệch); Quản lý thấy chênh lệch.
export default async function (h) {
  const role = h.q.get('role');
  await h.go('#/kho');
  h.check(!!h.$('.recv-row[data-id="k_coca"]') && !!h.$('.count-row[data-id="k_coca"]'), 'có mục Nhập hàng và Kiểm kê');
  await h.fill('.recv-row[data-id="k_coca"] input', '24');
  await h.click('[data-act="recv-ok"]');
  h.check(h.has('Đã nhập hàng'), 'nhập 24 Coca');
  await h.fill('.count-row[data-id="k_coca"] input', '20');
  await h.click('[data-act="count-ok"]');
  h.check(h.has('Đã lưu kiểm kê'), 'lưu kiểm kê Coca = 20');

  if (role === 'nv') {
    const t = h.text().toLowerCase();
    h.check(!t.includes('đáng lẽ còn') && !t.includes('chênh lệch') && !h.$('.stock-row'), 'nhân viên không thấy số đáng lẽ còn / chênh lệch');
  } else {
    const hist = h.$('.count-hist');
    h.check(hist && hist.textContent.includes('Coca') && hist.textContent.includes('-4'), 'Quản lý thấy lần đếm: Coca chênh -4');
    h.check(hist && !!hist.querySelector('.neg'), 'chênh lệch tô đỏ');
    const row = h.$('.stock-row[data-id="k_coca"]');
    h.check(row && row.textContent.includes('20'), 'tồn Coca đáng lẽ còn 20 (theo lần đếm)');
    // thêm hàng kho
    await h.fill('#st-name', 'Đá viên (thử)'); await h.fill('#st-unit', 'bao');
    await h.click('[data-act="add-stock"]');
    h.check(!!h.$$('.count-row').find((r) => r.textContent.includes('Đá viên (thử)')), 'thêm hàng kho mới');
  }
  h.noOverflow(); h.strange();
}
