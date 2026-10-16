// Story content: journal pages, expedition logs, wall carvings and relics.

export const JOURNAL = {
  // --- Expedition logs (the player's own team and an earlier diver) ---
  log_start: {
    kind: 'log', title: 'Expedition Log — Day 1',
    text: `The sonar was right. Under the reef there are straight lines that nature does not draw: streets, walls, a whole city running north into the deep.

The old tablets say Atlantis drew its light from a great crystal in the central palace, and that when it broke, the city went dark and sank. If any of it remains, I will find it.

The base bell is anchored here. It holds a pocket of air, so I can always come back to breathe, and the console can fit new gear if I bring pearls to trade with the supply ship.

Strange: a pale glow comes from a cave to the south-west of the base, under the rocks. Worth a look.`,
  },
  log_quill: {
    kind: 'log', title: 'Diver\'s Note — the Gull',
    text: `If anyone finds this: my name is Mara Quill, and the Gull was my boat before the storm.

I got as far as the drowned city gate in the north before the pressure nearly cracked my mask. You will need a proper pressure suit to walk those streets.

The dolphins here are not ordinary. One followed me for days, clicking at walls I could not see through. I think they remember something.`,
  },
  log_heat: {
    kind: 'log', title: 'Diver\'s Note — West Road',
    text: `West of the city the water turns hot enough to boil an egg. Something down there still burns. Without an insulated suit I would not go a meter further.

East of the city the temples are colder and darker, but safe enough. I saw lights moving inside the walls — eels, I hope.`,
  },
  log_abyss: {
    kind: 'log', title: 'Diver\'s Note — The Edge',
    text: `North of the palace the floor simply ends. My lamp lit nothing at all, as if the dark were eating the light.

A stronger lamp, and a suit that could take real depth — with those, someone could go down there. Not me. Not now.`,
  },

  // --- Keeper's journal (Atlantean) ---
  page1: {
    kind: 'page', title: 'Keeper\'s Journal I — The Heartstone',
    text: `I am Ilyra, last Keeper of the Heartstone.

For a thousand years the great crystal sang beneath the palace. Its song warmed the water, lit the streets, and let our people breathe the sea as easily as air. We did not own it. We listened to it.

If you are reading this, the Stone is broken, and so are we.`,
  },
  page2: {
    kind: 'page', title: 'Keeper\'s Journal II — The Council',
    text: `The Council grew tired of sharing the sea.

"Why should the tides move as they please," said Archon Vael, "when the Stone could command them?" They wanted walls of water to keep the world out, and currents to drag the world's ships in.

I told them the Stone is a voice, not a weapon. They laughed and said a voice can be made to shout.`,
  },
  page3: {
    kind: 'page', title: 'Keeper\'s Journal III — The Night of Breaking',
    text: `They bound the Heartstone in rings of orichalcum and pulled at its song until it screamed.

The light went white, then black. I heard the crystal crack like ice on a winter lake. Seven pieces fell from the cradle, still warm, still humming.

Then the sea came in through every street at once.`,
  },
  page4: {
    kind: 'page', title: 'Keeper\'s Journal IV — Seven Hiding Places',
    text: `I could not let the Council take the shards again, so I hid them where the city itself would guard them.

One to the coral, cradled in a living shell. One to the forest, watched by guardians. One to the market, under the old weights. One to the temple, behind the four signs. One to the fire, in the smiths' maze. One to the dark, where only light can open the door.

The seventh I gave to friends who sing.`,
  },
  page5: {
    kind: 'page', title: 'Keeper\'s Journal V — The Guardians',
    text: `In the forest clearing stand three guardians, older than the city: Tides, Flame and Stone.

The children used to play a game there, turning the statues to look at the signs carved around them. I have made that game into a lock. Each guardian must look upon the sign it loves.`,
  },
  page6: {
    kind: 'page', title: 'Keeper\'s Journal VI — The Market Weights',
    text: `Our merchants were honest because the scales were public. Three great weights, three great plates, in the middle of the square for all to see.

I sealed the vault beneath the market with the same rule: the vault opens only when every plate carries a weight. If a stone sticks in a corner, the old reset lever still works.`,
  },
  page7: {
    kind: 'page', title: 'Keeper\'s Journal VII — The Temple Seal',
    text: `The great door of the Temple of Tides listens for four signs, spoken in order.

The priests carved one sign in each of the four small shrines around the temple, so that no single priest could open the door alone. Find all four shrines, and read the order on each stone.`,
  },
  page8: {
    kind: 'page', title: 'Keeper\'s Journal VIII — The Ember Labyrinth',
    text: `Beneath the burning vents our smiths built a maze of rushing water to cool their forges. You cannot swim against those currents; nobody can.

Follow the water. It knows the way better than you do. And breathe where the smiths breathed — they left a pocket of air halfway through.`,
  },
  page9: {
    kind: 'page', title: 'Keeper\'s Journal IX — The Lightless Sanctum',
    text: `In the deepest trench lies the Sanctum, where we kept our records in the dark.

Wake the beacon, and teach the light where to go. The crystals turn; the light follows. When the eye of the door sees the light, it will open. One crystal fell from its stand long ago — put it back where it belongs.`,
  },
  page10: {
    kind: 'page', title: 'Keeper\'s Journal X — To the One Who Comes',
    text: `If all seven sing together again, bring them home. Set them in the cradle at the heart of the palace.

Do not try to rule the sea. Light it. That was always the Stone's only wish.

— Ilyra`,
  },

  // --- Carvings ---
  c_clam: {
    kind: 'carving', title: 'Carving — The Living Shell',
    text: `A carving of a giant clam holding a bright star in its mouth. Small figures bow before it.

Beneath: "The sea keeps what the sea is given. Ask, and the shell will open."`,
  },
  c_guardians: {
    kind: 'carving', title: 'Carving — The Three Guardians',
    text: `Three robed figures, each with a sign on its chest.

"TIDES gazes upon the MOON.
FLAME gazes upon the EYE.
STONE gazes upon the WAVE."`,
  },
  c_market: {
    kind: 'carving', title: 'Carving — The Fair Scales',
    text: `Merchants push square stones across a tiled square.

"Three weights upon three plates, and the vault shall open. Push with care: a stone in a corner cannot be pulled out."`,
  },
  c_mural: {
    kind: 'carving', title: 'Mural — The Shining City',
    text: `A long mural: a palace with a blazing crystal at its heart, streets full of light, people dancing, dolphins leaping through rings of water.

In the corner a dolphin carries something glowing in its mouth toward a forest of kelp.`,
  },
  c_dolphins: {
    kind: 'carving', title: 'Carving — The Song Door',
    text: `Dolphins circle a sealed door, their mouths open in song.

"Only the song of the sea's children opens this way."`,
  },
  c_shrine1: { kind: 'carving', title: 'Shrine Stone — First Sign', text: `The stone shows four empty circles. The FIRST circle holds the sign of the SPIRAL.` },
  c_shrine2: { kind: 'carving', title: 'Shrine Stone — Second Sign', text: `The stone shows four empty circles. The SECOND circle holds the sign of the SUN.` },
  c_shrine3: { kind: 'carving', title: 'Shrine Stone — Third Sign', text: `The stone shows four empty circles. The THIRD circle holds the sign of the TRIDENT.` },
  c_shrine4: { kind: 'carving', title: 'Shrine Stone — Fourth Sign', text: `The stone shows four empty circles. The FOURTH circle holds the sign of the MOON.` },
  c_forge: {
    kind: 'carving', title: 'Carving — Riders of the Current',
    text: `Smiths ride streams of water like birds riding wind, carried through a maze toward a glowing anvil.

"Do not fight the water."`,
  },
  c_sanctum: {
    kind: 'carving', title: 'Carving — The Beacon',
    text: `A beam of light leaves a beacon and bends at three crystals before striking a great carved eye.

"Light from the beacon, guided by crystal, wakes the sealed heart."`,
  },
  c_palace: {
    kind: 'carving', title: 'Carving — The Palace Gate',
    text: `Seven sockets in a ring around a carved crystal.

"Seven lights for seven sockets. Only the whole song opens the heart."`,
  },
};

