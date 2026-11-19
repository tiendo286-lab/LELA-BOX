-- Lela Box — khởi tạo máy chủ (chạy lại nhiều lần không sao).
-- Mọi bảng bật RLS và thu hồi quyền; web chỉ gọi hàm app_* (SECURITY DEFINER). Hàm nội bộ app__* không cho web gọi.
-- Lỗi trả về dạng 'TRUNG: …' / 'LOI: …' / 'QUYEN: …' để web hiện đúng câu.

create extension if not exists btree_gist;
-- Bỏ dấu tiếng Việt khi tìm khách (Supabase để extension trong schema 'extensions')
create schema if not exists extensions;
create extension if not exists unaccent schema extensions;

-- ===== Bảng =====
create table if not exists public.staff (
  id text primary key default gen_random_uuid()::text,
  email text not null unique,
  name text not null,
  role text not null check (role in ('chu', 'nv')),
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id int primary key check (id = 1),
  open time not null default '08:00',
  close time not null default '23:00',
  hold_min int not null default 180,
  free_min int not null default 180,
  grace_min int not null default 10,
  late_min int not null default 15,
  per_box int not null default 3
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.boxes (
  id text primary key,
  name text not null,
  active boolean not null default true,
  sort int not null default 0
);
insert into public.boxes (id, name, sort)
  select 'b' || g, 'Box ' || g, g from generate_series(1, 12) g
  on conflict (id) do nothing;

create table if not exists public.customers (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  phone text not null default '',
  tiktok text not null default '',
  created_at timestamptz not null default now()
);
create unique index if not exists customers_phone_uq on public.customers (phone) where phone <> '';

create table if not exists public.bookings (
  id text primary key default gen_random_uuid()::text,
  customer_id text not null references public.customers (id),
  biz_date date not null,
  start_min int not null,
  dur_min int not null,
  people int not null default 1,
  channel text not null default 'tiktok',
  note text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.visits (
  id text primary key default gen_random_uuid()::text,
  booking_id text references public.bookings (id),
  box_id text not null references public.boxes (id),
  customer_id text references public.customers (id),
  guest_name text not null default '',
  status text not null check (status in ('dat', 'ngoi', 've', 'huy', 'vang')),
  biz_date date not null,
  start_min int,
  dur_min int not null default 180,
  in_at timestamptz,
  out_at timestamptz,
  people int not null default 1,
  minutes int,
  extra int,
  hold tstzrange
);
create index if not exists visits_date_idx on public.visits (biz_date);
create index if not exists visits_live_idx on public.visits (box_id) where status in ('dat', 'ngoi');

create table if not exists public.visit_log (
  id bigserial primary key,
  visit_id text not null references public.visits (id),
  at timestamptz not null default now(),
  by_name text not null default '',
  action text not null,
  detail text not null default ''
);
create index if not exists visit_log_visit_idx on public.visit_log (visit_id);

alter table public.staff enable row level security;
alter table public.settings enable row level security;
alter table public.boxes enable row level security;
alter table public.customers enable row level security;
alter table public.bookings enable row level security;
alter table public.visits enable row level security;
alter table public.visit_log enable row level security;
revoke all on public.staff, public.settings, public.boxes, public.customers, public.bookings, public.visits, public.visit_log from anon, authenticated;
revoke all on sequence public.visit_log_id_seq from anon, authenticated;

-- ===== Hàm nội bộ =====
create or replace function public.app__vn_ts(d date, m int) returns timestamptz
language sql stable set search_path = public as $$
  select (d::timestamp + make_interval(mins => m)) at time zone 'Asia/Ho_Chi_Minh'
$$;

create or replace function public.app__ms(t timestamptz) returns bigint
language sql immutable as $$ select case when t is null then null else (extract(epoch from t) * 1000)::bigint end $$;

-- Khoảng giữ box của lượt đặt trước (dùng cho ràng buộc chống trùng)
create or replace function public.app__visit_hold() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'dat' then
    new.hold := tstzrange(app__vn_ts(new.biz_date, new.start_min), app__vn_ts(new.biz_date, new.start_min + new.dur_min), '[)');
  else
    new.hold := null;
  end if;
  return new;
end $$;
drop trigger if exists visits_hold on public.visits;
create trigger visits_hold before insert or update on public.visits for each row execute function public.app__visit_hold();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'visits_no_overlap') then
    alter table public.visits add constraint visits_no_overlap
      exclude using gist (box_id with =, hold with &&) where (status = 'dat');
  end if;
end $$;

create or replace function public.app__me() returns public.staff
language sql stable security definer set search_path = public as $$
  select * from staff where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1
$$;

create or replace function public.app__need(p_role text default null) returns public.staff
language plpgsql stable security definer set search_path = public as $$
declare u staff;
begin
  u := app__me();
  if u.id is null then raise exception 'QUYEN: Chưa đăng nhập hoặc email chưa được gán vai trò'; end if;
  if coalesce(p_role, '') = 'chu' and coalesce(u.role, '') <> 'chu' then raise exception 'QUYEN: Chỉ Chủ được làm việc này'; end if;
  return u;
end $$;

create or replace function public.app__norm_phone(p text) returns text
language sql immutable as $$
  select case when d like '84%' and length(d) >= 11 then '0' || substr(d, 3) else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') d) x
$$;

create or replace function public.app__log(p_visit text, p_action text, p_detail text default '') returns void
language sql security definer set search_path = public as $$
  insert into visit_log (visit_id, by_name, action, detail) values (p_visit, coalesce((app__me()).name, ''), p_action, coalesce(p_detail, ''))
$$;

create or replace function public.app__fold(t text) returns text
language sql stable set search_path = public, extensions as $$
  select lower(extensions.unaccent(replace(replace(coalesce(t, ''), 'đ', 'd'), 'Đ', 'D')))
$$;

create or replace function public.app__fmt_min(m int) returns text
language sql immutable as $$ select lpad(((m / 60) % 24)::text, 2, '0') || ':' || lpad((m % 60)::text, 2, '0') $$;

create or replace function public.app__extra(p_minutes int) returns int
language sql stable security definer set search_path = public as $$
  select case when p_minutes <= s.free_min + s.grace_min then 0 else ceil((p_minutes - s.free_min) / 60.0)::int end
  from settings s where s.id = 1
$$;

-- Lượt còn giữ box trùng khoảng p_range (lượt đang ngồi giữ tới max(nay, vào + thời lượng))
create or replace function public.app__clash(p_box text, p_range tstzrange, p_ignore text[] default '{}') returns public.visits
language sql stable security definer set search_path = public as $$
  select * from visits v
  where v.box_id = p_box and not (v.id = any (coalesce(p_ignore, '{}')))
    and ((v.status = 'dat' and v.hold && p_range)
      or (v.status = 'ngoi' and tstzrange(v.in_at, greatest(now(), v.in_at + make_interval(mins => v.dur_min)), '[)') && p_range))
  order by v.status desc limit 1
$$;

create or replace function public.app__visit_json(v public.visits) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', v.id, 'bookingId', v.booking_id, 'boxId', v.box_id, 'customerId', v.customer_id, 'guestName', v.guest_name,
    'status', v.status, 'date', v.biz_date, 'startMin', v.start_min, 'durMin', v.dur_min,
    'inAt', app__ms(v.in_at), 'outAt', app__ms(v.out_at), 'people', v.people, 'minutes', v.minutes, 'extra', v.extra,
    'log', coalesce((select jsonb_agg(jsonb_build_object('at', app__ms(l.at), 'by', l.by_name, 'action', l.action, 'detail', l.detail) order by l.id)
                     from visit_log l where l.visit_id = v.id), '[]'::jsonb))
