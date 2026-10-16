/**
 * Messages owned by the "raceResult" feature. English is the source of truth; the other
 * languages are typed against it, so a missing or extra key fails the build.
 * Keep keys namespaced (e.g. 'raceResult.something').
 */
const en = {} as const;
type Keys = keyof typeof en;

const de: Record<Keys, string> = {};
const es: Record<Keys, string> = {};
const fr: Record<Keys, string> = {};

export const raceResult = { en, de, es, fr };
