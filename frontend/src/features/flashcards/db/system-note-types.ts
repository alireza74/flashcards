// Eingebaute Notiztypen. Dieselben IDs und Inhalte legt die Supabase-Migration
// backend/supabase/migrations/20261127161130_flashcards.sql an - bei Aenderungen beide Stellen anpassen.

export const SYSTEM_NOTE_TYPE_IDS = {
  basic: '00000000-0000-4000-8000-000000000101',
  basicReverse: '00000000-0000-4000-8000-000000000102',
  vocabulary: '00000000-0000-4000-8000-000000000103',
} as const;

type SystemNoteType = {
  id: string;
  key: string;
  name: string;
  fields: { id: string; ord: number; fieldKey: string; name: string }[];
  templates: { id: string; ord: number; name: string; front: string; back: string }[];
};

export const SYSTEM_NOTE_TYPES: SystemNoteType[] = [
  {
    id: SYSTEM_NOTE_TYPE_IDS.basic,
    key: 'basic',
    name: 'Einfach',
    fields: [
      { id: '00000000-0000-4000-8000-000000000201', ord: 0, fieldKey: 'front', name: 'Vorderseite' },
      { id: '00000000-0000-4000-8000-000000000202', ord: 1, fieldKey: 'back', name: 'Rueckseite' },
    ],
    templates: [
      { id: '00000000-0000-4000-8000-000000000301', ord: 0, name: 'Vorwaerts', front: '{{front}}', back: '{{back}}' },
    ],
  },
  {
    id: SYSTEM_NOTE_TYPE_IDS.basicReverse,
    key: 'basic_reverse',
    name: 'Einfach mit Rueckrichtung',
    fields: [
      { id: '00000000-0000-4000-8000-000000000203', ord: 0, fieldKey: 'front', name: 'Vorderseite' },
      { id: '00000000-0000-4000-8000-000000000204', ord: 1, fieldKey: 'back', name: 'Rueckseite' },
    ],
    templates: [
      { id: '00000000-0000-4000-8000-000000000302', ord: 0, name: 'Vorwaerts', front: '{{front}}', back: '{{back}}' },
      { id: '00000000-0000-4000-8000-000000000303', ord: 1, name: 'Rueckwaerts', front: '{{back}}', back: '{{front}}' },
    ],
  },
  {
    id: SYSTEM_NOTE_TYPE_IDS.vocabulary,
    key: 'vocabulary',
    name: 'Vokabel',
    fields: [
      { id: '00000000-0000-4000-8000-000000000205', ord: 0, fieldKey: 'word', name: 'Wort' },
      { id: '00000000-0000-4000-8000-000000000206', ord: 1, fieldKey: 'meaning', name: 'Bedeutung' },
      { id: '00000000-0000-4000-8000-000000000207', ord: 2, fieldKey: 'example', name: 'Beispielsatz' },
    ],
    templates: [
      {
        id: '00000000-0000-4000-8000-000000000304',
        ord: 0,
        name: 'Wort -> Bedeutung',
        front: '{{word}}',
        back: '{{meaning}}\n\n{{example}}',
      },
      {
        id: '00000000-0000-4000-8000-000000000305',
        ord: 1,
        name: 'Bedeutung -> Wort',
        front: '{{meaning}}',
        back: '{{word}}\n\n{{example}}',
      },
    ],
  },
];
