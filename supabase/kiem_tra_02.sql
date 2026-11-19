-- Chạy thử 02_tinh_tien_kho.sql trên máy chủ thật mà KHÔNG lưu gì: gửi 01_khoi_tao.sql (nếu chưa chạy) + 02_tinh_tien_kho.sql + tệp này trong cùng một lần.
-- Kết quả là một lỗi có chủ ý 'REPORT>> …' → mọi thay đổi tự hoàn tác. Đối chiếu từng mục với "mong:" ghi bên cạnh.
do $$
declare
  r text := '';
  lines jsonb := '[{"kind":"mon","group":"Trà","name":"Trà đào","price":35000,"qty":2,"voided":null},
                   {"kind":"combo","group":"Combo","name":"Combo 3 người","price":150000,"qty":1,"serves":3}]';
  p jsonb; mid text; v1 jsonb; v2 jsonb; o1 text; o2 text; x jsonb; i int;
  as_chu text := json_build_object('email', 'chu.thu@vi-du.local', 'role', 'authenticated')::text;
  as_nv text := json_build_object('email', 'nv.thu@vi-du.local', 'role', 'authenticated')::text;
begin
  insert into staff (email, name, role) values ('chu.thu@vi-du.local', 'Chủ thử', 'chu'), ('nv.thu@vi-du.local', 'NV thử', 'nv') on conflict (email) do nothing;
  insert into promotions (name, kind, value, scope, days, from_min, to_min) values ('Giờ vàng thử', 'pct', 20, '["Trà"]', '[1,2,3,4,5]', 840, 1020);
  insert into vouchers (code, kind, value) values ('THU15', 'pct', 15);

  -- 1) Con số tiền (giống kiem_tra/money_test.mjs)
  p := app__price(lines, 2, 20000, null, null, '2026-11-19 15:00+07');
  r := r || format('tiền: goods %s promo %s extra %s total %s (mong 220000/14000/40000/246000); ', p ->> 'goods', p -> 'promo' ->> 'amount', p ->> 'extraAmount', p ->> 'total');
  p := app__price(lines, 2, 20000, '{"kind":"pct","value":10}', null, '2026-11-19 15:00+07');
  r := r || format('giảm tay 10%%: %s → %s (mong 24600 → 221400); ', p ->> 'manualAmount', p ->> 'total');
  p := app__price(lines, 2, 20000, null, null, '2026-11-19 17:00+07');
  r := r || format('17:00 hết giờ vàng: promo %s (mong null); ', coalesce(p ->> 'promo', 'null'));
  p := app__price('[{"kind":"mon","group":"Trà","name":"X","price":33333,"qty":1}]', 0, 20000, null, 'thu15', '2026-11-19 18:00+07');
  r := r || format('15%% × 33.333 = %s (mong 4999); ', p -> 'promo' ->> 'amount');
  r := r || format('tiền chữ: %s (mong 1.234.567đ); ', app__fmt_money(1234567));

  -- 2) Chủ tạo món + hàng kho + PIN
  perform set_config('request.jwt.claims', as_chu, true);
  perform app_menu_save('{"name":"Coca thử","group":"Nước","price":20000,"kind":"mon"}');
  select id into mid from menu_items where name = 'Coca thử';
  perform app_stock_save(jsonb_build_object('name', 'Coca thử', 'unit', 'lon', 'menuItemId', mid));
  perform app_pin_set('1111');
  perform app_settings_save('{"extraPrice": 25000}');
  r := r || format('lưu 1 phần cài đặt: giá thêm %s, mở cửa %s (mong 25000, giữ nguyên); ', app__settings_json() ->> 'extraPrice', app__settings_json() ->> 'open');

  -- 3) Nhân viên bán: thu một lần, thu lần hai bị chặn
  perform set_config('request.jwt.claims', as_nv, true);
  v1 := app_walk_in('{"boxId":"b12","people":1}');
  o1 := app_orders_of_visit(v1 ->> 'id') -> 0 ->> 'id';
  perform app_order_add(o1, jsonb_build_array(jsonb_build_object('menuItemId', mid, 'qty', 1)));
  x := app_order_send(o1);
  r := r || format('phiếu pha chế: %s dòng, gọi thêm=%s (mong 1, false); ', jsonb_array_length(x -> 'ticket' -> 'lines'), x -> 'ticket' ->> 'again');
  x := app_order_pay(jsonb_build_array(o1), '{"transfer":20000,"cashGiven":0}');
  r := r || format('thu: tổng %s, lượt %s (mong 20000, ve); ', x -> 'receipt' -> 'priced' ->> 'total', (select status from visits where id = v1 ->> 'id'));
  begin
    perform app_order_pay(jsonb_build_array(o1), '{"transfer":20000,"cashGiven":0}');
    r := r || 'THU LẦN 2 KHÔNG BỊ CHẶN (SAI); ';
  exception when others then r := r || 'thu lần 2: ' || sqlerrm || ' (mong LOI: Phiếu đã thu); ';
  end;
  r := r || format('kho bán: %s (mong 1); ', (select sum(qty) from stock_moves where order_id = o1 and kind = 'ban'));

  -- 4) Giảm tay: nhân viên không PIN / PIN sai 5 lần → khoá
  v2 := app_walk_in('{"boxId":"b11","people":2}');
  o2 := app_orders_of_visit(v2 ->> 'id') -> 0 ->> 'id';
  perform app_order_add(o2, jsonb_build_array(jsonb_build_object('menuItemId', mid, 'qty', 1)));
  x := app_order_manual(o2, '{"kind":"amt","value":5000,"reason":"khách quen"}');
  r := r || 'không PIN: ' || coalesce(x ->> '__error', 'KHÔNG CHẶN (SAI)') || '; ';
  x := app_order_manual(o2, '{"kind":"amt","value":5000,"reason":"khách quen","pin":"1111"}');
  r := r || format('PIN đúng: người duyệt %s (mong Chủ thử); ', x -> 'manual' ->> 'approvedBy');
  for i in 1 .. 5 loop x := app_order_manual(o2, '{"kind":"amt","value":3000,"reason":"x","pin":"0000"}'); end loop;
  x := app_order_manual(o2, '{"kind":"amt","value":3000,"reason":"x","pin":"1111"}');
  r := r || 'sau 5 lần sai: ' || coalesce(x ->> '__error', 'KHÔNG KHOÁ (SAI)') || '; ';
  begin
    perform app_order_pay(jsonb_build_array(o2), '{"transfer":0,"cashGiven":1000}');
    r := r || 'THIẾU TIỀN KHÔNG BỊ CHẶN (SAI); ';
  exception when others then r := r || 'thiếu tiền: ' || sqlerrm || ' (mong Khách đưa thiếu 14.000đ); ';
  end;
  x := app_snapshot((now() at time zone 'Asia/Ho_Chi_Minh')::date);
  r := r || format('snapshot: box 11 tạm tính %s, cần %s món (mong 20000, 2); ', x -> 'orderStats' -> (v2 ->> 'id') ->> 'total', x -> 'orderStats' -> (v2 ->> 'id') ->> 'need');
  begin
    perform app_stock_overview();
    r := r || 'NV XEM TỒN KHO ĐƯỢC (SAI); ';
  exception when others then r := r || 'nv xem tồn: ' || sqlerrm || '; ';
  end;
  x := app_stock_count(jsonb_build_object('items', jsonb_build_array(jsonb_build_object('stockItemId', (select id from stock_items where name = 'Coca thử'), 'counted', 5))));
  r := r || format('kiểm kê mù: trả về %s (mong chỉ id + at); ', (select string_agg(k, ',') from jsonb_object_keys(x) k));

  -- 5) Chủ huỷ hoá đơn → hoàn kho
  perform set_config('request.jwt.claims', as_chu, true);
  x := app_order_void(o1, '{"reason":"thu nhầm"}');
  r := r || format('huỷ: %s, hoàn kho %s (mong huy, 1); ', x ->> 'status', (select sum(qty) from stock_moves where order_id = o1 and kind = 'hoan'));
  r := r || format('kiểm kê (Chủ xem): đáng lẽ %s, đếm 5, lệch %s (mong -1, 6 — chưa nhập hàng, đã bán 1); ',
    app_stock_counts(current_date - 1, current_date + 1) -> 0 -> 'items' -> 0 ->> 'expected', app_stock_counts(current_date - 1, current_date + 1) -> 0 -> 'items' -> 0 ->> 'diff');
  r := r || format('doanh thu trong ngày: %s phiếu (mong 1 — phiếu đã huỷ vẫn hiện để trừ); ', jsonb_array_length(app_orders_range(current_date - 1, current_date + 1)));
  r := r || format('duyệt: %s (mong giam_tay, huy_hoa_don); ', (select string_agg(kind, ', ' order by id) from approvals));

  -- 6) Sửa sau duyệt: gộp món bấm nhiều lần, cộng/trừ số lượng, huỷ & thu lại, trả chung + voucher số tiền, danh sách hoá đơn
  perform set_config('request.jwt.claims', as_nv, true);
  perform app_order_add(o2, jsonb_build_array(jsonb_build_object('menuItemId', mid, 'qty', 1)));
  x := app_order_add(o2, jsonb_build_array(jsonb_build_object('menuItemId', mid, 'qty', 1)));
  r := r || format('gộp món: %s dòng, SL %s (mong 1, 3); ', jsonb_array_length(x -> 'lines'), x -> 'lines' -> 0 ->> 'qty');
  x := app_order_line_bump(o2, x -> 'lines' -> 0 ->> 'id', -1);
  r := r || format('bớt 1: SL %s (mong 2); ', x -> 'lines' -> 0 ->> 'qty');
  perform set_config('request.jwt.claims', as_chu, true);
  begin
    perform app_order_void(o1, '{"reason":"lại"}');
    r := r || 'HUỶ LẦN 2 KHÔNG BỊ CHẶN (SAI); ';
  exception when others then r := r || 'huỷ lần 2: ' || sqlerrm || ' (mong LOI: Chỉ huỷ được hoá đơn đã thu); ';
  end;
  insert into vouchers (code, kind, value) values ('THU20K', 'amt', 20000);
  perform app_order_voucher(o2, 'THU20K');
  x := app_order_quote(jsonb_build_array(o2));
  r := r || format('voucher 20.000 trên 40.000: giảm %s, tổng %s (mong 20000, 15000 — còn giảm tay 5.000 ở trên); ', x -> 'orders' -> 0 -> 'priced' -> 'promo' ->> 'amount', x ->> 'total');
  x := app_order_pay(jsonb_build_array(o2), '{"transfer":0,"cashGiven":50000}');
  r := r || format('voucher dùng %s lần (mong 1); thối %s (mong 35000); ', (select used from vouchers where code = 'THU20K'), x -> 'receipt' ->> 'change');
  perform app_settings_save('{"extraPrice": 30000}');
  r := r || format('in lại giữ giá thêm cũ: %s (mong 25000); ', app_order_receipt(o2) -> 'priced' ->> 'extraPrice');
  x := app_order_void(o2, '{"reason":"thu nhầm","reopen":true}');
  r := r || format('huỷ & thu lại: phiếu mở mới %s, số món %s (mong 1, 1 dòng SL 2); ',
    (select count(*) from orders where visit_id = v2 ->> 'id' and status = 'mo'), (select jsonb_array_length(lines) from orders where visit_id = v2 ->> 'id' and status = 'mo'));
  x := app_bills_of_day((now() at time zone 'Asia/Ho_Chi_Minh')::date);
  r := r || format('danh sách hoá đơn: %s (mong 2 — cả 2 đã huỷ); ', (select string_agg(b ->> 'status', ',') from jsonb_array_elements(x) b));

  raise exception 'REPORT>> %', r;
end $$;
