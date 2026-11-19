// Cài đặt (chỉ Chủ): giờ mở cửa + quy định, danh sách box, nhân viên
import { html, str, $, on, toast, showError } from '../ui.js';
import { mountSales, pinSection, bindPin } from './cai_dat_ban.js';

const HOURS = [60, 90, 120, 150, 180, 210, 240, 300, 360];
const hLabel = (m) => (m % 60 ? `${Math.floor(m / 60)} giờ ${m % 60}` : `${m / 60} giờ`);

export default async function render(root, ctx) {
  const { store } = ctx;
  // Quản lý: chỉ đổi PIN của mình
  if (ctx.me.role !== 'chu') {
    root.innerHTML = str(html`<h1>Cài đặt</h1>${pinSection()}`);
    bindPin(root, ctx);
    return;
  }
  const s = await store.getSettings();
  const boxes = await store.listBoxes({ all: true });
  const staff = await store.listStaff();
  const sel = (name, list, val, fmt) => html`<select name="${name}">${list.map((m) => html`<option value="${m}" ${m === val ? 'selected' : ''}>${fmt(m)}</option>`)}</select>`;

  root.innerHTML = str(html`
    <h1>Cài đặt</h1>
    <section class="card"><h2>Giờ mở cửa và quy định</h2>
      <form id="f-set">
        <div class="row">
          <label>Giờ mở cửa<input id="f-open" name="open" type="time" step="1800" value="${s.open}"></label>
          <label>Giờ đóng cửa<input id="f-close" name="close" type="time" step="1800" value="${s.close}"></label>
        </div>
        <div class="row">
          <label>Giữ box khi đặt trước (mặc định)${sel('holdMin', HOURS, s.holdMin, hLabel)}</label>
          <label>Miễn phí${sel('freeMin', HOURS, s.freeMin, hLabel)}</label>
        </div>
        <div class="row">
          <label>Cho phép quá giờ (phút)${sel('graceMin', [0, 5, 10, 15, 20, 30], s.graceMin, String)}</label>
          <label>Giữ box khi khách đến muộn (phút)${sel('lateMin', [10, 15, 20, 30], s.lateMin, String)}</label>
          <label>Tối đa người / box${sel('perBox', [1, 2, 3, 4, 5, 6], s.perBox, String)}</label>
        </div>
        <p class="muted small">Ví dụ với cài đặt hiện tại: ngồi đến ${hLabel(s.freeMin)} ${s.graceMin} phút không tính thêm; quá thì tính tròn lên từng giờ kể từ mốc ${hLabel(s.freeMin)}.</p>
        <button class="primary" type="submit">Lưu giờ và quy định</button>
      </form>
    </section>

    <section class="card"><h2>Box</h2>
      <div id="boxes">${boxes.map((b, i) => html`
        <div class="box-row" data-id="${b.id}">
          <input name="name" value="${b.name}" aria-label="Tên box">
          <label class="act-label"><input type="checkbox" name="active" ${b.active ? 'checked' : ''}> Đang dùng</label>
          <button type="button" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Lên">↑</button>
          <button type="button" data-act="down" ${i === boxes.length - 1 ? 'disabled' : ''} aria-label="Xuống">↓</button>
          <button type="button" data-act="save-box">Lưu</button>
        </div>`)}</div>
      <p class="muted small">Box tạm ngừng sẽ ẩn khỏi bảng box và không đặt được; lượt cũ vẫn còn.</p>
      <button type="button" data-act="add-box">+ Thêm box</button>
    </section>

    <section class="card"><h2>Nhân viên</h2>
      <div id="staff">${staff.map((u) => html`
        <div class="staff-row" data-id="${u.id}">
          <input name="name" value="${u.name}" aria-label="Tên">
          <input name="email" type="email" value="${u.email}" aria-label="Email" placeholder="Email đăng nhập">
          <select name="role" aria-label="Vai trò"><option value="nv" ${u.role === 'nv' ? 'selected' : ''}>Nhân viên</option><option value="ql" ${u.role === 'ql' ? 'selected' : ''}>Quản lý</option><option value="chu" ${u.role === 'chu' ? 'selected' : ''}>Chủ</option></select>
          <button type="button" data-act="save-staff">Lưu</button>
        </div>`)}</div>
      <button type="button" data-act="add-staff">+ Thêm nhân viên</button>
      <p class="muted small">Khi có máy chủ thật: tài khoản đăng nhập tạo trong trang quản trị Supabase (Authentication › Users), rồi ghi đúng email ở đây để gán vai trò.</p>
    </section>
    <div id="sales"></div>`);
  await mountSales($('#sales', root), ctx);

  $('#f-set', root).addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await store.saveSettings({ open: f.open.value, close: f.close.value, holdMin: f.holdMin.value, freeMin: f.freeMin.value, graceMin: f.graceMin.value, lateMin: f.lateMin.value, perBox: f.perBox.value });
      toast('Đã lưu'); ctx.refresh();
    } catch (err) { showError(err); }
  });

  const rowBox = (el) => { const r = el.closest('.box-row'); return { r, id: r.dataset.id, name: $('[name=name]', r).value, active: $('[name=active]', r).checked }; };
  on(root, 'click', '[data-act="save-box"]', async (e, b) => {
    const x = rowBox(b);
    try { await store.saveBox({ id: x.id, name: x.name, active: x.active, sort: boxes.find((y) => y.id === x.id).sort }); toast('Đã lưu'); } catch (err) { showError(err); }
  });
  on(root, 'click', '[data-act="up"], [data-act="down"]', async (e, b) => {
    const x = rowBox(b);
    const i = boxes.findIndex((y) => y.id === x.id), j = i + (b.dataset.act === 'up' ? -1 : 1);
    const a = boxes[i], c = boxes[j];
    if (!c) return;
    try {
      await store.saveBox({ ...a, sort: c.sort });
      await store.saveBox({ ...c, sort: a.sort });
      ctx.refresh();
    } catch (err) { showError(err); }
  });
  on(root, 'click', '[data-act="add-box"]', async () => {
    try { await store.saveBox({ name: 'Box ' + (boxes.length + 1), active: true }); toast('Đã thêm box'); ctx.refresh(); } catch (err) { showError(err); }
  });
  on(root, 'click', '[data-act="save-staff"]', async (e, b) => {
    const r = b.closest('.staff-row');
    try { await store.saveStaff({ id: r.dataset.id || undefined, name: $('[name=name]', r).value, email: $('[name=email]', r).value, role: $('[name=role]', r).value }); toast('Đã lưu'); } catch (err) { showError(err); }
  });
  on(root, 'click', '[data-act="add-staff"]', () => {
    const div = document.createElement('div');
    div.className = 'staff-row'; div.dataset.id = '';
    div.innerHTML = str(html`<input name="name" placeholder="Tên" aria-label="Tên"><input name="email" type="email" placeholder="Email đăng nhập" aria-label="Email">
      <select name="role" aria-label="Vai trò"><option value="nv">Nhân viên</option><option value="ql">Quản lý</option><option value="chu">Chủ</option></select>
      <button type="button" data-act="save-staff">Lưu</button>`);
    $('#staff', root).appendChild(div);
  });
}
