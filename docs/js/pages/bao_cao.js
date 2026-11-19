// Báo cáo (Chủ): lượt khách / ngày, giờ cao điểm, giờ ngồi thêm.
import { html, str, $, on } from '../ui.js';
import { fmtMin, fmtDay, fromMs, addDays, fmtDur } from '../time.js';
import { dailyCounts, peakGrid, extraList } from '../report.js';

const vn = (x) => String(x).replace('.', ',');

export default async function render(root, ctx) {
  const { store } = ctx;
  const today = fromMs(ctx.now()).date;
  const s = await store.getSettings();
  const boxes = await store.listBoxes({ all: true });
  const boxName = (id) => (boxes.find((b) => b.id === id) || {}).name || id;
  const nBoxes = boxes.filter((b) => b.active).length || 1;
  let from = addDays(today, -6), to = today;

  root.innerHTML = str(html`<h1>Báo cáo</h1>
    <div class="actions ranges">
      <button type="button" data-r="today">Hôm nay</button><button type="button" data-r="7" class="on">7 ngày</button><button type="button" data-r="month">Tháng này</button>
    </div>
    <div class="row"><label>Từ ngày<input type="date" id="r-from"></label><label>Đến ngày<input type="date" id="r-to"></label></div>
    <div id="rep"></div>`);

  async function draw() {
    $('#r-from', root).value = from; $('#r-to', root).value = to;
    const vs = await store.visitsRange(from, to);
    const daily = dailyCounts(vs, from, to);
    const peak = peakGrid(vs, from, to, s);
    const ex = extraList(vs, from, to, s);
    const sum = daily.reduce((a, d) => ({ dat: a.dat + d.datTruoc, vl: a.vl + d.vangLai, kd: a.kd + d.khongDen }), { dat: 0, vl: 0, kd: 0 });
    const shade = (v) => `background:rgba(122,74,43,${Math.min(1, v / nBoxes).toFixed(2)});color:${v / nBoxes > 0.55 ? '#fff' : 'inherit'}`;
    const byOut = (v) => ((v.log || []).filter((l) => l.action === 'Khách về').pop() || {}).by || '';
    $('#rep', root).innerHTML = str(html`
      <section class="card"><h2>Lượt khách mỗi ngày</h2>
        <p class="small muted">Tổng: ${sum.dat} đặt trước · ${sum.vl} vãng lai · ${sum.kd} không đến</p>
        <div class="scroll-x"><table class="tbl t-daily"><thead><tr><th>Ngày</th><th>Đặt trước</th><th>Vãng lai</th><th>Không đến</th><th>Huỷ</th><th>Giờ ngồi</th></tr></thead>
        <tbody>${daily.slice().reverse().map((d) => html`<tr><td>${fmtDay(d.date)}</td><td>${d.datTruoc}</td><td>${d.vangLai}</td><td>${d.khongDen}</td><td>${d.huy}</td><td>${vn(d.gioNgoi)}</td></tr>`)}</tbody></table></div>
      </section>
      <section class="card"><h2>Giờ cao điểm</h2>
        <p class="small muted">Số box có khách trung bình theo thứ và giờ (ô càng đậm càng đông; tối đa ${nBoxes} box).</p>
        <div class="scroll-x"><table class="tbl t-peak"><thead><tr><th></th>${peak.cols.map((m) => html`<th>${m % 60 ? '' : fmtMin(m).slice(0, 2)}</th>`)}</tr></thead>
        <tbody>${peak.rows.map((r, i) => html`<tr><th>${r}</th>${peak.avg[i].map((v, c) => html`<td style="${shade(v)}" title="${`${r} ${fmtMin(peak.cols[c])}: ${vn(v)} box`}">${v ? vn(v) : ''}</td>`)}</tr>`)}</tbody></table></div>
      </section>
      <section class="card"><h2>Giờ ngồi thêm</h2>
        <p class="big">Tổng giờ thêm: ${ex.total} giờ</p>
        ${ex.items.length ? html`<div class="scroll-x"><table class="tbl t-extra"><thead><tr><th>Ngày</th><th>Box</th><th>Vào</th><th>Ra</th><th>Ngồi</th><th>Thêm</th><th>Người bấm về</th></tr></thead>
        <tbody>${ex.items.map((x) => html`<tr><td>${fmtDay(x.visit.date)}</td><td>${boxName(x.visit.boxId)}</td><td>${fmtMin(fromMs(x.visit.inAt).min)}</td><td>${fmtMin(fromMs(x.visit.outAt).min)}</td><td>${fmtDur(x.minutes)}</td><td>${x.extra} giờ</td><td>${byOut(x.visit)}</td></tr>`)}</tbody></table></div>`
          : html`<p class="muted">Không có lượt nào ngồi thêm.</p>`}
      </section>`);
    root.querySelectorAll('[data-r]').forEach((b) => b.classList.toggle('on', b.dataset.r === cur));
  }

  let cur = '7';
  on(root, 'click', '[data-r]', async (e, b) => {
    cur = b.dataset.r;
    if (cur === 'today') { from = today; to = today; }
    if (cur === '7') { from = addDays(today, -6); to = today; }
    if (cur === 'month') { from = today.slice(0, 8) + '01'; to = today; }
    await draw();
  });
  const custom = async () => {
    const a = $('#r-from', root).value, b = $('#r-to', root).value;
    if (a && b && a <= b) { from = a; to = b; cur = ''; await draw(); }
  };
  $('#r-from', root).addEventListener('change', custom);
  $('#r-to', root).addEventListener('change', custom);
  await draw();
}
