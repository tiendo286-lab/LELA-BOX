-- Lela Box — bán hàng + kho (thay KiotViet). Chạy SAU 01_khoi_tao.sql. Chạy lại nhiều lần không sao.
-- Cùng quy tắc với bản chạy thử (docs/js/money.js, docs/js/store/local_ban.js). JSON trả về dùng khoá camelCase như bản chạy thử.
-- Lỗi: 'LOI: …' / 'QUYEN: …'. Riêng duyệt PIN sai trả {"__error": "QUYEN: …"} (không ném lỗi) để bộ đếm sai PIN không bị hoàn tác.

create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;

-- ===== Vai trò Quản lý + PIN =====
alter table public.staff drop constraint if exists staff_role_check;
alter table public.staff add constraint staff_role_check check (role in ('chu', 'ql', 'nv'));
alter table public.staff add column if not exists pin_hash text;

create table if not exists public.pin_guard (
  id int primary key check (id = 1),
  fails int not null default 0,
  lock_until timestamptz not null default '-infinity'
);
insert into public.pin_guard (id) values (1) on conflict (id) do nothing;

-- ===== Cài đặt thêm =====
alter table public.settings add column if not exists extra_price int not null default 20000;
alter table public.settings add column if not exists min_per_person int not null default 1;
alter table public.settings add column if not exists no_order_min int not null default 10;
alter table public.settings add column if not exists shop_name text not null default 'Lela Box';
alter table public.settings add column if not exists bill_footer text not null default 'Cảm ơn quý khách!';
alter table public.settings add column if not exists paper text not null default '80';

-- ===== Bảng =====
create table if not exists public.menu_items (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  grp text not null default 'Khác',
  price int not null check (price > 0),
  kind text not null default 'mon' check (kind in ('mon', 'combo')),
  active boolean not null default true,
  sort int not null default 0,
  serves int,
  slots jsonb
);

create table if not exists public.promotions (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  active boolean not null default true,
  kind text not null check (kind in ('pct', 'amt')),
  value int not null,
  scope jsonb not null default '"all"',
  days jsonb not null default '[1,2,3,4,5,6,7]',
  from_min int not null default 0,
  to_min int not null default 1440,
  from_date date,
  to_date date
);

create table if not exists public.vouchers (
  code text primary key,
  active boolean not null default true,
  kind text not null check (kind in ('pct', 'amt')),
  value int not null,
  max_uses int not null default 0,
  used int not null default 0,
  min_total int not null default 0,
  from_date date,
  to_date date
);

create table if not exists public.orders (
  id text primary key default gen_random_uuid()::text,
  visit_id text not null references public.visits (id),
  box_id text not null,
  status text not null default 'mo' check (status in ('mo', 'da_thu', 'huy')),
  lines jsonb not null default '[]',
  voucher_code text,
  manual jsonb,
  extra_hours int not null default 0,
  extra_price int not null default 0,
  priced jsonb,
  payments jsonb not null default '[]',
  change int not null default 0,
  paid_with text,
  opened_by text not null default '',
  opened_at timestamptz not null default now(),
  paid_by text,
  paid_at timestamptz,
  voided_by text,
  voided_at timestamptz,
  void_reason text not null default '',
  split_from text
);
create index if not exists orders_visit_idx on public.orders (visit_id);
create index if not exists orders_paid_idx on public.orders (paid_at);
create index if not exists orders_open_idx on public.orders (visit_id) where status = 'mo';

create table if not exists public.stock_items (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  unit text not null default 'cái',
  menu_item_id text references public.menu_items (id),
  active boolean not null default true
);

create table if not exists public.stock_moves (
  id bigserial primary key,
  stock_item_id text not null references public.stock_items (id),
  kind text not null check (kind in ('nhap', 'ban', 'hoan', 'dieu_chinh')),
  qty int not null,
  at timestamptz not null default now(),
  by_name text not null default '',
  note text not null default '',
  order_id text
);
create index if not exists stock_moves_item_idx on public.stock_moves (stock_item_id, at);

create table if not exists public.stock_counts (
  id text primary key default gen_random_uuid()::text,
  at timestamptz not null default now(),
  by_name text not null default '',
  note text not null default '',
  items jsonb not null default '[]'
);

create table if not exists public.approvals (
  id bigserial primary key,
  at timestamptz not null default now(),
  kind text not null,
  order_id text,
  amount int,
  pct int,
  item text,
  reason text not null default '',
  asked_by text not null default '',
  approved_by text not null default ''
);

alter table public.pin_guard enable row level security;
alter table public.menu_items enable row level security;
alter table public.promotions enable row level security;
alter table public.vouchers enable row level security;
alter table public.orders enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_moves enable row level security;
alter table public.stock_counts enable row level security;
alter table public.approvals enable row level security;
revoke all on public.pin_guard, public.menu_items, public.promotions, public.vouchers, public.orders,
  public.stock_items, public.stock_moves, public.stock_counts, public.approvals from anon, authenticated;
revoke all on sequence public.stock_moves_id_seq, public.approvals_id_seq from anon, authenticated;

-- ===== Hàm nội bộ =====
create or replace function public.app__need_boss() returns public.staff
language plpgsql stable security definer set search_path = public as $$
declare u staff;
begin
  u := app__need();
  if coalesce(u.role, '') not in ('chu', 'ql') then raise exception 'QUYEN: Chỉ Quản lý / Chủ được làm việc này'; end if;
  return u;
end $$;

create or replace function public.app__fmt_money(n bigint) returns text
language sql immutable as $$
  select case when n < 0 then '-' else '' end || regexp_replace(abs(n)::text, '(\d)(?=(\d{3})+$)', '\1.', 'g') || 'đ'
$$;

create or replace function public.app__vn_date(t timestamptz) returns date
language sql immutable as $$ select (t at time zone 'Asia/Ho_Chi_Minh')::date $$;

create or replace function public.app__settings_json() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('open', to_char(open, 'HH24:MI'), 'close', to_char(close, 'HH24:MI'), 'holdMin', hold_min, 'freeMin', free_min,
    'graceMin', grace_min, 'lateMin', late_min, 'perBox', per_box,
    'extraPrice', extra_price, 'minPerPerson', min_per_person, 'noOrderMin', no_order_min, 'shopName', shop_name, 'billFooter', bill_footer, 'paper', paper)
  from settings where id = 1
$$;

