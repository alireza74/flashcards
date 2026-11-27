// Anki-Deck importieren (/import?deck=<id>). Ablauf auf einer Seite:
//   Datei waehlen -> lesen -> Zuordnung je Anki-Notiztyp + Niveau -> Vorschau -> Import mit Fortschritt -> fertig.
// Die Logik steckt in features/flashcards/import/ (getestet); diese Seite haelt nur den Ablauf.

import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useAuth } from '@/core/auth/auth-provider';
import { reportError } from '@/core/monitoring/error-sink';
import { AppText } from '@/shared/ui/app-text';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { ChipSelect } from '@/shared/ui/chip-select';
import { FormMessage } from '@/shared/ui/form-message';
import { BackButton } from '@/shared/ui/header-buttons';
import { Screen } from '@/shared/ui/screen';
import { ErrorState, LoadingState } from '@/shared/ui/states';
import { radius, spacing, usePalette } from '@/shared/ui/theme';

import type { DataContext } from '../data/context';
import { getDeck, getDeckPath, listChildDecks, type Deck } from '../data/decks';
import { LEVELS, type Level } from '../data/notes';
import { localQueryKey, useDataContext, useLocalQuery } from '../data/use-local-data';
import { SYSTEM_NOTE_TYPE_IDS } from '../db/system-note-types';
import { requestSync } from '../sync/sync-triggers';
import { AnkiReadError, readAnkiPackage, type AnkiModel, type AnkiPackage } from '../import/anki-package';
import {
  IMPORT_NOTE_TYPE_IDS,
  loadMapping,
  saveMapping,
  suggestFields,
  targetFieldKeys,
  type ModelMapping,
} from '../import/field-mapping';
import { buildImportPlan, type ImportGroup, type ImportPlan } from '../import/import-plan';
import { openExpoAnkiDb, pickAnkiFile } from '../import/open-anki-file';
import { runImport, selectNotes, type ImportChoice, type ImportResult } from '../import/run-import';

const NO_LEVEL = 'none';
const EMPTY_FIELD = 'empty';
type LevelChoice = Level | typeof NO_LEVEL;

const NOTE_TYPE_LABEL_KEYS: Record<string, 'basic' | 'basicReverse' | 'vocabulary'> = {
  [SYSTEM_NOTE_TYPE_IDS.basic]: 'basic',
  [SYSTEM_NOTE_TYPE_IDS.basicReverse]: 'basicReverse',
  [SYSTEM_NOTE_TYPE_IDS.vocabulary]: 'vocabulary',
};

type Step =
  | { kind: 'pick'; error: string | null }
  | { kind: 'busy'; text: string }
  | { kind: 'setup'; pkg: AnkiPackage; mappings: Record<string, ModelMapping> }
  | { kind: 'preview'; pkg: AnkiPackage; mappings: Record<string, ModelMapping>; plan: ImportPlan }
  | { kind: 'importing'; done: number; total: number }
  | { kind: 'done'; result: ImportResult }
  | { kind: 'failed' };

export function ImportScreen() {
  const { t } = useTranslation();
  const { deck: deckId } = useLocalSearchParams<{ deck: string }>();
  const context = useDataContext();
  const target = useLocalQuery(['import-target', deckId], async (db) => {
    const deck = await getDeck(db, deckId);
    if (!deck) return null;
    // Bei einem Bereich (oberstes Deck) waehlt man das Unterdeck, in das die Karten kommen
    const children = deck.parent_id === null ? await listChildDecks(db, deckId) : [];
    return { deck, path: await getDeckPath(db, deckId), children };
  });

  const title = t('flashcards.import.title');
  if (target.isPending || context.isPending) {
    return (
      <Screen title={title} headerLeft={<BackButton />}>
        <LoadingState />
      </Screen>
    );
  }
  if (!target.data || !context.data) {
    return (
      <Screen title={title} headerLeft={<BackButton />}>
        <ErrorState message={t('flashcards.deck.notFound')} onRetry={() => void target.refetch()} />
      </Screen>
    );
  }
  return (
    <ImportFlow ctx={context.data} start={target.data.deck} path={target.data.path} subdecks={target.data.children} />
  );
}

type ImportFlowProps = { ctx: DataContext; start: Deck; path: string[]; subdecks: Deck[] };

