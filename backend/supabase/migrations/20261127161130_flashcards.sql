-- Karteikarten: Fachtabellen (Konzept: docs/Konzept-Version1.md, Erklaerung: docs/lernen/10-datenmodell.md).
--
-- Grundsaetze:
-- - Die Daten entstehen auf dem Geraet (SQLite) und werden abgeglichen. Darum vergibt das Geraet die id.
-- - Jede abgeglichene Tabelle hat:
--     updated_at         Zeit der Aenderung auf dem Geraet - entscheidet bei Konflikten ("neuere gewinnt")
--     server_updated_at  Zeit auf dem Server (Trigger, clock_timestamp) - Grundlage fuer "seit dem letzten Abgleich"
--     deleted_at         Loeschmarker; hartes Loeschen gibt es fuer die App nicht
-- - review_logs wird nur angefuegt (keine Aenderung, kein Loeschen).
-- - Fremdschluessel innerhalb einer Organisation sind zusammengesetzt (organization_id, id),
--   damit keine Zeile auf Daten einer anderen Organisation zeigen kann.

-- ---------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------

insert into public.permissions (key, description) values
  ('decks.manage', 'Decks, Lernoptionen und eigene Notiztypen verwalten'),
  ('cards.write',  'Notizen und Karten anlegen, aendern und lernen');

-- Version 1 kennt nur persoenliche Organisationen (Nutzer = owner). member bekommt die Rechte fuer
-- spaetere Lerngruppen ebenfalls. admin bewusst (noch) nicht: Test 01 der Basis prueft dessen Rechte genau.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r, public.permissions p
where r.organization_id is null and r.key in ('owner', 'member')
  and p.key in ('decks.manage', 'cards.write');

-- ---------------------------------------------------------------------------
-- Trigger fuer den Abgleich
-- ---------------------------------------------------------------------------

-- Setzt server_updated_at und verwirft veraltete Aenderungen ("neuere Aenderung gewinnt").
create function private.flashcards_sync_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'organization_id cannot be changed' using errcode = '42501';
    end if;
    -- Aelterer Stand vom Geraet: Zeile unveraendert lassen. Das Geraet holt sich beim naechsten Abgleich den neueren.
    if new.updated_at < old.updated_at then
      return null;
    end if;
  end if;
  -- clock_timestamp statt now(): now() ist der Beginn der Transaktion und kann aelter sein als
  -- eine bereits abgeholte Zeile einer anderen Transaktion.
  new.server_updated_at = clock_timestamp();
  return new;
end;
$$;

comment on function private.flashcards_sync_row() is
  'Trigger: setzt server_updated_at, verwirft Aenderungen mit aelterem updated_at, verbietet Wechsel der Organisation.';

-- Fuer Tabellen, die nur angefuegt werden (review_logs).
create function private.flashcards_set_server_time()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at = clock_timestamp();
  return new;
end;
$$;

comment on function private.flashcards_set_server_time() is 'Trigger: setzt server_updated_at beim Anfuegen.';

-- ---------------------------------------------------------------------------
-- deck_configs - Lernoptionen
-- ---------------------------------------------------------------------------

create table public.deck_configs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 100),
  desired_retention numeric(4, 3) not null default 0.9 check (desired_retention between 0.7 and 0.99),
  learning_steps    text[] not null default '{1m,10m}',
  relearning_steps  text[] not null default '{10m}',
  new_per_day       integer not null default 20 check (new_per_day between 0 and 9999),
  reviews_per_day   integer not null default 200 check (reviews_per_day between 0 and 99999),
  answer_buttons    smallint not null default 2 check (answer_buttons in (2, 4)),
  maximum_interval  integer not null default 36500 check (maximum_interval between 1 and 36500),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz,
  unique (organization_id, id)
);

comment on table public.deck_configs is 'Lernoptionen (Zielquote, Lernschritte, Tageslimits, Knoepfe); Decks verweisen darauf.';
comment on column public.deck_configs.learning_steps is 'Lernschritte fuer neue Karten, z. B. {1m,10m} (Einheiten m, h, d).';

-- ---------------------------------------------------------------------------
-- decks - Gliederung in Ebenen
-- ---------------------------------------------------------------------------

