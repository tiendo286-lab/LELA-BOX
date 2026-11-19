// Bán hàng ở Bảng box (14:32 Thứ 5 — đang có khuyến mãi "Giờ vàng −20% Trà").
// Box 2: 3 người ngồi 2g10 (chưa gọi gì) · Box 3: 2 người ngồi 2g52.
export default async function (h) {
  const lastPrint = () => (window.__lelaPrints || []).slice(-1)[0] || '';
  const tile = (id) => h.$(`.tile[data-box="${id}"]`);
  const role = h.q.get('role');
  await h.go('#/bang');

  if (role === 'ql') {
    await h.click(tile('b3'));
    await h.clickText('Gọi món', '.sheet button');
    await h.click('.sheet .menu-btn[data-item="m_trdao"]');
    await h.click('.sheet [data-act="pay"]');
    await h.click('.sheet [data-act="manual"]');
    h.check(!h.$('.sheet input[name="pin"]') && !!h.$('.sheet input[name="reason"]'), 'Quản lý giảm tay: không hỏi PIN, chỉ hỏi lý do');
    await h.fill('.sheet input[name="reason"]', 'khách quen');
    await h.click('.sheet [data-act="pin-ok"]');
    await h.fill('.sheet [name="m-value"]', '5000');
    await h.click('.sheet [data-act="manual-ok"]');
    h.check(h.has('Giảm tay') && h.has('-5.000đ'), 'đã giảm tay 5.000đ');
    h.noOverflow(); h.strange();
    return;
  }

  h.check(h.has('Box 2 vào 130 phút chưa gọi món'), 'nhắc Box 2 chưa gọi món');
  await h.click(tile('b2'));
  await h.clickText('Gọi món', '.sheet button');
  h.check(h.$$('.sheet .menu-btn').length >= 8, 'có lưới món');
  await h.click('.sheet .menu-btn[data-item="m_trdao"]');
  await h.click('.sheet .menu-btn[data-item="m_trdao"]');
  await h.click('.sheet .menu-btn[data-item="m_coca"]');
  h.check(h.$('#o-total') && h.$('#o-total').textContent.includes('90.000đ'), 'tạm tính 90.000đ');

  await h.click('.sheet [data-act="send"]');
  h.check(lastPrint().includes('Trà đào') && !lastPrint().includes('GỌI THÊM'), 'in phiếu pha chế lần đầu');
  h.check(h.$$('.sheet .oline.sent').length === 2, '2 dòng đã gửi');
  await h.fill('#q-mon', 'huong duong');
  h.$('#q-mon').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await h.settle();
  await h.click('.sheet [data-act="send"]');
  h.check(lastPrint().includes('GỌI THÊM') && lastPrint().includes('Hướng dương'), 'gõ tìm + Enter thêm món, in GỌI THÊM');

  // Huỷ món đã gửi → nhân viên phải có PIN quản lý
  await h.click('.sheet .oline.sent [data-act="del-line"]');
  h.check(!!h.$('.sheet input[name="pin"]'), 'huỷ món đã gửi: hỏi PIN quản lý');
  await h.click('.sheet [data-act="pin-cancel"]');
  h.check(h.$$('.sheet .oline').length === 3, 'bấm Huỷ → món còn nguyên');

  // Combo: chọn món cho từng ô
  await h.click('.sheet .menu-btn[data-item="m_combo3"]');
  h.check(h.$('.sheet [data-act="combo-ok"]').disabled, 'combo chưa chọn đủ → chưa cho thêm');
  for (const id of ['m_trvai', 'm_trvai', 'm_bx', 'm_hd']) await h.click(`.sheet .pick-item[data-item="${id}"]`);
  await h.click('.sheet [data-act="combo-ok"]');
  h.check(h.$$('.sheet .oline').length === 4, 'đã thêm combo');
  const combo = h.$$('.sheet .oline').find((x) => x.textContent.includes('Combo'));
  if (combo) await h.click(combo.querySelector('[data-act="del-line"]'));
  h.check(h.$$('.sheet .oline').length === 3, 'xoá combo chưa gửi không cần PIN');

  await h.click('.sheet [data-act="close"]');
  h.check(tile('b2').textContent.includes('115.000đ'), 'ô Box 2 hiện tạm tính 115.000đ');

  // Thanh toán từ khung box
  await h.click(tile('b2'));
  await h.clickText('Thanh toán & khách về', '.sheet button');
  h.check(h.has('Giờ vàng') && h.has('-14.000đ') && h.has('101.000đ'), 'áp khuyến mãi Giờ vàng, tổng 101.000đ');
  await h.fill('#pay-transfer', '50000');
  await h.fill('#pay-given', '100000');
  h.check(h.$('#pay-change') && h.$('#pay-change').textContent.includes('49.000đ'), 'tiền thối 49.000đ');
  await h.click('.sheet [data-act="pay-ok"]');
  h.check(lastPrint().includes('TỔNG') && lastPrint().includes('101.000đ'), 'in hoá đơn');
  h.check(tile('b2').classList.contains('k-trong'), 'Box 2 trống lại sau khi thu');
  h.noOverflow(); h.strange();
}
