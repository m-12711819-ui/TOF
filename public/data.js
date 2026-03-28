const BOARD_SPACES = [
  { id: 0, name: "The Gate", type: "gate" },
  { id: 1, name: "The Weaver's Alley", type: "district", color: "brown", price: 60, baseRent: 2 },
  { id: 2, name: "Tides of Fate", type: "tides" },
  { id: 3, name: "The Spice Bazaar", type: "district", color: "brown", price: 60, baseRent: 4 },
  { id: 4, name: "Sadaqah", type: "charity", amount: 200, desc: "Pay 200 Dirhams into the Common Well" },
  { id: 5, name: "Caravan Route North", type: "station", price: 200, baseRent: 25 },
  { id: 6, name: "The Carpenter's Guild", type: "district", color: "lightblue", price: 100, baseRent: 6 },
  { id: 7, name: "Tides of Fate", type: "tides" },
  { id: 8, name: "The Potter's Kiln", type: "district", color: "lightblue", price: 100, baseRent: 6 },
  { id: 9, name: "The Glassblower's Shop", type: "district", color: "lightblue", price: 120, baseRent: 8 },
  { id: 10, name: "Reflection Garden", type: "reflection_visiting" }, // Just visiting
  { id: 11, name: "The Perfume Souq", type: "district", color: "pink", price: 140, baseRent: 10 },
  { id: 12, name: "The Water Mill", type: "utility", price: 150 },
  { id: 13, name: "The Silk Market", type: "district", color: "pink", price: 140, baseRent: 10 },
  { id: 14, name: "The Goldsmith's Row", type: "district", color: "pink", price: 160, baseRent: 12 },
  { id: 15, name: "Caravan Route East", type: "station", price: 200, baseRent: 25 },
  { id: 16, name: "The Herbalist's Pharmacy", type: "district", color: "orange", price: 180, baseRent: 14, tags: ["Medical Clinic"] },
  { id: 17, name: "Tides of Fate", type: "tides" },
  { id: 18, name: "The Architect's Studio", type: "district", color: "orange", price: 180, baseRent: 14 },
  { id: 19, name: "The Calligrapher's Atrium", type: "district", color: "orange", price: 200, baseRent: 16 },
  { id: 20, name: "The Oasis", type: "oasis" },
  { id: 21, name: "The Poet's Courtyard", type: "district", color: "red", price: 220, baseRent: 18 },
  { id: 22, name: "Tides of Fate", type: "tides" },
  { id: 23, name: "The Scholar's Library", type: "district", color: "red", price: 220, baseRent: 18, tags: ["Knowledge/School"] },
  { id: 24, name: "The Philosopher's Academy", type: "district", color: "red", price: 240, baseRent: 20, tags: ["Knowledge/School"] },
  { id: 25, name: "Caravan Route South", type: "station", price: 200, baseRent: 25 },
  { id: 26, name: "The Agronomist's Garden", type: "district", color: "yellow", price: 260, baseRent: 22, tags: ["Garden", "Farm"] },
  { id: 27, name: "The Botanist's Conservatory", type: "district", color: "yellow", price: 260, baseRent: 22, tags: ["Garden", "Farm"] },
  { id: 28, name: "The Wind Tower", type: "utility", price: 150 },
  { id: 29, name: "The Astronomer's Observatory", type: "district", color: "yellow", price: 280, baseRent: 24, tags: ["Knowledge/School"] },
  { id: 30, name: "Go To Reflection Garden", type: "go_to_reflection" },
  { id: 31, name: "The Healer's Clinic", type: "district", color: "green", price: 300, baseRent: 26, tags: ["Medical Clinic"] },
  { id: 32, name: "The Surgeon's Hospital", type: "district", color: "green", price: 300, baseRent: 26, tags: ["Medical Clinic"] },
  { id: 33, name: "Tides of Fate", type: "tides" },
  { id: 34, name: "The Mathematician's Hall", type: "district", color: "green", price: 320, baseRent: 28, tags: ["Knowledge/School"] },
  { id: 35, name: "Caravan Route West", type: "station", price: 200, baseRent: 25 },
  { id: 36, name: "Tides of Fate", type: "tides" },
  { id: 37, name: "Zakat", type: "charity", amount: 100, desc: "Pay 100 Dirhams into the Common Well" },
  { id: 38, name: "The Grand Palace", type: "district", color: "darkblue", price: 350, baseRent: 35 },
  { id: 39, name: "The Grand Mosque", type: "district", color: "darkblue", price: 400, baseRent: 50 }
];

