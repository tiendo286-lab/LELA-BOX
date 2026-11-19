// Bảng box lúc 14:32 với dữ liệu mẫu:
// Box 2 ngồi 2g10 · Box 3 ngồi 2g52 (sắp hết) · Box 6 ngồi 3g20 (quá giờ) · Box 7 đặt 14:00 (trễ 32') · Box 4+5 đặt 16:30
export default async function (h) {
  await h.go('#/bang');
  const tile = (id) => h.$(`.tile[data-box="${id}"]`);
  h.check(h.$$('.tile').length === 12, 'có 12 ô box');
  h.check(h.has('Trống 9') && h.has('Đang ngồi 3') && h.has('Sắp đặt 3'), 'tóm tắt Trống 9 · Đang ngồi 3 · Sắp đặt 3');
  h.check(tile('b2').classList.contains('k-ngoi') && tile('b2').textContent.includes('2g10'), 'Box 2 xanh, 2g10');
  h.check(tile('b3').classList.contains('k-sap_het'), 'Box 3 vàng (sắp hết 3 giờ)');
  h.check(tile('b6').classList.contains('k-qua_gio') && tile('b6').textContent.includes('+1 giờ'), 'Box 6 đỏ, +1 giờ');
  h.check(tile('b4').textContent.includes('đặt 16:30'), 'Box 4 ghi đặt 16:30');
  h.check(h.has('Box 7: Khách mẫu 1 (0900 000 001) trễ 32 phút'), 'nhắc khách trễ');
  h.check(h.has('Box 3 hết 3 giờ lúc 14:40'), 'nhắc sắp hết 3 giờ');
  h.check((window.__lelaBeeps || 0) >= 1, 'có kêu chuông khi có nhắc mới');

  // Khách vãng lai vào box trống
  await h.click(tile('b1'));
  await h.fill('.sheet select[name="people"]', '2');
  await h.clickText('Khách vào ngay', '.sheet button');
  h.check(tile('b1').classList.contains('k-ngoi') && tile('b1').textContent.includes('0g00'), 'Box 1 có khách, 0g00');

  // Box có khách đặt 16:30: cảnh báo nhưng vẫn cho vào
  await h.click(tile('b4'));
  h.check(h.has('Box 4 có khách đặt 16:30 — chỉ ngồi được 1g58'), 'cảnh báo vướng lượt đặt');
  await h.clickText('Khách vào ngay', '.sheet button');
  h.check(tile('b4').classList.contains('k-ngoi'), 'vẫn cho khách vào Box 4');

  // Khách về ở box quá giờ
  await h.click(tile('b6'));
  await h.clickText('Khách về', '.sheet button');
  h.check(h.has('Ngồi 3g20 → tính thêm 1 giờ'), 'hiện giờ ngồi và giờ tính thêm');
  await h.clickText('Xác nhận khách về', '.sheet button');
  h.check(tile('b6').classList.contains('k-trong'), 'Box 6 trống lại');

  // Đã xem nhắc
  const before = h.$$('.nhac-item').length;
  await h.click('.nhac-item[data-key^="tre:"] [data-act="seen"]');
  h.check(!h.$('.nhac-item[data-key^="tre:"]') && h.$$('.nhac-item').length === before - 1, 'Đã xem ẩn nhắc');

  // Khách đặt trước đến
  await h.click(tile('b7'));
  await h.clickText('Khách vào', '.sheet button');
  h.check(tile('b7').classList.contains('k-ngoi'), 'khách đặt Box 7 đã vào');

  // Đổi box
  await h.click(tile('b7'));
  await h.clickText('Đổi box', '.sheet button');
  await h.click('.sheet [data-move="b8"]');
  h.check(tile('b8').classList.contains('k-ngoi') && tile('b7').classList.contains('k-trong'), 'đổi khách từ Box 7 sang Box 8');

  h.noOverflow(); h.strange();
}