create table public.decks (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  parent_id         uuid,
  name              text not null check (char_length(name) between 1 and 100),
  kind              text not null default 'general' check (kind in ('general', 'vocabulary', 'phrases', 'grammar')),
  lang              text check (lang ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  config_id         uuid,
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, parent_id) references public.decks (organization_id, id) on delete cascade,
  foreign key (organization_id, config_id) references public.deck_configs (organization_id, id) on delete cascade,
  check (parent_id is distinct from id)
);

comment on table public.decks is 'Decks; Hierarchie ueber parent_id. kind kommt aus der Vorlage (Vokabeln, Redewendungen ...).';
comment on column public.decks.lang is 'Sprache des Lernstoffs (BCP 47, z. B. en, de, fa); leer = keine Sprache.';
comment on column public.decks.config_id is 'Lernoptionen; leer = Standardoptionen der Organisation (App).';

-- ---------------------------------------------------------------------------
-- note_types, note_type_fields, card_templates - Notiztypen als Daten
-- organization_id null = eingebauter Notiztyp (fuer alle lesbar, nur per Migration aenderbar).
-- ---------------------------------------------------------------------------

create table public.note_types (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references public.organizations (id) on delete cascade,
  key               text check (key ~ '^[a-z_]{1,40}$'),
  name              text not null check (char_length(name) between 1 and 100),
  kind              text not null default 'standard' check (kind in ('standard', 'cloze')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz,
  unique (organization_id, id),
  check (organization_id is not null or key is not null)
);

create unique index note_types_system_key_idx on public.note_types (key) where organization_id is null;

comment on table public.note_types is 'Notiztypen. organization_id null = eingebaut (key basic, basic_reverse, vocabulary).';
comment on column public.note_types.key is 'Stabiler Schluessel eingebauter Typen; die App uebersetzt den Namen danach.';

create table public.note_type_fields (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references public.organizations (id) on delete cascade,
  note_type_id      uuid not null references public.note_types (id) on delete cascade,
  ord               smallint not null check (ord between 0 and 99),
  field_key         text not null check (field_key ~ '^[a-z][a-z0-9_]{0,39}$'),
  name              text not null check (char_length(name) between 1 and 100),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz,
  unique (note_type_id, ord),
  unique (note_type_id, field_key)
);

comment on table public.note_type_fields is 'Felder eines Notiztyps; field_key ist der Schluessel in notes.fields.';

create table public.card_templates (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid references public.organizations (id) on delete cascade,
  note_type_id      uuid not null references public.note_types (id) on delete cascade,
  ord               smallint not null check (ord between 0 and 99),
  name              text not null check (char_length(name) between 1 and 100),
  front_template    text not null,
  back_template     text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz,
  unique (note_type_id, ord)
);

comment on table public.card_templates is 'Kartenvorlagen eines Notiztyps; je Vorlage entsteht aus einer Notiz eine Karte. Platzhalter {{field_key}}.';

-- Eingebaute Notiztypen mit festen IDs (dieselben IDs legt die App in ihrer lokalen Datenbank an).
insert into public.note_types (id, organization_id, key, name, kind) values
  ('00000000-0000-4000-8000-000000000101', null, 'basic',         'Einfach',                   'standard'),
  ('00000000-0000-4000-8000-000000000102', null, 'basic_reverse', 'Einfach mit Rueckrichtung', 'standard'),
  ('00000000-0000-4000-8000-000000000103', null, 'vocabulary',    'Vokabel',                   'standard');

insert into public.note_type_fields (id, organization_id, note_type_id, ord, field_key, name) values
  ('00000000-0000-4000-8000-000000000201', null, '00000000-0000-4000-8000-000000000101', 0, 'front',   'Vorderseite'),
  ('00000000-0000-4000-8000-000000000202', null, '00000000-0000-4000-8000-000000000101', 1, 'back',    'Rueckseite'),
  ('00000000-0000-4000-8000-000000000203', null, '00000000-0000-4000-8000-000000000102', 0, 'front',   'Vorderseite'),
  ('00000000-0000-4000-8000-000000000204', null, '00000000-0000-4000-8000-000000000102', 1, 'back',    'Rueckseite'),
  ('00000000-0000-4000-8000-000000000205', null, '00000000-0000-4000-8000-000000000103', 0, 'word',    'Wort'),
  ('00000000-0000-4000-8000-000000000206', null, '00000000-0000-4000-8000-000000000103', 1, 'meaning', 'Bedeutung'),
  ('00000000-0000-4000-8000-000000000207', null, '00000000-0000-4000-8000-000000000103', 2, 'example', 'Beispielsatz');

insert into public.card_templates (id, organization_id, note_type_id, ord, name, front_template, back_template) values
  ('00000000-0000-4000-8000-000000000301', null, '00000000-0000-4000-8000-000000000101', 0, 'Vorwaerts',  '{{front}}',   '{{back}}'),
  ('00000000-0000-4000-8000-000000000302', null, '00000000-0000-4000-8000-000000000102', 0, 'Vorwaerts',  '{{front}}',   '{{back}}'),
  ('00000000-0000-4000-8000-000000000303', null, '00000000-0000-4000-8000-000000000102', 1, 'Rueckwaerts', '{{back}}',   '{{front}}'),
  ('00000000-0000-4000-8000-000000000304', null, '00000000-0000-4000-8000-000000000103', 0, 'Wort -> Bedeutung', '{{word}}',    E'{{meaning}}\n\n{{example}}'),
  ('00000000-0000-4000-8000-000000000305', null, '00000000-0000-4000-8000-000000000103', 1, 'Bedeutung -> Wort', '{{meaning}}', E'{{word}}\n\n{{example}}');

-- ---------------------------------------------------------------------------
-- notes - Inhalte
-- ---------------------------------------------------------------------------

create table public.notes (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  note_type_id      uuid not null references public.note_types (id) on delete cascade,
  deck_id           uuid not null,
  fields            jsonb not null default '{}' check (jsonb_typeof(fields) = 'object'),
  tags              text[] not null default '{}',
  level             text check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  topic             text check (char_length(topic) <= 100),
  source            text check (char_length(source) <= 200),
  lang              text check (lang ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  dedupe_key        text check (char_length(dedupe_key) <= 500),
  external_guid     text check (char_length(external_guid) <= 100),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, deck_id) references public.decks (organization_id, id) on delete cascade
);

comment on table public.notes is 'Notizen: Inhalte in fields (Schluessel = note_type_fields.field_key); erzeugen Karten.';
comment on column public.notes.dedupe_key is 'Bereinigtes Hauptfeld fuer den Duplikat-Abgleich beim Import (je Sprache).';
comment on column public.notes.external_guid is 'Kennung aus der Quelle (Anki-guid) fuer erneuten Import.';

create index notes_dedupe_idx on public.notes (organization_id, lang, dedupe_key) where deleted_at is null;
create index notes_external_guid_idx on public.notes (organization_id, external_guid) where external_guid is not null;
create index notes_deck_idx on public.notes (organization_id, deck_id);

-- ---------------------------------------------------------------------------
-- cards - Lernstand je Karte (FSRS)
-- ---------------------------------------------------------------------------

create table public.cards (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  note_id           uuid not null,
  template_ord      smallint not null check (template_ord between 0 and 99),
  deck_id           uuid not null,
  state             smallint not null default 0 check (state between 0 and 3),
  due_at            timestamptz not null default now(),
  last_review_at    timestamptz,
  stability         double precision not null default 0,
  stability_fast    double precision not null default 0,
  difficulty        double precision not null default 0,
  scheduled_days    double precision not null default 0,
  learning_step     smallint not null default 0,
  reps              integer not null default 0,
  lapses            integer not null default 0,
  suspended         boolean not null default false,
  fsrs_model        text not null default 'fsrs-7',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp(),
  deleted_at        timestamptz,
  unique (organization_id, id),
  unique (note_id, template_ord),
  foreign key (organization_id, note_id) references public.notes (organization_id, id) on delete cascade,
  foreign key (organization_id, deck_id) references public.decks (organization_id, id) on delete cascade
);

comment on table public.cards is 'Karten mit FSRS-Zustand. state: 0 neu, 1 lernen, 2 wiederholen, 3 neu lernen (ts-fsrs).';
comment on column public.cards.scheduled_days is 'Aktueller Abstand in Tagen; Kartei-Box: < 21 jung, >= 21 gefestigt.';
comment on column public.cards.fsrs_model is 'FSRS-Modell, mit dem stability/difficulty berechnet wurden.';

create index cards_due_idx on public.cards (organization_id, due_at) where deleted_at is null and not suspended;
create index cards_deck_idx on public.cards (organization_id, deck_id);

-- ---------------------------------------------------------------------------
-- review_logs - Lernhistorie (nur anfuegen)
-- ---------------------------------------------------------------------------

create table public.review_logs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  card_id           uuid not null,
  rating            smallint not null check (rating between 1 and 4),
  state             smallint not null check (state between 0 and 3),
  due_at            timestamptz not null,
  last_review_at    timestamptz,
  stability         double precision not null,
  stability_fast    double precision not null default 0,
  difficulty        double precision not null,
  scheduled_days    double precision not null,
  learning_step     smallint not null default 0,
  reviewed_at       timestamptz not null,
  duration_ms       integer check (duration_ms between 0 and 86400000),
  is_test           boolean not null default false,
  created_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp(),
  foreign key (organization_id, card_id) references public.cards (organization_id, id) on delete cascade
);

