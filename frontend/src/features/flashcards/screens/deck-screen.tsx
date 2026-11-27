// Deckseite: Kartei-Box (Faecher anklickbar), Unterdecks, Zeile "Karten ansehen" (eigene Seite /browse). Menue: umbenennen, Unterdeck, loeschen.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/app-text';
import { BottomSheet } from '@/shared/ui/bottom-sheet';
import { Button } from '@/shared/ui/button';
import { BackButton, MoreMenu } from '@/shared/ui/header-buttons';
import { ListRow } from '@/shared/ui/list-row';
import { Screen } from '@/shared/ui/screen';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { TextField } from '@/shared/ui/text-field';
import { spacing } from '@/shared/ui/theme';

import { BoxBar } from '../components/box-bar';
import { countNotes } from '../data/card-browser';
import { createDeck, deleteDeckTree, getDeck, getDeckPath, listChildDecks, renameDeck } from '../data/decks';
import { getDeckCounts } from '../data/stats';
import { useLocalMutation, useLocalQuery } from '../data/use-local-data';

type SheetMode = 'rename' | 'subdeck' | null;

export function DeckScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sheet, setSheet] = useState<SheetMode>(null);
  const [sheetName, setSheetName] = useState('');

  const details = useLocalQuery(['deck', id], async (db) => {
    const deck = await getDeck(db, id);
    if (!deck) return null;
    const now = Date.now();
    const children = [];
    for (const child of await listChildDecks(db, id)) {
      children.push({
        deck: child,
        counts: await getDeckCounts(db, child.id, now),
      });
    }
    return {
      deck,
      path: await getDeckPath(db, id),
      counts: await getDeckCounts(db, id, now),
      noteCount: await countNotes(db, { deckId: id, search: '', level: null, box: null }),
      children,
    };
  });

  const rename = useLocalMutation((ctx, name: string) => renameDeck(ctx, id, name));
  const addSubdeck = useLocalMutation((ctx, name: string) => {
    const parent = details.data?.deck;
    return createDeck(
      ctx,
      {
        name,
        parentId: id,
        kind: parent?.kind ?? 'general',
        lang: parent?.lang ?? null,
      },
      parent?.config_id ?? null,
    );
  });
  const remove = useLocalMutation((ctx) => deleteDeckTree(ctx, id));

  if (details.isPending) {
    return (
      <Screen headerLeft={<BackButton />}>
        <LoadingState />
      </Screen>
    );
  }
  if (details.isError || !details.data) {
    return (
      <Screen headerLeft={<BackButton />}>
        <ErrorState message={t('flashcards.deck.notFound')} onRetry={() => details.refetch()} />
      </Screen>
    );
  }

  const { deck, path, counts, children, noteCount } = details.data;

  function openSheet(mode: SheetMode) {
    setSheetName(mode === 'rename' ? deck.name : '');
    setSheet(mode);
  }

  function saveSheet() {
    const name = sheetName.trim();
    if (!name) return;
    const options = { onSuccess: () => setSheet(null) };
    if (sheet === 'rename') rename.mutate(name, options);
    if (sheet === 'subdeck') addSubdeck.mutate(name, options);
  }

  return (
    <Screen
      title={deck.name}
      headerLeft={<BackButton />}
      headerAction={
        <MoreMenu
          items={[
            {
              key: 'rename',
              label: t('flashcards.deck.rename'),
              onPress: () => openSheet('rename'),
            },
            {
              key: 'subdeck',
              label: t('flashcards.deck.addSubdeck'),
              onPress: () => openSheet('subdeck'),
            },
            {
              key: 'test',
              label: t('flashcards.deck.test'),
              onPress: () => router.push({ pathname: '/quiz', params: { deck: id } }),
            },
            {
              key: 'stats',
              label: t('flashcards.deck.stats'),
              onPress: () => router.push({ pathname: '/stats', params: { deck: id } }),
            },
            {
              key: 'pensum',
              label: t('flashcards.deck.pensum'),
              onPress: () => router.push({ pathname: '/pensum', params: { deck: id } }),
            },
            {
              key: 'import',
              label: t('flashcards.deck.importAnki'),
              onPress: () => router.push({ pathname: '/import', params: { deck: id } }),
            },
            {
              key: 'delete',
              label: t('flashcards.deck.delete'),
              confirmLabel: t('flashcards.deck.deleteConfirm'),
              destructive: true,
              onPress: () => remove.mutate(undefined, { onSuccess: () => router.back() }),
            },
          ]}
        />
      }
      footer={
        <View style={styles.footer}>
          <View style={styles.footerButton}>
            <Button
              variant="secondary"
              title={t('flashcards.deck.addCard')}
              onPress={() => router.push({ pathname: '/cards/new', params: { deck: id } })}
            />
          </View>
          <View style={styles.footerButton}>
            <Button
              title={t('flashcards.study.learn')}
              onPress={() => router.push({ pathname: '/study', params: { deck: id } })}
              disabled={counts.due + counts.newToday === 0}
            />
          </View>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {path.length > 1 ? <AppText tone="secondary">{path.slice(0, -1).join(' › ')}</AppText> : null}

        <BoxBar counts={counts} onSelect={(box) => router.push({ pathname: '/browse', params: { deck: id, box } })} />

        {children.length > 0 ? (
          <View style={styles.section}>
            <AppText variant="heading">{t('flashcards.deck.subdecks')}</AppText>
            {children.map(({ deck: child, counts: childCounts }) => (
              <ListRow
                key={child.id}
                title={child.name}
                subtitle={t('flashcards.today.deckSubtitle', {
                  due: childCounts.due + childCounts.newToday,
                  total: childCounts.total,
                })}
                onPress={() =>
                  router.push({
                    pathname: '/decks/[id]',
                    params: { id: child.id },
                  })
                }
              />
            ))}
          </View>
        ) : null}

        <ListRow
          title={t('flashcards.deck.browseCards')}
          subtitle={t('flashcards.deck.cardCount', { count: noteCount })}
          onPress={() => router.push({ pathname: '/browse', params: { deck: id } })}
        />
      </ScrollView>

      <BottomSheet
        visible={sheet !== null}
        title={sheet === 'rename' ? t('flashcards.deck.rename') : t('flashcards.deck.addSubdeck')}
        onClose={() => setSheet(null)}
        footer={
          <Button
            title={t('flashcards.deck.save')}
            onPress={saveSheet}
            loading={rename.isPending || addSubdeck.isPending}
            disabled={!sheetName.trim()}
          />
        }
      >
        <TextField
          label={sheet === 'rename' ? t('flashcards.deck.name') : t('flashcards.deck.subdeckName')}
          value={sheetName}
          onChangeText={setSheetName}
          maxLength={100}
          autoFocus
        />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.lg },
  section: { gap: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.sm },
  footerButton: { flex: 1 },
});
