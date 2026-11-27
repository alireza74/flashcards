// Nur in der App: Datei waehlen und die Anki-Datenbank im Speicher oeffnen.
// Die Leselogik selbst (anki-package.ts) kennt weder Dateiauswahl noch expo-sqlite und ist so testbar.

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { deserializeDatabaseAsync } from 'expo-sqlite';
import { Platform } from 'react-native';

import type { OpenAnkiDb } from './anki-package';

export type PickedFile = { name: string; bytes: Uint8Array };

/** null = abgebrochen. */
export async function pickAnkiFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // .apkg hat keinen festen MIME-Typ; im Browser filtert die Endung, auf dem Handy alle Dateien
    type: Platform.OS === 'web' ? '.apkg' : '*/*',
    copyToCacheDirectory: true,
    multiple: false,
    base64: false, // sonst liest der Browser die ganze Datei zusaetzlich als Text ein
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const buffer = asset.file ? await asset.file.arrayBuffer() : await new File(asset.uri).arrayBuffer();
  return { name: asset.name, bytes: new Uint8Array(buffer) };
}

/** Anki-Datenbank aus den entpackten Bytes nur im Speicher oeffnen (keine Datei auf dem Geraet). */
export const openExpoAnkiDb: OpenAnkiDb = async (bytes) => {
  const db = await deserializeDatabaseAsync(bytes);
  return {
    getAllAsync: (source, params) => db.getAllAsync(source, params),
    closeAsync: () => db.closeAsync(),
  };
};
