// Sửa giờ vào / ra của một lượt (đang ngồi hoặc đã về) — có xem trước giờ ngồi + giờ tính thêm.
import { html, str, $, openSheet, toast, showError } from '../ui.js';
import { fmtMin, fmtDay, fmtDur, fromMs, atMs, toMin } from '../time.js';
import { extraHours } from '../rules.js';

// Câu xem trước + lỗi cho một cặp giờ vào / ra (ms)
export function previewTimes(inAt, outAt, now, s) {
  if (!inAt || !outAt) return { error: 'Nhập đủ giờ vào và giờ ra', text: '' };
  if (outAt <= inAt) return { error: 'Giờ ra phải sau giờ vào', text: '' };
  if (outAt > now + 60000 || inAt > now + 60000) return { error: 'Giờ này chưa tới', text: '' };
  const mins = Math.floor((outAt - inAt) / 60000);
  return { error: null, text: `Ngồi ${fmtDur(mins)} → tính thêm ${extraHours(mins, s)} giờ`, mins };
}

export function openTimes(ctx, v, boxName, settings, after) {
  const inDate = fromMs(v.inAt).date;
  const sh = openSheet(`Sửa giờ — ${boxName}`, html`
    <p class="small muted">Lượt ngày ${fmtDay(inDate)}${v.status === 'ngoi' ? ' (đang ngồi)' : ''}. Mọi lần sửa đều ghi vào nhật ký.</p>
    <div class="row">
      <label>Giờ vào<input name="in" type="time" value="${fmtMin(fromMs(v.inAt).min)}"></label>
      ${v.status === 've' ? html`<label>Giờ ra<input name="out" type="time" value="${fmtMin(fromMs(v.outAt).min)}"></label>` : ''}
    </div>
    <p class="big" id="pv"></p><p class="err" id="pv-err"></p>
    <button class="primary" data-act="save-times">Lưu giờ</button>`);
  const el = sh.el;
  const read = () => {
    const i = $('[name="in"]', el).value, o = $('[name="out"]', el);
    return { inAt: i ? atMs(inDate, toMin(i)) : null, outAt: o ? (o.value ? atMs(inDate, toMin(o.value)) : null) : null };
  };
  const show = () => {
    const t = read();
    const p = previewTimes(t.inAt, v.status === 've' ? t.outAt : ctx.now(), ctx.now(), settings);
    $('#pv', el).textContent = v.status === 've' ? p.text : (p.error ? '' : `Đã ngồi ${fmtDur(p.mins)}`);
    $('#pv-err', el).textContent = p.error || '';
    $('[data-act="save-times"]', el).disabled = !!p.error;
    return { t, p };
  };
  el.addEventListener('input', show);
  $('[data-act="save-times"]', el).addEventListener('click', async () => {
    const { t, p } = show();
    if (p.error) return;
    try {
      const r = await ctx.store.editTimes(v.id, v.status === 've' ? t : { inAt: t.inAt });
      sh.close();
      toast(r.minutes != null ? `Đã sửa giờ — ngồi ${fmtDur(r.minutes)}, tính thêm ${r.extra} giờ` : 'Đã sửa giờ vào');
      if (after) await after();
    } catch (e) { showError(e); }
  });
  show();
  return sh;
}
