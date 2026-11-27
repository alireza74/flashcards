// Testmodus (/quiz?deck=<id>, Datei app/quiz.tsx - "test.tsx" haelt Jest fuer eine Testdatei): Auswahl -> Test (aufdecken, Gewusst / Nicht gewusst) -> Ergebnis.
// Die Termine der Karten bleiben unveraendert (Logik und Regeln: study/test-mode.ts).
// Tastatur im Browser: Leertaste = aufdecken, dann 1 = nicht gewusst, 2 oder Enter = gewusst, u = rueckgaengig.

import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/core/auth/auth-provider';
import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { ChipSelect } from '@/shared/ui/chip-select';
import { FormMessage } from '@/shared/ui/form-message';
import { BackButton } from '@/shared/ui/header-buttons';
import { Screen } from '@/shared/ui/screen';
import { LoadingState } from '@/shared/ui/states';
import { radius, spacing, usePalette } from '@/shared/ui/theme';

import { useBoxColors } from '../components/box-bar';
import { ProgressRing } from '../components/progress-ring';
import { BOX_FILTERS } from '../data/card-browser';
import type { DataContext } from '../data/context';
import { getDeck } from '../data/decks';
import { LEVELS, type Level } from '../data/notes';
import { localQueryKey, useDataContext, useLocalQuery } from '../data/use-local-data';
import { renderTemplate } from '../study/render';
import {
  pickTestCards,
  recordTestAnswer,
  relearnCards,
  undoTestAnswer,
  type TestAnswer,
  type TestCard,
  type TestDirection,
  type TestOptions,
  type TestScope,
} from '../study/test-mode';
import { requestSync } from '../sync/sync-triggers';

const ALL = 'all';
const COUNTS = ['10', '20', '50', ALL] as const;
type CountChoice = (typeof COUNTS)[number];
type LevelChoice = Level | typeof ALL;

type Phase =
  | { kind: 'setup'; message: string | null }
  | { kind: 'run'; cards: TestCard[] }
  | { kind: 'result'; cards: TestCard[]; answers: TestAnswer[] };

export function TestScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { deck: deckId } = useLocalSearchParams<{ deck: string }>();
  const context = useDataContext();
  const deck = useLocalQuery(['deck-only', deckId], (db) => getDeck(db, deckId));
  const queryClient = useQueryClient();
  const { session } = useAuth();

  const [phase, setPhase] = useState<Phase>({ kind: 'setup', message: null });
  const [count, setCount] = useState<CountChoice>('20');
  const [scope, setScope] = useState<TestScope>('learned');
  const [level, setLevel] = useState<LevelChoice>(ALL);
  const [direction, setDirection] = useState<TestDirection>('cards');

  // Beim Verlassen: Anzeige neu laden und Testantworten senden
  useEffect(() => {
    return () => {
      void queryClient.invalidateQueries({ queryKey: localQueryKey(session?.user.id) });
      requestSync();
    };
  }, [queryClient, session?.user.id]);

  const ctx = context.data;
  if (!ctx || !deck.data) {
    return (
      <Screen title={t('flashcards.test.title')} headerLeft={<BackButton />}>
        <LoadingState />
      </Screen>
    );
  }

  async function start(options: Omit<TestOptions, 'deckId'>, only?: TestCard[]) {
    const cards = only ?? (await pickTestCards(ctx!.db, { deckId, ...options }));
    if (cards.length === 0) {
      setPhase({ kind: 'setup', message: t('flashcards.test.noCards') });
      return;
    }
    setPhase({ kind: 'run', cards });
  }

  const options: Omit<TestOptions, 'deckId'> = {
    count: count === ALL ? null : Number(count),
    scope,
    level: level === ALL ? null : level,
    direction,
  };

  if (phase.kind === 'run') {
    return (
      <TestRun
        key={phase.cards.map((c) => c.id).join(',')}
        ctx={ctx}
        cards={phase.cards}
        onFinish={(answers) => setPhase({ kind: 'result', cards: phase.cards, answers })}
      />
    );
  }
  if (phase.kind === 'result') {
    return (
      <TestResult
        ctx={ctx}
        cards={phase.cards}
        answers={phase.answers}
        onRetryWrong={(wrong) => void start(options, wrong)}
        onNewTest={() => setPhase({ kind: 'setup', message: null })}
        onDone={() => router.back()}
      />
    );
  }

  return (
    <Screen
      title={t('flashcards.test.title')}
      headerLeft={<BackButton />}
      footer={<Button title={t('flashcards.test.start')} onPress={() => void start(options)} />}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <AppText tone="secondary">{t('flashcards.test.intro', { name: deck.data.name })}</AppText>
        <ChipSelect<CountChoice>
          label={t('flashcards.test.count')}
          value={count}
          onChange={setCount}
          options={COUNTS.map((value) => ({ value, label: value === ALL ? t('flashcards.browse.all') : value }))}
        />
        <ChipSelect<TestScope>
          label={t('flashcards.test.scope')}
          value={scope}
          onChange={setScope}
          options={[
            { value: 'learned', label: t('flashcards.test.scopeLearned') },
            { value: 'all', label: t('flashcards.browse.all') },
            ...BOX_FILTERS.map((value) => ({ value, label: t(`flashcards.box.${value}`) })),
          ]}
        />
        <ChipSelect<LevelChoice>
          label={t('flashcards.note.level')}
          value={level}
          onChange={setLevel}
          options={[
            { value: ALL, label: t('flashcards.browse.all') },
            ...LEVELS.map((value) => ({ value, label: value })),
          ]}
        />
        <ChipSelect<TestDirection>
          label={t('flashcards.test.direction')}
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'cards', label: t('flashcards.test.directionCards') },
            { value: 'forward', label: t('flashcards.test.directionForward') },
            { value: 'reverse', label: t('flashcards.test.directionReverse') },
          ]}
        />
        <AppText variant="caption" tone="secondary">
          {t('flashcards.test.noEffect')}
        </AppText>
        {phase.message ? <FormMessage tone="info" text={phase.message} /> : null}
      </ScrollView>
    </Screen>
  );
}

