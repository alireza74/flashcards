// Lernpensum (/pensum?deck=<id>): wie viele neue Karten und Wiederholungen pro Tag, je Deck.
// Bei einem Bereich (z. B. "Spanisch") eine Zeile je Unterdeck und die Summe.
// Aufbau wie beim Karten-Editor: PensumScreen laedt, PensumForm haelt die Eingaben.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { FormMessage } from '@/shared/ui/form-message';
import { BackButton } from '@/shared/ui/header-buttons';
import { Screen } from '@/shared/ui/screen';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { spacing } from '@/shared/ui/theme';

import { NumberStepper } from '../components/number-stepper';
import { getPensum, MAX_PER_DAY, possibleNewPerDay, setDeckLimits, type Limits, type PensumRow } from '../data/pensum';
import { useLocalMutation, useLocalQuery } from '../data/use-local-data';

const NEW_STEP = 5;
const REVIEW_STEP = 50;

export function PensumScreen() {
  const { t } = useTranslation();
  const { deck } = useLocalSearchParams<{ deck: string }>();
  const pensum = useLocalQuery(['pensum', deck], (db) => getPensum(db, deck));
  const title = t('flashcards.pensum.title');

  if (pensum.isPending) {
    return (
      <Screen title={title} headerLeft={<BackButton />}>
        <LoadingState />
      </Screen>
    );
  }
  if (!pensum.data || pensum.data.length === 0) {
    return (
      <Screen title={title} headerLeft={<BackButton />}>
        <ErrorState message={t('flashcards.deck.notFound')} onRetry={() => void pensum.refetch()} />
      </Screen>
    );
  }
  return <PensumForm title={title} rows={pensum.data} />;
}

function PensumForm({ title, rows }: { title: string; rows: PensumRow[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [values, setValues] = useState<Record<string, Limits>>(() =>
    Object.fromEntries(rows.map((row) => [row.deckId, { newPerDay: row.newPerDay, reviewsPerDay: row.reviewsPerDay }])),
  );
  const [error, setError] = useState(false);

  const save = useLocalMutation(async (ctx, _input: void) => {
    for (const row of rows) {
      const value = values[row.deckId];
      if (value.newPerDay !== row.newPerDay || value.reviewsPerDay !== row.reviewsPerDay)
        await setDeckLimits(ctx, row.deckId, value);
    }
  });

  const update = (deckId: string, change: Partial<Limits>) =>
    setValues((current) => ({ ...current, [deckId]: { ...current[deckId], ...change } }));
  const possible = possibleNewPerDay(rows.map((row) => ({ ...row, newPerDay: values[row.deckId].newPerDay })));

  return (
    <Screen
      title={title}
      headerLeft={<BackButton />}
      footer={
        <Button
          title={t('flashcards.pensum.save')}
          loading={save.isPending}
          onPress={() => {
            setError(false);
            save.mutate(undefined, { onSuccess: () => router.back(), onError: () => setError(true) });
          }}
        />
      }
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppText tone="secondary">{t('flashcards.pensum.intro')}</AppText>

        {rows.map((row) => (
          // Leere Decks blasser: einstellbar, liefern aber heute nichts
          <View key={row.deckId} style={row.waitingNew === 0 ? styles.empty : null}>
            <Card title={row.direct ? t('flashcards.pensum.direct', { name: row.name }) : row.name}>
              <NumberStepper
                label={t('flashcards.pensum.newPerDay')}
                value={values[row.deckId].newPerDay}
                onChange={(newPerDay) => update(row.deckId, { newPerDay })}
                step={NEW_STEP}
                max={MAX_PER_DAY}
                decreaseLabel={t('flashcards.pensum.decrease')}
                increaseLabel={t('flashcards.pensum.increase')}
              />
              <NumberStepper
                label={t('flashcards.pensum.reviewsPerDay')}
                value={values[row.deckId].reviewsPerDay}
                onChange={(reviewsPerDay) => update(row.deckId, { reviewsPerDay })}
                step={REVIEW_STEP}
                max={MAX_PER_DAY}
                decreaseLabel={t('flashcards.pensum.decrease')}
                increaseLabel={t('flashcards.pensum.increase')}
              />
              <AppText variant="caption" tone="secondary">
                {row.waitingNew > 0
                  ? t('flashcards.pensum.waiting', { count: row.waitingNew })
                  : t('flashcards.pensum.waitingNone')}
              </AppText>
            </Card>
          </View>
        ))}

        {rows.length > 1 ? (
          <View style={styles.total}>
            <AppText variant="heading">{t('flashcards.pensum.total', { count: possible })}</AppText>
          </View>
        ) : null}
        <AppText variant="caption" tone="secondary">
          {t('flashcards.pensum.reviewsHint')}
        </AppText>
        {error ? <FormMessage tone="error" text={t('common.error')} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.lg },
  total: { paddingHorizontal: spacing.xs },
  empty: { opacity: 0.6 },
});