-- Lưu cài đặt: web có thể gửi một phần (vd chỉ phần bán hàng) → ghép với cài đặt hiện có rồi kiểm
create or replace function public.app_settings_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  perform app__need('chu');
  m := app__settings_json() || coalesce(p, '{}'::jsonb);
  if extract(minute from (m ->> 'open')::time) not in (0, 30) or extract(minute from (m ->> 'close')::time) not in (0, 30) then
    raise exception 'LOI: Giờ mở / đóng cửa phải tròn giờ hoặc rưỡi (vd 08:00, 08:30)';
  end if;
  if (m ->> 'close')::time <= (m ->> 'open')::time then raise exception 'LOI: Giờ đóng cửa phải sau giờ mở cửa'; end if;
  if (m ->> 'perBox')::int < 1 or (m ->> 'freeMin')::int < 30 or (m ->> 'holdMin')::int < 30 then raise exception 'LOI: Số chưa hợp lệ'; end if;
  if (m ->> 'extraPrice') !~ '^\d+$' or (m ->> 'minPerPerson')::numeric not between 0 and 5 or (m ->> 'noOrderMin')::numeric < 0
     or coalesce(m ->> 'paper', '') not in ('58', '80') then raise exception 'LOI: Số chưa hợp lệ'; end if;
  update settings set open = (m ->> 'open')::time, close = (m ->> 'close')::time, hold_min = (m ->> 'holdMin')::int,
    free_min = (m ->> 'freeMin')::int, grace_min = (m ->> 'graceMin')::int, late_min = (m ->> 'lateMin')::int, per_box = (m ->> 'perBox')::int,
    extra_price = (m ->> 'extraPrice')::int, min_per_person = (m ->> 'minPerPerson')::int, no_order_min = (m ->> 'noOrderMin')::int,
    shop_name = coalesce(nullif(trim(m ->> 'shopName'), ''), 'Lela Box'), bill_footer = coalesce(trim(m ->> 'billFooter'), ''), paper = m ->> 'paper'
  where id = 1;
  return app__settings_json();
end $$;

-- Nhân viên: thêm vai trò Quản lý
create or replace function public.app_staff_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform app__need('chu');
  if coalesce(trim(p ->> 'name'), '') = '' then raise exception 'LOI: Nhập tên nhân viên'; end if;
  if coalesce(p ->> 'role', '') not in ('chu', 'ql', 'nv') then raise exception 'LOI: Chọn vai trò'; end if;
  if coalesce(trim(p ->> 'email'), '') = '' then raise exception 'LOI: Nhập email đăng nhập'; end if;
  if coalesce(p ->> 'id', '') <> '' and exists (select 1 from staff where id = p ->> 'id') then
    update staff set name = trim(p ->> 'name'), role = p ->> 'role', email = lower(trim(p ->> 'email')) where id = p ->> 'id';
  else
    insert into staff (name, role, email) values (trim(p ->> 'name'), p ->> 'role', lower(trim(p ->> 'email')));
  end if;
  return app_staff_list();
end $$;

create or replace function public.app__menu_json(m public.menu_items) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', m.id, 'name', m.name, 'group', m.grp, 'price', m.price, 'kind', m.kind, 'active', m.active, 'sort', m.sort)
    || case when m.kind = 'combo' then jsonb_build_object('serves', coalesce(m.serves, 1), 'slots', coalesce(m.slots, '[]'::jsonb)) else '{}'::jsonb end
$$;

create or replace function public.app__promo_json(p public.promotions) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'active', p.active, 'kind', p.kind, 'value', p.value, 'scope', p.scope, 'days', p.days,
    'fromMin', p.from_min, 'toMin', p.to_min, 'fromDate', coalesce(p.from_date::text, ''), 'toDate', coalesce(p.to_date::text, ''))
$$;

create or replace function public.app__voucher_json(v public.vouchers) returns jsonb
language sql immutable as $$
  select jsonb_build_object('code', v.code, 'active', v.active, 'kind', v.kind, 'value', v.value, 'maxUses', v.max_uses, 'used', v.used,
    'minTotal', v.min_total, 'fromDate', coalesce(v.from_date::text, ''), 'toDate', coalesce(v.to_date::text, ''))
$$;

create or replace function public.app__order_json(o public.orders) returns jsonb
language sql immutable as $$
  select jsonb_build_object('id', o.id, 'visitId', o.visit_id, 'boxId', o.box_id, 'status', o.status, 'lines', o.lines, 'voucherCode', o.voucher_code,
    'manual', o.manual, 'extraHours', o.extra_hours, 'extraPrice', o.extra_price, 'priced', o.priced, 'payments', o.payments, 'change', o.change,
    'paidWith', o.paid_with, 'openedBy', o.opened_by, 'openedAt', app__ms(o.opened_at), 'paidBy', o.paid_by, 'paidAt', app__ms(o.paid_at),
    'voidedBy', o.voided_by, 'voidedAt', app__ms(o.voided_at), 'voidReason', o.void_reason, 'splitFrom', o.split_from)
$$;

-- Dòng còn hiệu lực (chưa huỷ)
create or replace function public.app__live_lines(p_lines jsonb) returns setof jsonb
language sql immutable as $$
  select l from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) l where l -> 'voided' is null or jsonb_typeof(l -> 'voided') = 'null'
$$;

create or replace function public.app__goods(p_lines jsonb) returns bigint
language sql immutable as $$ select coalesce(sum((l ->> 'price')::bigint * (l ->> 'qty')::bigint), 0) from app__live_lines(p_lines) l $$;

-- Giảm: % làm tròn xuống, số tiền không vượt nền, nền ≤ 0 → 0
create or replace function public.app__cut(p_kind text, p_value numeric, p_base bigint) returns bigint
language sql immutable as $$
  select case when p_base <= 0 then 0
    else greatest(0, least(p_base, case when p_kind = 'pct' then floor(p_base * coalesce(p_value, 0) / 100) else floor(coalesce(p_value, 0)) end))::bigint end
$$;

create or replace function public.app__promo_active(p public.promotions, t timestamptz) returns boolean
language sql immutable as $$
  select p.active
    and (p.from_date is null or app__vn_date(t) >= p.from_date)
    and (p.to_date is null or app__vn_date(t) <= p.to_date)
    and (jsonb_array_length(coalesce(p.days, '[]'::jsonb)) = 0 or p.days @> to_jsonb(extract(isodow from (t at time zone 'Asia/Ho_Chi_Minh'))::int))
    and (extract(hour from (t at time zone 'Asia/Ho_Chi_Minh')) * 60 + extract(minute from (t at time zone 'Asia/Ho_Chi_Minh'))) >= p.from_min
    and (extract(hour from (t at time zone 'Asia/Ho_Chi_Minh')) * 60 + extract(minute from (t at time zone 'Asia/Ho_Chi_Minh'))) < p.to_min
$$;

create or replace function public.app__voucher_error(v public.vouchers, p_goods bigint, t timestamptz) returns text
language sql immutable as $$
  select case
    when v.code is null or not v.active then 'Mã không đúng hoặc đã tắt'
    when v.from_date is not null and app__vn_date(t) < v.from_date then 'Mã chưa tới ngày dùng'
    when v.to_date is not null and app__vn_date(t) > v.to_date then 'Mã đã hết hạn'
    when v.max_uses > 0 and v.used >= v.max_uses then 'Mã đã dùng hết lượt'
    when v.min_total > p_goods then 'Hoá đơn tối thiểu ' || app__fmt_money(v.min_total)
    else null end
$$;

