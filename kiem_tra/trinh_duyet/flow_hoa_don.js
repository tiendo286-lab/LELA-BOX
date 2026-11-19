// Tab Hoá đơn (mọi vai trò): in lại, huỷ & thu lại (nhân viên cần PIN quản lý).
export default async function (h) {
  const lastPrint = () => (window.__lelaPrints || []).slice(-1)[0] || '';
  const st = window.__lela.store;
  // Thu trước một phiếu Box 2: 1 Coca 20.000đ, tiền mặt
  const v2 = (await st.snapshot('2026-11-19')).visits.find((v) => v.boxId === 'b2' && v.status === 'ngoi');
  const o = (await st.ordersOfVisit(v2.id))[0];
  await st.addLines(o.id, [{ menuItemId: 'm_coca', qty: 1, note: '' }]);
  await st.pay([o.id], { transfer: 0, cashGiven: 20000 });

  await h.go('#/hoa-don');
  const row = () => h.$$('.bill-row').find((r) => r.textContent.includes('Box 2'));
  h.check(row() && row().textContent.includes('20.000đ') && row().textContent.includes('Tiền mặt'), 'danh sách có hoá đơn Box 2 — 20.000đ tiền mặt');

  await h.click(row().querySelector('[data-act="reprint"]'));
  h.check(lastPrint().includes('IN LẠI') && lastPrint().includes('20.000đ'), 'In lại hoá đơn có chữ IN LẠI');

  // Thu nhầm tiền mặt → huỷ & thu lại bằng chuyển khoản
  await h.click(row().querySelector('[data-act="rebill"]'));
  h.check(!!h.$('.sheet input[name="pin"]'), 'nhân viên huỷ hoá đơn: hỏi PIN quản lý');
  await h.fill('.sheet input[name="pin"]', '2222');
  await h.fill('.sheet input[name="reason"]', 'thu nhầm tiền mặt');
  await h.click('.sheet [data-act="pin-ok"]');
  await h.waitFor('#pay-total');
  h.check(h.$('#pay-total') && h.$('#pay-total').textContent.includes('20.000đ'), 'mở lại màn thanh toán với đúng món cũ');
  await h.click('.sheet [data-act="all-transfer"]');
  await h.click('.sheet [data-act="pay-ok"]');
  await h.sleep(300); await h.settle();
  h.check(h.$$('.bill-row').some((r) => r.textContent.includes('Đã huỷ') && r.textContent.includes('thu nhầm tiền mặt')), 'hoá đơn cũ ghi Đã huỷ + lý do');
  h.check(h.$$('.bill-row').some((r) => r.textContent.includes('Chuyển khoản') && !r.textContent.includes('Đã huỷ')), 'hoá đơn mới thu bằng chuyển khoản');
  h.noOverflow(); h.strange();
}