function ImportFlow({ ctx, start, path, subdecks }: ImportFlowProps) {
  const { t } = useTranslation();
  // Ziel: Vorschlag Vokabeln (bei einem Sprachbereich), sonst das erste Unterdeck, sonst das Deck selbst
  const [targetId, setTargetId] = useState(
    () => (subdecks.find((d) => d.kind === 'vocabulary') ?? subdecks[0] ?? start).id,
  );
  const deck = subdecks.find((d) => d.id === targetId) ?? start;
  const targetPath = deck.id === start.id ? path : [...path, deck.name];
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [step, setStep] = useState<Step>({ kind: 'pick', error: null });
  const [level, setLevel] = useState<LevelChoice>(NO_LEVEL);
  const [choice, setChoice] = useState<ImportChoice>({ includeSame: false, includeVariants: true });
  const [alignDirection, setAlignDirection] = useState(true);

  async function pickFile() {
    let file;
    try {
      file = await pickAnkiFile();
    } catch (error) {
      reportError(error, { level: 'warning', context: { source: 'anki import pick' } });
      setStep({ kind: 'pick', error: t('flashcards.import.errors.generic') });
      return;
    }
    if (!file) return;
    setStep({ kind: 'busy', text: t('flashcards.import.reading') });
    try {
      const pkg = await readAnkiPackage(file.bytes, openExpoAnkiDb);
      const mappings: Record<string, ModelMapping> = {};
      for (const model of pkg.models)
        if (!model.isCloze) mappings[model.id] = await loadMapping(ctx.db, model, deck.kind);
      setStep({ kind: 'setup', pkg, mappings });
    } catch (error) {
      const code = error instanceof AnkiReadError ? error.code : 'generic';
      if (code === 'generic') reportError(error, { level: 'warning', context: { source: 'anki import read' } });
      setStep({ kind: 'pick', error: t(`flashcards.import.errors.${code}`) });
    }
  }

  async function toPreview(pkg: AnkiPackage, mappings: Record<string, ModelMapping>, align = alignDirection) {
    setStep({ kind: 'busy', text: t('flashcards.import.reading') });
    for (const [modelId, mapping] of Object.entries(mappings)) await saveMapping(ctx.db, modelId, mapping);
    const plan = await buildImportPlan(ctx.db, pkg, { lang: deck.lang, mappings, alignDirection: align });
    setStep({ kind: 'preview', pkg, mappings, plan });
  }

  async function startImport(plan: ImportPlan) {
    try {
      const result = await runImport(
        ctx,
        plan,
        {
          deckId: deck.id,
          kind: deck.kind,
          lang: deck.lang,
          configId: deck.config_id,
          level: level === NO_LEVEL ? null : level,
        },
        choice,
        async (done, total) => {
          setStep({ kind: 'importing', done, total });
          await new Promise((resolve) => setTimeout(resolve, 0)); // Anzeige zwischen den Paketen erneuern
        },
      );
      setStep({ kind: 'done', result });
    } catch (error) {
      reportError(error, { level: 'warning', context: { source: 'anki import' } });
      setStep({ kind: 'failed' });
    } finally {
      await queryClient.invalidateQueries({ queryKey: localQueryKey(session?.user.id) });
      requestSync();
    }
  }

  const title = t('flashcards.import.title');
  // Waehrend des Imports kein Zurueck (der Import liefe sonst unsichtbar weiter)
  const headerLeft = step.kind === 'importing' ? undefined : <BackButton />;

  if (step.kind === 'busy' || step.kind === 'importing') {
    const progress = step.kind === 'importing' ? step : null;
    const busyText = step.kind === 'busy' ? step.text : '';
    return (
      <Screen title={title} headerLeft={headerLeft}>
        <View style={styles.content}>
          <AppText>
            {progress ? t('flashcards.import.importing', { done: progress.done, total: progress.total }) : busyText}
          </AppText>
          {progress ? <ProgressBar value={progress.total ? progress.done / progress.total : 0} /> : <LoadingState />}
        </View>
      </Screen>
    );
  }

  if (step.kind === 'pick') {
    return (
      <Screen
        title={title}
        headerLeft={headerLeft}
        footer={
          <Button
            title={step.error ? t('flashcards.import.pickOther') : t('flashcards.import.pick')}
            onPress={pickFile}
          />
        }
      >
        <ScrollView contentContainerStyle={styles.content}>
          {subdecks.length > 0 ? (
            <ChipSelect
              label={t('flashcards.import.target')}
              value={targetId}
              onChange={setTargetId}
              options={[
                ...subdecks.map((d) => ({ value: d.id, label: d.name })),
                { value: start.id, label: t('flashcards.import.targetDirect', { name: start.name }) },
              ]}
            />
          ) : null}
          <AppText>{t('flashcards.import.intro', { path: targetPath.join(' › ') })}</AppText>
          <AppText tone="secondary">{t('flashcards.import.introDetails')}</AppText>
          {step.error ? <FormMessage tone="error" text={step.error} /> : null}
        </ScrollView>
      </Screen>
    );
  }

  if (step.kind === 'setup') {
    const { pkg, mappings } = step;
    const setMapping = (modelId: string, mapping: ModelMapping) =>
      setStep({ ...step, mappings: { ...mappings, [modelId]: mapping } });
    return (
      <Screen
        title={title}
        headerLeft={headerLeft}
        footer={<Button title={t('flashcards.import.toPreview')} onPress={() => void toPreview(pkg, mappings)} />}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {pkg.models.map((model) =>
            model.isCloze ? (
              <AppText key={model.id} tone="secondary">
                {t('flashcards.import.clozeSkipped', { name: model.name, count: model.noteCount })}
              </AppText>
            ) : (
              <ModelMappingCard
                key={model.id}
                model={model}
                mapping={mappings[model.id]}
                onChange={(mapping) => setMapping(model.id, mapping)}
              />
            ),
          )}
          {deck.lang ? (
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
        </ScrollView>
      </Screen>
    );
  }

  if (step.kind === 'preview') {
    const { plan } = step;
    const count = selectNotes(plan, choice).length;
    return (
      <Screen
        title={title}
        headerLeft={headerLeft}
        footer={
          <View style={styles.footer}>
            <Button
              title={t('flashcards.import.start', { count })}
              onPress={() => void startImport(plan)}
              disabled={count === 0}
            />
            <Button
              variant="secondary"
              title={t('flashcards.import.back')}
              onPress={() => setStep({ kind: 'setup', pkg: step.pkg, mappings: step.mappings })}
            />
          </View>
        }
      >
        <ScrollView contentContainerStyle={styles.content}>
          {plan.swappable > 0 ? (
            <Card title={t('flashcards.import.swapTitle', { count: plan.swappable })}>
              <AppText tone="secondary">{t('flashcards.import.swapText')}</AppText>
              <ChipSelect<'yes' | 'no'>
                value={alignDirection ? 'yes' : 'no'}
                onChange={(value) => {
                  setAlignDirection(value === 'yes');
                  void toPreview(step.pkg, step.mappings, value === 'yes'); // Duplikate neu vergleichen
                }}
                options={[
                  { value: 'yes', label: t('flashcards.import.swapYes') },
                  { value: 'no', label: t('flashcards.import.swapNo') },
                ]}
              />
            </Card>
          ) : null}
          <GroupCard plan={plan} group="new" />
          <GroupCard
            plan={plan}
            group="variant"
            included={choice.includeVariants}
            onToggle={(includeVariants) => setChoice({ ...choice, includeVariants })}
          />
          <GroupCard
            plan={plan}
            group="same"
            included={choice.includeSame}
            onToggle={(includeSame) => setChoice({ ...choice, includeSame })}
          />
          <GroupCard plan={plan} group="known" />
          {plan.subdecks.length > 0 ? (
            <AppText tone="secondary">
              {t('flashcards.import.subdecks', { list: plan.subdecks.map((p) => p.join(' › ')).join(', ') })}
            </AppText>
          ) : null}
          {plan.withMedia > 0 ? (
            <FormMessage tone="info" text={t('flashcards.import.media', { count: plan.withMedia })} />
          ) : null}
          {plan.skippedCloze > 0 ? (
            <AppText tone="secondary">{t('flashcards.import.skippedCloze', { count: plan.skippedCloze })}</AppText>
          ) : null}
          {plan.skippedEmpty > 0 ? (
            <AppText tone="secondary">{t('flashcards.import.skippedEmpty', { count: plan.skippedEmpty })}</AppText>
          ) : null}
        </ScrollView>
      </Screen>
    );
  }

  // fertig oder abgebrochen
  return (
    <Screen
      title={title}
      headerLeft={headerLeft}
      footer={<Button title={t('flashcards.import.toDeck')} onPress={() => router.back()} />}
    >
      <View style={styles.content}>
        {step.kind === 'done' ? (
          <>
            <AppText variant="heading">{t('flashcards.import.doneTitle')}</AppText>
            <AppText>{t('flashcards.import.doneText', { notes: step.result.notes, cards: step.result.cards })}</AppText>
            {step.result.decksCreated > 0 ? (
              <AppText tone="secondary">
                {t('flashcards.import.doneDecks', { count: step.result.decksCreated })}
              </AppText>
            ) : null}
          </>
        ) : (
          <FormMessage tone="error" text={t('flashcards.import.failed')} />
        )}
      </View>
    </Screen>
  );
}

function ModelMappingCard({
  model,
  mapping,
  onChange,
}: {
  model: AnkiModel;
  mapping: ModelMapping;
  onChange: (mapping: ModelMapping) => void;
}) {
  const { t } = useTranslation();
  const fieldOptions = [
    ...model.fields.map((field) => ({ value: String(field.ord), label: field.name })),
    { value: EMPTY_FIELD, label: t('flashcards.import.emptyField') },
  ];
  return (
    <Card title={t('flashcards.import.modelTitle', { name: model.name, count: model.noteCount })}>
      <ChipSelect
        label={t('flashcards.import.noteType')}
        value={mapping.noteTypeId}
        onChange={(noteTypeId) => onChange({ noteTypeId, fields: suggestFields(model, noteTypeId) })}
        options={IMPORT_NOTE_TYPE_IDS.map((id) => ({
          value: id,
          label: t(`flashcards.import.noteTypes.${NOTE_TYPE_LABEL_KEYS[id]}`),
        }))}
      />
      {targetFieldKeys(mapping.noteTypeId).map((key) => {
        const ord = mapping.fields[key];
        return (
          <ChipSelect
            key={key}
            label={t(`flashcards.note.fields.${key}`, { defaultValue: key })}
            value={ord === null || ord === undefined ? EMPTY_FIELD : String(ord)}
            onChange={(value) =>
              onChange({
                ...mapping,
                fields: { ...mapping.fields, [key]: value === EMPTY_FIELD ? null : Number(value) },
              })
            }
            options={fieldOptions}
          />
        );
      })}
    </Card>
  );
}

const EXAMPLES_PER_GROUP = 3;

function GroupCard({
  plan,
  group,
  included,
  onToggle,
}: {
  plan: ImportPlan;
  group: ImportGroup;
  included?: boolean;
  onToggle?: (include: boolean) => void;
}) {
  const { t } = useTranslation();
  const count = plan.counts[group];
  if (count === 0) return null;
  const examples = plan.notes.filter((note) => note.group === group).slice(0, EXAMPLES_PER_GROUP);
  return (
    <Card title={`${t(`flashcards.import.groups.${group}`)} · ${count}`}>
      {examples.map((note) => {
        const values = Object.values(note.fields).filter(Boolean);
        return (
          <AppText key={note.guid} tone="secondary" numberOfLines={1}>
            {values.slice(0, 2).join(' – ')}
          </AppText>
        );
      })}
      {onToggle ? (
        <ChipSelect<'yes' | 'no'>
          value={included ? 'yes' : 'no'}
          onChange={(value) => onToggle(value === 'yes')}
          options={[
            { value: 'yes', label: t('flashcards.import.include') },
            { value: 'no', label: t('flashcards.import.skip') },
          ]}
        />
      ) : group === 'known' ? (
        <AppText variant="caption" tone="secondary">
          {t('flashcards.import.alwaysSkipped')}
        </AppText>
      ) : null}
    </Card>
  );
}

function ProgressBar({ value }: { value: number }) {
  const palette = usePalette();
  return (
    <View style={[styles.track, { backgroundColor: palette.surface }]}>
      <View style={[styles.fill, { backgroundColor: palette.primary, width: `${Math.round(value * 100)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.lg },
  footer: { gap: spacing.sm },
  track: { height: 8, borderRadius: radius.sm, overflow: 'hidden' },
  fill: { height: 8 },
});
