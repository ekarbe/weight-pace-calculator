/**
 * Messages owned by the "band" feature. English is the source of truth; the other
 * languages are typed against it, so a missing or extra key fails the build.
 * Keep keys namespaced (e.g. 'band.something').
 */
const en = {
  'band.show': 'Show range',
  'band.legend.estimate': 'Estimate: {factor} s/km per kg',
  'band.legend.range': 'Range: {low} to {high} s/km per kg',
  'band.chart.aria': 'Estimated range at {weight} {unit}: {fast} to {slow}.',
  'band.card.range': '({low} to {high})',
  'band.card.srRange': 'Estimated range: {low} to {high} faster.',
  'band.disclaimer': 'The pace gain per kg lost is a rule of thumb of roughly {low} to {high} s/km per kg (default {default}), not a prediction. It assumes the weight you lose is mostly fat while training and fuelling are maintained. The gain shrinks or disappears, and can even reverse, if you lose muscle, lose weight too fast or under-eat. Applying it in a straight line over large weight losses is optimistic.',
} as const;
type Keys = keyof typeof en;

const de: Record<Keys, string> = {
  'band.show': 'Spanne anzeigen',
  'band.legend.estimate': 'Schätzung: {factor} s/km pro kg',
  'band.legend.range': 'Spanne: {low} bis {high} s/km pro kg',
  'band.chart.aria': 'Geschätzte Spanne bei {weight} {unit}: {fast} bis {slow}.',
  'band.card.range': '({low} bis {high})',
  'band.card.srRange': 'Geschätzte Spanne: {low} bis {high} schneller.',
  'band.disclaimer': 'Der Tempogewinn pro verlorenem kg ist eine Faustregel von etwa {low} bis {high} s/km pro kg (Standard: {default}) und keine Vorhersage. Sie setzt voraus, dass du hauptsächlich Fett verlierst und Training und Ernährung gleich bleiben. Der Gewinn wird kleiner oder verschwindet, im Extremfall kehrt er sich sogar um, wenn du Muskeln verlierst, zu schnell abnimmst oder zu wenig isst. Ihn bei großen Gewichtsverlusten linear fortzuschreiben, ist optimistisch.',
};
const es: Record<Keys, string> = {
  'band.show': 'Mostrar rango',
  'band.legend.estimate': 'Estimación: {factor} s/km por kg',
  'band.legend.range': 'Rango: de {low} a {high} s/km por kg',
  'band.chart.aria': 'Rango estimado con {weight} {unit}: de {fast} a {slow}.',
  'band.card.range': '({low} a {high})',
  'band.card.srRange': 'Rango estimado: de {low} a {high} más rápido.',
  'band.disclaimer': 'La mejora de ritmo por kg perdido es una regla empírica de entre {low} y {high} s/km por kg, aproximadamente (por defecto {default}), no una predicción. Supone que el peso que pierdes es sobre todo grasa y que el entrenamiento y la alimentación se mantienen. La mejora se reduce o desaparece, e incluso puede invertirse, si pierdes músculo, adelgazas demasiado rápido o no comes lo suficiente. Aplicarla de forma lineal a pérdidas de peso grandes es optimista.',
};
const fr: Record<Keys, string> = {
  'band.show': 'Afficher la fourchette',
  'band.legend.estimate': 'Estimation : {factor} s/km par kg',
  'band.legend.range': 'Fourchette : {low} à {high} s/km par kg',
  'band.chart.aria': 'Fourchette estimée à {weight} {unit} : de {fast} à {slow}.',
  'band.card.range': '({low} à {high})',
  'band.card.srRange': 'Fourchette estimée : de {low} à {high} plus vite.',
  'band.disclaimer': 'Le gain d’allure par kg perdu est une règle empirique d’environ {low} à {high} s/km par kg (valeur par défaut : {default}), et non une prévision. Il suppose que le poids perdu est surtout de la graisse et que l’entraînement et l’alimentation restent inchangés. Le gain diminue ou disparaît, et peut même s’inverser, si vous perdez du muscle, maigrissez trop vite ou ne mangez pas assez. L’appliquer de façon linéaire à de grosses pertes de poids est optimiste.',
};

export const band = { en, de, es, fr };
