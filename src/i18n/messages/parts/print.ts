/**
 * Messages owned by the "print" feature. English is the source of truth; the other
 * languages are typed against it, so a missing or extra key fails the build.
 * Keep keys namespaced (e.g. 'print.something').
 */
const en = {
  'print.button': 'Print / save as PDF',
  'print.targetDate': 'Target date',
  'print.targetValue': '{weight} {unit} ({lost} {unit} lighter)',
  'print.targetSame': '{weight} {unit} (current weight)',
  'print.printedOn': 'Printed on {date}',
} as const;
type Keys = keyof typeof en;

const de: Record<Keys, string> = {
  'print.button': 'Drucken / als PDF speichern',
  'print.targetDate': 'Zieldatum',
  'print.targetValue': '{weight} {unit} ({lost} {unit} leichter)',
  'print.targetSame': '{weight} {unit} (aktuelles Gewicht)',
  'print.printedOn': 'Gedruckt am {date}',
};
const es: Record<Keys, string> = {
  'print.button': 'Imprimir / guardar como PDF',
  'print.targetDate': 'Fecha objetivo',
  'print.targetValue': '{weight} {unit} ({lost} {unit} menos)',
  'print.targetSame': '{weight} {unit} (peso actual)',
  'print.printedOn': 'Impreso el {date}',
};
const fr: Record<Keys, string> = {
  'print.button': 'Imprimer / enregistrer en PDF',
  'print.targetDate': 'Date cible',
  'print.targetValue': '{weight} {unit} ({lost} {unit} de moins)',
  'print.targetSame': '{weight} {unit} (poids actuel)',
  'print.printedOn': 'Imprimé le {date}',
};

export const print = { en, de, es, fr };
