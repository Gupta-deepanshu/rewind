export function slugify(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** TMDB slugs look like "346-seven-samurai": the id first, so the title part can change freely. */
export function tmdbSlug(id: number, title: string): string {
  const words = slugify(title);
  return words ? `${id}-${words}` : String(id);
}

export function idFromSlug(slug: string): number | undefined {
  const m = /^(\d+)(?:-|$)/.exec(slug);
  return m ? Number(m[1]) : undefined;
}
