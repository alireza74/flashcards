// mailto-Adresse fuer "Feedback senden" (eigene Datei ohne App-Abhaengigkeiten, damit testbar).
export function feedbackMailUrl(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
