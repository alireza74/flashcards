-- Karteikarten: Mandantentrennung, Notiztypen, Abgleich-Regeln ("neuere Aenderung gewinnt"),
-- Lernhistorie nur anfuegen, kein hartes Loeschen, Datenexport.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.test', '{"display_name": "Alice"}'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.test', '{"display_name": "Bob"}');

create temporary table org_ids as
  select created_by as user_id, id from public.organizations;
grant select on org_ids to authenticated;

-- ---- Bob legt ein Deck an ----
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.decks (id, organization_id, name)
     values ('bbbbbbbb-0000-4000-8000-000000000001',
             (select id from org_ids where user_id = '22222222-2222-2222-2222-222222222222'), 'Bobs Deck') $$,
  'Bob legt ein Deck in seiner Organisation an'
);

-- ---- als Alice ----
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select results_eq(
  $$ select key from public.note_types where organization_id is null order by key $$,
  array['basic', 'basic_reverse', 'vocabulary'],
  'Eingebaute Notiztypen sind lesbar'
);

select results_eq(
  $$ select count(*)::int from public.card_templates
     where note_type_id = '00000000-0000-4000-8000-000000000102' $$,
  array[2],
  'Einfach mit Rueckrichtung hat zwei Kartenvorlagen'
);

select is_empty(
  $$ update public.note_types set name = 'gehackt' where key = 'basic' returning id $$,
  'Eingebaute Notiztypen sind nicht aenderbar'
);

select lives_ok(
  $$ insert into public.deck_configs (id, organization_id, name)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             (select id from org_ids where user_id = '11111111-1111-1111-1111-111111111111'), 'Standard') $$,
  'Alice legt Lernoptionen an'
);

select lives_ok(
  $$ insert into public.decks (id, organization_id, name, kind, lang, config_id)
     values ('aaaaaaaa-0000-4000-8000-000000000002',
             (select id from org_ids where user_id = '11111111-1111-1111-1111-111111111111'),
             'Englisch', 'general', 'en', 'aaaaaaaa-0000-4000-8000-000000000001'),
            ('aaaaaaaa-0000-4000-8000-000000000003',
             (select id from org_ids where user_id = '11111111-1111-1111-1111-111111111111'),
             'Vokabeln', 'vocabulary', 'en', null) $$,
  'Alice legt Decks an'
);

select lives_ok(
  $$ update public.decks set parent_id = 'aaaaaaaa-0000-4000-8000-000000000002', updated_at = now() + interval '1 second'
     where id = 'aaaaaaaa-0000-4000-8000-000000000003' $$,
  'Alice ordnet ein Unterdeck ein'
);

select lives_ok(
  $$ insert into public.notes (id, organization_id, note_type_id, deck_id, fields, level, lang, dedupe_key, updated_at)
     values ('aaaaaaaa-0000-4000-8000-000000000004',
             (select id from org_ids where user_id = '11111111-1111-1111-1111-111111111111'),
             '00000000-0000-4000-8000-000000000103', 'aaaaaaaa-0000-4000-8000-000000000003',
             '{"word": "house", "meaning": "Haus"}', 'B1', 'en', 'house', '2026-11-27 10:00:00+00') $$,
  'Alice legt eine Vokabel an'
);

select lives_ok(
  $$ insert into public.cards (id, organization_id, note_id, template_ord, deck_id)
     values ('aaaaaaaa-0000-4000-8000-000000000005',
             (select id from org_ids where user_id = '11111111-1111-1111-1111-111111111111'),
             'aaaaaaaa-0000-4000-8000-000000000004', 0, 'aaaaaaaa-0000-4000-8000-000000000003') $$,
  'Alice legt eine Karte an'
);

select lives_ok(
  $$ insert into public.review_logs (organization_id, card_id, rating, state, due_at, stability, difficulty,
                                     scheduled_days, reviewed_at, duration_ms)
     values ((select id from org_ids where user_id = '11111111-1111-1111-1111-111111111111'),
             'aaaaaaaa-0000-4000-8000-000000000005', 3, 0, now(), 0, 0, 0, now(), 4200) $$,
  'Alice speichert eine Lernantwort'
);

-- Mandantentrennung
select is_empty(
  $$ select id from public.decks where id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'Alice sieht Bobs Deck nicht'
);

select throws_ok(
  $$ insert into public.decks (organization_id, name)
     values ((select id from org_ids where user_id = '22222222-2222-2222-2222-222222222222'), 'fremd') $$,
  '42501', null,
  'Alice kann kein Deck in Bobs Organisation anlegen'
);

