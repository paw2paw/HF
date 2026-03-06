/**
 * Fake name generator for sim launch.
 * Used when no learner name is provided — produces a realistic-sounding
 * but clearly fictional name instead of a serial number.
 */

const FIRST_NAMES = [
  // Original set
  "Alex", "Blake", "Casey", "Dana", "Elise", "Finn", "Grace", "Harper",
  "Imani", "Jordan", "Kai", "Leila", "Morgan", "Nadia", "Omar", "Priya",
  "Quinn", "Remy", "Sage", "Tara", "Uma", "Val", "Wren", "Xio",
  "Yara", "Zeke", "Aiden", "Bea", "Cole", "Dani", "Eden", "Frankie",
  "Glen", "Hazel", "Iris", "Jules", "Kieran", "Luca", "Mila", "Nico",
  "Olive", "Phoenix", "River", "Sasha", "Theo", "Uri", "Vera", "Winter",
  // Expanded set
  "Amara", "Bodhi", "Caleb", "Darcy", "Emeka", "Fatima", "Gael", "Hana",
  "Idris", "Juno", "Kofi", "Layla", "Mateo", "Nia", "Oscar", "Paloma",
  "Quincy", "Rowan", "Sienna", "Tariq", "Umi", "Vivian", "Wyatt", "Xena",
  "Yusuf", "Zara", "Arlo", "Brynn", "Cyrus", "Dahlia", "Ezra", "Freya",
  "Gia", "Henrik", "Ines", "Jasper", "Kira", "Leo", "Maren", "Nash",
  "Orla", "Piper", "Rae", "Stellan", "Tessa", "Ugo", "Vesper", "Wells",
  "Ximena", "Yael", "Zion", "Asha", "Beckett", "Cleo", "Diego", "Elowen",
  "Felix", "Gemma", "Hugo", "Isla", "Joaquin", "Kaia", "Levi", "Maeve",
  "Nolan", "Opal", "Pascal", "Rhea", "Soren", "Thalia", "Ulric", "Viola",
  "Wes", "Xiomara", "Yolanda", "Zev",
];

const LAST_NAMES = [
  // Original set
  "Ahmed", "Baxter", "Chen", "Diallo", "Evans", "Ferreira", "Garcia",
  "Hassan", "Ishida", "James", "Kim", "Larson", "Moreau", "Nakamura",
  "Osei", "Patel", "Quinn", "Reyes", "Sharma", "Torres", "Ueda",
  "Vasquez", "Walsh", "Xu", "Yamamoto", "Zhao", "Anders", "Brooks",
  "Costa", "Dubois", "Ellis", "Foster", "Grant", "Hill", "Ibarra",
  "Jensen", "Khan", "Lima", "Mori", "Nour", "Ortiz", "Park", "Reid",
  "Santos", "Taylor", "Vance", "Wood", "Young", "Zola",
  // Expanded set
  "Adeyemi", "Bergström", "Cho", "Delgado", "Eriksen", "Fernandez", "Gupta",
  "Hernandez", "Ivanova", "Johansson", "Kato", "Lindqvist", "Mendes", "Novak",
  "Okafor", "Petrov", "Ramirez", "Sato", "Tanaka", "Urdaneta", "Volkov",
  "Weber", "Xiong", "Yilmaz", "Zheng", "Abadi", "Björk", "Cabrera",
  "Dempsey", "Engström", "Fong", "Gomes", "Horváth", "Ikeda", "Jaffe",
  "Kowalski", "Lam", "Müller", "Nguyen", "Okamoto", "Popov", "Qureshi",
  "Rossi", "Sundaram", "Tremblay", "Uribe", "Vieira", "Whitfield", "Yoo",
  "Zambrano", "Ashworth", "Bello", "Castellanos", "Doyle", "Esposito", "Falk",
  "Guzmán", "Hawkins", "Ito", "Jansen", "Kemp", "Lombardi", "Magnusson",
  "Nkosi", "Olsson", "Pascual", "Rinaldi", "Söderberg", "Thorne", "Uchida",
  "Valdez", "Winters", "Yanez", "Ziegler",
];

/** Returns a random fake full name, e.g. "Elise Moreau" */
export function randomFakeName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return `${first} ${last}`;
}