$$;

create or replace function public.app__settings_json() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('open', to_char(open, 'HH24:MI'), 'close', to_char(close, 'HH24:MI'), 'holdMin', hold_min, 'freeMin', free_min,
    'graceMin', grace_min, 'lateMin', late_min, 'perBox', per_box) from settings where id = 1
$$;

create or replace function public.app__customer_upsert(p_name text, p_phone text, p_tiktok text) returns text
language plpgsql security definer set search_path = public as $$
declare p text := app__norm_phone(p_phone); cid text;
begin
  if p <> '' then select id into cid from customers where phone = p; end if;
  if cid is not null then
    update customers set name = coalesce(nullif(trim(p_name), ''), name), tiktok = coalesce(nullif(trim(p_tiktok), ''), tiktok) where id = cid;
    return cid;
  end if;
  insert into customers (name, phone, tiktok) values (trim(p_name), p, coalesce(trim(p_tiktok), '')) returning id into cid;
  return cid;
end $$;

-- Kiểm phiếu đặt trước (cùng quy tắc với docs/js/rules.js checkBooking)
create or replace function public.app__check_booking(p jsonb, p_ignore text[], p_same_time boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  s settings; d date := (p ->> 'date')::date; sm int := (p ->> 'startMin')::int; du int := (p ->> 'durMin')::int;
  ph text := app__norm_phone(p ->> 'phone'); ids text[]; bid text; b boxes; c visits; r tstzrange; today date;
  om int; cm int; cname text;
begin
  select * into s from settings where id = 1;
  today := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  select coalesce(array_agg(x), '{}') into ids from jsonb_array_elements_text(coalesce(p -> 'boxIds', '[]'::jsonb)) x;
  if coalesce(trim(p ->> 'name'), '') = '' then raise exception 'LOI: Nhập tên khách'; end if;
  if length(ph) not between 10 and 11 then raise exception 'LOI: Số điện thoại chưa đúng'; end if;
  if coalesce(array_length(ids, 1), 0) not between 1 and 3 then raise exception 'LOI: Chọn 1–3 box'; end if;
  if d > today + 6 then raise exception 'LOI: Chỉ đặt trước tối đa 7 ngày'; end if;
  if not coalesce(p_same_time, false) and app__vn_ts(d, sm) < now() then raise exception 'LOI: Giờ này đã qua'; end if;
  if sm % 30 <> 0 or du % 30 <> 0 or du < 30 then raise exception 'LOI: Giờ phải theo bước 30 phút'; end if;
  om := extract(hour from s.open) * 60 + extract(minute from s.open);
  cm := extract(hour from s.close) * 60 + extract(minute from s.close);
  if sm < om or sm + du > cm then raise exception 'LOI: Ngoài giờ mở cửa (%–%)', to_char(s.open, 'HH24:MI'), to_char(s.close, 'HH24:MI'); end if;
  foreach bid in array ids loop
    select * into b from boxes where id = bid;
    if b.id is null or not b.active then raise exception 'LOI: % đang tạm ngừng', coalesce(b.name, bid); end if;
  end loop;
  r := tstzrange(app__vn_ts(d, sm), app__vn_ts(d, sm + du), '[)');
  foreach bid in array ids loop
    c := app__clash(bid, r, p_ignore);
    if c.id is not null then
      select name into b.name from boxes where id = bid;
      if c.status = 'ngoi' then raise exception 'TRUNG: % đang có khách ngồi', b.name; end if;
      select name into cname from customers where id = c.customer_id;
      raise exception 'TRUNG: % trùng với %, %–%', b.name, coalesce(cname, 'khách khác'), app__fmt_min(c.start_min), app__fmt_min(c.start_min + c.dur_min);
    end if;
  end loop;
end $$;

-- Khách vào box lúc này: chặn nếu box đang có người
create or replace function public.app__check_sit(p_box text, p_self text default null) returns void
language plpgsql security definer set search_path = public as $$
declare b boxes;
begin
  select * into b from boxes where id = p_box;
  if b.id is null or not b.active then raise exception 'LOI: Box này đang tạm ngừng'; end if;
  if exists (select 1 from visits where box_id = p_box and status = 'ngoi' and id <> coalesce(p_self, '')) then
    raise exception 'TRUNG: % đang có khách', b.name;
  end if;
end $$;

revoke all on function public.app__vn_ts(date, int), public.app__ms(timestamptz), public.app__visit_hold(), public.app__me(), public.app__need(text),
  public.app__norm_phone(text), public.app__log(text, text, text), public.app__fmt_min(int), public.app__extra(int),
  public.app__clash(text, tstzrange, text[]), public.app__visit_json(public.visits), public.app__settings_json(),
  public.app__customer_upsert(text, text, text), public.app__check_booking(jsonb, text[], boolean), public.app__check_sit(text, text),
  public.app__fold(text)
  from public, anon, authenticated;

-- ===== Hàm web gọi =====
create or replace function public.app_me() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when u.id is null then null else jsonb_build_object('id', u.id, 'name', u.name, 'role', u.role, 'email', u.email) end
  from (select (app__me()).*) u
$$;

create or replace function public.app_settings_get() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin perform app__need(); return app__settings_json(); end $$;

create or replace function public.app_settings_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform app__need('chu');
  if extract(minute from (p ->> 'open')::time) not in (0, 30) or extract(minute from (p ->> 'close')::time) not in (0, 30) then
    raise exception 'LOI: Giờ mở / đóng cửa phải tròn giờ hoặc rưỡi (vd 08:00, 08:30)';
  end if;
  if (p ->> 'close')::time <= (p ->> 'open')::time then raise exception 'LOI: Giờ đóng cửa phải sau giờ mở cửa'; end if;
  if (p ->> 'perBox')::int < 1 or (p ->> 'freeMin')::int < 30 or (p ->> 'holdMin')::int < 30 then raise exception 'LOI: Số chưa hợp lệ'; end if;
  update settings set open = (p ->> 'open')::time, close = (p ->> 'close')::time, hold_min = (p ->> 'holdMin')::int,
    free_min = (p ->> 'freeMin')::int, grace_min = (p ->> 'graceMin')::int, late_min = (p ->> 'lateMin')::int, per_box = (p ->> 'perBox')::int
  where id = 1;
  return app__settings_json();
end $$;

create or replace function public.app_boxes_list(p_all boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform app__need();
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'active', active, 'sort', sort) order by sort)
                   from boxes where p_all or active), '[]'::jsonb);