-- Tính tiền một phiếu (giống priceOrder ở docs/js/money.js). Chỉ 1 khuyến mãi: tự động hoặc voucher, lấy cái giảm nhiều hơn (bằng nhau → voucher).
create or replace function public.app__price(p_lines jsonb, p_extra_hours int, p_extra_price int, p_manual jsonb, p_voucher text, p_at timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  goods bigint := app__goods(p_lines);
  combo bigint; mon bigint; base bigint; amt bigint;
  best jsonb := null; pr promotions; v vouchers; verr text := null;
  extra bigint := greatest(0, coalesce(p_extra_hours, 0))::bigint * greatest(0, coalesce(p_extra_price, 0));
  before bigint; manual bigint := 0;
begin
  select coalesce(sum((l ->> 'price')::bigint * (l ->> 'qty')::bigint), 0) into combo from app__live_lines(p_lines) l where l ->> 'kind' = 'combo';
  mon := goods - combo;
  for pr in select * from promotions loop
    if not app__promo_active(pr, p_at) then continue; end if;
    select coalesce(sum((l ->> 'price')::bigint * (l ->> 'qty')::bigint), 0) into base from app__live_lines(p_lines) l
      where l ->> 'kind' <> 'combo' and (pr.scope = '"all"'::jsonb or jsonb_typeof(pr.scope) <> 'array' or pr.scope ? (l ->> 'group'));
    amt := app__cut(pr.kind, pr.value, base);
    if amt > 0 and (best is null or amt > (best ->> 'amount')::bigint) then
      best := jsonb_build_object('source', 'tu_dong', 'id', pr.id, 'name', pr.name, 'amount', amt);
    end if;
  end loop;
  if coalesce(trim(p_voucher), '') <> '' then
    select * into v from vouchers where code = upper(trim(p_voucher));
    verr := app__voucher_error(v, goods, p_at);
    if verr is null then
      amt := app__cut(v.kind, v.value, mon);
      if amt > 0 and (best is null or amt >= (best ->> 'amount')::bigint) then
        best := jsonb_build_object('source', 'voucher', 'id', v.code, 'name', 'Mã ' || v.code, 'amount', amt);
      end if;
    end if;
  end if;
  before := goods + extra - coalesce((best ->> 'amount')::bigint, 0);
  if p_manual is not null and jsonb_typeof(p_manual) = 'object' then manual := app__cut(p_manual ->> 'kind', (p_manual ->> 'value')::numeric, before); end if;
  return jsonb_build_object('goods', goods, 'comboTotal', combo, 'monEligible', mon, 'extraAmount', extra, 'promo', best,
    'voucherError', verr, 'manualAmount', manual, 'total', greatest(0, before - manual));
end $$;

-- Duyệt việc cần quản lý. QL/Chủ tự làm → chỉ cần lý do. Nhân viên → PIN của một QL/Chủ. Sai 5 lần liên tiếp → khoá 5 phút.
-- Trả {"ok": true, "by": tên} hoặc {"error": "QUYEN: …"} (KHÔNG ném lỗi, để bộ đếm sai được lưu).
create or replace function public.app__approve(p_auth jsonb, p_kind text, p_extra jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  u staff := app__need();
  g pin_guard; ap text := null;
  pin text := nullif(trim(coalesce(p_auth ->> 'pin', '')), '');
  rs text := trim(coalesce(p_auth ->> 'reason', ''));
begin
  if coalesce(u.role, '') in ('chu', 'ql') then ap := u.name;
  else
    select * into g from pin_guard where id = 1 for update;
    if g.lock_until > now() then return jsonb_build_object('error', 'QUYEN: Sai PIN quá 5 lần — chờ 5 phút'); end if;
    if pin is not null then
      select s.name into ap from staff s where s.role in ('chu', 'ql') and s.pin_hash is not null and s.pin_hash = extensions.crypt(pin, s.pin_hash)
      order by s.created_at limit 1;
    end if;
    if ap is null then
      if pin is not null then
        update pin_guard set lock_until = case when fails + 1 >= 5 then now() + interval '5 minutes' else lock_until end,
                             fails = case when fails + 1 >= 5 then 0 else fails + 1 end where id = 1;
      end if;
      return jsonb_build_object('error', case when pin is null then 'QUYEN: Cần quản lý nhập PIN' else 'QUYEN: PIN không đúng' end);
    end if;
    update pin_guard set fails = 0 where id = 1;
  end if;
  if rs = '' then raise exception 'LOI: Ghi lý do'; end if;
  insert into approvals (kind, order_id, amount, pct, item, reason, asked_by, approved_by)
  values (p_kind, p_extra ->> 'orderId', (p_extra ->> 'amount')::int, (p_extra ->> 'pct')::int, p_extra ->> 'item', rs, u.name, ap);
  return jsonb_build_object('ok', true, 'by', ap);
end $$;

create or replace function public.app__order_open(p_id text) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = p_id for update;
  if o.id is null then raise exception 'LOI: Không tìm thấy phiếu'; end if;
  if o.status = 'da_thu' then raise exception 'LOI: Phiếu đã thu'; end if;
  if o.status <> 'mo' then raise exception 'LOI: Phiếu đã đóng'; end if;
  return o;
end $$;

-- Khách về (dùng khi thu tiền xong). p_out null = lúc này.
create or replace function public.app__checkout_visit(p_id text, p_out timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare v visits; o timestamptz; m int;
begin
  select * into v from visits where id = p_id;
  if v.id is null or v.status <> 'ngoi' then return; end if;
  o := coalesce(p_out, greatest(now(), v.in_at));
  m := floor(extract(epoch from (o - v.in_at)) / 60);
  update visits set status = 've', out_at = o, minutes = m, extra = app__extra(m) where id = p_id returning * into v;
  perform app__log(v.id, 'Khách về', 'Ngồi ' || (m / 60) || 'g' || lpad((m % 60)::text, 2, '0') || ' → thêm ' || v.extra || ' giờ');
end $$;

-- Số liệu phiếu của các lượt đang ngồi (ô box + nhắc chưa gọi món)
create or replace function public.app__order_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(v.id, jsonb_build_object(
    'total', coalesce((select sum(app__goods(o.lines)) from orders o where o.visit_id = v.id and o.status = 'mo'), 0),
    'have', coalesce((select sum(case when l ->> 'kind' = 'combo' then coalesce((l ->> 'serves')::int, 1) * (l ->> 'qty')::int else (l ->> 'qty')::int end)
                      from orders o, app__live_lines(o.lines) l where o.visit_id = v.id and o.status <> 'huy'), 0),
    'need', v.people * (select min_per_person from settings where id = 1),
    'firstAt', (select min((l ->> 'at')::bigint) from orders o, jsonb_array_elements(o.lines) l where o.visit_id = v.id and o.status <> 'huy'))), '{}'::jsonb)
  from visits v where v.status = 'ngoi'
$$;

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
    'visits', vs,
    'orderStats', app__order_stats());
end $$;

-- ===== PIN =====
create or replace function public.app_pin_set(p_pin text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare u staff := app__need_boss();
begin
  if coalesce(p_pin, '') !~ '^\d{4,6}$' then raise exception 'LOI: PIN gồm 4–6 chữ số'; end if;
  update staff set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')) where id = u.id;
  return true;
end $$;

-- ===== Menu, khuyến mãi, voucher =====
create or replace function public.app_menu_list(p_all boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform app__need();
  return coalesce((select jsonb_agg(app__menu_json(m) order by m.sort, m.name) from menu_items m where p_all or m.active), '[]'::jsonb);
end $$;

create or replace function public.app_menu_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare nm text := trim(coalesce(p ->> 'name', '')); pr int := coalesce(nullif(p ->> 'price', '')::numeric, 0)::int;
  kd text := case when p ->> 'kind' = 'combo' then 'combo' else 'mon' end; sl jsonb;
begin
  perform app__need('chu');
  if nm = '' then raise exception 'LOI: Nhập tên món'; end if;
  if pr <= 0 then raise exception 'LOI: Giá phải lớn hơn 0'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('label', coalesce(nullif(trim(x ->> 'label'), ''), 'Chọn món'), 'count', greatest(1, coalesce((x ->> 'count')::int, 1)), 'groups', x -> 'groups')), '[]'::jsonb)
    into sl from jsonb_array_elements(coalesce(p -> 'slots', '[]'::jsonb)) x
    where jsonb_typeof(x -> 'groups') = 'array' and jsonb_array_length(x -> 'groups') > 0;
  if kd = 'combo' and jsonb_array_length(sl) = 0 then raise exception 'LOI: Combo cần ít nhất 1 ô chọn món'; end if;
  if coalesce(p ->> 'id', '') <> '' and exists (select 1 from menu_items where id = p ->> 'id') then
    update menu_items set name = nm, grp = coalesce(nullif(trim(p ->> 'group'), ''), 'Khác'), price = pr, kind = kd, active = coalesce((p ->> 'active')::boolean, true),
      serves = case when kd = 'combo' then greatest(1, coalesce((p ->> 'serves')::int, 1)) end, slots = case when kd = 'combo' then sl end
    where id = p ->> 'id';
  else
    insert into menu_items (name, grp, price, kind, active, sort, serves, slots)
    values (nm, coalesce(nullif(trim(p ->> 'group'), ''), 'Khác'), pr, kd, coalesce((p ->> 'active')::boolean, true), (select coalesce(max(sort), 0) + 1 from menu_items),
      case when kd = 'combo' then greatest(1, coalesce((p ->> 'serves')::int, 1)) end, case when kd = 'combo' then sl end);
  end if;
  return app_menu_list(true);
end $$;

create or replace function public.app_menu_import(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; nm text; pr int; mid text; added int := 0; updated int := 0;
begin
  perform app__need('chu');
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    nm := trim(coalesce(it ->> 'name', '')); pr := coalesce(nullif(regexp_replace(coalesce(it ->> 'price', ''), '\D', '', 'g'), '')::bigint, 0)::int;
    if nm = '' or pr <= 0 then continue; end if;
    select id into mid from menu_items where app__fold(name) = app__fold(nm) limit 1;
    if mid is not null then
      update menu_items set price = pr, grp = coalesce(nullif(trim(it ->> 'group'), ''), grp) where id = mid; updated := updated + 1;
    else
      insert into menu_items (name, grp, price, sort) values (nm, coalesce(nullif(trim(it ->> 'group'), ''), 'Khác'), pr, (select coalesce(max(sort), 0) + 1 from menu_items));
      added := added + 1;
    end if;
    mid := null;
  end loop;
  return jsonb_build_object('added', added, 'updated', updated);
end $$;

create or replace function public.app_promo_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin perform app__need(); return coalesce((select jsonb_agg(app__promo_json(p) order by p.name) from promotions p), '[]'::jsonb); end $$;

create or replace function public.app_promo_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare val int := coalesce(nullif(p ->> 'value', '')::numeric, 0)::int; fm int := coalesce((p ->> 'fromMin')::int, 0); tm int := coalesce((p ->> 'toMin')::int, 1440);
  sc jsonb := case when jsonb_typeof(p -> 'scope') = 'array' and jsonb_array_length(p -> 'scope') > 0 then p -> 'scope' else '"all"'::jsonb end;
  ds jsonb := coalesce((select jsonb_agg(d::int) from jsonb_array_elements_text(coalesce(p -> 'days', '[]'::jsonb)) d where d ~ '^[1-7]$'), '[]'::jsonb);
begin
  perform app__need('chu');
  if coalesce(trim(p ->> 'name'), '') = '' then raise exception 'LOI: Nhập tên khuyến mãi'; end if;
  if coalesce(p ->> 'kind', '') not in ('pct', 'amt') or val <= 0 or (p ->> 'kind' = 'pct' and val > 100) then raise exception 'LOI: Mức giảm chưa đúng'; end if;
  if tm <= fm then raise exception 'LOI: Giờ kết thúc phải sau giờ bắt đầu'; end if;
  if coalesce(p ->> 'id', '') <> '' and exists (select 1 from promotions where id = p ->> 'id') then
    update promotions set name = trim(p ->> 'name'), active = coalesce((p ->> 'active')::boolean, true), kind = p ->> 'kind', value = val, scope = sc, days = ds,
      from_min = fm, to_min = tm, from_date = nullif(p ->> 'fromDate', '')::date, to_date = nullif(p ->> 'toDate', '')::date where id = p ->> 'id';
  else
    insert into promotions (name, active, kind, value, scope, days, from_min, to_min, from_date, to_date)
    values (trim(p ->> 'name'), coalesce((p ->> 'active')::boolean, true), p ->> 'kind', val, sc, ds, fm, tm, nullif(p ->> 'fromDate', '')::date, nullif(p ->> 'toDate', '')::date);
  end if;
  return app_promo_list();
end $$;

create or replace function public.app_voucher_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin perform app__need(); return coalesce((select jsonb_agg(app__voucher_json(v) order by v.code) from vouchers v), '[]'::jsonb); end $$;

create or replace function public.app_voucher_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cd text := upper(regexp_replace(coalesce(p ->> 'code', ''), '\s+', '', 'g')); val int := coalesce(nullif(p ->> 'value', '')::numeric, 0)::int;
begin
  perform app__need('chu');
  if cd !~ '^[A-Z0-9_-]{3,20}$' then raise exception 'LOI: Mã gồm 3–20 chữ / số, không dấu'; end if;
  if coalesce(p ->> 'kind', '') not in ('pct', 'amt') or val <= 0 or (p ->> 'kind' = 'pct' and val > 100) then raise exception 'LOI: Mức giảm chưa đúng'; end if;
  if exists (select 1 from vouchers where code = cd) then
    if not coalesce((p ->> 'editing')::boolean, false) then raise exception 'LOI: Mã này đã có'; end if;
    update vouchers set active = coalesce((p ->> 'active')::boolean, true), kind = p ->> 'kind', value = val, max_uses = greatest(0, coalesce((p ->> 'maxUses')::int, 0)),
      min_total = greatest(0, coalesce((p ->> 'minTotal')::int, 0)), from_date = nullif(p ->> 'fromDate', '')::date, to_date = nullif(p ->> 'toDate', '')::date where code = cd;
  else
    insert into vouchers (code, active, kind, value, max_uses, min_total, from_date, to_date)
    values (cd, coalesce((p ->> 'active')::boolean, true), p ->> 'kind', val, greatest(0, coalesce((p ->> 'maxUses')::int, 0)), greatest(0, coalesce((p ->> 'minTotal')::int, 0)),
      nullif(p ->> 'fromDate', '')::date, nullif(p ->> 'toDate', '')::date);
  end if;
  return app_voucher_list();
end $$;

-- ===== Phiếu =====
create or replace function public.app_orders_of_visit(p_visit text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u staff := app__need(); v visits;
begin
  perform pg_advisory_xact_lock(4242);
  select * into v from visits where id = p_visit;
  if v.id is null then raise exception 'LOI: Không tìm thấy lượt'; end if;
  if v.status = 'ngoi' and not exists (select 1 from orders where visit_id = v.id and status = 'mo') then
    insert into orders (visit_id, box_id, opened_by) values (v.id, v.box_id, u.name);
  end if;
  return coalesce((select jsonb_agg(app__order_json(o) order by o.opened_at, o.id) from orders o where o.visit_id = v.id), '[]'::jsonb);
end $$;

create or replace function public.app_order_add(p_id text, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u staff := app__need(); o orders; it jsonb; m menu_items; q int; picks jsonb; slot jsonb; i int; k int;
  rest jsonb; pk jsonb; pm menu_items; found boolean; total int; add jsonb := '[]'::jsonb;
begin
  perform pg_advisory_xact_lock(4242);
  o := app__order_open(p_id);
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    select * into m from menu_items where id = it ->> 'menuItemId' and active;
    if m.id is null then raise exception 'LOI: Món không còn bán'; end if;
    q := coalesce((it ->> 'qty')::int, 0);
    if q < 1 then raise exception 'LOI: Số lượng phải từ 1'; end if;
    picks := '[]'::jsonb;
    if m.kind = 'combo' then
      -- Ghép món đã chọn vào từng ô: mỗi ô lấy đủ "count" món thuộc nhóm của ô
      rest := coalesce(it -> 'picks', '[]'::jsonb);
      select coalesce(sum((s ->> 'count')::int), 0) into total from jsonb_array_elements(coalesce(m.slots, '[]'::jsonb)) s;
      if jsonb_array_length(rest) <> total then raise exception 'LOI: Chọn đủ món cho combo'; end if;
      for slot in select * from jsonb_array_elements(m.slots) loop
        for i in 1 .. (slot ->> 'count')::int loop
          found := false;
          for k in 0 .. jsonb_array_length(rest) - 1 loop
            pk := rest -> k;
            select * into pm from menu_items where id = pk ->> 'menuItemId';
            if pm.id is not null and pm.kind <> 'combo' and (slot -> 'groups') ? pm.grp then
              picks := picks || jsonb_build_array(jsonb_build_object('menuItemId', pm.id, 'name', pm.name));
              rest := rest - k; found := true; exit;
            end if;
          end loop;
          if not found then raise exception 'LOI: Chọn đủ món cho combo'; end if;
        end loop;
      end loop;
    end if;
    add := add || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'menuItemId', m.id, 'kind', m.kind, 'group', m.grp, 'name', m.name,
      'price', m.price, 'qty', q, 'note', coalesce(trim(it ->> 'note'), ''), 'picks', picks, 'sentAt', null, 'voided', null, 'addedBy', u.name, 'at', app__ms(now()))
      || case when m.kind = 'combo' then jsonb_build_object('serves', coalesce(m.serves, 1)) else '{}'::jsonb end);
  end loop;
  update orders set lines = lines || add where id = o.id returning * into o;
  return app__order_json(o);
end $$;

create or replace function public.app_order_line_qty(p_id text, p_line text, p_qty int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders; idx int; l jsonb;
begin
  perform app__need();
  perform pg_advisory_xact_lock(4242);
  o := app__order_open(p_id);
  select (e.n - 1)::int, e.x into idx, l from jsonb_array_elements(o.lines) with ordinality e(x, n) where e.x ->> 'id' = p_line;
  if l is null then raise exception 'LOI: Không tìm thấy món'; end if;
  if jsonb_typeof(l -> 'sentAt') = 'number' or jsonb_typeof(l -> 'voided') = 'object' then raise exception 'LOI: Món đã gửi pha chế — huỷ món thay vì sửa'; end if;
  if coalesce(p_qty, 0) < 1 then raise exception 'LOI: Số lượng phải từ 1'; end if;
  update orders set lines = jsonb_set(lines, array[idx::text, 'qty'], to_jsonb(p_qty)) where id = o.id returning * into o;
  return app__order_json(o);
end $$;

create or replace function public.app_order_remove_line(p_id text, p_line text, p_auth jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders; idx int; l jsonb; a jsonb;
begin
  perform app__need();
  perform pg_advisory_xact_lock(4242);
  o := app__order_open(p_id);
  select (e.n - 1)::int, e.x into idx, l from jsonb_array_elements(o.lines) with ordinality e(x, n) where e.x ->> 'id' = p_line;
  if l is null then raise exception 'LOI: Không tìm thấy món'; end if;
  if jsonb_typeof(l -> 'voided') = 'object' then raise exception 'LOI: Món này đã huỷ'; end if;
  if jsonb_typeof(l -> 'sentAt') is distinct from 'number' then
    update orders set lines = lines - idx where id = o.id returning * into o;
  else
    a := app__approve(p_auth, 'huy_mon', jsonb_build_object('orderId', o.id, 'amount', (l ->> 'price')::int * (l ->> 'qty')::int, 'item', l ->> 'name'));
    if a ? 'error' then return jsonb_build_object('__error', a ->> 'error'); end if;
    update orders set lines = jsonb_set(lines, array[idx::text, 'voided'],
      jsonb_build_object('by', a ->> 'by', 'reason', trim(coalesce(p_auth ->> 'reason', '')), 'at', app__ms(now()))) where id = o.id returning * into o;
  end if;
  return app__order_json(o);
end $$;

create or replace function public.app_order_send(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u staff := app__need(); o orders; fresh jsonb; again boolean; t bigint := app__ms(now()); bn text;
begin
  perform pg_advisory_xact_lock(4242);
  o := app__order_open(p_id);
  select coalesce(jsonb_agg(l), '[]'::jsonb) into fresh from jsonb_array_elements(o.lines) l
    where jsonb_typeof(l -> 'sentAt') is distinct from 'number' and jsonb_typeof(l -> 'voided') is distinct from 'object';
  if jsonb_array_length(fresh) = 0 then raise exception 'LOI: Không có món mới để gửi'; end if;
  select exists (select 1 from jsonb_array_elements(o.lines) l where jsonb_typeof(l -> 'sentAt') = 'number') into again;
  update orders set lines = (select jsonb_agg(case when jsonb_typeof(l -> 'sentAt') is distinct from 'number' and jsonb_typeof(l -> 'voided') is distinct from 'object'
                                                   then jsonb_set(l, '{sentAt}', to_jsonb(t)) else l end order by n)
                             from jsonb_array_elements(o.lines) with ordinality e(l, n))
  where id = o.id returning * into o;
  select b.name into bn from visits v join boxes b on b.id = v.box_id where v.id = o.visit_id;
  return jsonb_build_object('order', app__order_json(o), 'ticket', jsonb_build_object('boxName', bn, 'at', t, 'again', again, 'by', u.name,
    'lines', (select jsonb_agg(jsonb_build_object('name', l ->> 'name', 'qty', (l ->> 'qty')::int, 'note', coalesce(l ->> 'note', ''),
              'picks', coalesce((select jsonb_agg(p ->> 'name') from jsonb_array_elements(coalesce(l -> 'picks', '[]'::jsonb)) p), '[]'::jsonb))) from jsonb_array_elements(fresh) l)));
end $$;

create or replace function public.app_order_split(p_id text, p_lines jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u staff := app__need(); o orders; mv jsonb; keep jsonb; n orders;
begin
  perform pg_advisory_xact_lock(4242);
  o := app__order_open(p_id);
  select coalesce(jsonb_agg(l order by e.i), '[]'::jsonb) into mv from jsonb_array_elements(o.lines) with ordinality e(l, i) where coalesce(p_lines, '[]'::jsonb) ? (l ->> 'id');
  if jsonb_array_length(mv) = 0 then raise exception 'LOI: Chọn món để tách'; end if;
  select coalesce(jsonb_agg(l order by e.i), '[]'::jsonb) into keep from jsonb_array_elements(o.lines) with ordinality e(l, i) where not (coalesce(p_lines, '[]'::jsonb) ? (l ->> 'id'));
  update orders set lines = keep where id = o.id;
  insert into orders (visit_id, box_id, lines, opened_by, split_from) values (o.visit_id, o.box_id, mv, u.name, o.id) returning * into n;
  return app__order_json(n);
end $$;

create or replace function public.app_order_voucher(p_id text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders; v vouchers; e text;
begin
  perform app__need();
  perform pg_advisory_xact_lock(4242);
  o := app__order_open(p_id);
  if coalesce(trim(p_code), '') = '' then
    update orders set voucher_code = null where id = o.id returning * into o;
    return app__order_json(o);
  end if;
  select * into v from vouchers where code = upper(trim(p_code));
  e := app__voucher_error(v, app__goods(o.lines), now());
  if e is not null then raise exception 'LOI: %', e; end if;
  update orders set voucher_code = v.code where id = o.id returning * into o;
  return app__order_json(o);
end $$;

create or replace function public.app_order_manual(p_id text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders; val int; a jsonb;
begin
  perform app__need();
  perform pg_advisory_xact_lock(4242);
  o := app__order_open(p_id);
  if p is null or jsonb_typeof(p) <> 'object' then
    update orders set manual = null where id = o.id returning * into o;
    return app__order_json(o);
  end if;
  val := coalesce(nullif(p ->> 'value', '')::numeric, 0)::int;
  if coalesce(p ->> 'kind', '') not in ('pct', 'amt') or val <= 0 or (p ->> 'kind' = 'pct' and val > 100) then raise exception 'LOI: Mức giảm chưa đúng'; end if;
  a := app__approve(p, 'giam_tay', jsonb_build_object('orderId', o.id, 'amount', case when p ->> 'kind' = 'amt' then val end, 'pct', case when p ->> 'kind' = 'pct' then val end));
  if a ? 'error' then return jsonb_build_object('__error', a ->> 'error'); end if;
  update orders set manual = jsonb_build_object('kind', p ->> 'kind', 'value', val, 'approvedBy', a ->> 'by', 'reason', trim(coalesce(p ->> 'reason', '')))
  where id = o.id returning * into o;
  return app__order_json(o);
end $$;

-- Tính tiền các phiếu sẽ thu cùng lúc (khoá các phiếu). Lượt nào thu hết phiếu mở thì phiếu cuối mang giờ ngồi thêm.
create or replace function public.app__quote(p_ids jsonb, p_out_ms bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s settings; ids text[]; o orders; v visits; t_out timestamptz; rows jsonb := '[]'::jsonb; total bigint := 0;
  is_last boolean; mins int; eh int; pr jsonb; warns text[] := '{}'; have int; vids text[]; oid_ text;
begin
  select * into s from settings where id = 1;
  select array_agg(x order by n) into ids from (select x, min(n) n from jsonb_array_elements_text(coalesce(p_ids, '[]'::jsonb)) with ordinality e(x, n) group by x) d;
  if ids is null or array_length(ids, 1) = 0 then raise exception 'LOI: Chọn phiếu để thu'; end if;
  foreach oid_ in array ids loop perform app__order_open(oid_); end loop;
  select array_agg(visit_id order by fn) into vids from (select visit_id, min(array_position(ids, id)) fn from orders where id = any (ids) group by visit_id) d;
  if p_out_ms is null then
    select greatest(now(), max(in_at)) into t_out from visits where id = any (vids);
  else
    t_out := to_timestamp(p_out_ms / 1000.0);
    for v in select * from visits where id = any (vids) and status = 'ngoi' loop
      if t_out <= v.in_at then raise exception 'LOI: Giờ ra phải sau giờ vào'; end if;
    end loop;
  end if;
  if t_out > now() + interval '1 minute' then raise exception 'LOI: Giờ ra chưa tới'; end if;
  for o in select * from orders where id = any (ids) order by array_position(ids, id) loop
    select * into v from visits where id = o.visit_id;
    -- phiếu cuối: mọi phiếu mở của lượt đều nằm trong lần thu này, và đây là phiếu cuối cùng của lượt trong danh sách
    is_last := not exists (select 1 from orders x where x.visit_id = v.id and x.status = 'mo' and not (x.id = any (ids)))
      and o.id = (select x.id from orders x where x.id = any (ids) and x.visit_id = v.id order by array_position(ids, x.id) desc limit 1);
    mins := case when v.status = 'ngoi' then floor(extract(epoch from (t_out - v.in_at)) / 60)::int else coalesce(v.minutes, 0) end;
    eh := case when not is_last then 0 when v.status = 'ngoi' then app__extra(mins) else coalesce(v.extra, 0) end;
    pr := app__price(o.lines, eh, s.extra_price, o.manual, o.voucher_code, t_out);
    total := total + (pr ->> 'total')::bigint;
    rows := rows || jsonb_build_array(jsonb_build_object('order', app__order_json(o), 'priced', pr, 'isLast', is_last, 'extraHours', eh, 'minutes', mins));
  end loop;
  for v in select * from visits where id = any (vids) order by array_position(vids, id) loop
    select coalesce(sum(case when l ->> 'kind' = 'combo' then coalesce((l ->> 'serves')::int, 1) * (l ->> 'qty')::int else (l ->> 'qty')::int end), 0)::int into have
      from orders x, app__live_lines(x.lines) l where x.visit_id = v.id and x.status <> 'huy';
    if have < v.people * s.min_per_person then
      warns := warns || ((select name from boxes where id = v.box_id) || ': ' || v.people || ' người mới gọi ' || have || ' món');
    end if;
  end loop;
  return jsonb_build_object('rows', rows, 'total', total, 'outAt', app__ms(t_out), 'visitIds', to_jsonb(vids),
    'minWarn', nullif(array_to_string(warns, '; '), ''),
    'boxNames', (select jsonb_agg(distinct b.name) from visits x join boxes b on b.id = x.box_id where x.id = any (vids)));
end $$;

create or replace function public.app_order_quote(p_ids jsonb, p_out_ms bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q jsonb;
begin
  perform app__need();
  q := app__quote(p_ids, p_out_ms);
  return jsonb_build_object('orders', q -> 'rows', 'total', q -> 'total', 'minWarn', q -> 'minWarn', 'outAt', q -> 'outAt', 'boxNames', q -> 'boxNames');
end $$;

-- Hoá đơn (phiếu đầu nhóm giữ khoản trả)
create or replace function public.app__receipt(p_id text, p_reprint boolean) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s settings; rid text; r orders; vids text[];
begin
  select * into s from settings where id = 1;
  select coalesce(paid_with, id) into rid from orders where id = p_id;
  select * into r from orders where id = rid;
  select array_agg(distinct visit_id) into vids from orders where id = rid or paid_with = rid;
  return jsonb_build_object(
    'shopName', s.shop_name, 'footer', s.bill_footer,
    'boxNames', (select jsonb_agg(distinct b.name) from visits x join boxes b on b.id = x.box_id where x.id = any (vids)),
    'inAt', (select app__ms(min(in_at)) from visits where id = any (vids)),
    'outAt', (select case when bool_and(out_at is not null) then app__ms(max(out_at)) end from visits where id = any (vids)),
    'minutes', (select case when count(*) = 1 then max(minutes) end from visits where id = any (vids)),
    'lines', coalesce((select jsonb_agg(l order by o.opened_at, o.id) from orders o, app__live_lines(o.lines) l where o.id = rid or o.paid_with = rid), '[]'::jsonb),
    'priced', (select jsonb_build_object('goods', sum((priced ->> 'goods')::bigint), 'extraAmount', sum((priced ->> 'extraAmount')::bigint), 'extraHours', sum(extra_hours),
                 'extraPrice', s.extra_price, 'promos', coalesce(jsonb_agg(priced -> 'promo') filter (where jsonb_typeof(priced -> 'promo') = 'object'), '[]'::jsonb),
                 'manualAmount', sum((priced ->> 'manualAmount')::bigint), 'total', sum((priced ->> 'total')::bigint))
               from orders where id = rid or paid_with = rid),
    'payments', r.payments, 'change', r.change, 'paidBy', r.paid_by, 'at', app__ms(r.paid_at), 'reprint', p_reprint, 'voided', r.status = 'huy');
end $$;

-- Thu tiền: MỘT lệnh — phiếu đã thu, trừ kho, lượt về (khi hết phiếu mở), voucher +1 lượt dùng
create or replace function public.app_order_pay(p_ids jsonb, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u staff := app__need(); s settings; q jsonb; total bigint; tr bigint; given bigint; cash bigint; pays jsonb := '[]'::jsonb; chg bigint := 0;
  a jsonb; r jsonb; rid text := null; o orders; vid text; out_ms bigint := nullif(p ->> 'outAt', '')::bigint;
begin
  perform pg_advisory_xact_lock(4242);
  select * into s from settings where id = 1;
  q := app__quote(p_ids, out_ms);
  total := (q ->> 'total')::bigint;
  if coalesce(p ->> 'transfer', '0') !~ '^\d+$' or coalesce(p ->> 'cashGiven', '0') !~ '^\d+$' then raise exception 'LOI: Số tiền chưa đúng'; end if;
  tr := coalesce(p ->> 'transfer', '0')::bigint; given := coalesce(p ->> 'cashGiven', '0')::bigint;
  if tr > total then raise exception 'LOI: Chuyển khoản lớn hơn số phải trả'; end if;
  cash := total - tr;
  if given < cash then raise exception 'LOI: Khách đưa thiếu %', app__fmt_money(cash - given); end if;
  if cash > 0 then pays := pays || jsonb_build_array(jsonb_build_object('method', 'tien_mat', 'amount', cash)); chg := given - cash; end if;
  if tr > 0 then pays := pays || jsonb_build_array(jsonb_build_object('method', 'chuyen_khoan', 'amount', tr)); end if;
  if total = 0 then
    a := app__approve(p -> 'auth', 'thu_0d', jsonb_build_object('orderId', q -> 'rows' -> 0 -> 'order' ->> 'id', 'amount', 0));
    if a ? 'error' then return jsonb_build_object('__error', a ->> 'error'); end if;
  end if;
  for r in select * from jsonb_array_elements(q -> 'rows') loop
    update orders set status = 'da_thu', priced = r -> 'priced', extra_hours = (r ->> 'extraHours')::int, extra_price = s.extra_price,
      paid_by = u.name, paid_at = now(), payments = case when rid is null then pays else '[]'::jsonb end,
      change = case when rid is null then chg else 0 end, paid_with = rid
    where id = r -> 'order' ->> 'id' returning * into o;
    if rid is null then rid := o.id; end if;
    if r -> 'priced' -> 'promo' ->> 'source' = 'voucher' then update vouchers set used = used + 1 where code = o.voucher_code; end if;
    insert into stock_moves (stock_item_id, kind, qty, by_name, order_id)
    select k.id, 'ban', sum(d.q)::int, u.name, o.id
    from (select case when l ->> 'kind' = 'combo' then p2 ->> 'menuItemId' else l ->> 'menuItemId' end mid, (l ->> 'qty')::int q
          from app__live_lines(o.lines) l
          left join lateral jsonb_array_elements(case when l ->> 'kind' = 'combo' then coalesce(l -> 'picks', '[]'::jsonb) else '[null]'::jsonb end) p2 on true) d
    join stock_items k on k.menu_item_id = d.mid
    where d.mid is not null
    group by k.id;
  end loop;
  for vid in select jsonb_array_elements_text(q -> 'visitIds') loop
    if not exists (select 1 from orders where visit_id = vid and status = 'mo') then
      perform app__checkout_visit(vid, case when out_ms is null then null else to_timestamp(out_ms / 1000.0) end);
    end if;
  end loop;
  return jsonb_build_object('receipt', app__receipt(rid, false));
end $$;

create or replace function public.app_order_void(p_id text, p_auth jsonb default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o orders; rid text; amt bigint; a jsonb;
begin
  perform app__need();
  perform pg_advisory_xact_lock(4242);
  select * into o from orders where id = p_id for update;
  if o.id is null then raise exception 'LOI: Không tìm thấy phiếu'; end if;
  if o.status <> 'da_thu' then raise exception 'LOI: Chỉ huỷ được hoá đơn đã thu'; end if;
  rid := coalesce(o.paid_with, o.id);
  select coalesce(sum((priced ->> 'total')::bigint), 0) into amt from orders where id = rid or paid_with = rid;
  a := app__approve(p_auth, 'huy_hoa_don', jsonb_build_object('orderId', o.id, 'amount', amt));
  if a ? 'error' then return jsonb_build_object('__error', a ->> 'error'); end if;
  update orders set status = 'huy', voided_by = a ->> 'by', voided_at = now(), void_reason = trim(coalesce(p_auth ->> 'reason', ''))
  where (id = rid or paid_with = rid) and status = 'da_thu';
  insert into stock_moves (stock_item_id, kind, qty, by_name, order_id)
  select m.stock_item_id, 'hoan', m.qty, a ->> 'by', m.order_id from stock_moves m
  where m.kind = 'ban' and m.order_id in (select id from orders where id = rid or paid_with = rid);
  select * into o from orders where id = p_id;
  return app__order_json(o);
end $$;

create or replace function public.app_order_receipt(p_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o orders;
begin
  perform app__need();
  select * into o from orders where id = p_id;
  if o.id is null then raise exception 'LOI: Không tìm thấy phiếu'; end if;
  if o.status = 'mo' then raise exception 'LOI: Phiếu chưa thu'; end if;
  return app__receipt(p_id, true);
end $$;

create or replace function public.app_orders_range(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform app__need_boss();
  return coalesce((select jsonb_agg(app__order_json(o) order by o.paid_at) from orders o
    where o.status in ('da_thu', 'huy') and (app__vn_date(o.paid_at) between p_from and p_to or (o.status = 'huy' and app__vn_date(o.voided_at) between p_from and p_to))), '[]'::jsonb);
end $$;

create or replace function public.app_approvals_range(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform app__need_boss();
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'at', app__ms(a.at), 'kind', a.kind, 'orderId', a.order_id, 'amount', a.amount, 'pct', a.pct,
    'item', a.item, 'reason', a.reason, 'askedBy', a.asked_by, 'approvedBy', a.approved_by) order by a.id)
    from approvals a where app__vn_date(a.at) between p_from and p_to), '[]'::jsonb);
end $$;

-- ===== Kho =====
create or replace function public.app__expected(p_item text) returns int
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := '-infinity'; base int := 0;
begin
  select c.at, (i ->> 'counted')::int into since, base from stock_counts c, jsonb_array_elements(c.items) i
  where i ->> 'stockItemId' = p_item order by c.at desc limit 1;
  if since is null then since := '-infinity'; base := 0; end if;
  return base + coalesce((select sum(case when kind in ('nhap', 'hoan') then qty when kind = 'ban' then -qty else 0 end)
                          from stock_moves where stock_item_id = p_item and at > since), 0);
end $$;

create or replace function public.app_stock_list() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform app__need();
  return coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'unit', k.unit, 'menuItemId', k.menu_item_id, 'active', k.active) order by k.name)
                   from stock_items k where k.active), '[]'::jsonb);
end $$;

create or replace function public.app_stock_save(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform app__need_boss();
  if coalesce(trim(p ->> 'name'), '') = '' then raise exception 'LOI: Nhập tên hàng'; end if;
  if coalesce(p ->> 'id', '') <> '' and exists (select 1 from stock_items where id = p ->> 'id') then
    update stock_items set name = trim(p ->> 'name'), unit = coalesce(nullif(trim(p ->> 'unit'), ''), 'cái'), menu_item_id = nullif(p ->> 'menuItemId', ''),
      active = coalesce((p ->> 'active')::boolean, true) where id = p ->> 'id';
  else
    insert into stock_items (name, unit, menu_item_id) values (trim(p ->> 'name'), coalesce(nullif(trim(p ->> 'unit'), ''), 'cái'), nullif(p ->> 'menuItemId', ''));
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'unit', k.unit, 'menuItemId', k.menu_item_id, 'active', k.active) order by k.name) from stock_items k), '[]'::jsonb);
end $$;

create or replace function public.app_stock_receive(p jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare u staff := app__need(); it jsonb; n int := 0;
begin
  perform pg_advisory_xact_lock(4242);
  for it in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb)) where coalesce(value ->> 'stockItemId', '') <> '' loop
    if not exists (select 1 from stock_items where id = it ->> 'stockItemId') then raise exception 'LOI: Không tìm thấy hàng'; end if;
    if coalesce(it ->> 'qty', '') !~ '^\d+$' or (it ->> 'qty')::int <= 0 then raise exception 'LOI: Số lượng phải lớn hơn 0'; end if;
    insert into stock_moves (stock_item_id, kind, qty, by_name, note) values (it ->> 'stockItemId', 'nhap', (it ->> 'qty')::int, u.name, coalesce(trim(p ->> 'note'), ''));
    n := n + 1;
  end loop;
  if n = 0 then raise exception 'LOI: Nhập số lượng ít nhất 1 hàng'; end if;
  return true;
end $$;

create or replace function public.app_stock_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform app__need_boss();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'item', jsonb_build_object('id', k.id, 'name', k.name, 'unit', k.unit, 'menuItemId', k.menu_item_id, 'active', k.active),
      'expected', app__expected(k.id),
      'lastCount', (select jsonb_build_object('at', app__ms(c.at), 'counted', (i ->> 'counted')::int) from stock_counts c, jsonb_array_elements(c.items) i
                    where i ->> 'stockItemId' = k.id order by c.at desc limit 1)) order by k.name)
    from stock_items k where k.active), '[]'::jsonb);
