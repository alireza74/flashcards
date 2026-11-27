// Kartenliste (/browse?deck=<id>&box=<fach>): suchen, nach Niveau und Kartei-Box-Fach filtern,
// in Stuecken zu 50 laden, alle gefilterten Karten in ein anderes Deck verschieben.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/app-text';
import { BottomSheet } from '@/shared/ui/bottom-sheet';
import { Button } from '@/shared/ui/button';
import { ChipSelect } from '@/shared/ui/chip-select';
import { FormMessage } from '@/shared/ui/form-message';
import { BackButton } from '@/shared/ui/header-buttons';
import { ListRow } from '@/shared/ui/list-row';
import { Screen } from '@/shared/ui/screen';
import { TextField } from '@/shared/ui/text-field';
import { spacing } from '@/shared/ui/theme';

import {
  BOX_FILTERS,
  browseNotes,
  countNotes,
  moveNotes,
  NO_LEVEL,
  type BoxFilter,
  type NoteFilter,
} from '../data/card-browser';
import { getDeck, getDeckPath } from '../data/decks';
import { LEVELS, type Level } from '../data/notes';
import { useLocalMutation, useLocalQuery } from '../data/use-local-data';

const PAGE_SIZE = 50;
const ALL = 'all';
type LevelChoice = Level | typeof NO_LEVEL | typeof ALL;
type BoxChoice = BoxFilter | typeof ALL;

export function BrowseScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ deck: string; box?: string }>();
  const deckId = params.deck;
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<LevelChoice>(ALL);
  const [box, setBox] = useState<BoxChoice>(
    BOX_FILTERS.includes(params.box as BoxFilter) ? (params.box as BoxFilter) : ALL,
  );
  const [pages, setPages] = useState(1);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filter: NoteFilter = {
    deckId,
    search,
    level: level === ALL ? null : level,
    box: box === ALL ? null : box,
  };
  const filterKey = [deckId, search, level, box];

  const deck = useLocalQuery(['deck-only', deckId], (db) => getDeck(db, deckId));
  const count = useLocalQuery(['browse-count', ...filterKey], (db) => countNotes(db, filter));
  const items = useLocalQuery(['browse', ...filterKey, pages], (db) => browseNotes(db, filter, pages * PAGE_SIZE));
  const deckNames = useLocalQuery(['browse-decks'], async (db) => {
    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM decks WHERE deleted_at IS NULL ORDER BY created_at',
      [],
    );
    const result: { id: string; path: string }[] = [];
    for (const row of rows) result.push({ id: row.id, path: (await getDeckPath(db, row.id)).join(' › ') });
    return result;
  });

  const move = useLocalMutation((ctx, target: string) => moveNotes(ctx, filter, target));

  // Filter aendern -> wieder bei der ersten Seite beginnen
  const changeFilter =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPages(1);
    };

  const total = count.data ?? 0;
  const shown = items.data ?? [];
  const pathOf = (id: string) => deckNames.data?.find((d) => d.id === id)?.path ?? '';
  const otherDeck = (id: string) => id !== deckId;

  return (
    <Screen
      title={t('flashcards.browse.title')}
      headerLeft={<BackButton />}
      footer={
        <Button
          variant="secondary"
          title={t('flashcards.browse.move', { count: total })}
          disabled={total === 0}
          onPress={() => {
            setMessage(null);
            setMoveTarget(null);
            setMoveOpen(true);
          }}
        />
      }
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {deck.data ? <AppText tone="secondary">{pathOf(deck.data.id) || deck.data.name}</AppText> : null}
        <TextField
          label={t('flashcards.deck.search')}
          value={search}
          onChangeText={changeFilter(setSearch)}
          autoCapitalize="none"
        />
        <ChipSelect<BoxChoice>
          label={t('flashcards.browse.box')}
          value={box}
          onChange={changeFilter(setBox)}
          options={[
            { value: ALL, label: t('flashcards.browse.all') },
            ...BOX_FILTERS.map((value) => ({ value, label: t(`flashcards.box.${value}`) })),
          ]}
        />
        <ChipSelect<LevelChoice>
          label={t('flashcards.note.level')}
          value={level}
          onChange={changeFilter(setLevel)}
          options={[
            { value: ALL, label: t('flashcards.browse.all') },
            { value: NO_LEVEL, label: t('flashcards.note.noLevel') },
            ...LEVELS.map((value) => ({ value, label: value })),
          ]}
        />
        {message ? <FormMessage tone="info" text={message} /> : null}

        <AppText variant="heading">{t('flashcards.browse.count', { count: total })}</AppText>
        {count.data === 0 ? <AppText tone="secondary">{t('flashcards.deck.noResults')}</AppText> : null}
        <View style={styles.list}>
          {shown.map((note) => (
            <ListRow
              key={note.id}
              title={note.title}
              subtitle={[
                note.subtitle,
                note.level,
                otherDeck(note.deckId) ? pathOf(note.deckId).split(' › ').pop() : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => router.push({ pathname: '/cards/[noteId]', params: { noteId: note.id } })}
            />
          ))}
        </View>
        {shown.length < total ? (
          <Button
            variant="secondary"
            title={t('flashcards.browse.more', { shown: shown.length, total })}
            loading={items.isFetching}
            onPress={() => setPages((p) => p + 1)}
          />
        ) : null}
      </ScrollView>

      <BottomSheet
        visible={moveOpen}
        title={t('flashcards.browse.moveTitle', { count: total })}
        onClose={() => setMoveOpen(false)}
        footer={
          <Button
            title={t('flashcards.browse.moveConfirm', { count: total })}
            disabled={!moveTarget}
            loading={move.isPending}
            onPress={() =>
              moveTarget &&
              move.mutate(moveTarget, {
                onSuccess: (moved) => {
                  setMoveOpen(false);
                  setPages(1);
                  setMessage(t('flashcards.browse.moved', { count: moved, path: pathOf(moveTarget) }));
                },
              })
            }
          />
        }
      >
        <ScrollView style={styles.sheetList}>
          <ChipSelect
            label={t('flashcards.browse.moveTo')}
            value={moveTarget ?? ''}
            onChange={setMoveTarget}
            options={(deckNames.data ?? []).map((d) => ({ value: d.id, label: d.path }))}
          />
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.lg },
  list: { gap: spacing.sm },
  sheetList: { maxHeight: 360 },
});
