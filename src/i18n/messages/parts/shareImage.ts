/**
 * Messages owned by the "shareImage" feature. English is the source of truth; the other
 * languages are typed against it, so a missing or extra key fails the build.
 * Keep keys namespaced (e.g. 'shareImage.something').
 */
const en = {
  'shareImage.heading': 'Share image',
  'shareImage.intro': 'Save a picture of your estimated race times to keep or share.',
  'shareImage.weights.label': 'Include weights in the image',
  'shareImage.weights.hint': 'Off by default: the image shows no weight, height or body fat. Turn on to add your current and target weight.',
  'shareImage.save': 'Save image',
  'shareImage.share': 'Share…',
  'shareImage.saved': 'Image saved',
  'shareImage.failed': 'Couldn’t create the image. Please try again.',
  'shareImage.shareFailed': 'Couldn’t share the image. Try saving it instead.',
  'shareImage.blocked': 'No image for this target weight: it may be below a healthy body-fat level, or past the model’s pace limit. Choose a higher target weight.',
  'shareImage.title': 'Estimated race times',
  'shareImage.subtitle.lighter': 'At the chosen target weight, compared with now',
  'shareImage.subtitle.same': 'At the current weight',
  'shareImage.faster': '−{delta} faster',
  'shareImage.same': 'same as now',
  'shareImage.alt': 'Image preview: {summary}',
  'shareImage.alt.weights': 'Weight from {from} to {to}',
  'shareImage.alt.weight': 'Weight {weight}',
  'shareImage.alt.private': 'The image shows no weights or other body measurements',
} as const;
type Keys = keyof typeof en;

const de: Record<Keys, string> = {
  'shareImage.heading': 'Bild teilen',
  'shareImage.intro': 'Speichere ein Bild deiner geschätzten Rennzeiten, um es aufzubewahren oder zu teilen.',
  'shareImage.weights.label': 'Gewichte im Bild anzeigen',
  'shareImage.weights.hint': 'Standardmäßig aus: Das Bild zeigt weder Gewicht noch Größe oder Körperfett. Aktiviere die Option, um dein aktuelles Gewicht und dein Zielgewicht hinzuzufügen.',
  'shareImage.save': 'Bild speichern',
  'shareImage.share': 'Teilen…',
  'shareImage.saved': 'Bild gespeichert',
  'shareImage.failed': 'Das Bild konnte nicht erstellt werden. Bitte versuche es erneut.',
  'shareImage.shareFailed': 'Das Bild konnte nicht geteilt werden. Versuche stattdessen, es zu speichern.',
  'shareImage.blocked': 'Für dieses Zielgewicht wird kein Bild erstellt: Es liegt womöglich unter einem gesunden Körperfettanteil oder jenseits der Tempo-Grenze des Modells. Wähle ein höheres Zielgewicht.',
  'shareImage.title': 'Geschätzte Rennzeiten',
  'shareImage.subtitle.lighter': 'Beim gewählten Zielgewicht, verglichen mit jetzt',
  'shareImage.subtitle.same': 'Beim aktuellen Gewicht',
  'shareImage.faster': '−{delta} schneller',
  'shareImage.same': 'wie jetzt',
  'shareImage.alt': 'Bildvorschau: {summary}',
  'shareImage.alt.weights': 'Gewicht von {from} auf {to}',
  'shareImage.alt.weight': 'Gewicht {weight}',
  'shareImage.alt.private': 'Das Bild zeigt keine Gewichte oder andere Körperdaten',
};

const es: Record<Keys, string> = {
  'shareImage.heading': 'Compartir imagen',
  'shareImage.intro': 'Guarda una imagen con tus tiempos de carrera estimados para conservarla o compartirla.',
  'shareImage.weights.label': 'Incluir los pesos en la imagen',
  'shareImage.weights.hint': 'Desactivado por defecto: la imagen no muestra peso, altura ni grasa corporal. Actívalo para añadir tu peso actual y tu peso objetivo.',
  'shareImage.save': 'Guardar imagen',
  'shareImage.share': 'Compartir…',
  'shareImage.saved': 'Imagen guardada',
  'shareImage.failed': 'No se pudo crear la imagen. Inténtalo de nuevo.',
  'shareImage.shareFailed': 'No se pudo compartir la imagen. Prueba a guardarla.',
  'shareImage.blocked': 'No se crea ninguna imagen para este peso objetivo: podría estar por debajo de un nivel saludable de grasa corporal o superar el límite de ritmo del modelo. Elige un peso objetivo más alto.',
  'shareImage.title': 'Tiempos de carrera estimados',
  'shareImage.subtitle.lighter': 'Con el peso objetivo elegido, comparado con ahora',
  'shareImage.subtitle.same': 'Con el peso actual',
  'shareImage.faster': '−{delta} más rápido',
  'shareImage.same': 'igual que ahora',
  'shareImage.alt': 'Vista previa de la imagen: {summary}',
  'shareImage.alt.weights': 'Peso de {from} a {to}',
  'shareImage.alt.weight': 'Peso {weight}',
  'shareImage.alt.private': 'La imagen no muestra pesos ni otras medidas corporales',
};

const fr: Record<Keys, string> = {
  'shareImage.heading': 'Partager l’image',
  'shareImage.intro': 'Enregistrez une image de vos temps de course estimés pour la conserver ou la partager.',
  'shareImage.weights.label': 'Inclure les poids dans l’image',
  'shareImage.weights.hint': 'Désactivé par défaut : l’image n’affiche ni poids, ni taille, ni masse grasse. Activez l’option pour ajouter votre poids actuel et votre poids cible.',
  'shareImage.save': 'Enregistrer l’image',
  'shareImage.share': 'Partager…',
  'shareImage.saved': 'Image enregistrée',
  'shareImage.failed': 'Impossible de créer l’image. Veuillez réessayer.',
  'shareImage.shareFailed': 'Impossible de partager l’image. Essayez plutôt de l’enregistrer.',
  'shareImage.blocked': 'Aucune image pour ce poids cible : il peut être inférieur à un taux de masse grasse sain ou dépasser la limite d’allure du modèle. Choisissez un poids cible plus élevé.',
  'shareImage.title': 'Temps de course estimés',
  'shareImage.subtitle.lighter': 'Au poids cible choisi, comparé à aujourd’hui',
  'shareImage.subtitle.same': 'Au poids actuel',
  'shareImage.faster': '−{delta} plus vite',
  'shareImage.same': 'comme aujourd’hui',
  'shareImage.alt': 'Aperçu de l’image : {summary}',
  'shareImage.alt.weights': 'Poids de {from} à {to}',
  'shareImage.alt.weight': 'Poids {weight}',
  'shareImage.alt.private': 'L’image n’affiche ni poids ni autres mesures corporelles',
};

export const shareImage = { en, de, es, fr };