end $$;

create or replace function public.app_box_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare nid text;
begin
  perform app__need('chu');
  if coalesce(trim(p ->> 'name'), '') = '' then raise exception 'LOI: Nhập tên box'; end if;
  if p ->> 'id' is not null and exists (select 1 from boxes where id = p ->> 'id') then
    update boxes set name = trim(p ->> 'name'), active = coalesce((p ->> 'active')::boolean, true), sort = coalesce((p ->> 'sort')::int, sort) where id = p ->> 'id';
  else
    nid := 'b' || (select coalesce(max(substring(id from 2)::int), 0) + 1 from boxes where id ~ '^b\d+$');
    insert into boxes (id, name, active, sort) values (nid, trim(p ->> 'name'), coalesce((p ->> 'active')::boolean, true), (select coalesce(max(sort), 0) + 1 from boxes));
  end if;
  return app_boxes_list(true);
end $$;

create or replace function public.app_staff_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform app__need();
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role, 'email', email) order by created_at) from staff), '[]'::jsonb);
end $$;

create or replace function public.app_staff_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform app__need('chu');
  if coalesce(trim(p ->> 'name'), '') = '' then raise exception 'LOI: Nhập tên nhân viên'; end if;
  if coalesce(p ->> 'role', '') not in ('chu', 'nv') then raise exception 'LOI: Chọn vai trò'; end if;
  if coalesce(trim(p ->> 'email'), '') = '' then raise exception 'LOI: Nhập email đăng nhập'; end if;
  if coalesce(p ->> 'id', '') <> '' and exists (select 1 from staff where id = p ->> 'id') then
    update staff set name = trim(p ->> 'name'), role = p ->> 'role', email = lower(trim(p ->> 'email')) where id = p ->> 'id';
  else
    insert into staff (name, role, email) values (trim(p ->> 'name'), p ->> 'role', lower(trim(p ->> 'email')));
  end if;
  return app_staff_list();
