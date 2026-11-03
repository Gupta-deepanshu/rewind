/**
 * Directors that can appear on the homepage's director shelf when TMDB is connected.
 * Their filmographies come from TMDB; only the names (and native-script names) live here.
 */
export const DIRECTOR_SEEDS: { name: string; nativeName?: string }[] = [
  { name: "Akira Kurosawa", nativeName: "黒澤明" },
  { name: "Alfred Hitchcock" },
  { name: "Yasujirō Ozu", nativeName: "小津安二郎" },
  { name: "Wong Kar-wai", nativeName: "王家衛" },
  { name: "Agnès Varda" },
  { name: "Bong Joon-ho", nativeName: "봉준호" },
  { name: "Céline Sciamma" },
  { name: "Hayao Miyazaki", nativeName: "宮崎駿" },
];