comment on table public.review_logs is 'Lernhistorie, nur anfuegen. Zustand der Karte VOR der Antwort; is_test = Testmodus (nie fuer FSRS).';

create index review_logs_card_idx on public.review_logs (organization_id, card_id, reviewed_at);

-- ---------------------------------------------------------------------------
-- Trigger und Abgleich-Indizes
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['deck_configs', 'decks', 'note_types', 'note_type_fields', 'card_templates', 'notes', 'cards'] loop
    execute format('create trigger flashcards_sync_row before insert or update on public.%I
                    for each row execute function private.flashcards_sync_row()', t);
    execute format('create index %I on public.%I (organization_id, server_updated_at)', t || '_sync_idx', t);
  end loop;
end;
$$;

create trigger flashcards_set_server_time before insert on public.review_logs
  for each row execute function private.flashcards_set_server_time();
create index review_logs_sync_idx on public.review_logs (organization_id, server_updated_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Lesen: eigene Organisationen. Schreiben: mit Recht. Hartes Loeschen: keine Policy (Loeschmarker).
-- ---------------------------------------------------------------------------

alter table public.deck_configs     enable row level security;
alter table public.decks            enable row level security;
alter table public.note_types       enable row level security;
alter table public.note_type_fields enable row level security;
alter table public.card_templates   enable row level security;
alter table public.notes            enable row level security;
alter table public.cards            enable row level security;
alter table public.review_logs      enable row level security;

revoke all on public.deck_configs, public.decks, public.note_types, public.note_type_fields,
  public.card_templates, public.notes, public.cards, public.review_logs from anon;
revoke delete on public.deck_configs, public.decks, public.note_types, public.note_type_fields,
  public.card_templates, public.notes, public.cards from authenticated;
revoke update, delete, truncate on public.review_logs from authenticated;

-- Tabellen der Organisation mit Recht decks.manage
create policy "members read deck_configs" on public.deck_configs
  for select to authenticated using (organization_id in (select private.my_organization_ids()));
create policy "insert deck_configs with permission" on public.deck_configs
  for insert to authenticated with check ((select private.has_permission(organization_id, 'decks.manage')));
create policy "update deck_configs with permission" on public.deck_configs
  for update to authenticated
  using ((select private.has_permission(organization_id, 'decks.manage')))
  with check ((select private.has_permission(organization_id, 'decks.manage')));

create policy "members read decks" on public.decks
  for select to authenticated using (organization_id in (select private.my_organization_ids()));
create policy "insert decks with permission" on public.decks
  for insert to authenticated with check ((select private.has_permission(organization_id, 'decks.manage')));
create policy "update decks with permission" on public.decks
  for update to authenticated
  using ((select private.has_permission(organization_id, 'decks.manage')))
  with check ((select private.has_permission(organization_id, 'decks.manage')));

-- Notiztypen: eingebaute fuer alle lesbar; eigene wie Decks
create policy "read system and own note_types" on public.note_types
  for select to authenticated
  using (organization_id is null or organization_id in (select private.my_organization_ids()));
create policy "insert note_types with permission" on public.note_types
  for insert to authenticated
  with check (organization_id is not null and (select private.has_permission(organization_id, 'decks.manage')));
create policy "update note_types with permission" on public.note_types
  for update to authenticated
  using (organization_id is not null and (select private.has_permission(organization_id, 'decks.manage')))
  with check (organization_id is not null and (select private.has_permission(organization_id, 'decks.manage')));

create policy "read system and own note_type_fields" on public.note_type_fields
  for select to authenticated
  using (organization_id is null or organization_id in (select private.my_organization_ids()));
create policy "insert note_type_fields with permission" on public.note_type_fields
  for insert to authenticated
  with check (organization_id is not null and (select private.has_permission(organization_id, 'decks.manage')));
create policy "update note_type_fields with permission" on public.note_type_fields
  for update to authenticated
  using (organization_id is not null and (select private.has_permission(organization_id, 'decks.manage')))
  with check (organization_id is not null and (select private.has_permission(organization_id, 'decks.manage')));

create policy "read system and own card_templates" on public.card_templates
  for select to authenticated
  using (organization_id is null or organization_id in (select private.my_organization_ids()));
create policy "insert card_templates with permission" on public.card_templates
  for insert to authenticated
  with check (organization_id is not null and (select private.has_permission(organization_id, 'decks.manage')));
create policy "update card_templates with permission" on public.card_templates
  for update to authenticated
  using (organization_id is not null and (select private.has_permission(organization_id, 'decks.manage')))
  with check (organization_id is not null and (select private.has_permission(organization_id, 'decks.manage')));

-- Inhalte und Lernstand mit Recht cards.write
create policy "members read notes" on public.notes
  for select to authenticated using (organization_id in (select private.my_organization_ids()));
create policy "insert notes with permission" on public.notes
  for insert to authenticated with check ((select private.has_permission(organization_id, 'cards.write')));
create policy "update notes with permission" on public.notes
  for update to authenticated
  using ((select private.has_permission(organization_id, 'cards.write')))
  with check ((select private.has_permission(organization_id, 'cards.write')));

create policy "members read cards" on public.cards
  for select to authenticated using (organization_id in (select private.my_organization_ids()));
create policy "insert cards with permission" on public.cards
  for insert to authenticated with check ((select private.has_permission(organization_id, 'cards.write')));
create policy "update cards with permission" on public.cards
  for update to authenticated
  using ((select private.has_permission(organization_id, 'cards.write')))
  with check ((select private.has_permission(organization_id, 'cards.write')));

create policy "members read review_logs" on public.review_logs
  for select to authenticated using (organization_id in (select private.my_organization_ids()));
create policy "append review_logs with permission" on public.review_logs
  for insert to authenticated with check ((select private.has_permission(organization_id, 'cards.write')));

-- ---------------------------------------------------------------------------
-- Datenexport um die Lerndaten der persoenlichen Organisation erweitern
-- ---------------------------------------------------------------------------

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  personal_orgs uuid[];
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select coalesce(array_agg(o.id), '{}') into personal_orgs
  from public.organizations o where o.kind = 'personal' and o.created_by = uid;

  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at)
                from auth.users u where u.id = uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object('organization', o.name, 'kind', o.kind, 'role', r.key, 'since', m.created_at)
                       order by m.created_at)
      from public.organization_members m
      join public.organizations o on o.id = m.organization_id
      join public.roles r on r.id = m.role_id
      where m.user_id = uid), '[]'::jsonb),
    'consents', coalesce((
      select jsonb_agg(jsonb_build_object('purpose', c.purpose, 'granted', c.granted,
                                          'text_version', c.text_version, 'created_at', c.created_at)
                       order by c.created_at)
      from public.consents c where c.user_id = uid), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object('action', a.action, 'entity', a.entity, 'created_at', a.created_at)
                       order by a.created_at)
      from public.audit_log a where a.actor_id = uid), '[]'::jsonb),
    'flashcards', jsonb_build_object(
      'deck_configs', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at)
                                from public.deck_configs x where x.organization_id = any (personal_orgs)), '[]'::jsonb),
      'decks', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at)
                         from public.decks x where x.organization_id = any (personal_orgs)), '[]'::jsonb),
      'note_types', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at)
                              from public.note_types x where x.organization_id = any (personal_orgs)), '[]'::jsonb),
      'note_type_fields', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at)
                                    from public.note_type_fields x where x.organization_id = any (personal_orgs)), '[]'::jsonb),
      'card_templates', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at)
                                  from public.card_templates x where x.organization_id = any (personal_orgs)), '[]'::jsonb),
      'notes', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at)
                         from public.notes x where x.organization_id = any (personal_orgs)), '[]'::jsonb),
      'cards', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at)
                         from public.cards x where x.organization_id = any (personal_orgs)), '[]'::jsonb),
      'review_logs', coalesce((select jsonb_agg(to_jsonb(x) order by x.reviewed_at)
                               from public.review_logs x where x.organization_id = any (personal_orgs)), '[]'::jsonb)
    )
  );
end;
$$;

comment on function public.export_my_data() is 'Datenexport (Art. 20 DSGVO) fuer die angemeldete Person, inkl. Lerndaten.';

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
revoke execute on all functions in schema private from public, anon;
