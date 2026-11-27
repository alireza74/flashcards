// Einrichtung "Was moechtest du lernen?": aus der Wahl entsteht die Deck-Gliederung.
// Die Vorlagen sind Daten - neue Bereiche brauchen nur einen Eintrag hier.

import type { DataContext } from './context';
import { createConfig, createDeck, ensureDefaultConfig, type DeckKind } from './decks';

export type AreaKind = 'language' | 'subject' | 'exam' | 'free';

/** Sprachen zur Auswahl (BCP 47). Anzeigename kommt aus den Texten flashcards.languages.<code>. */
export const AREA_LANGUAGES = ['de', 'en', 'fa', 'fr', 'es', 'it', 'tr', 'ar'] as const;

/** Unterdecks eines Sprachbereichs; Namen kommen aus den Texten flashcards.deckKinds.<kind>. */
export const LANGUAGE_SUBDECKS: DeckKind[] = ['vocabulary', 'phrases', 'grammar'];

/** Vorgabe "neu pro Tag" je Unterdeck eines Sprachbereichs (eigene Lernoptionen je Unterdeck). */
export const LANGUAGE_NEW_PER_DAY: Partial<Record<DeckKind, number>> = { vocabulary: 20, grammar: 10, phrases: 5 };

export type AreaInput = {
  kind: AreaKind;
  /** Anzeigename des Bereichs (z. B. "Englisch", "Mathe") */
  name: string;
  /** nur bei Sprache */
  lang: string | null;
  /** Namen der Unterdecks in der aktuellen Sprache der App (nur bei Sprache) */
  subdeckNames?: Partial<Record<DeckKind, string>>;
  /** Name der Standard-Lernoptionen, falls sie angelegt werden */
  defaultConfigName: string;
};

/** Legt den Bereich an und liefert die ID des obersten Decks. */
export async function createArea(ctx: DataContext, input: AreaInput): Promise<string> {
  const configId = await ensureDefaultConfig(ctx, input.defaultConfigName);
  const rootId = await createDeck(
    ctx,
    {
      name: input.name,
      parentId: null,
      kind: 'general',
      lang: input.kind === 'language' ? input.lang : null,
    },
    configId,
  );
  if (input.kind === 'language') {
    for (const kind of LANGUAGE_SUBDECKS) {
      const name = input.subdeckNames?.[kind] ?? kind;
      const subdeckConfigId = await createConfig(ctx, `${input.name} › ${name}`, {
        new_per_day: LANGUAGE_NEW_PER_DAY[kind] ?? 20,
      });
      await createDeck(
        ctx,
        {
          name,
          parentId: rootId,
          kind,
          lang: input.lang,
        },
        subdeckConfigId,
      );
    }
  }
  return rootId;
}
