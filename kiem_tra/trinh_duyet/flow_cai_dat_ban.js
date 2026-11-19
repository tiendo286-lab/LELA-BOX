// Cài đặt bán hàng: Chủ sửa menu, nhập file, voucher, khuyến mãi, giá ngồi thêm, In thử, PIN. Quản lý chỉ thấy "PIN của tôi".
export default async function (h) {
  const role = h.q.get('role');
  const lastPrint = () => (window.__lelaPrints || []).slice(-1)[0] || '';
  await h.go('#/cai-dat');

  if (role === 'ql') {
    h.check(!!h.$('#f-pin') && !h.$('.menu-row') && !h.$('#f-set'), 'Quản lý chỉ thấy mục PIN của tôi');
    await h.fill('#f-pin [name="pin"]', '5678'); await h.fill('#f-pin [name="pin2"]', '5678');
    await h.click('#f-pin [type="submit"]');
    h.check(h.has('Đã đổi PIN'), 'Quản lý đổi PIN được');
    h.noOverflow(); h.strange();
    return;
  }

  // Món mới
  await h.click('[data-act="add-item"]');
  const row = h.$$('.menu-row').slice(-1)[0];
  await h.fill(row.querySelector('[name="name"]'), 'Trà chanh (thử)');
  await h.fill(row.querySelector('[name="group"]'), 'Trà');
  await h.fill(row.querySelector('[name="price"]'), '30000');
  await h.click(row.querySelector('[data-act="save-item"]'));
  await h.sleep(200); await h.settle();
  h.check(h.$$('.menu-row [name="name"]').some((i) => i.value === 'Trà chanh (thử)'), 'thêm món Trà chanh (thử)');

  // Nhập file CSV (giả file xuất từ KiotViet)
  const f = new File(['Tên hàng,Nhóm hàng,Giá bán\nTra dao,Trà,38000\nBánh flan (thử),Snack,20000\n'], 'menu.csv', { type: 'text/csv' });
  const dt = new DataTransfer(); dt.items.add(f);
  const inp = h.$('#f-excel'); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true }));
  await h.waitFor(() => h.$$('#imp-preview tr').length >= 3);
  h.check(h.$$('#imp-preview tbody tr').length === 2, 'xem trước 2 món từ file');
  await h.click('[data-act="imp-ok"]');
  await h.sleep(200); await h.settle();
  h.check(h.has('Thêm 1, cập nhật 1'), 'nhập file: Thêm 1, cập nhật 1');
  h.check(h.$$('.menu-row [name="price"]').some((i) => i.value === '38000'), 'giá Trà đào cập nhật 38000');

  // Voucher
  await h.fill('#vc-code', 'TEST5'); await h.fill('#vc-kind', 'amt'); await h.fill('#vc-value', '5000');
  await h.click('[data-act="add-voucher"]');
  await h.sleep(200); await h.settle();
  h.check(h.$$('.voucher-row').some((r) => r.textContent.includes('TEST5')), 'tạo voucher TEST5');

  // Khuyến mãi
  await h.fill('#pr-name', 'Cuối tuần (thử)'); await h.fill('#pr-value', '10');
  await h.click('[data-act="add-promo"]');
  await h.sleep(200); await h.settle();
  h.check(h.$$('.promo-row').some((r) => r.textContent.includes('Cuối tuần (thử)')), 'tạo khuyến mãi');

  // Giá ngồi thêm
  await h.fill('#f-ban [name="extraPrice"]', '25000');
  await h.click('#f-ban [type="submit"]');
  await h.sleep(200); await h.settle();
  h.check(h.$('#f-ban [name="extraPrice"]').value === '25000', 'lưu giá ngồi thêm 25000');

  // In thử
  await h.click('[data-act="test-print"]');
  h.check(lastPrint().includes('Ngồi thêm') && lastPrint().includes('25.000đ'), 'In thử hoá đơn mẫu theo giá mới');

  // PIN của tôi
  await h.fill('#f-pin [name="pin"]', '4321'); await h.fill('#f-pin [name="pin2"]', '4320');
  await h.click('#f-pin [type="submit"]');
  h.check(h.has('Hai lần nhập PIN chưa giống nhau'), 'PIN nhập lại sai → báo');
  h.noOverflow(); h.strange();
}
