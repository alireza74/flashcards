-- Fehlerberichte: nur mit Einwilligung, nur eigene, nicht lesbar fuer Nutzer, begrenzt, geloescht nach 90 Tagen.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.test',   '{"display_name": "Bob"}');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- ---- ohne Einwilligung ----
select throws_ok(
  $$ insert into public.error_reports (short_id, message, occurred_at) values ('AAAA-0001', 'Test', now()) $$,
  '42501', null,
  'Ohne Einwilligung kein Bericht'
);

-- ---- mit Einwilligung ----
insert into public.consents (purpose, granted, text_version) values ('crash_reports', true, 'v1');

select lives_ok(
  $$ insert into public.error_reports (short_id, message, occurred_at, breadcrumbs)
     values ('AAAA-0002', 'TypeError: x is undefined', now(), '[{"category":"navigation","message":"/profile"}]') $$,
  'Mit Einwilligung wird der Bericht gespeichert'
);

select throws_ok(
  $$ insert into public.error_reports (user_id, short_id, message, occurred_at)
     values ('22222222-2222-2222-2222-222222222222', 'AAAA-0003', 'fremd', now()) $$,
  '42501', null,
  'Kein Bericht im Namen eines anderen Nutzers'
);

select throws_ok(
  $$ select id from public.error_reports $$,
  '42501', null,
  'Nutzer koennen Berichte nicht lesen (auch eigene nicht)'
);

select throws_ok(
  $$ update public.error_reports set message = 'geaendert' $$,
  '42501', null,
  'Berichte lassen sich nicht aendern'
);

select throws_ok(
  $$ insert into public.error_reports (short_id, message, occurred_at) values ('falsch', 'x', now()) $$,
  '23514', null,
  'Fehler-ID muss das Format XXXX-XXXX haben'
);

select results_eq(
  $$ select jsonb_array_length(public.export_my_data() -> 'error_reports') $$,
  array[1],
  'Eigene Berichte sind im Datenexport enthalten'
);

-- ---- Widerruf ----
insert into public.consents (purpose, granted, text_version) values ('crash_reports', false, 'v1');
select throws_ok(
  $$ insert into public.error_reports (short_id, message, occurred_at) values ('AAAA-0004', 'Test', now()) $$,
  '42501', null,
  'Nach Widerruf kein Bericht mehr'
);

-- ---- anon ----
reset role;
set local role anon;
select throws_ok(
  $$ insert into public.error_reports (short_id, message, occurred_at) values ('AAAA-0005', 'x', now()) $$,
  '42501', null,
  'anon kann keine Berichte senden'
);

-- ---- Begrenzung und Loeschjob (als Betreiber) ----
reset role;

insert into public.error_reports (user_id, short_id, message, occurred_at, created_at)
select '22222222-2222-2222-2222-222222222222', 'BBBB-' || lpad(i::text, 4, '0'), 'Schleife', now(), now()
from generate_series(1, 30) as i;

select throws_ok(
  $$ insert into public.error_reports (user_id, short_id, message, occurred_at)
     values ('22222222-2222-2222-2222-222222222222', 'BBBB-0031', 'zu viel', now()) $$,
  'P0001', 'too many error reports',
  'Hoechstens 30 Berichte pro Nutzer und Stunde'
);

update public.error_reports set created_at = now() - interval '91 days' where short_id = 'AAAA-0002';

select results_eq(
  $$ select private.purge_old_error_reports() $$,
  array[1],
  'Berichte aelter als 90 Tage werden geloescht'
);

select results_eq(
  $$ select count(*)::int from cron.job where jobname = 'purge-old-error-reports' $$,
  array[1],
  'Taeglicher Loeschjob fuer Berichte ist eingeplant'
);

delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select is_empty(
  $$ select id from public.error_reports where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'Kontoloeschung loescht die Berichte mit'
);

select * from finish();
rollback;
