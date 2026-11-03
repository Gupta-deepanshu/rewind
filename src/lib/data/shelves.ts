/**
 * Example shelf data: [title, year] pairs. The film API will replace this.
 * Titles are turned into slugs by the catalog, so the same title on two shelves is one film.
 */
type Entry = [title: string, year: number];

export const DIRECTORS: {
  slug: string;
  name: string;
  nativeName?: string;
  active: [number, number];
  films: Entry[];
}[] = [
  {
    slug: "akira-kurosawa",
    name: "Akira Kurosawa",
    nativeName: "黒澤明",
    active: [1943, 1993],
    films: [
      ["Sanshiro Sugata", 1943], ["Drunken Angel", 1948], ["Stray Dog", 1949], ["Rashomon", 1950],
      ["Ikiru", 1952], ["Seven Samurai", 1954], ["Throne of Blood", 1957], ["The Hidden Fortress", 1958],
      ["The Bad Sleep Well", 1960], ["Yojimbo", 1961], ["Sanjuro", 1962], ["High and Low", 1963],
      ["Red Beard", 1965], ["Dersu Uzala", 1975], ["Kagemusha", 1980], ["Ran", 1985],
      ["Dreams", 1990], ["Madadayo", 1993],
    ],
  },
  {
    slug: "alfred-hitchcock",
    name: "Alfred Hitchcock",
    active: [1925, 1976],
    films: [
      ["The Lodger", 1927], ["The 39 Steps", 1935], ["The Lady Vanishes", 1938], ["Rebecca", 1940],
      ["Notorious", 1946], ["Strangers on a Train", 1951], ["Rear Window", 1954], ["Vertigo", 1958],
      ["North by Northwest", 1959], ["Psycho", 1960], ["The Birds", 1963], ["Marnie", 1964],
      ["Frenzy", 1972], ["Family Plot", 1976],
    ],
  },
  {
    slug: "yasujiro-ozu",
    name: "Yasujirō Ozu",
    nativeName: "小津安二郎",
    active: [1927, 1962],
    films: [
      ["I Was Born, But...", 1932], ["Late Spring", 1949], ["Early Summer", 1951], ["Tokyo Story", 1953],
      ["Early Spring", 1956], ["Tokyo Twilight", 1957], ["Equinox Flower", 1958], ["Good Morning", 1959],
      ["Floating Weeds", 1959], ["Late Autumn", 1960], ["The End of Summer", 1961], ["An Autumn Afternoon", 1962],
    ],
  },
  {
    slug: "wong-kar-wai",
    name: "Wong Kar-wai",
    nativeName: "王家衛",
    active: [1988, 2013],
    films: [
      ["As Tears Go By", 1988], ["Days of Being Wild", 1990], ["Chungking Express", 1994], ["Ashes of Time", 1994],
      ["Fallen Angels", 1995], ["Happy Together", 1997], ["In the Mood for Love", 2000], ["2046", 2004],
      ["My Blueberry Nights", 2007], ["The Grandmaster", 2013],
    ],
  },
  {
    slug: "carol-reed",
    name: "Carol Reed",
    active: [1935, 1972],
    films: [["Odd Man Out", 1947], ["The Fallen Idol", 1948], ["The Third Man", 1949], ["Oliver!", 1968]],
  },
  {
    slug: "roman-polanski",
    name: "Roman Polanski",
    active: [1962, 2023],
    films: [["Knife in the Water", 1962], ["Repulsion", 1965], ["Rosemary's Baby", 1968], ["Chinatown", 1974]],
  },
];

export const AISLES: { slug: string; num: string; name: string; jp: string; films: Entry[] }[] = [
  {
    slug: "new-arrivals",
    num: "01",
    name: "New Arrivals",
    jp: "新作",
    films: [
      ["Past Lives", 2023], ["Aftersun", 2022], ["Oppenheimer", 2023], ["Dune: Part Two", 2024],
      ["Poor Things", 2023], ["Anatomy of a Fall", 2023], ["Perfect Days", 2023], ["The Holdovers", 2023],
      ["Anora", 2024], ["Conclave", 2024], ["The Brutalist", 2024], ["Flow", 2024],
      ["Challengers", 2024], ["Tár", 2022], ["Decision to Leave", 2022], ["Drive My Car", 2021],
      ["Godzilla Minus One", 2023], ["The Substance", 2024], ["Nope", 2022], ["Parasite", 2019],
      ["Women Talking", 2022], ["The Fabelmans", 2022], ["Barbie", 2023], ["The Zone of Interest", 2023],
    ],
  },
  {
    slug: "drama",
    num: "02",
    name: "Drama",
    jp: "ドラマ",
    films: [
      ["Tokyo Story", 1953], ["Bicycle Thieves", 1948], ["Late Spring", 1949], ["The 400 Blows", 1959],
      ["Wild Strawberries", 1957], ["Pather Panchali", 1955], ["Umberto D.", 1952], ["La Strada", 1954],
      ["In the Mood for Love", 2000], ["Yi Yi", 2000], ["Paris, Texas", 1984], ["Days of Heaven", 1978],
      ["Moonlight", 2016], ["Ordet", 1955], ["Floating Weeds", 1959], ["Close-Up", 1990],
      ["Nights of Cabiria", 1957], ["Wings of Desire", 1987], ["Cinema Paradiso", 1988], ["Viridiana", 1961],
      ["An Autumn Afternoon", 1962], ["Ikiru", 1952], ["Ugetsu", 1953], ["Stalker", 1979],
    ],
  },
  {
    slug: "thriller-mystery",
    num: "03",
    name: "Thriller & Mystery",
    jp: "スリラー",
    films: [
      ["Vertigo", 1958], ["Rear Window", 1954], ["Psycho", 1960], ["The Third Man", 1949],
      ["Chinatown", 1974], ["Se7en", 1995], ["Zodiac", 2007], ["Memories of Murder", 2003],
      ["Le Samouraï", 1967], ["Diabolique", 1955], ["The Conversation", 1974], ["Blow-Up", 1966],
      ["High and Low", 1963], ["Cure", 1997], ["Oldboy", 2003], ["Blue Velvet", 1986],
      ["Mulholland Drive", 2001], ["Prisoners", 2013], ["The Vanishing", 1988], ["Le Cercle Rouge", 1970],
      ["Notorious", 1946], ["Rashomon", 1950], ["The Wages of Fear", 1953], ["North by Northwest", 1959],
    ],
  },
];
