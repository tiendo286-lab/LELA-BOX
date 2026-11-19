// Tab Khách (mọi vai) + Báo cáo (Chủ). Dữ liệu mẫu: mỗi ngày trước có 4 lượt đã về
// (1 đặt trước + 3 vãng lai; ngồi 150 / 200 / 250 / 185 phút → thêm 0 / 1 / 2 / 0 giờ), ngày thứ 3 và 6 trước có 1 lượt không đến.
export default async function (h) {
  const role = h.q.get('role');
  await h.go('#/khach');
  await h.fill('#q-khach', 'Khách mẫu 1');
  const card = await h.waitFor(() => h.$$('.kcard').find((e) => e.textContent.includes('Khách mẫu 1')));
  h.check(!!card && card.textContent.includes('0900 000 001'), 'tìm ra Khách mẫu 1 kèm SĐT');
  h.check(card && /\d+ lần đến/.test(card.textContent), 'thẻ khách có số lần đến');
  await h.fill('#q-khach', '0900 000 006');
  const c6 = await h.waitFor(() => h.$$('.kcard').find((e) => e.textContent.includes('Khách mẫu 6')));
  h.check(c6 && c6.textContent.includes('2 lần không đến'), 'Khách mẫu 6: 2 lần không đến');
  await h.click(c6.querySelector('.k-head'));
  h.check(h.$$('.kvis').length >= 1, 'mở thẻ thấy các lượt của khách');
  await h.clickText('Đặt cho khách này');
  h.check(h.$('.sheet input[name="name"]') && h.$('.sheet input[name="name"]').value === 'Khách mẫu 6' && h.$('.sheet input[name="phone"]').value === '0900000006', 'phiếu mới điền sẵn tên + SĐT');
  await h.click('.sheet [data-act="close"]');
  h.noOverflow('(Khách)'); h.strange();
  if (role !== 'chu') return;

  await h.go('#/bao-cao');
  await h.clickText('7 ngày');
  const rows = h.$$('.t-daily tbody tr');
  h.check(rows.length === 7, 'bảng lượt khách có 7 ngày');
  const r18 = rows.find((r) => r.textContent.includes('18/11'));
  const cells = r18 ? [...r18.children].map((td) => td.textContent.trim()) : [];
  h.note('dòng 18/11: ' + cells.join(' | '));
  h.check(cells[1] === '1' && cells[2] === '3' && cells[5] === '13,1', '18/11: 1 đặt trước, 3 vãng lai, 13,1 giờ ngồi');
  h.check(h.has('Tổng giờ thêm: 18 giờ'), 'tổng giờ thêm 7 ngày = 18 giờ');
  h.check(h.$$('.t-peak tbody tr').length === 7, 'bảng giờ cao điểm có 7 hàng (T2…CN)');
  h.check(h.$$('.t-extra tbody tr').length === 12, 'danh sách giờ thêm có 12 lượt');
  await h.clickText('Hôm nay');
  h.check(h.$$('.t-daily tbody tr').length === 1, 'chọn Hôm nay còn 1 dòng');
  h.noOverflow('(Báo cáo)'); h.strange();
}
