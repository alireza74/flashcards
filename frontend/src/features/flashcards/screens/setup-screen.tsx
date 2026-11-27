// Einrichtung "Was moechtest du lernen?" - aus der Wahl entsteht die Gliederung (data/areas.ts).

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { BackButton } from '@/shared/ui/header-buttons';
import { Button } from '@/shared/ui/button';
import { ChipSelect } from '@/shared/ui/chip-select';
import { FormMessage } from '@/shared/ui/form-message';
import { Screen } from '@/shared/ui/screen';
import { TextField } from '@/shared/ui/text-field';
import { spacing } from '@/shared/ui/theme';

import { AREA_LANGUAGES, createArea, LANGUAGE_SUBDECKS, type AreaKind } from '../data/areas';
import { useLocalMutation } from '../data/use-local-data';

const SUBJECTS = ['math', 'physics', 'chemistry', 'biology', 'history'] as const;
const OTHER = 'other';

type LanguageChoice = (typeof AREA_LANGUAGES)[number] | typeof OTHER;
type SubjectChoice = (typeof SUBJECTS)[number] | typeof OTHER;

export function SetupScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [kind, setKind] = useState<AreaKind>('language');
  const [language, setLanguage] = useState<LanguageChoice>('en');
  const [subject, setSubject] = useState<SubjectChoice>('math');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useLocalMutation(createArea);

  const needsName =
    kind === 'exam' ||
    kind === 'free' ||
    (kind === 'language' && language === OTHER) ||
    (kind === 'subject' && subject === OTHER);

  function areaName(): string {
    if (needsName) return name.trim();
    if (kind === 'language') return t(`flashcards.languages.${language as (typeof AREA_LANGUAGES)[number]}`);
    return t(`flashcards.setup.subjects.${subject as (typeof SUBJECTS)[number]}`);
  }

  function submit() {
    const finalName = areaName();
    if (!finalName) {
      setError(t('flashcards.setup.nameRequired'));
      return;
    }
    setError(null);
    const subdeckNames = Object.fromEntries(LANGUAGE_SUBDECKS.map((k) => [k, t(`flashcards.deckKinds.${k}`)]));
    create.mutate(
      {
        kind,
        name: finalName,
        lang: kind === 'language' && language !== OTHER ? language : null,
        subdeckNames,
        defaultConfigName: t('flashcards.setup.defaultConfig'),
      },
      {
        onSuccess: (rootId) => router.replace({ pathname: '/decks/[id]', params: { id: rootId } }),
      },
    );
  }

  return (
    <Screen
      title={t('flashcards.setup.title')}
      headerLeft={router.canGoBack() ? <BackButton /> : undefined}
      footer={<Button title={t('flashcards.setup.create')} onPress={submit} loading={create.isPending} />}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <ChipSelect<AreaKind>
          label={t('flashcards.setup.kind')}
          value={kind}
          onChange={setKind}
          options={(['language', 'subject', 'exam', 'free'] as const).map((value) => ({
            value,
            label: t(`flashcards.setup.kinds.${value}`),
          }))}
        />

        {kind === 'language' ? (
          <ChipSelect<LanguageChoice>
            label={t('flashcards.setup.chooseLanguage')}
            value={language}
            onChange={setLanguage}
            options={[
              ...AREA_LANGUAGES.map((code) => ({
                value: code,
                label: t(`flashcards.languages.${code}`),
              })),
              { value: OTHER, label: t('flashcards.setup.other') },
            ]}
          />
        ) : null}

        {kind === 'subject' ? (
          <ChipSelect<SubjectChoice>
            label={t('flashcards.setup.chooseSubject')}
            value={subject}
            onChange={setSubject}
            options={[
              ...SUBJECTS.map((key) => ({
                value: key,
                label: t(`flashcards.setup.subjects.${key}`),
              })),
              { value: OTHER, label: t('flashcards.setup.other') },
            ]}
          />
        ) : null}

        {needsName ? (
          <TextField
            label={t('flashcards.setup.name')}
            placeholder={t('flashcards.setup.namePlaceholder')}
            value={name}
            onChangeText={setName}
            maxLength={100}
            autoFocus
          />
        ) : null}

        {error ? <FormMessage tone="error" text={error} /> : null}
        {create.isError ? <FormMessage tone="error" text={t('common.error')} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.lg },
});