end $$;

-- Kiểm kê: lưu cả số đáng lẽ còn + chênh lệch lúc đếm, nhưng KHÔNG trả về cho người đếm
create or replace function public.app_stock_count(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u staff := app__need(); it jsonb; items jsonb := '[]'::jsonb; ex int; c stock_counts;
begin
  perform pg_advisory_xact_lock(4242);
  for it in select * from jsonb_array_elements(coalesce(p -> 'items', '[]'::jsonb))
            where coalesce(value ->> 'stockItemId', '') <> '' and coalesce(value ->> 'counted', '') <> '' loop
    if not exists (select 1 from stock_items where id = it ->> 'stockItemId') then raise exception 'LOI: Không tìm thấy hàng'; end if;
    if (it ->> 'counted') !~ '^\d+$' then raise exception 'LOI: Số đếm phải là số nguyên từ 0'; end if;
    ex := app__expected(it ->> 'stockItemId');
    items := items || jsonb_build_array(jsonb_build_object('stockItemId', it ->> 'stockItemId', 'expected', ex, 'counted', (it ->> 'counted')::int, 'diff', (it ->> 'counted')::int - ex));
  end loop;
  if jsonb_array_length(items) = 0 then raise exception 'LOI: Nhập số đếm ít nhất 1 hàng'; end if;
  insert into stock_counts (by_name, note, items) values (u.name, coalesce(trim(p ->> 'note'), ''), items) returning * into c;
  return jsonb_build_object('id', c.id, 'at', app__ms(c.at));
end $$;

create or replace function public.app_stock_counts(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform app__need_boss();
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'at', app__ms(c.at), 'by', c.by_name, 'note', c.note,
      'items', (select jsonb_agg(i || jsonb_build_object('name', coalesce((select name from stock_items where id = i ->> 'stockItemId'), '?'))) from jsonb_array_elements(c.items) i))
      order by c.at desc)
    from stock_counts c where app__vn_date(c.at) between p_from and p_to), '[]'::jsonb);
end $$;

create or replace function public.app_stock_moves(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform app__need_boss();
  return coalesce((select jsonb_agg(jsonb_build_object('at', app__ms(m.at), 'kind', m.kind, 'name', k.name, 'qty', m.qty, 'by', m.by_name, 'note', m.note) order by m.at, m.id)
    from stock_moves m join stock_items k on k.id = m.stock_item_id where app__vn_date(m.at) between p_from and p_to), '[]'::jsonb);
end $$;

-- Chỉ cho web (đã đăng nhập) gọi các hàm app_*; hàm nội bộ app__* thu hồi hết
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'app\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    if f.proname like 'app\_\_%' then execute format('revoke all on function %s from authenticated', f.sig);
    else execute format('grant execute on function %s to authenticated', f.sig); end if;
  end loop;
end $$;
