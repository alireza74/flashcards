// NUR FUER TESTS: vollstaendige Beispielzeilen (lokales Format).

import { SYSTEM_NOTE_TYPE_IDS } from '../db/system-note-types';
import type { LocalRow } from '../sync/table-specs';

export function deckRow(id: string, organizationId: string, name = 'Deck'): LocalRow {
  return {
    id,
    organization_id: organizationId,
    parent_id: null,
    name,
    kind: 'general',
    lang: null,
    config_id: null,
    position: 0,
    created_at: null,
    updated_at: null,
    deleted_at: null,
  };
}

export function vocabularyNoteRow(id: string, organizationId: string, deckId: string, word: string): LocalRow {
  return {
    id,
    organization_id: organizationId,
    note_type_id: SYSTEM_NOTE_TYPE_IDS.vocabulary,
    deck_id: deckId,
    fields: JSON.stringify({ word, meaning: `Bedeutung von ${word}` }),
    tags: JSON.stringify(['test']),
    level: 'B1',
    topic: null,
    source: null,
    lang: 'en',
    dedupe_key: word.toLowerCase(),
    external_guid: null,
    created_at: null,
    updated_at: null,
    deleted_at: null,
  };
}

export function cardRow(id: string, organizationId: string, noteId: string, deckId: string): LocalRow {
  return {
    id,
    organization_id: organizationId,
    note_id: noteId,
    template_ord: 0,
    deck_id: deckId,
    state: 0,
    due_at: Date.UTC(2026, 10, 27, 8),
    last_review_at: null,
    stability: 0,
    stability_fast: 0,
    difficulty: 0,
    scheduled_days: 0,
    learning_step: 0,
    reps: 0,
    lapses: 0,
    suspended: 0,
    fsrs_model: 'fsrs-7',
    created_at: null,
    updated_at: null,
    deleted_at: null,
  };
}

export function reviewLogRow(id: string, organizationId: string, cardId: string): LocalRow {
  return {
    id,
    organization_id: organizationId,
    card_id: cardId,
    rating: 3,
    state: 0,
    due_at: Date.UTC(2026, 10, 27, 8),
    last_review_at: null,
    stability: 0,
    stability_fast: 0,
    difficulty: 0,
    scheduled_days: 0,
    learning_step: 0,
    reviewed_at: Date.UTC(2026, 10, 27, 8, 1),
    duration_ms: 3000,
    is_test: 0,
    created_at: null,
  };
}
