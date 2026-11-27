// Lernsitzung (/study, /study?deck=<id>).
// Oben Fortschritt und Rueckgaengig, Mitte die Karte (Tippen deckt auf), unten zwei breite Knoepfe
// mit dem naechsten Termin. Am Ende ein Abschlussbildschirm.
// Waehrend der Sitzung kein Abgleich (sonst ginge Rueckgaengig nicht mehr) - erst beim Verlassen.
//
// Aufbau: StudyScreen laedt die Karten einmal, StudyRun haelt die Sitzung (Startwerte ohne Effekte).

import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/core/auth/auth-provider';
import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { FormMessage } from '@/shared/ui/form-message';
import { BackButton } from '@/shared/ui/header-buttons';
import { Screen } from '@/shared/ui/screen';
import { LoadingState } from '@/shared/ui/states';
import { radius, spacing, usePalette } from '@/shared/ui/theme';

import type { DataContext } from '../data/context';
import { getDeckTreeIds } from '../data/decks';
import { localQueryKey, useDataContext, useLocalQuery } from '../data/use-local-data';
import { loadStudyCards, StudySession, type StudyLoad, type StudyCard } from '../study/queue';
import { intervalLabel, renderTemplate } from '../study/render';
import { answerCard, schedulerConfigOf, undoAnswer, type AnswerRecord } from '../study/review';
import { previewDue, type Rating } from '../study/scheduler';
import { startOfNextStudyDay } from '../study/study-day';
import { requestSync } from '../sync/sync-triggers';

export function StudyScreen() {
  const { t } = useTranslation();
  const { deck } = useLocalSearchParams<{ deck?: string }>();
  const context = useDataContext();
  const load = useLocalQuery(['study-load', deck ?? 'all'], async (db) => {
    const deckIds = deck
      ? await getDeckTreeIds(db, deck)
      : (await db.getAllAsync<{ id: string }>('SELECT id FROM decks WHERE deleted_at IS NULL', [])).map((d) => d.id);
    return { deckIds, load: await loadStudyCards(db, deckIds, deck ?? null, Date.now()) };
  });

  if (load.isPending || context.isPending || !load.data || !context.data) {
    return (
      <Screen title={t('flashcards.study.title')} headerLeft={<BackButton />}>
        <LoadingState />
      </Screen>
    );
  }
  return <StudyRun initial={load.data.load} deckIds={load.data.deckIds} ctx={context.data} />;
}

type Stats = { answered: number; firstSeen: Set<string>; firstCorrect: number; startedAt: number };

