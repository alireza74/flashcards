// Karte anlegen (/cards/new?deck=...) und bearbeiten (/cards/<noteId>).
// - Notiztyp aus dem Deck: Vokabel- und Redewendungs-Decks -> "Vokabel", sonst "Einfach"
//   (beim Anlegen waehlbar: nur vorwaerts / beide Richtungen).
// - Niveau nur bei Decks mit Sprache.
// - Duplikat-Hinweis beim Tippen (blockiert nicht).
// - "Speichern und naechste": Deck und Niveau bleiben, Fokus zurueck ins erste Feld.
//
// Aufbau: NoteEditorScreen laedt (Notiz beim Bearbeiten, Deckliste), NoteForm haelt die Eingaben.
// So startet NoteForm mit fertigen Anfangswerten und braucht keine Effekte zum Befuellen.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/shared/ui/button';
import { ChipSelect } from '@/shared/ui/chip-select';
import { ConfirmButton } from '@/shared/ui/confirm-button';
import { FormMessage } from '@/shared/ui/form-message';
import { BackButton } from '@/shared/ui/header-buttons';
import { Screen } from '@/shared/ui/screen';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { TextField } from '@/shared/ui/text-field';
import { spacing } from '@/shared/ui/theme';

import { SYSTEM_NOTE_TYPE_IDS } from '../db/system-note-types';
import { getDeck, getDeckPath, type Deck } from '../data/decks';
import {
  createNote,
  deleteNote,
  findDuplicates,
  getNote,
  getNoteTypeFields,
  LEVELS,
  normalizeDedupeKey,
  updateNote,
  type Level,
  type NoteForEdit,
} from '../data/notes';
import { useLocalMutation, useLocalQuery } from '../data/use-local-data';

const NO_LEVEL = 'none';
type LevelChoice = Level | typeof NO_LEVEL;
type DeckOption = { id: string; path: string };

/** Hoehe des Feldes in Zeilen: waechst mit dem Inhalt (ca. 32 Zeichen je Zeile), hoechstens 8. */
function fieldRows(text: string, minimum: number): number {
  const lines = text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 32)), 0);
  return Math.min(8, Math.max(minimum, lines));
}

function noteTypeForDeck(deck: Deck, reverse: boolean): string {
  if (deck.kind === 'vocabulary' || deck.kind === 'phrases') return SYSTEM_NOTE_TYPE_IDS.vocabulary;
  return reverse ? SYSTEM_NOTE_TYPE_IDS.basicReverse : SYSTEM_NOTE_TYPE_IDS.basic;
}

export function NoteEditorScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ noteId?: string; deck?: string }>();
  const editingId = params.noteId;

  const existing = useLocalQuery(['note', editingId], (db) => getNote(db, editingId!), editingId !== undefined);
  const decks = useLocalQuery(['all-decks'], async (db): Promise<DeckOption[]> => {
    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM decks WHERE deleted_at IS NULL ORDER BY created_at',
      [],
    );
    const result: DeckOption[] = [];
    for (const row of rows)
      result.push({
        id: row.id,
        path: (await getDeckPath(db, row.id)).join(' › '),
      });
    return result;
  });

  const title = editingId ? t('flashcards.note.editTitle') : t('flashcards.note.newTitle');

  if ((editingId && existing.isPending) || decks.isPending) {
    return (
      <Screen title={title} headerLeft={<BackButton />}>
        <LoadingState />
      </Screen>
    );
  }
  if ((editingId && !existing.data) || !decks.data || decks.data.length === 0) {
    return (
      <Screen title={title} headerLeft={<BackButton />}>
        <ErrorState message={t('flashcards.note.notFound')} onRetry={() => void existing.refetch()} />
      </Screen>
    );
  }

  const note = existing.data ?? null;
  const initialDeckId = note?.deck_id ?? params.deck ?? decks.data[0].id;
  return (
    <NoteForm
      key={note?.id ?? 'new'}
      title={title}
      note={note}
      initialDeckId={initialDeckId}
      deckOptions={params.deck || note ? null : decks.data}
    />
  );
}

type NoteFormProps = {
  title: string;
  note: NoteForEdit | null;
  initialDeckId: string;
  /** null = Deck steht fest (Aufruf aus einem Deck oder Bearbeiten) */
  deckOptions: DeckOption[] | null;
};

