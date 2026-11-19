// Lịch + phiếu đặt trước (giờ giả lập 19/11 14:32; đặt cho ngày mai 20/11)
export default async function (h) {
  const shownVis = (txt) => h.$$('.vis').filter((e) => h.visible(e) && e.textContent.includes(txt)).length;
  await h.go('#/lich');
  h.check(h.$$('.day-chip').length === 7, 'có 7 ngày để chọn');
  await h.click('.day-chip[data-d="2026-11-20"]');
  await h.fill('#f-start', '900');
  await h.fill('#f-people', '5');
  h.check(h.has('Gợi ý 2 box'), 'gợi ý 2 box cho 5 người');
  h.check(h.$$('.pick').length === 12, 'mai 15:00 còn 12 box trống');
  await h.click('.pick[data-box="b1"]');
  await h.click('.pick[data-box="b2"]');
  await h.click('#btn-dat');
  const sheet = await h.waitFor('.sheet');
  h.check(sheet && h.$('.sheet input[name="box"][value="b1"]').checked && h.$('.sheet input[name="box"][value="b2"]').checked, 'phiếu chọn sẵn Box 1, Box 2');
  await h.fill('.sheet input[name="name"]', 'Khách thử');
  await h.fill('.sheet input[name="phone"]', '0911 222 333');
  h.check(!h.$('.sheet [data-act="save"]').disabled, 'đủ thông tin thì nút Lưu bật');
  await h.click('.sheet [data-act="save"]');
  h.check(!h.$('.sheet'), 'lưu xong đóng phiếu');
  h.check(shownVis('Khách thử') === 2, 'lịch mai có 2 lượt của Khách thử');

  // Giờ trùng
  await h.fill('#f-start', '960');
  h.check(!h.$('.pick[data-box="b1"]') && !h.$('.pick[data-box="b2"]'), '16:00 không còn Box 1, Box 2 trong danh sách trống');
  await h.click('#btn-moi');
  await h.fill('.sheet input[name="name"]', 'Khách khác');
  await h.fill('.sheet input[name="phone"]', '0933444555');
  await h.fill('.sheet select[name="date"]', '2026-11-20');
  await h.fill('.sheet select[name="start"]', '960');
  await h.fill('.sheet input[name="box"][value="b1"]', true);
  h.check(h.has('Box 1 trùng với Khách thử, 15:00–18:00'), 'báo trùng rõ ràng');
  h.check(h.$('.sheet [data-act="save"]').disabled, 'trùng thì nút Lưu tắt');
  await h.fill('.sheet input[name="box"][value="b1"]', false);
  await h.fill('.sheet input[name="box"][value="b3"]', true);
  await h.fill('.sheet input[name="phone"]', '');
  h.check(h.has('Số điện thoại chưa đúng'), 'thiếu SĐT bị báo');
  await h.click('.sheet [data-act="close"]');

  // Tìm phiếu theo SĐT rồi huỷ
  await h.fill('#q-phieu', '0911 222');
  const hit = await h.waitFor(() => h.$$('.hit').find((e) => e.textContent.includes('Khách thử')));
  h.check(!!hit, 'tìm theo SĐT ra phiếu Khách thử');
  if (hit) await h.click(hit);
  await h.clickText('Huỷ phiếu', '.sheet button');
  h.check(shownVis('Khách thử') === 0, 'huỷ phiếu → lịch không còn Khách thử');
  await h.fill('#f-start', '900');
  h.check(!!h.$('.pick[data-box="b1"]'), 'Box 1 trống lại lúc 15:00');

  // Từ Bảng box: Đặt trước box này
  await h.go('#/lich?box=b9');
  h.check(h.$('.pick[data-box="b9"]') && h.$('.pick[data-box="b9"]').classList.contains('on'), 'đến từ Bảng box thì Box 9 được chọn sẵn');

  h.noOverflow(); h.strange();
}