export const JOURNAL_ORDER = [
  'log_start', 'log_quill', 'log_heat', 'log_abyss',
  'page1', 'page2', 'page3', 'page4', 'page5', 'page6', 'page7', 'page8', 'page9', 'page10',
  'c_clam', 'c_guardians', 'c_market', 'c_mural', 'c_dolphins', 'c_shrine1', 'c_shrine2', 'c_shrine3', 'c_shrine4', 'c_forge', 'c_sanctum', 'c_palace',
];

export const RELICS = {
  maskGold: { name: 'Orichalcum Mask', desc: 'A ceremonial mask of red-gold metal. Its eyes are cut in the shape of waves.', shape: 'mask', color: 0xd9a838 },
  maskCoral: { name: 'Coral Mask', desc: 'Carved from pink coral, worn at the festival of the first tide.', shape: 'mask', color: 0xff8a8a },
  maskTide: { name: 'Mask of the Deep', desc: 'Black stone with teal inlay. The priests wore it in the temple.', shape: 'mask', color: 0x2f4f5f },
  coinSun: { name: 'Sun Coin', desc: 'A heavy gold coin stamped with an eight-rayed sun.', shape: 'coin', color: 0xe8c04a },
  coinMoon: { name: 'Moon Coin', desc: 'A silver coin with a crescent moon. Still bright after all these years.', shape: 'coin', color: 0xd8dde8 },
  coinTrident: { name: 'Trident Coin', desc: 'Bronze, worn smooth by many hands. Market money.', shape: 'coin', color: 0xb07a40 },
  statDolphin: { name: 'Dolphin Figurine', desc: 'A small jade dolphin. Children carried them for luck.', shape: 'dolphin', color: 0x6fd6a8 },
  statGuardian: { name: 'Guardian Figurine', desc: 'A palm-sized copy of a forest guardian.', shape: 'statue', color: 0xe9e3d3 },
  statQueen: { name: 'Figurine of the Keeper', desc: 'A robed woman holding a crystal. The base reads: Ilyra.', shape: 'statue', color: 0xc59bff },
  amphora: { name: 'Painted Amphora', desc: 'A wine jar painted with octopuses. The cork is still in it.', shape: 'amphora', color: 0xc8643a },
  crown: { name: 'Smith\'s Crown', desc: 'A crown of blackened iron, given to the best smith of the forge each year.', shape: 'crown', color: 0x5a4a44 },
  starCompass: { name: 'Star Compass', desc: 'A disc of crystal and gold that once pointed toward the palace.', shape: 'coin', color: 0x7ff3ff },
};

export const RELIC_ORDER = Object.keys(RELICS);
