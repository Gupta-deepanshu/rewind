import type { FilmDetails } from "../types";

/**
 * Full details for the staff-pick films, keyed by slug.
 * This is example data; the film API will replace it.
 */
export const DETAILS: Record<string, FilmDetails> = {
  "seven-samurai": {
    originalTitle: "七人の侍",
    originalTitleLatin: "Shichinin no Samurai",
    runtime: 207,
    genres: ["Action", "Drama"],
    language: "Japanese",
    colour: "B&W",
    synopsis:
      "Raided every harvest by bandits, a farming village hires seven masterless samurai to defend it.",
    tagline: "They were hired to save a village.",
    backCopy:
      "A veteran ronin gathers six more swordsmen, one of them a hot-headed farmer's son pretending to be a samurai, and teaches a frightened village to fight back.",
    staffNote:
      "Three and a half hours that feel like ninety minutes. Watch for the final battle in the rain.",
    writers: ["Akira Kurosawa", "Shinobu Hashimoto", "Hideo Oguni"],
    studio: "Toho",
    cast: [
      { name: "Toshiro Mifune", character: "Kikuchiyo" },
      { name: "Takashi Shimura", character: "Kambei Shimada" },
      { name: "Keiko Tsushima", character: "Shino" },
      { name: "Yoshio Inaba", character: "Gorobei Katayama" },
      { name: "Daisuke Katō", character: "Shichiroji" },
      { name: "Isao Kimura", character: "Katsushiro Okamoto" },
      { name: "Minoru Chiaki", character: "Heihachi Hayashida" },
      { name: "Seiji Miyaguchi", character: "Kyuzo" },
    ],
    crew: [
      { job: "Produced by", name: "Sōjirō Motoki" },
      { job: "Music", name: "Fumio Hayasaka" },
      { job: "Cinematography", name: "Asakazu Nakai" },
      { job: "Edited by", name: "Akira Kurosawa" },
    ],
  },
  "tokyo-story": {
    originalTitle: "東京物語",
    originalTitleLatin: "Tōkyō Monogatari",
    runtime: 136,
    genres: ["Drama"],
    language: "Japanese",
    colour: "B&W",
    synopsis:
      "An elderly couple travel to Tokyo to visit their grown children, who are too busy to make time for them.",
    tagline: "A visit. A city. A family drifting apart.",
    backCopy:
      "Only their widowed daughter-in-law, Noriko, shows them real kindness, in a quiet, devastating film about time and the people we take for granted.",
    staffNote: "Call your parents after this one. Seriously.",
    writers: ["Kōgo Noda", "Yasujirō Ozu"],
    studio: "Shochiku",
    cast: [
      { name: "Chishū Ryū", character: "Shūkichi Hirayama" },
      { name: "Chieko Higashiyama", character: "Tomi Hirayama" },
      { name: "Setsuko Hara", character: "Noriko Hirayama" },
      { name: "Haruko Sugimura", character: "Shige Kaneko" },
      { name: "Sō Yamamura", character: "Kōichi Hirayama" },
      { name: "Kuniko Miyake", character: "Fumiko Hirayama" },
      { name: "Kyōko Kagawa", character: "Kyōko Hirayama" },
      { name: "Eijirō Tōno", character: "Sanpei Numata" },
    ],
    crew: [
      { job: "Produced by", name: "Takeshi Yamamoto" },
      { job: "Music", name: "Kojun Saitō" },
      { job: "Cinematography", name: "Yūharu Atsuta" },
      { job: "Edited by", name: "Yoshiyasu Hamamura" },
    ],
  },
  vertigo: {
    runtime: 128,
    genres: ["Mystery", "Thriller"],
    language: "English",
    colour: "Colour",
    synopsis:
      "A retired San Francisco detective with a fear of heights is hired to follow an old friend's wife, and falls for her.",
    tagline: "Some obsessions you never come down from.",
    backCopy:
      "Scottie Ferguson shadows the haunted Madeleine through a city of bell towers and graveyards, until a fall leaves him chasing a ghost.",
    staffNote: "The second half changes the first. Don't read anything about it before you watch.",
    writers: ["Alec Coppel", "Samuel A. Taylor"],
    studio: "Paramount",
    cast: [
      { name: "James Stewart", character: "John “Scottie” Ferguson" },
      { name: "Kim Novak", character: "Madeleine Elster / Judy Barton" },
      { name: "Barbara Bel Geddes", character: "Midge Wood" },
      { name: "Tom Helmore", character: "Gavin Elster" },
      { name: "Henry Jones", character: "Coroner" },
      { name: "Raymond Bailey", character: "Scottie's doctor" },
      { name: "Ellen Corby", character: "Hotel manageress" },
      { name: "Konstantin Shayne", character: "Pop Leibel" },
    ],
    crew: [
      { job: "Produced by", name: "Alfred Hitchcock" },
      { job: "Music", name: "Bernard Herrmann" },
      { job: "Cinematography", name: "Robert Burks" },
      { job: "Edited by", name: "George Tomasini" },
    ],
  },
  "the-third-man": {
    runtime: 104,
    genres: ["Thriller", "Film noir"],
    language: "English",
    colour: "B&W",
    synopsis:
      "A pulp novelist arrives in post-war Vienna to work for his old friend Harry Lime, only to be told Harry is dead.",
    tagline: "Nobody in Vienna wants to talk about Harry Lime.",
    backCopy:
      "Holly Martins digs into the accident that killed his friend and finds a city of black markets, crooked angles and a man who may not be in his grave.",
    staffNote: "That zither score will live in your head for a week. Worth it.",
    writers: ["Graham Greene"],
    studio: "London Films",
    cast: [
      { name: "Joseph Cotten", character: "Holly Martins" },
      { name: "Alida Valli", character: "Anna Schmidt" },
      { name: "Orson Welles", character: "Harry Lime" },
      { name: "Trevor Howard", character: "Major Calloway" },
      { name: "Bernard Lee", character: "Sergeant Paine" },
      { name: "Paul Hörbiger", character: "Karl, the porter" },
      { name: "Ernst Deutsch", character: "Baron Kurtz" },
      { name: "Erich Ponto", character: "Dr. Winkel" },
    ],
    crew: [
      { job: "Produced by", name: "Carol Reed" },
      { job: "Music", name: "Anton Karas" },
      { job: "Cinematography", name: "Robert Krasker" },
      { job: "Edited by", name: "Oswald Hafenrichter" },
    ],
  },
  rashomon: {
    originalTitle: "羅生門",
    originalTitleLatin: "Rashōmon",
    runtime: 88,
    genres: ["Crime", "Drama"],
    language: "Japanese",
    colour: "B&W",
    synopsis:
      "Sheltering from a storm under a ruined gate, three men retell a killing in the forest, and no two versions agree.",
    tagline: "Four witnesses. Four truths.",
    backCopy:
      "A bandit, a wife, a dead samurai and a woodcutter each tell the story of one afternoon in the woods, and each makes themselves the hero.",
    staffNote: "Eighty-eight minutes and it invented a whole way of telling stories.",
    writers: ["Akira Kurosawa", "Shinobu Hashimoto"],
    studio: "Daiei",
    cast: [
      { name: "Toshiro Mifune", character: "Tajōmaru" },
      { name: "Machiko Kyō", character: "Masago" },
      { name: "Masayuki Mori", character: "Takehiro" },
      { name: "Takashi Shimura", character: "Woodcutter" },
      { name: "Minoru Chiaki", character: "Priest" },
      { name: "Kichijirō Ueda", character: "Commoner" },
      { name: "Noriko Honma", character: "Medium" },
      { name: "Daisuke Katō", character: "Policeman" },
    ],
    crew: [
      { job: "Produced by", name: "Minoru Jingo" },
      { job: "Music", name: "Fumio Hayasaka" },
      { job: "Cinematography", name: "Kazuo Miyagawa" },
    ],
  },
  chinatown: {
    runtime: 130,
    genres: ["Mystery", "Neo-noir"],
    language: "English",
    colour: "Colour",
    synopsis:
      "A Los Angeles private eye takes a routine adultery case and walks into a conspiracy over the city's water.",
    tagline: "Forget it, Jake. Or don't.",
    backCopy:
      "J.J. Gittes follows a dead man's trail through drought, reservoirs and orange groves to the most powerful family in town.",
    staffNote: "Maybe the best screenplay ever written. Pay attention to the water.",
    writers: ["Robert Towne"],
    studio: "Paramount",
    cast: [
      { name: "Jack Nicholson", character: "J.J. “Jake” Gittes" },
      { name: "Faye Dunaway", character: "Evelyn Mulwray" },
      { name: "John Huston", character: "Noah Cross" },
      { name: "Perry Lopez", character: "Lt. Lou Escobar" },
      { name: "John Hillerman", character: "Russ Yelburton" },
      { name: "Darrell Zwerling", character: "Hollis Mulwray" },
      { name: "Diane Ladd", character: "Ida Sessions" },
      { name: "Burt Young", character: "Curly" },
    ],
    crew: [
      { job: "Produced by", name: "Robert Evans" },
      { job: "Music", name: "Jerry Goldsmith" },
      { job: "Cinematography", name: "John A. Alonzo" },
      { job: "Edited by", name: "Sam O'Steen" },
    ],
  },
  "in-the-mood-for-love": {
    originalTitle: "花樣年華",
    originalTitleLatin: "Fa yeung nin wa",
    runtime: 98,
    genres: ["Romance", "Drama"],
    language: "Cantonese",
    colour: "Colour",
    synopsis:
      "Hong Kong, 1962. Two neighbours discover their spouses are having an affair, and slowly grow close themselves.",
    tagline: "It is a restless moment.",
    backCopy:
      "In narrow corridors and noodle stalls, Mr. Chow and Mrs. Chan rehearse the affair they swear they will never have.",
    staffNote: "Every frame could hang on a wall. Turn the lights down for this one.",
    writers: ["Wong Kar-wai"],
    studio: "Jet Tone Production",
    cast: [
      { name: "Tony Leung Chiu-wai", character: "Chow Mo-wan" },
      { name: "Maggie Cheung", character: "Su Li-zhen" },
      { name: "Rebecca Pan", character: "Mrs. Suen" },
      { name: "Lai Chen", character: "Mr. Ho" },
      { name: "Siu Ping-lam", character: "Ah Ping" },
    ],
    crew: [
      { job: "Produced by", name: "Wong Kar-wai" },
      { job: "Music", name: "Michael Galasso, Shigeru Umebayashi" },
      { job: "Cinematography", name: "Christopher Doyle, Mark Lee Ping-bing" },
      { job: "Edited by", name: "William Chang" },
    ],
  },
  ikiru: {
    originalTitle: "生きる",
    originalTitleLatin: "Ikiru",
    runtime: 143,
    genres: ["Drama"],
    language: "Japanese",
    colour: "B&W",
    synopsis:
      "A bureaucrat who has spent thirty years doing nothing learns he is dying, and sets out to do one thing that matters.",
    tagline: "He had six months to start living.",
    backCopy:
      "Kanji Watanabe tries drink, nightlife and the company of a young co-worker before finding his purpose in a small patch of muddy ground.",
    staffNote: "The swing scene. You'll know it when you see it.",
    writers: ["Akira Kurosawa", "Shinobu Hashimoto", "Hideo Oguni"],
    studio: "Toho",
    cast: [
      { name: "Takashi Shimura", character: "Kanji Watanabe" },
      { name: "Nobuo Kaneko", character: "Mitsuo Watanabe" },
      { name: "Miki Odagiri", character: "Toyo Odagiri" },
      { name: "Yūnosuke Itō", character: "Novelist" },
      { name: "Minoru Chiaki", character: "Noguchi" },
      { name: "Kamatari Fujiwara", character: "Ono" },
    ],
    crew: [
      { job: "Produced by", name: "Sōjirō Motoki" },
      { job: "Music", name: "Fumio Hayasaka" },
      { job: "Cinematography", name: "Asakazu Nakai" },
    ],
  },
};

/** Staff picks, in shelf order. */
export const STAFF_PICKS = [
  "seven-samurai",
  "tokyo-story",
  "vertigo",
  "the-third-man",
  "rashomon",
  "chinatown",
  "in-the-mood-for-love",
  "ikiru",
];