function TestRun({
  ctx,
  cards,
  onFinish,
}: {
  ctx: DataContext;
  cards: TestCard[];
  onFinish: (answers: TestAnswer[]) => void;
}) {
  const { t } = useTranslation();
  const palette = usePalette();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<TestAnswer[]>([]);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const current = cards[index];

  const view = useLocalQuery(['test-card', current?.id], async (db) => {
    const row = await db.getFirstAsync<{ fields: string; front_template: string; back_template: string }>(
      `SELECT n.fields, t.front_template, t.back_template FROM cards c
       JOIN notes n ON n.id = c.note_id
       JOIN card_templates t ON t.note_type_id = n.note_type_id AND t.ord = c.template_ord
       WHERE c.id = ?`,
      [current.id],
    );
    const fields = JSON.parse(row?.fields ?? '{}') as Record<string, string>;
    return {
      front: renderTemplate(row?.front_template ?? '', fields),
      back: renderTemplate(row?.back_template ?? '', fields),
    };
  });

  async function answer(known: boolean) {
    if (!current || busy || !revealed) return;
    setBusy(true);
    setMessage(null);
    try {
      const record = await recordTestAnswer(ctx, current.id, known, Date.now() - shownAt);
      const next = [...answers, record];
      setAnswers(next);
      if (index + 1 >= cards.length) {
        onFinish(next);
        return;
      }
      setIndex(index + 1);
      setRevealed(false);
      setShownAt(Date.now());
    } catch {
      setMessage(t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    const last = answers[answers.length - 1];
    if (!last || busy) return;
    setBusy(true);
    try {
      if (!(await undoTestAnswer(ctx.db, last))) {
        setMessage(t('flashcards.study.undoNotPossible'));
        return;
      }
      setAnswers(answers.slice(0, -1));
      setIndex(index - 1);
      setRevealed(false);
      setShownAt(Date.now());
    } finally {
      setBusy(false);
    }
  }

  const handlers = useRef({ answer, undo, reveal: () => setRevealed(true), revealed });
  useEffect(() => {
    handlers.current = { answer, undo, reveal: () => setRevealed(true), revealed };
  });
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      const h = handlers.current;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') return void h.undo();
      if (event.key === 'u') return void h.undo();
      if (!h.revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        return h.reveal();
      }
      if (h.revealed && event.key === '1') return void h.answer(false);
      if (h.revealed && (event.key === '2' || event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        return void h.answer(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const done = answers.length;
  return (
    <Screen
      title={t('flashcards.test.title')}
      headerLeft={<BackButton />}
      headerAction={
        <Button
          variant="link"
          title={t('flashcards.study.undo')}
          onPress={() => void undo()}
          disabled={!done || busy}
        />
      }
      footer={
        revealed ? (
          <View style={styles.answerRow}>
            <View style={styles.answerButton}>
              <Button
                variant="secondary"
                title={t('flashcards.test.unknown')}
                onPress={() => void answer(false)}
                disabled={busy}
              />
            </View>
            <View style={styles.answerButton}>
              <Button title={t('flashcards.test.known')} onPress={() => void answer(true)} disabled={busy} />
            </View>
          </View>
        ) : (
          <Button title={t('flashcards.study.show')} onPress={() => setRevealed(true)} />
        )
      }
    >
      <View style={[styles.progressTrack, { backgroundColor: palette.surface }]}>
        <View style={[styles.progressFill, { backgroundColor: palette.primary, flex: done / cards.length }]} />
        <View style={{ flex: 1 - done / cards.length }} />
      </View>
      <AppText variant="caption" tone="secondary">
        {t('flashcards.test.progress', { done: index + 1, total: cards.length })}
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

function TestResult({
  ctx,
  cards,
  answers,
  onRetryWrong,
  onNewTest,
  onDone,
}: {
  ctx: DataContext;
  cards: TestCard[];
  answers: TestAnswer[];
  onRetryWrong: (wrong: TestCard[]) => void;
  onNewTest: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const palette = usePalette();
  const boxColors = useBoxColors();
  const [relearned, setRelearned] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const known = answers.filter((a) => a.known).length;
  const percent = answers.length ? Math.round((known / answers.length) * 100) : 0;
  const wrongIds = new Set(answers.filter((a) => !a.known).map((a) => a.cardId));
  const wrongCards = cards.filter((c) => wrongIds.has(c.id));

  const wrongTexts = useLocalQuery(['test-wrong', [...wrongIds].join(',')], async (db) => {
    const result: { id: string; front: string; back: string }[] = [];
    for (const card of wrongCards) {
      const row = await db.getFirstAsync<{ fields: string; front_template: string; back_template: string }>(
        `SELECT n.fields, t.front_template, t.back_template FROM cards c
         JOIN notes n ON n.id = c.note_id
         JOIN card_templates t ON t.note_type_id = n.note_type_id AND t.ord = c.template_ord
         WHERE c.id = ?`,
        [card.id],
      );
      const fields = JSON.parse(row?.fields ?? '{}') as Record<string, string>;
      result.push({
        id: card.id,
        front: renderTemplate(row?.front_template ?? '', fields),
        back: renderTemplate(row?.back_template ?? '', fields).split('\n')[0],
      });
    }
    return result;
  });

  async function relearn() {
    setBusy(true);
    try {
      setRelearned(await relearnCards(ctx, [...wrongIds]));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title={t('flashcards.test.resultTitle')}
      footer={
        <View style={styles.footer}>
          {wrongCards.length > 0 ? (
            <Button
              title={t('flashcards.test.retryWrong', { count: wrongCards.length })}
              onPress={() => onRetryWrong(wrongCards)}
            />
          ) : null}
          <Button variant="secondary" title={t('flashcards.test.newTest')} onPress={onNewTest} />
          <Button variant="link" title={t('flashcards.study.finish')} onPress={onDone} />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.resultHero}>
          <ProgressRing
            ratio={answers.length ? known / answers.length : 0}
            color={percent >= 80 ? boxColors.mature : palette.primary}
            label={t('flashcards.test.score', { known, total: answers.length, percent })}
          >
            <AppText style={[styles.percent, { color: palette.text }]}>{`${percent} %`}</AppText>
          </ProgressRing>
          <AppText variant="heading">{t('flashcards.test.score', { known, total: answers.length, percent })}</AppText>
        </View>

        {wrongCards.length > 0 ? (
          <View style={styles.wrongList}>
            <AppText variant="heading">{t('flashcards.test.wrongTitle')}</AppText>
            {wrongTexts.data?.map((item) => (
              <View key={item.id} style={[styles.wrongRow, { borderColor: palette.border }]}>
                <AppText variant="label">{item.front}</AppText>
                <AppText variant="caption" tone="secondary">
                  {item.back}
                </AppText>
              </View>
            ))}
            {relearned === null ? (
              <>
                <Button
                  variant="secondary"
                  title={t('flashcards.test.relearn', { count: wrongCards.length })}
                  onPress={() => void relearn()}
                  loading={busy}
                />
                <AppText variant="caption" tone="secondary">
                  {t('flashcards.test.relearnHint')}
                </AppText>
              </>
            ) : (
              <FormMessage tone="info" text={t('flashcards.test.relearned', { count: relearned })} />
            )}
          </View>
        ) : (
          <AppText tone="secondary">{t('flashcards.test.allKnown')}</AppText>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.lg },
  footer: { gap: spacing.sm },
  progressTrack: { flexDirection: 'row', height: 6, borderRadius: radius.sm, overflow: 'hidden' },
  progressFill: { height: 6 },
  card: { flex: 1, borderWidth: 1, borderRadius: radius.md, marginVertical: spacing.md, minHeight: 240 },
  cardContent: { padding: spacing.lg, gap: spacing.lg, alignItems: 'center' },
  cardText: { fontSize: 24, lineHeight: 32, textAlign: 'center' },
  divider: { height: 1, alignSelf: 'stretch' },
  answerRow: { flexDirection: 'row', gap: spacing.sm },
  answerButton: { flex: 1 },
  resultHero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  percent: { fontSize: 36, fontWeight: '700', lineHeight: 44 },
  wrongList: { gap: spacing.sm },
  wrongRow: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
});
