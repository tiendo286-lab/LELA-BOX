-- Chạy thử 01_khoi_tao.sql trên máy chủ thật mà KHÔNG lưu gì: gửi 01_khoi_tao.sql + tệp này trong cùng một lần.
-- Kết quả là một lỗi có chủ ý 'REPORT>> …' → mọi thay đổi tự hoàn tác.
do $$
declare
  r text := '';
  d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date + 1;
  k1 jsonb; k2 jsonb; w jsonb; o jsonb;
begin
  insert into staff (email, name, role) values ('thu@vi-du.local', 'Người thử', 'chu') on conflict (email) do nothing;
  perform set_config('request.jwt.claims', json_build_object('email', 'thu@vi-du.local', 'role', 'authenticated')::text, true);

  r := r || 'me=' || coalesce(app_me() ->> 'name', 'NULL') || '; ';
  r := r || 'extra 190/191/240/241/301=' || app__extra(190) || '/' || app__extra(191) || '/' || app__extra(240) || '/' || app__extra(241) || '/' || app__extra(301) || '; ';

  k1 := app_booking_create(jsonb_build_object('name', 'Thử A', 'phone', '0911000001', 'date', d, 'startMin', 600, 'durMin', 180, 'people', 5, 'boxIds', jsonb_build_array('b1', 'b2')));
  r := r || 'phiếu nhóm: ' || jsonb_array_length(k1 -> 'visits') || ' lượt; ';

  begin
    perform app_booking_create(jsonb_build_object('name', 'Thử B', 'phone', '0911000002', 'date', d, 'startMin', 660, 'durMin', 120, 'boxIds', jsonb_build_array('b2')));
    r := r || 'TRÙNG KHÔNG BỊ CHẶN (SAI); ';
  exception when others then r := r || 'trùng bị chặn: ' || sqlerrm || '; ';
  end;

  k2 := app_booking_create(jsonb_build_object('name', 'Thử C', 'phone', '0911000003', 'date', d, 'startMin', 780, 'durMin', 60, 'boxIds', jsonb_build_array('b1')));
  r := r || 'chạm mép 13:00 được; ';

  perform app_booking_cancel(k1 -> 'booking' ->> 'id');
  perform app_booking_create(jsonb_build_object('name', 'Thử D', 'phone', '0911000004', 'date', d, 'startMin', 600, 'durMin', 180, 'boxIds', jsonb_build_array('b2')));
  r := r || 'huỷ rồi đặt lại được; ';

  begin
    perform app_booking_create(jsonb_build_object('name', 'Thử E', 'phone', '', 'date', d, 'startMin', 600, 'durMin', 60, 'boxIds', jsonb_build_array('b5')));
  exception when others then r := r || 'thiếu SĐT: ' || sqlerrm || '; ';
  end;

  w := app_walk_in(jsonb_build_object('boxId', 'b7', 'people', 2, 'name', 'Lẻ'));
  begin
    perform app_walk_in(jsonb_build_object('boxId', 'b7', 'people', 1));
    r := r || 'VÀO BOX ĐANG NGỒI KHÔNG BỊ CHẶN (SAI); ';
  exception when others then r := r || 'vào box đang ngồi: ' || sqlerrm || '; ';
  end;
  update visits set in_at = now() - interval '241 minutes' where id = w ->> 'id';
  o := app_check_out(w ->> 'id');
  r := r || 'về sau 241 phút: thêm ' || (o ->> 'extra') || ' giờ; ';

  perform app_booking_create(jsonb_build_object('name', 'Lân Thử', 'phone', '0911000005', 'date', d, 'startMin', 900, 'durMin', 60, 'boxIds', jsonb_build_array('b9')));
  r := r || 'tìm "lan" ra "Lân": ' || jsonb_array_length(app_customers_find('lan')) || '; ';
  w := app_walk_in(jsonb_build_object('boxId', 'b8', 'people', 1));
  update visits set in_at = now() - interval '20 hours' where id = w ->> 'id';
  o := app_check_out(w ->> 'id', app__ms(now() - interval '11 hours'));
  r := r || 'quên bấm về, ghi giờ ra thật (ngồi 9 giờ): thêm ' || (o ->> 'extra') || ' giờ; ';
  r := r || 'snapshot lượt=' || jsonb_array_length(app_snapshot(d) -> 'visits') || '; ';
  r := r || 'tìm khách "0911000003"=' || jsonb_array_length(app_customers_find('0911000003')) || '; ';

  raise exception 'REPORT>> %', r;
end $$;