const TIDES_OF_FATE_DECK = [
  { id: "tof_1", name: "Bountiful Harvest", desc: "Every player receives 50 Dirhams from the bank. The Barakah Bonus: Add +10 Dirhams for every seed currently in the Barakah Bowl." },
  { id: "tof_2", name: "The Traveling Scholar", desc: "The player with the most Knowledge/School properties draws 2 Gratitude Tokens. The Barakah Bonus: If there are 5+ seeds, every player draws 1 Gratitude Token instead." },
  { id: "tof_3", name: "Market Expansion", desc: "Every player may move their token to the nearest unowned District and buy it at half price. The Barakah Bonus: If the Bowl has 10+ seeds, the bank pays for the property entirely!" },
  { id: "tof_4", name: "Unexpected Rain", desc: "All Garden and Farm owners collect double fees this round. Every player adds 1 Seed to the Barakah Bowl for Shared Joy." },
  { id: "tof_5", name: "The Local Festival", desc: "Every player gives 20 Dirhams to the player on their left as a gift. Anyone who gives a gift also takes a Gratitude Token from the deck." },
  { id: "tof_6", name: "Economic Downturn", desc: "A recession hits. Every player must pay 50 Dirhams to the bank. The Barakah Bonus: The Shield - For every 2 seeds in the Bowl, reduce the payment by 10 Dirhams." },
  { id: "tof_7", name: "Waqf Expansion", desc: "You may build one House (Shelter) on any property you own for free. The Barakah Bonus: If you already have a Hotel (Endowment), add 3 Seeds to the Barakah Bowl." },
  { id: "tof_8", name: "The Guest at the Gate", desc: "Move your token directly to The Gate (GO) and collect your 200 Dirhams. The Barakah Bonus: If you pass another player, give them 20 Dirhams and take a Gratitude Token." },
  { id: "tof_9", name: "Community Repairs", desc: "Pay 25 Dirhams per House and 100 Dirhams per Hotel you own. The Barakah Bonus: Charity Twist - This money goes into the Common Well, not the bank!" },
  { id: "tof_10", name: "The Healing Springs", desc: "Every player currently in the Reflection Garden (Jail) may leave for free. They each add 1 Seed to the Bowl as a Thank You to the community." },
  { id: "tof_11", name: "Shared Knowledge", desc: "Choose one opponent. You both draw a Niyyah Card. The Barakah Bonus: If you both have the same color property, you both gain 100 Dirhams." },
  { id: "tof_12", name: "Dust Storm", desc: "All players lose 1 turn to stay safe indoors. Except: Players with a Medical Clinic or Shelter may still take their turn." },
  { id: "tof_13", name: "The Golden Rule", desc: "Choose any player. Give them 100 Dirhams. The Barakah Bonus: The Bank immediately gives YOU 200 Dirhams and a Gratitude Token." },
  { id: "tof_14", name: "Urban Migration", desc: "All players move their tokens 3 spaces forward and resolve the new space. Any fees incurred during this move are cut in half." },
  { id: "tof_15", name: "The Great Endowment", desc: "The player with the least amount of money receives the entire contents of the Common Well. The Barakah Bonus: If the Well is empty, the Bank gives them 300 Dirhams." },
  { id: "tof_16", name: "Abundance Overflow", desc: "If the Barakah Bowl has 15+ seeds, the game ends immediately. Everyone flips their hidden scores. The era of prosperity has arrived!" }
];

const NIYYAH_DECK = [
  { id: "niy_1", name: "The Humble Neighbor", desc: "End the game without ever owning more than 2 Districts of the same color.", bonus: 50 },
  { id: "niy_2", name: "The Generous Host", desc: "Waive a Contribution (fee) at least 5 times during the game.", bonus: 40 },
  { id: "niy_3", name: "The Silent Partner", desc: "Co-Invest in 3 different properties with 3 different players.", bonus: 45 },
  { id: "niy_4", name: "The Bridge Builder", desc: "Be the player with the most Gratitude Tokens from 3 or more different opponents.", bonus: 60 },
  { id: "niy_5", name: "The Simple Liver", desc: "End the game with the least amount of physical cash (Dirhams) among all players.", bonus: 55 },
  { id: "niy_6", name: "The Common Guardian", desc: "Land on the Sadaqah or Zakat spaces at least 3 times and pay into the Well.", bonus: 35 },
  { id: "niy_7", name: "The Patron of Arts", desc: "Invest in a Library or School Endowment for someone else using your own turn.", bonus: 50 },
  { id: "niy_8", name: "The Patient One", desc: "Spend at least 3 turns in the Reflection Garden without complaining.", bonus: 30 },
  { id: "niy_9", name: "The Open Hand", desc: "Give a resource or property to another player for 0 Dirhams during a trade.", bonus: 45 },
  { id: "niy_10", name: "The Well-Digger", desc: "Be the first player to turn a property into a Legacy Endowment (sending rent to the Well).", bonus: 40 },
  { id: "niy_11", name: "The Shield", desc: "Pay a fee for another player who was about to run out of money.", bonus: 60 },
  { id: "niy_12", name: "The Community Pillar", desc: "Ensure the Barakah Bowl reaches 10 seeds before the middle of the Tides of Fate deck.", bonus: 50 }
];

// District Colors mapped to hex codes for UI rendering
const COLOR_MAP = {
  brown: "#8B4513",
  lightblue: "#87CEEB",
  pink: "#FF69B4",
  orange: "#FFA500",
  red: "#FF0000",
  yellow: "#FFD700",
  green: "#008000",
  darkblue: "#00008B",
  station: "#333333",
  utility: "#D2B48C" // Tan
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BOARD_SPACES, TIDES_OF_FATE_DECK, NIYYAH_DECK, COLOR_MAP };
}