end $$;

create or replace function public.app_snapshot(p_date date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare vs jsonb;
begin
  perform app__need();
  select coalesce(jsonb_agg(app__visit_json(v)), '[]'::jsonb) into vs from visits v where v.biz_date = p_date or v.status = 'ngoi';
  return jsonb_build_object(
    'settings', app__settings_json(),
    'boxes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'active', active, 'sort', sort) order by sort) from boxes), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'tiktok', c.tiktok)) from customers c
                           where c.id in (select customer_id from visits where biz_date = p_date or status = 'ngoi')), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'customerId', k.customer_id, 'date', k.biz_date, 'startMin', k.start_min,
                           'durMin', k.dur_min, 'people', k.people, 'channel', k.channel, 'note', k.note, 'createdBy', k.created_by, 'createdAt', app__ms(k.created_at)))
                          from bookings k where k.id in (select booking_id from visits where biz_date = p_date or status = 'ngoi')), '[]'::jsonb),
    'visits', vs);
end $$;

create or replace function public.app_visits_range(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform app__need();
  return coalesce((select jsonb_agg(app__visit_json(v)) from visits v where v.biz_date between p_from and p_to), '[]'::jsonb);
end $$;

create or replace function public.app_booking_create(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u staff; cid text; kid text; bid text; i int := 0; n int; left_p int; k int; vid text; v_out jsonb := '[]'::jsonb; s settings;
begin
  u := app__need();
  perform pg_advisory_xact_lock(4242);
  perform app__check_booking(p, '{}', false);
  select * into s from settings where id = 1;
  cid := app__customer_upsert(p ->> 'name', p ->> 'phone', p ->> 'tiktok');
  insert into bookings (customer_id, biz_date, start_min, dur_min, people, channel, note, created_by)
  values (cid, (p ->> 'date')::date, (p ->> 'startMin')::int, (p ->> 'durMin')::int, greatest(1, coalesce((p ->> 'people')::int, 1)),
          coalesce(p ->> 'channel', 'tiktok'), coalesce(p ->> 'note', ''), u.name)
  returning id into kid;
  n := jsonb_array_length(p -> 'boxIds'); left_p := greatest(1, coalesce((p ->> 'people')::int, 1));
  for bid in select jsonb_array_elements_text(p -> 'boxIds') loop
    i := i + 1;
    k := case when i = n then greatest(1, left_p) else least(s.per_box, greatest(1, left_p - (n - i))) end;
    left_p := left_p - k;
    insert into visits (booking_id, box_id, customer_id, status, biz_date, start_min, dur_min, people)
    values (kid, bid, cid, 'dat', (p ->> 'date')::date, (p ->> 'startMin')::int, (p ->> 'durMin')::int, k) returning id into vid;
    perform app__log(vid, 'Đặt trước', n || ' box');
  end loop;
  select coalesce(jsonb_agg(app__visit_json(v)), '[]'::jsonb) into v_out from visits v where v.booking_id = kid;
  return jsonb_build_object('booking', (select jsonb_build_object('id', id, 'customerId', customer_id, 'date', biz_date, 'startMin', start_min, 'durMin', dur_min,
    'people', people, 'channel', channel, 'note', note, 'createdBy', created_by, 'createdAt', app__ms(created_at)) from bookings where id = kid), 'visits', v_out);
exception when exclusion_violation then
  raise exception 'TRUNG: Vừa có người đặt giờ này';
end $$;

create or replace function public.app_booking_update(p_id text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k bookings; open_ids text[]; same boolean; cid text; bid text; v visits; i int := 0; n int; left_p int; ppl int; s settings; v_out jsonb;
begin
  perform app__need();
  perform pg_advisory_xact_lock(4242);
  select * into k from bookings where id = p_id;
  if k.id is null then raise exception 'LOI: Không tìm thấy phiếu'; end if;
  select * into s from settings where id = 1;
  select coalesce(array_agg(id), '{}') into open_ids from visits where booking_id = p_id and status = 'dat';
  same := (p ->> 'date')::date = k.biz_date and (p ->> 'startMin')::int = k.start_min;
  perform app__check_booking(p, open_ids, same);
  cid := app__customer_upsert(p ->> 'name', p ->> 'phone', p ->> 'tiktok');
  update bookings set customer_id = cid, biz_date = (p ->> 'date')::date, start_min = (p ->> 'startMin')::int, dur_min = (p ->> 'durMin')::int,
    people = greatest(1, coalesce((p ->> 'people')::int, 1)), channel = coalesce(p ->> 'channel', channel), note = coalesce(p ->> 'note', '')
  where id = p_id;
  n := jsonb_array_length(p -> 'boxIds'); left_p := greatest(1, coalesce((p ->> 'people')::int, 1));
  -- Bỏ box không còn trong phiếu trước, để không vướng ràng buộc trùng
  for v in select * from visits where booking_id = p_id and status = 'dat' and not (box_id = any (select jsonb_array_elements_text(p -> 'boxIds'))) loop
    update visits set status = 'huy' where id = v.id; perform app__log(v.id, 'Bỏ box khỏi phiếu');
  end loop;
  for bid in select jsonb_array_elements_text(p -> 'boxIds') loop
    i := i + 1;
    ppl := case when i = n then greatest(1, left_p) else least(s.per_box, greatest(1, left_p - (n - i))) end;
    left_p := left_p - ppl;
    select * into v from visits where booking_id = p_id and status = 'dat' and box_id = bid limit 1;
    if v.id is null then
      insert into visits (booking_id, box_id, customer_id, status, biz_date, start_min, dur_min, people)
      values (p_id, bid, cid, 'dat', (p ->> 'date')::date, (p ->> 'startMin')::int, (p ->> 'durMin')::int, ppl) returning * into v;
      perform app__log(v.id, 'Thêm box vào phiếu');
    else
      update visits set customer_id = cid, biz_date = (p ->> 'date')::date, start_min = (p ->> 'startMin')::int, dur_min = (p ->> 'durMin')::int, people = ppl where id = v.id;
      perform app__log(v.id, 'Sửa phiếu');
    end if;
  end loop;
  select coalesce(jsonb_agg(app__visit_json(x)), '[]'::jsonb) into v_out from visits x where x.booking_id = p_id;
  return jsonb_build_object('booking', (select jsonb_build_object('id', id, 'customerId', customer_id, 'date', biz_date, 'startMin', start_min, 'durMin', dur_min,
    'people', people, 'channel', channel, 'note', note, 'createdBy', created_by, 'createdAt', app__ms(created_at)) from bookings where id = p_id), 'visits', v_out);
exception when exclusion_violation then
  raise exception 'TRUNG: Vừa có người đặt giờ này';
end $$;

create or replace function public.app_booking_cancel(p_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v visits;
begin
  perform app__need();
  for v in select * from visits where booking_id = p_id and status = 'dat' loop
    update visits set status = 'huy' where id = v.id; perform app__log(v.id, 'Huỷ phiếu');
  end loop;
  return true;
end $$;

create or replace function public.app_walk_in(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s settings; cid text; v visits; ph text := app__norm_phone(p ->> 'phone');
begin
  perform app__need();
  perform pg_advisory_xact_lock(4242);
  perform app__check_sit(p ->> 'boxId');
  select * into s from settings where id = 1;
  if length(ph) >= 10 then cid := app__customer_upsert(coalesce(nullif(trim(p ->> 'name'), ''), 'Khách'), ph, ''); end if;
  insert into visits (box_id, customer_id, guest_name, status, biz_date, dur_min, in_at, people)
  values (p ->> 'boxId', cid, case when cid is null then coalesce(trim(p ->> 'name'), '') else '' end, 'ngoi',
          (now() at time zone 'Asia/Ho_Chi_Minh')::date, s.free_min, now(), greatest(1, coalesce((p ->> 'people')::int, 1)))
  returning * into v;
  perform app__log(v.id, 'Khách vào (vãng lai)');
  return app__visit_json(v);
end $$;

create or replace function public.app_check_in(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v visits;
begin
  perform app__need();
  perform pg_advisory_xact_lock(4242);
  select * into v from visits where id = p_id;
  if v.id is null or v.status <> 'dat' then raise exception 'LOI: Lượt này không ở trạng thái Đã đặt'; end if;
  perform app__check_sit(v.box_id, v.id);
  update visits set status = 'ngoi', in_at = now() where id = p_id returning * into v;
  perform app__log(v.id, 'Khách vào');
  return app__visit_json(v);
end $$;

-- p_out_ms: giờ ra thật (ms) khi quên bấm, hôm sau mới bấm; bỏ trống = lúc này
drop function if exists public.app_check_out(text);
create or replace function public.app_check_out(p_id text, p_out_ms bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v visits; m int; o timestamptz;
begin
  perform app__need();
  select * into v from visits where id = p_id;
  if v.id is null or v.status <> 'ngoi' then raise exception 'LOI: Lượt này không đang ngồi'; end if;
  o := case when p_out_ms is null then now() else to_timestamp(p_out_ms / 1000.0) end;
  if o <= v.in_at then raise exception 'LOI: Giờ ra phải sau giờ vào'; end if;
  if o > now() + interval '1 minute' then raise exception 'LOI: Giờ ra chưa tới'; end if;
  m := floor(extract(epoch from (o - v.in_at)) / 60);
  update visits set status = 've', out_at = o, minutes = m, extra = app__extra(m) where id = p_id returning * into v;
  perform app__log(v.id, 'Khách về', 'Ngồi ' || (m / 60) || 'g' || lpad((m % 60)::text, 2, '0') || ' → thêm ' || v.extra || ' giờ');
  return jsonb_build_object('visit', app__visit_json(v), 'minutes', v.minutes, 'extra', v.extra);
end $$;

create or replace function public.app_no_show(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v visits;
begin
  perform app__need();
  select * into v from visits where id = p_id;
  if v.id is null or v.status <> 'dat' then raise exception 'LOI: Lượt này không ở trạng thái Đã đặt'; end if;
  update visits set status = 'vang' where id = p_id returning * into v;
  perform app__log(v.id, 'Không đến');
  return app__visit_json(v);
end $$;

create or replace function public.app_move_box(p_id text, p_box text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v visits; c visits; from_name text; to_name text;
begin
  perform app__need();
  perform pg_advisory_xact_lock(4242);
  select * into v from visits where id = p_id;
  if v.id is null then raise exception 'LOI: Không tìm thấy lượt'; end if;
  select name into to_name from boxes where id = p_box;
  if v.status = 'ngoi' then perform app__check_sit(p_box, v.id);
  elsif v.status = 'dat' then
    c := app__clash(p_box, v.hold, array[v.id]);
    if c.id is not null then raise exception 'TRUNG: % đã có người giữ giờ này', to_name; end if;
  else raise exception 'LOI: Lượt này đã xong'; end if;
  select name into from_name from boxes where id = v.box_id;
  update visits set box_id = p_box where id = p_id returning * into v;
  perform app__log(v.id, 'Đổi box', from_name || ' → ' || to_name);
  return app__visit_json(v);
exception when exclusion_violation then
  raise exception 'TRUNG: Vừa có người đặt giờ này';
end $$;

create or replace function public.app_edit_times(p_id text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v visits; m int;
begin
  perform app__need();
  select * into v from visits where id = p_id;
  if v.id is null then raise exception 'LOI: Không tìm thấy lượt'; end if;
  if v.status not in ('ngoi', 've') then raise exception 'LOI: Chỉ sửa giờ của lượt đã vào'; end if;
  if p ? 'inAt' and p ->> 'inAt' is not null then v.in_at := to_timestamp((p ->> 'inAt')::bigint / 1000.0); end if;
  if p ? 'outAt' and p ->> 'outAt' is not null then v.out_at := to_timestamp((p ->> 'outAt')::bigint / 1000.0); end if;
  if v.out_at is not null and v.in_at is not null and v.out_at <= v.in_at then raise exception 'LOI: Giờ ra phải sau giờ vào'; end if;
  if v.in_at > now() + interval '1 minute' or coalesce(v.out_at, now()) > now() + interval '1 minute' then raise exception 'LOI: Giờ này chưa tới'; end if;
  if v.status = 've' then m := floor(extract(epoch from (v.out_at - v.in_at)) / 60); v.minutes := m; v.extra := app__extra(m); end if;
  update visits set in_at = v.in_at, out_at = v.out_at, minutes = v.minutes, extra = v.extra where id = p_id returning * into v;
  perform app__log(v.id, 'Sửa giờ vào/ra', case when v.minutes is not null then 'Ngồi ' || (v.minutes / 60) || 'g' || lpad((v.minutes % 60)::text, 2, '0') || ' → thêm ' || v.extra || ' giờ' else '' end);
  return jsonb_build_object('visit', app__visit_json(v), 'minutes', v.minutes, 'extra', v.extra);
end $$;

create or replace function public.app_customers_find(p_q text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q text := app__fold(trim(coalesce(p_q, ''))); d text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g');
begin
  perform app__need();
  if length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'customer', jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'tiktok', c.tiktok),
      'visits', coalesce((select jsonb_agg(app__visit_json(v) order by coalesce(v.in_at, app__vn_ts(v.biz_date, coalesce(v.start_min, 0))) desc)
                          from visits v where v.customer_id = c.id), '[]'::jsonb),
      'visitsCount', (select count(*) from visits v where v.customer_id = c.id and v.status in ('ngoi', 've')),
      'noShows', (select count(*) from visits v where v.customer_id = c.id and v.status = 'vang'),
      'topBox', (select b.name from visits v join boxes b on b.id = v.box_id where v.customer_id = c.id and v.status in ('ngoi', 've')
                 group by b.name order by count(*) desc limit 1)))
    from (select * from customers c
          where app__fold(c.name) like '%' || q || '%' or (length(d) >= 3 and c.phone like '%' || d || '%')
             or (c.tiktok <> '' and app__fold(c.tiktok) like '%' || ltrim(q, '@') || '%')
          limit 20) c), '[]'::jsonb);
end $$;

-- Chỉ cho web (đã đăng nhập) gọi các hàm app_*
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'app\_%' and p.proname not like 'app\_\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
