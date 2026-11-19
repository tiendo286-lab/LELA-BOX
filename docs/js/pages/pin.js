// Hộp duyệt việc cần quản lý: nhân viên → quản lý / Chủ gõ PIN; quản lý / Chủ tự làm → chỉ ghi lý do.
import { html, $, on, openSheet } from '../ui.js';
import { fmtMoney } from '../money.js';

export function askPin({ title, me, needReason = true, amount = null }) {
  const boss = me && (me.role === 'chu' || me.role === 'ql');
  return new Promise((resolve) => {
    let done = false;
    const sh = openSheet(title, html`
      ${amount != null ? html`<p>Số tiền: <b>${fmtMoney(amount)}</b></p>` : ''}
      ${boss ? html`<p class="muted small">Bạn là ${me.role === 'chu' ? 'Chủ' : 'Quản lý'} — không cần PIN, chỉ ghi lý do.</p>`
        : html`<label>PIN của quản lý / Chủ<input name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="6"></label>`}
      ${needReason ? html`<label>Lý do<input name="reason" autocomplete="off" placeholder="vd khách đổi món"></label>` : ''}
      <p class="err" id="pin-err"></p>
      <div class="actions"><button type="button" class="primary" data-act="pin-ok">Đồng ý</button><button type="button" data-act="pin-cancel">Huỷ</button></div>`);
    const el = sh.el;
    const finish = (v) => { if (done) return; done = true; sh.close(); resolve(v); };
    const val = (n) => { const x = $(`[name="${n}"]`, el); return x ? x.value.trim() : ''; };
    on(el, 'click', '[data-act="pin-ok"]', () => {
      if (!boss && !/^\d{4,6}$/.test(val('pin'))) { $('#pin-err', el).textContent = 'Nhập PIN 4–6 số'; return; }
      if (needReason && !val('reason')) { $('#pin-err', el).textContent = 'Ghi lý do'; return; }
      finish({ pin: boss ? null : val('pin'), reason: val('reason') });
    });
    on(el, 'click', '[data-act="pin-cancel"]', () => finish(null));
    // Đóng bằng ✕ / bấm ra ngoài → coi như huỷ
    new MutationObserver((m, obs) => { if (!document.body.contains(el)) { obs.disconnect(); finish(null); } }).observe(document.body, { childList: true });
    const first = $('[name="pin"]', el) || $('[name="reason"]', el); if (first) first.focus();
  });
}
