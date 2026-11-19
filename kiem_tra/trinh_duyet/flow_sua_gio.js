// Sau duyệt cuối: nhắc việc ở mọi tab (I2); quên bấm "Khách về" tới hôm sau (C1); sửa giờ ra của lượt đã về.
export default async function (h) {
  const clock = await import('/js/clock.js');
  const time = await import('/js/time.js');
  const store = () => window.__lela.store;

  // I2: đang ở tab Lịch vẫn thấy nhắc, bấm nhắc thì mở đúng box
  await h.go('#/lich');
  h.check(h.$$('.nhac-item').length >= 1, 'tab Lịch vẫn có dải nhắc việc');
  await h.click('.nhac-item[data-key^="tre:"] [data-open]');
  h.check(location.hash.startsWith('#/bang') && h.$('.sheet h2') && h.$('.sheet h2').textContent.includes('Box 7'), 'bấm nhắc → sang Bảng box, mở Box 7');
  await h.click('.sheet [data-act="close"]');

  // C1: khách vào 14:32 ngày 19/11, quên bấm về, 09:00 sáng 20/11 mới bấm
  await h.click('.tile[data-box="b10"]');
  await h.fill('.sheet input[name="name"]', 'Quên Về');
  await h.fill('.sheet input[name="phone"]', '0977 000 111');
  await h.clickText('Khách vào ngay', '.sheet button');
  clock.set(time.atMs('2026-11-20', 540));
  await h.go('#/khach'); await h.go('#/bang');
  h.check(h.$$('.nhac-item').some((e) => e.textContent.includes('Box 10 chưa bấm Khách về')), 'nhắc "Box 10 chưa bấm Khách về"');
  await h.click('.tile[data-box="b10"]');
  await h.clickText('Thanh toán & khách về', '.sheet button');
  h.check(h.$('#pay-out') && h.$('#pay-out').value === '23:00', 'giờ ra mặc định = giờ đóng cửa ngày khách vào (23:00)');
  h.check(h.has('Ngồi thêm 6 giờ × 20.000đ (ngồi 8g28)') && h.has('120.000đ'), 'xem trước đúng: ngồi 8g28 → thêm 6 giờ = 120.000đ');
  await h.click('.sheet [data-act="all-cash"]');
  await h.click('.sheet [data-act="pay-ok"]');
  let v = (await store().visitsRange('2026-11-19', '2026-11-20')).find((x) => x.boxId === 'b10' && x.status === 've');
  h.check(v && v.minutes === 508 && v.extra === 6, 'lưu đúng 508 phút, thêm 6 giờ (không phải 18g28)');

  // Sửa giờ ra của lượt đã về (tab Khách)
  await h.go('#/khach');
  await h.fill('#q-khach', '0977 000');
  await h.click('.kcard .k-head');
  await h.click('.kcard [data-visit]');
  await h.fill('.sheet input[name="out"]', '22:00');
  h.check(h.has('Ngồi 7g28 → tính thêm 5 giờ'), 'sửa giờ ra 22:00 → xem trước 7g28, thêm 5 giờ');
  await h.fill('.sheet input[name="out"]', '14:00');
  h.check(h.has('Giờ ra phải sau giờ vào') && h.$('.sheet [data-act="save-times"]').disabled, 'giờ ra trước giờ vào → báo lỗi, tắt nút Lưu');
  await h.fill('.sheet input[name="out"]', '22:00');
  await h.click('.sheet [data-act="save-times"]');
  v = (await store().visitsRange('2026-11-19', '2026-11-20')).find((x) => x.id === v.id);
  h.check(v.minutes === 448 && v.extra === 5, 'đã lưu giờ ra mới: 448 phút, thêm 5 giờ');
  h.noOverflow(); h.strange();
}