function StudyRun({ initial, deckIds, ctx }: { initial: StudyLoad; deckIds: string[]; ctx: DataContext }) {
  const { t } = useTranslation();
  const router = useRouter();
  const palette = usePalette();
  const queryClient = useQueryClient();
  const { session: auth } = useAuth();

  const [session] = useState(() => new StudySession(initial));
  const [current, setCurrent] = useState<StudyCard | null>(() => session.next(Date.now()));
  const [revealed, setRevealed] = useState(false);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [lastAnswer, setLastAnswer] = useState<AnswerRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>(() => ({
    answered: 0,
    firstSeen: new Set(),
    firstCorrect: 0,
    startedAt: Date.now(),
  }));

  const schedulerConfig = schedulerConfigOf(initial.config);
  const buttons: Rating[] = initial.config.answer_buttons === 4 ? [1, 2, 3, 4] : [1, 3];

  // Inhalt und Termine der aktuellen Karte
  const view = useLocalQuery(
    ['study-card', current?.id, current?.reps, current?.state],
    async (db) => {
      const row = await db.getFirstAsync<{ fields: string; front_template: string; back_template: string }>(
        `SELECT n.fields, t.front_template, t.back_template FROM cards c
         JOIN notes n ON n.id = c.note_id
         JOIN card_templates t ON t.note_type_id = n.note_type_id AND t.ord = c.template_ord
         WHERE c.id = ?`,
        [current!.id],
      );
      const fields = JSON.parse(row?.fields ?? '{}') as Record<string, string>;
      const now = Date.now();
      return {
        front: renderTemplate(row?.front_template ?? '', fields),
        back: renderTemplate(row?.back_template ?? '', fields),
        due: await previewDue(schedulerConfig, current!.id, current!, now),
        now,
      };
    },
    current !== null,
  );

  // Beim Verlassen: Anzeige neu laden und abgleichen
  useEffect(() => {
    return () => {
      void queryClient.invalidateQueries({ queryKey: localQueryKey(auth?.user.id) });
      requestSync();
    };
  }, [queryClient, auth?.user.id]);

  async function answer(rating: Rating) {
    if (!current || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const now = Date.now();
      const record = await answerCard(ctx.db, {
        card: current,
        rating,
        now,
        durationMs: now - shownAt,
        config: schedulerConfig,
        newId: ctx.newId,
        organizationId: ctx.organizationId,
      });
      session.answered(record.updatedCard, now);
      setStats((s) => {
        const isFirst = !s.firstSeen.has(current.id);
        const firstSeen = new Set(s.firstSeen).add(current.id);
        return {
          ...s,
          answered: s.answered + 1,
          firstSeen,
          firstCorrect: s.firstCorrect + (isFirst && rating > 1 ? 1 : 0),
        };
      });
      setLastAnswer(record);
      setCurrent(session.next(Date.now()));
      setRevealed(false);
      setShownAt(Date.now());
    } catch {
      setMessage(t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!lastAnswer || busy) return;
    setBusy(true);
    try {
      const ok = await undoAnswer(ctx.db, lastAnswer, Date.now());
      if (!ok) {
        setMessage(t('flashcards.study.undoNotPossible'));
        return;
      }
      const restored = { ...lastAnswer.updatedCard, ...pickCardState(lastAnswer.previousCardRow) };
      session.undo(restored);
      setStats((s) => ({ ...s, answered: Math.max(0, s.answered - 1) }));
      setLastAnswer(null);
      setCurrent(session.next(Date.now()));
      setRevealed(false);
      setShownAt(Date.now());
    } finally {
      setBusy(false);
    }
  }

  // Tastatur im Browser: Leertaste/Enter = aufdecken bzw. "Gewusst", 1-4 = Knopf, Strg+Z/u = rueckgaengig
  const handlers = useRef({ answer, undo, reveal: () => setRevealed(true), revealed, buttons });
  useEffect(() => {
    handlers.current = { answer, undo, reveal: () => setRevealed(true), revealed, buttons };
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      const h = handlers.current;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') return void h.undo();
      if (event.key === 'u') return void h.undo();
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        return h.revealed ? void h.answer(3) : h.reveal();
      }
      const index = Number(event.key) - 1;
      if (h.revealed && index >= 0 && index < h.buttons.length) void h.answer(h.buttons[index]);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const total = stats.answered + session.remaining + (current ? 1 : 0);
  const header = (
    <Button
      variant="link"
      title={t('flashcards.study.undo')}
      onPress={() => void undo()}
      disabled={!lastAnswer || busy}
    />
  );

  if (!current) {
    return <StudySummary stats={stats} deckIds={deckIds} onDone={() => router.back()} />;
  }

  return (
    <Screen
      title={t('flashcards.study.title')}
      headerLeft={<BackButton />}
      headerAction={header}
      footer={
        revealed ? (
          <View style={styles.answerRow}>
            {buttons.map((rating) => {
              const due = view.data?.due[rating];
              const label = due !== undefined && view.data ? intervalLabel(due - view.data.now) : null;
              return (
                <View key={rating} style={styles.answerButton}>
                  <Button
                    variant={rating === 1 ? 'secondary' : 'primary'}
                    title={`${t(`flashcards.study.rating.${rating}`)}${
                      label ? ` · ${t(`flashcards.study.interval.${label.unit}`, { count: label.count })}` : ''
                    }`}
                    onPress={() => void answer(rating)}
                    disabled={busy}
                  />
                </View>
              );
            })}
          </View>
        ) : (
          <Button title={t('flashcards.study.show')} onPress={() => setRevealed(true)} />
        )
      }
    >
      <View style={[styles.progressTrack, { backgroundColor: palette.surface }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: palette.primary, flex: total > 0 ? stats.answered / total : 0 },
          ]}
        />
        <View style={{ flex: total > 0 ? 1 - stats.answered / total : 1 }} />
      </View>
      <AppText variant="caption" tone="secondary">
        {t('flashcards.study.progress', { done: stats.answered, total })}
      </AppText>

      <Pressable
        role="button"
        aria-label={t('flashcards.study.show')}
        onPress={() => setRevealed(true)}
        disabled={revealed}
        style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
      >
        <ScrollView contentContainerStyle={styles.cardContent}>
          <AppText style={[styles.cardText, { color: palette.text }]}>{view.data?.front ?? ''}</AppText>
          {revealed ? (
            <>
              <View style={[styles.divider, { backgroundColor: palette.border }]} />
              <AppText style={[styles.cardText, { color: palette.text }]}>{view.data?.back ?? ''}</AppText>
            </>
          ) : (
            <AppText tone="secondary">{t('flashcards.study.tapToShow')}</AppText>
          )}
        </ScrollView>
      </Pressable>

      {message ? <FormMessage tone="error" text={message} /> : null}
    </Screen>
  );
}

function pickCardState(row: Record<string, unknown>) {
  return {
    state: Number(row.state),
    due_at: Number(row.due_at),
    last_review_at: row.last_review_at === null ? null : Number(row.last_review_at),
    stability: Number(row.stability),
    stability_fast: Number(row.stability_fast),
    difficulty: Number(row.difficulty),
    scheduled_days: Number(row.scheduled_days),
    learning_step: Number(row.learning_step),
    reps: Number(row.reps),
    lapses: Number(row.lapses),
  };
}

function StudySummary({ stats, deckIds, onDone }: { stats: Stats; deckIds: string[]; onDone: () => void }) {
  const { t } = useTranslation();
  const palette = usePalette();
  const [finishedAt] = useState(() => Date.now());
  const tomorrow = useLocalQuery(['study-tomorrow', deckIds.join(',')], async (db) => {
    if (deckIds.length === 0) return 0;
    const start = startOfNextStudyDay(finishedAt);
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT count(*) AS n FROM cards WHERE deleted_at IS NULL AND suspended = 0 AND state <> 0
       AND due_at < ? AND deck_id IN (${deckIds.map(() => '?').join(', ')})`,
      [start + 86_400_000, ...deckIds],
    );
    return row?.n ?? 0;
  });

  const percent = stats.firstSeen.size > 0 ? Math.round((stats.firstCorrect / stats.firstSeen.size) * 100) : 0;
  const minutes = Math.max(1, Math.round((finishedAt - stats.startedAt) / 60_000));

  return (
    <Screen
      title={t('flashcards.study.doneTitle')}
      footer={<Button title={t('flashcards.study.finish')} onPress={onDone} />}
    >
      {stats.answered === 0 ? (
        <AppText tone="secondary">{t('flashcards.study.nothingDue')}</AppText>
      ) : (
        <View style={styles.summary}>
          <AppText style={[styles.bigNumber, { color: palette.text }]}>{stats.firstSeen.size}</AppText>
          <AppText tone="secondary">{t('flashcards.study.doneCards')}</AppText>
          <AppText>{t('flashcards.study.doneCorrect', { percent })}</AppText>
          <AppText>{t('flashcards.study.doneDuration', { minutes })}</AppText>
          <AppText>{t('flashcards.study.doneTomorrow', { count: tomorrow.data ?? 0 })}</AppText>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressTrack: { flexDirection: 'row', height: 6, borderRadius: radius.sm, overflow: 'hidden' },
  progressFill: { height: 6 },
  card: { flex: 1, borderWidth: 1, borderRadius: radius.md, marginVertical: spacing.md, minHeight: 240 },
  cardContent: { padding: spacing.lg, gap: spacing.lg, alignItems: 'center' },
  cardText: { fontSize: 24, lineHeight: 32, textAlign: 'center' },
  divider: { height: 1, alignSelf: 'stretch' },
  answerRow: { flexDirection: 'row', gap: spacing.sm },
  answerButton: { flex: 1 },
  summary: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  bigNumber: { fontSize: 64, fontWeight: '700', lineHeight: 72 },
});
