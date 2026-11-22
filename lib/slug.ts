/** URL segment of a place name: no accents, apostrophes or capitals ("Côtes-d’Armor" → "cotes-d-armor"). */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