select throws_ok(
  $$ insert into public.notes (organization_id, note_type_id, deck_id)
     values ((select id from org_ids where user_id = '11111111-1111-1111-1111-111111111111'),
             '00000000-0000-4000-8000-000000000101', 'bbbbbbbb-0000-4000-8000-000000000001') $$,
  '23503', null,
  'Eine Notiz kann nicht auf Bobs Deck zeigen (zusammengesetzter Fremdschluessel)'
);

select is_empty(
  $$ update public.decks set name = 'gehackt', updated_at = now() + interval '1 day'
     where id = 'bbbbbbbb-0000-4000-8000-000000000001' returning id $$,
  'Alice kann Bobs Deck nicht aendern'
);

-- Abgleich: neuere Aenderung gewinnt
select is_empty(
  $$ update public.notes set fields = '{"word": "alt"}', updated_at = '2026-11-27 09:00:00+00'
     where id = 'aaaaaaaa-0000-4000-8000-000000000004' returning id $$,
  'Aeltere Aenderung wird verworfen'
);

select results_eq(
  $$ select fields->>'word' from public.notes where id = 'aaaaaaaa-0000-4000-8000-000000000004' $$,
  array['house'],
  'Inhalt bleibt nach verworfener Aenderung unveraendert'
);

create temporary table before_update as
  select server_updated_at from public.notes where id = 'aaaaaaaa-0000-4000-8000-000000000004';

select lives_ok(
  $$ update public.notes set fields = '{"word": "home", "meaning": "Zuhause"}', updated_at = '2026-11-27 11:00:00+00'
     where id = 'aaaaaaaa-0000-4000-8000-000000000004' $$,
  'Neuere Aenderung wird uebernommen'
);

select results_eq(
  $$ select fields->>'word' from public.notes where id = 'aaaaaaaa-0000-4000-8000-000000000004' $$,
  array['home'],
  'Neuer Inhalt ist gespeichert'
);

select ok(
  (select n.server_updated_at > b.server_updated_at
   from public.notes n, before_update b where n.id = 'aaaaaaaa-0000-4000-8000-000000000004'),
  'server_updated_at wird bei jeder Aenderung neu gesetzt'
);

select throws_ok(
  $$ update public.notes
     set organization_id = (select id from org_ids where user_id = '22222222-2222-2222-2222-222222222222'),
         updated_at = '2026-11-27 12:00:00+00'
     where id = 'aaaaaaaa-0000-4000-8000-000000000004' $$,
  '42501', null,
  'Die Organisation einer Zeile kann nicht gewechselt werden'
);

-- Loeschen nur per Loeschmarker, Lernhistorie nur anfuegen
select throws_ok(
  $$ delete from public.decks where id = 'aaaaaaaa-0000-4000-8000-000000000002' $$,
  '42501', null,
  'Decks lassen sich nicht hart loeschen'
);

select lives_ok(
  $$ update public.cards set deleted_at = now(), updated_at = now() + interval '1 second'
     where id = 'aaaaaaaa-0000-4000-8000-000000000005' $$,
  'Karte wird per Loeschmarker geloescht'
);

select throws_ok(
  $$ update public.review_logs set rating = 1 $$,
  '42501', null,
  'Lernhistorie laesst sich nicht aendern'
);

select throws_ok(
  $$ delete from public.review_logs $$,
  '42501', null,
  'Lernhistorie laesst sich nicht loeschen'
);

-- Datenexport
select results_eq(
  $$ select jsonb_array_length(public.export_my_data()->'flashcards'->'decks') $$,
  array[2],
  'Datenexport enthaelt Alices Decks'
);

select results_eq(
  $$ select jsonb_array_length(public.export_my_data()->'flashcards'->'review_logs') $$,
  array[1],
  'Datenexport enthaelt Alices Lernhistorie'
);

-- ---- als Bob ----
select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select results_eq(
  $$ select (select count(*) from public.notes) + (select count(*) from public.cards)
          + (select count(*) from public.review_logs) + (select count(*) from public.deck_configs) $$,
  array[0::bigint],
  'Bob sieht keine Notizen, Karten, Lernhistorie oder Lernoptionen von Alice'
);

-- ---- ohne Anmeldung ----
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);

select throws_ok(
  $$ select id from public.notes $$,
  '42501', null,
  'anon hat keinen Zugriff auf Notizen'
);

reset role;
select * from finish();
rollback;