function NoteForm({ title, note, initialDeckId, deckOptions }: NoteFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const editingId = note?.id;

  const [deckId, setDeckId] = useState(initialDeckId);
  const [reverse, setReverse] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>(note?.fields ?? {});
  const [level, setLevel] = useState<LevelChoice>(note?.level ?? NO_LEVEL);
  const [message, setMessage] = useState<{
    tone: 'info' | 'error';
    text: string;
  } | null>(null);
  const [formKey, setFormKey] = useState(0); // neu setzen = Felder neu aufbauen, erstes Feld bekommt Fokus

  const deck = useLocalQuery(['deck-only', deckId], (db) => getDeck(db, deckId));
  const noteTypeId = note?.note_type_id ?? (deck.data ? noteTypeForDeck(deck.data, reverse) : undefined);
  const fieldDefs = useLocalQuery(
    ['note-type-fields', noteTypeId],
    (db) => getNoteTypeFields(db, noteTypeId!),
    !!noteTypeId,
  );

  const lang = deck.data?.lang ?? null;
  const firstKey = fieldDefs.data?.[0]?.field_key;
  const firstValue = firstKey ? (fields[firstKey] ?? '') : '';
  const dedupeKey = useMemo(() => normalizeDedupeKey(firstValue, lang), [firstValue, lang]);
  const duplicates = useLocalQuery(
    ['duplicates', lang, dedupeKey, editingId],
    (db) => findDuplicates(db, lang, dedupeKey, editingId),
    dedupeKey.length > 0,
  );

  const save = useLocalMutation(async (ctx, _input: { next: boolean }) => {
    const levelValue = level === NO_LEVEL ? null : level;
    if (editingId) {
      await updateNote(ctx, editingId, { fields, level: levelValue });
    } else {
      await createNote(ctx, {
        deckId,
        noteTypeId: noteTypeId!,
        fields,
        level: levelValue,
        lang,
      });
    }
  });
  const remove = useLocalMutation((ctx) => deleteNote(ctx, editingId!));

  function submit(next: boolean) {
    if (!firstValue.trim()) {
      setMessage({
        tone: 'error',
        text: t('flashcards.note.firstFieldRequired'),
      });
      return;
    }
    setMessage(null);
    save.mutate(
      { next },
      {
        onSuccess: () => {
          if (next) {
            setFields({});
            setFormKey((k) => k + 1);
            setMessage({ tone: 'info', text: t('flashcards.note.saved') });
          } else {
            router.back();
          }
        },
        onError: () => setMessage({ tone: 'error', text: t('common.error') }),
      },
    );
  }

  const isBasicDeck =
    deck.data !== undefined && deck.data !== null && deck.data.kind !== 'vocabulary' && deck.data.kind !== 'phrases';

  return (
    <Screen
      title={title}
      headerLeft={<BackButton />}
      footer={
        <View style={styles.footer}>
          {!editingId ? (
            <Button
              title={t('flashcards.note.saveNext')}
              onPress={() => submit(true)}
              loading={save.isPending}
              disabled={!noteTypeId}
            />
          ) : null}
          <Button
            variant={editingId ? 'primary' : 'secondary'}
            title={t('flashcards.note.save')}
            onPress={() => submit(false)}
            disabled={save.isPending || !noteTypeId}
          />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {deckOptions ? (
          <ChipSelect
            label={t('flashcards.note.deck')}
            value={deckId}
            onChange={setDeckId}
            options={deckOptions.map((d) => ({ value: d.id, label: d.path }))}
          />
        ) : null}

        {!editingId && isBasicDeck ? (
          <ChipSelect<'no' | 'yes'>
            label={t('flashcards.note.direction')}
            value={reverse ? 'yes' : 'no'}
            onChange={(value) => setReverse(value === 'yes')}
            options={[
              { value: 'no', label: t('flashcards.note.forwardOnly') },
              { value: 'yes', label: t('flashcards.note.bothWays') },
            ]}
          />
        ) : null}

        <View key={formKey} style={styles.fields}>
          {fieldDefs.data?.map((field, index) => (
            <TextField
              key={field.field_key}
              label={t(`flashcards.note.fields.${field.field_key}`, {
                defaultValue: field.name,
              })}
              value={fields[field.field_key] ?? ''}
              onChangeText={(text) =>
                setFields((current) => ({
                  ...current,
                  [field.field_key]: text,
                }))
              }
              autoFocus={index === 0}
              // Alle Felder mehrzeilig: lange Inhalte (z. B. aus Anki) werden nicht abgeschnitten
              multiline
              numberOfLines={fieldRows(fields[field.field_key] ?? '', index === 0 ? 1 : 2)}
              textAlignVertical="top"
              autoCapitalize="none"
            />
          ))}
        </View>

        {duplicates.data && duplicates.data.length > 0 ? (
          <FormMessage
            tone="info"
            text={t('flashcards.note.duplicate', {
              text: firstValue.trim(),
              path: duplicates.data[0].deckPath.join(' › '),
            })}
          />
        ) : null}

        {lang ? (
          <ChipSelect<LevelChoice>
            label={t('flashcards.note.level')}
            value={level}
            onChange={setLevel}
            options={[
              { value: NO_LEVEL, label: t('flashcards.note.noLevel') },
              ...LEVELS.map((value) => ({ value, label: value })),
            ]}
          />
        ) : null}

        {message ? <FormMessage tone={message.tone} text={message.text} /> : null}

        {editingId ? (
          <ConfirmButton
            title={t('flashcards.note.delete')}
            confirmText={t('flashcards.note.deleteConfirm')}
            cancelTitle={t('common.cancel')}
            onConfirm={() => remove.mutate(undefined, { onSuccess: () => router.back() })}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.lg },
  fields: { gap: spacing.md },
  footer: { gap: spacing.sm },
});
