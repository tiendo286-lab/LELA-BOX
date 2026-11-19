// Khung web: tab theo vai trò, chặn Nhân viên vào Cài đặt, Chủ lưu cài đặt box (còn sau khi nạp lại)
export default async function (h) {
  const role = h.q.get('role');
  await h.go('#/bang');
  h.check(h.has('Lela Box'), 'có tên Lela Box');
  const tabs = h.$$('nav.tabs a').map((a) => a.textContent.trim());
  h.note('tab: ' + tabs.join(' | '));
  h.check(tabs.includes('Bảng box') && tabs.includes('Lịch') && tabs.includes('Khách'), 'có tab Bảng box, Lịch, Khách');
  if (role === 'nv') {
    h.check(!tabs.includes('Cài đặt') && !tabs.includes('Báo cáo'), 'Nhân viên không thấy Cài đặt / Báo cáo');
    await h.go('#/cai-dat');
    h.check(location.hash === '#/bang', 'Nhân viên vào #/cai-dat bị đưa về #/bang');
  } else {
    h.check(tabs.includes('Cài đặt') && tabs.includes('Báo cáo'), 'Chủ thấy Cài đặt / Báo cáo');
    await h.go('#/cai-dat');
    h.check(h.has('Giờ mở cửa'), 'trang Cài đặt có Giờ mở cửa');
    await h.fill('.box-row[data-id="b12"] input[name="active"]', false);
    await h.click('.box-row[data-id="b12"] [data-act="save-box"]');
    h.check(h.has('Đã lưu'), 'báo Đã lưu');
    await window.__lela.restart();
    await h.go('#/cai-dat');
    const cb = await h.waitFor('.box-row[data-id="b12"] input[name="active"]');
    h.check(cb && cb.checked === false, 'Box 12 vẫn tạm ngừng sau khi nạp lại');
  }
  h.noOverflow(); h.strange();
}
