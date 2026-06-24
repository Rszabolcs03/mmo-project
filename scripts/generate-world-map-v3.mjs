import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');
const mapsDir = path.join(publicDir, 'maps');
const tilesetsDir = path.join(publicDir, 'tilesets');
const assetTilesetsDir = path.join(publicDir, 'assets', 'tilesets');
const docsDir = path.join(rootDir, 'docs');

const TILE = 32;
const REGION_TILES = 800;
const REGION_GRID = 5;
const WORLD_TILES = REGION_TILES * REGION_GRID;
const TILESET_COLUMNS = 16;
const BIOME_TILESET_TILES = 256;
const WATER_TILESET_TILES = 16;
const BUILDING_TILESET_COLUMNS = 32;
const BUILDING_TILESET_TILES = 2048;
const PROP_TILESET_TILES = 256;
const CITY_TILESET_COLUMNS = 64;
const CITY_TILESET_TILES = 8192;

const BIOMES = [
  { id: 'emerald_vale', name: 'Emerald Starter Vale', firstgid: 1, colors: ['#5f9f54', '#9fc66f', '#2f683f', '#c6b36b', '#536c58'], road: '#b99c66', density: 0.58 },
  { id: 'golden_fields', name: 'Golden Countryside', firstgid: 257, colors: ['#8fad55', '#c0c46b', '#66843e', '#d2bb72', '#74704e'], road: '#c7a86b', density: 0.34 },
  { id: 'elderwood', name: 'Elderwood Deep Forest', firstgid: 513, colors: ['#3f7946', '#6fa856', '#1f4d35', '#9a8657', '#314d45'], road: '#866a49', density: 0.78 },
  { id: 'silver_river', name: 'Silver Riverlands', firstgid: 769, colors: ['#679b65', '#9abc78', '#3c7056', '#b8ad75', '#5d746d'], road: '#bda26e', density: 0.46 },
  { id: 'sunhill', name: 'Sunhill Downs', firstgid: 1025, colors: ['#879857', '#b5b96a', '#5b713f', '#c5aa67', '#6f7259'], road: '#ad915d', density: 0.40 },
  { id: 'cloudspine', name: 'Cloudspine Pass', firstgid: 1281, colors: ['#767c62', '#aaa074', '#505a50', '#ddd3ad', '#494f4b'], road: '#9d8258', density: 0.25 },
  { id: 'ironcrag', name: 'Ironcrag Highlands', firstgid: 1537, colors: ['#737568', '#9b9479', '#51554f', '#c3b682', '#444947'], road: '#967b56', density: 0.22 },
  { id: 'murkfen', name: 'Murkfen Marsh', firstgid: 1793, colors: ['#4f775d', '#819868', '#294d48', '#7d7352', '#3b5d56'], road: '#7a6a4c', density: 0.56 },
  { id: 'old_empire', name: 'Old Empire Ruins', firstgid: 2049, colors: ['#767165', '#9c9474', '#4c5049', '#bca46d', '#575955'], road: '#93825f', density: 0.36 },
  { id: 'saltwind', name: 'Saltwind Coast', firstgid: 2305, colors: ['#789a66', '#abb878', '#4d7655', '#d5bd78', '#6c7668'], road: '#c7ad70', density: 0.36 },
  { id: 'amber_steppe', name: 'Amber Steppe', firstgid: 2561, colors: ['#a69a4f', '#c9ba67', '#727b3f', '#d5bc77', '#716143'], road: '#b8955e', density: 0.28 },
  { id: 'shadowfen', name: 'Shadowfen Wilds', firstgid: 2817, colors: ['#526b52', '#79865e', '#2f4437', '#98815d', '#403f3b'], road: '#80694b', density: 0.66 },
];

const WATER_FIRSTGID = 3073;
const BUILDINGS_FIRSTGID = WATER_FIRSTGID + WATER_TILESET_TILES;
const PROPS_FIRSTGID = BUILDINGS_FIRSTGID + BUILDING_TILESET_TILES;
const COLLISION_FIRSTGID = PROPS_FIRSTGID + PROP_TILESET_TILES;
const CITY_FIRSTGID = COLLISION_FIRSTGID + 1;

const BIOME_BY_ID = Object.fromEntries(BIOMES.map((biome) => [biome.id, biome]));

const TILES = {
  base: 1,
  alt: 2,
  dark: 3,
  dirt: 4,
  road: 5,
  path: 6,
  water: 7,
  bank: 8,
  stone: 9,
  plaza: 10,
  field: 11,
  mud: 12,
  light: 13,
  flowers: 14,
  reeds: 15,
  shallowWater: 16,
  forestFloor: 17,
  cliffDirt: 18,
  mossStone: 19,
  sand: 20,
  tallGrass: 21,
  crop: 22,
  roadEdge: 23,
  ruinFloor: 24,
  tree: 33,
  treeAlt: 34,
  pine: 35,
  bush: 36,
  rock: 37,
  stump: 38,
  log: 39,
  mushroom: 40,
  mountain: 49,
  mountainSnow: 50,
  cliff: 51,
  scree: 52,
};

const PROPS = {
  barrel: 0,
  crate: 1,
  hay: 2,
  cart: 3,
  sign: 4,
  fenceH: 5,
  fenceV: 6,
  brokenFence: 7,
  lamp: 8,
  flowerPatch: 9,
  reeds: 10,
  mushroom: 11,
  rockSmall: 12,
  rockLarge: 13,
  stump: 14,
  log: 15,
  oak2x2: 16,
  pine2x2: 20,
  forestCluster3x3: 48,
  bridgeH: 80,
  bridgeV: 96,
  dock: 112,
  boat: 128,
  ruinsPillar: 144,
  ruinsWall: 145,
  mineEntrance: 160,
  caveEntrance: 176,
  marketStall: 192,
  well: 208,
  torch: 209,
  campfire: 210,
  torchFrame2: 211,
  campfireFrame2: 212,
  campfireFrame3: 213,
};

const WATER_TILES = {
  deep: 1,
  deepAlt: 2,
  river: 3,
  riverAlt: 4,
  shallow: 5,
  shallowAlt: 6,
  foam: 7,
  waterfall: 8,
};

const CITY = {
  cobble: 0,
  cobbleAlt: 1,
  cobbleDark: 2,
  interiorWood: 3,
  interiorStone: 4,
  interiorCarpet: 5,
  interiorWall: 6,
  interiorWallStone: 7,
  roofRed: 16,
  roofSlate: 17,
  roofGreen: 18,
  roofGold: 19,
  roofDark: 20,
  roofEdge: 21,
  facadePlaster: 22,
  facadeStone: 23,
  facadeWood: 24,
  door: 25,
  window: 26,
  chimney: 27,
  awningRed: 28,
  awningBlue: 29,
  awningGreen: 30,
  awningPurple: 31,
  fountainBasin: 32,
  fountainWater: 33,
  fountainWaterAlt: 34,
  fountainFoam: 35,
  fountainStatue: 36,
  fountainEdge: 37,
  counterH: 48,
  counterV: 49,
  shelf: 50,
  table: 51,
  bed: 52,
  forge: 53,
  anvil: 54,
  bankVault: 55,
  auctionDesk: 56,
  alchemyShelf: 57,
  arcaneShelf: 58,
  professionBench: 59,
  stableStall: 60,
  signBank: 64,
  signAuction: 65,
  signInn: 66,
  signSword: 67,
  signShield: 68,
  signPotion: 69,
  signArcane: 70,
  signProfession: 71,
  signGeneral: 72,
  cityLamp: 80,
  bench: 81,
  planter: 82,
  marketAwning: 83,
  crateStack: 84,
  barrelStack: 85,
  cartLarge: 86,
  bannerBlue: 87,
  bannerRed: 88,
  rugBlue: 89,
  rugGold: 90,
  counterCorner: 91,
  goldStack: 92,
  weaponRack: 93,
  armorStand: 94,
  potionTable: 95,
  arcaneRune: 96,
  fishRack: 97,
  oreCart: 98,
  clothRack: 99,
  leatherRack: 100,
  stableFeed: 101,
  civicDesk: 102,
  chapelAltar: 103,
  waterTrough: 104,
  signFishing: 105,
  signMining: 106,
  signTailor: 107,
  signLeather: 108,
};

function cityAtlasTile(col, row) {
  return row * CITY_TILESET_COLUMNS + col;
}

const CITY_BUILDING_PREFABS = {
  townHall: { exterior: cityAtlasTile(0, 4), interior: cityAtlasTile(0, 68), w: 18, h: 14, theme: 'civic', sign: CITY.signProfession, roof: '#657181', wall: '#928d82', trim: '#d7c59d', label: 'Town Hall' },
  guardPost: { exterior: cityAtlasTile(20, 4), interior: cityAtlasTile(20, 68), w: 14, h: 11, theme: 'civic', sign: CITY.signShield, roof: '#5f6772', wall: '#898982', trim: '#c8bda5', label: 'Guard Hall' },
  bank: { exterior: cityAtlasTile(36, 4), interior: cityAtlasTile(36, 68), w: 14, h: 11, theme: 'bank', sign: CITY.signBank, roof: '#64748b', wall: '#9b978d', trim: '#e0c46c', label: 'Bank' },
  auctionHouse: { exterior: cityAtlasTile(50, 4), interior: cityAtlasTile(50, 68), w: 14, h: 11, theme: 'auction', sign: CITY.signAuction, roof: '#9c7640', wall: '#968978', trim: '#e879f9', label: 'Auction' },
  inn: { exterior: cityAtlasTile(0, 19), interior: cityAtlasTile(0, 83), w: 16, h: 12, theme: 'inn', sign: CITY.signInn, roof: '#9b4d45', wall: '#b99564', trim: '#fbbf24', label: 'Inn' },
  generalGoods: { exterior: cityAtlasTile(18, 19), interior: cityAtlasTile(18, 83), w: 12, h: 10, theme: 'general', sign: CITY.signGeneral, roof: '#5e7e4e', wall: '#a98255', trim: '#d6aa6b', label: 'General Goods' },
  marketHall: { exterior: cityAtlasTile(32, 19), interior: cityAtlasTile(32, 83), w: 20, h: 10, theme: 'market', sign: CITY.signGeneral, roof: '#9b4d45', wall: '#a98255', trim: '#e5c07b', label: 'Market Hall' },
  alchemy: { exterior: cityAtlasTile(0, 32), interior: cityAtlasTile(0, 96), w: 11, h: 10, theme: 'alchemy', sign: CITY.signPotion, roof: '#4f7c55', wall: '#b99a73', trim: '#63d3b2', label: 'Alchemy' },
  arcane: { exterior: cityAtlasTile(13, 32), interior: cityAtlasTile(13, 96), w: 12, h: 10, theme: 'arcane', sign: CITY.signArcane, roof: '#4b3d73', wall: '#8a8490', trim: '#8be9fd', label: 'Arcane' },
  weaponsmith: { exterior: cityAtlasTile(27, 32), interior: cityAtlasTile(27, 96), w: 11, h: 10, theme: 'weaponsmith', sign: CITY.signSword, roof: '#493942', wall: '#8a8178', trim: '#e0e7ef', label: 'Weaponsmith' },
  blacksmith: { exterior: cityAtlasTile(40, 32), interior: cityAtlasTile(40, 96), w: 14, h: 11, theme: 'forge', sign: CITY.signSword, roof: '#44333a', wall: '#817b73', trim: '#f97316', label: 'Forge' },
  miningOffice: { exterior: cityAtlasTile(0, 44), interior: cityAtlasTile(0, 108), w: 11, h: 10, theme: 'mining', sign: CITY.signMining, roof: '#6b7076', wall: '#8c8378', trim: '#94a3b8', label: 'Mining Office' },
  armorer: { exterior: cityAtlasTile(13, 44), interior: cityAtlasTile(13, 108), w: 12, h: 10, theme: 'armorer', sign: CITY.signShield, roof: '#627080', wall: '#88837a', trim: '#cbd5e1', label: 'Armorer' },
  fishingLodge: { exterior: cityAtlasTile(27, 44), interior: cityAtlasTile(27, 108), w: 12, h: 10, theme: 'fishing', sign: CITY.signFishing, roof: '#496f5c', wall: '#8a6745', trim: '#38bdf8', label: 'Fishing Lodge' },
  tailor: { exterior: cityAtlasTile(41, 44), interior: cityAtlasTile(41, 108), w: 11, h: 10, theme: 'tailor', sign: CITY.signTailor, roof: '#8d4e69', wall: '#b99a73', trim: '#f0abfc', label: 'Tailor' },
  leatherworker: { exterior: cityAtlasTile(53, 44), interior: cityAtlasTile(53, 108), w: 11, h: 10, theme: 'leather', sign: CITY.signLeather, roof: '#5e7e4e', wall: '#8f6241', trim: '#c08457', label: 'Leatherworker' },
  stable: { exterior: cityAtlasTile(0, 55), interior: cityAtlasTile(0, 119), w: 18, h: 9, theme: 'stable', sign: CITY.signGeneral, roof: '#587248', wall: '#8a6745', trim: '#d0a26b', label: 'Stable' },
  chapel: { exterior: cityAtlasTile(20, 48), interior: cityAtlasTile(20, 112), w: 12, h: 16, theme: 'chapel', sign: CITY.signProfession, roof: '#667482', wall: '#99958a', trim: '#f8f0cf', label: 'Chapel' },
  rowHouseRed: { exterior: cityAtlasTile(34, 55), interior: cityAtlasTile(34, 119), w: 10, h: 9, theme: 'house', roof: '#8d4a44', wall: '#b79669', trim: '#f2d990', label: 'Rowhouse' },
  rowHouseGreen: { exterior: cityAtlasTile(46, 55), interior: cityAtlasTile(46, 119), w: 10, h: 9, theme: 'house', roof: '#596f46', wall: '#b99a73', trim: '#d7c59d', label: 'Rowhouse' },
};

const BUILDINGS = {
  cottage: { prefabId: 'small_cottage', start: 0, w: 3, h: 3, label: 'Small Cottage', collision: { x: 0, y: 1, w: 3, h: 2 } },
  house: { prefabId: 'medium_house', start: 4, w: 4, h: 4, label: 'Medium House', collision: { x: 0, y: 1, w: 4, h: 3 } },
  townHall: { prefabId: 'town_hall', start: 15, w: 7, h: 6, label: 'Town Hall', collision: { x: 0, y: 2, w: 7, h: 4 } },
  inn: { prefabId: 'inn_tavern', start: 23, w: 6, h: 5, label: 'Inn / Tavern', collision: { x: 0, y: 1, w: 6, h: 4 } },
  shop: { prefabId: 'large_house', start: 9, w: 5, h: 4, label: 'Large House / Shop', collision: { x: 0, y: 1, w: 5, h: 3 } },
  chapel: { prefabId: 'chapel_temple', start: 230, w: 5, h: 6, label: 'Chapel / Temple', collision: { x: 0, y: 2, w: 5, h: 4 } },
  blacksmith: { prefabId: 'blacksmith', start: 224, w: 5, h: 4, label: 'Blacksmith', collision: { x: 0, y: 1, w: 5, h: 3 } },
  farmhouse: { prefabId: 'farm_house', start: 250, w: 4, h: 4, label: 'Farm House', collision: { x: 0, y: 1, w: 4, h: 3 } },
  stable: { prefabId: 'stable', start: 236, w: 6, h: 4, label: 'Stable', collision: { x: 0, y: 1, w: 6, h: 3 } },
  warehouse: { prefabId: 'warehouse', start: 243, w: 6, h: 5, label: 'Warehouse', collision: { x: 0, y: 1, w: 6, h: 4 } },
  barracks: { prefabId: 'guard_post', start: 461, w: 4, h: 4, label: 'Guard Post', collision: { x: 0, y: 1, w: 4, h: 3 } },
  barn: { prefabId: 'barn', start: 448, w: 6, h: 5, label: 'Barn', collision: { x: 0, y: 1, w: 6, h: 4 } },
  marketSet: { prefabId: 'market_stall_set', start: 455, w: 5, h: 3, label: 'Market Stall Set', collision: { x: 0, y: 1, w: 5, h: 2 } },
  watchtower: { prefabId: 'watchtower', start: 466, w: 3, h: 6, label: 'Watchtower', collision: { x: 0, y: 2, w: 3, h: 4 } },
  dockBuilding: { prefabId: 'dock_building', start: 470, w: 6, h: 4, label: 'Dock Building', collision: { x: 0, y: 1, w: 6, h: 3 } },
  ruinedSmall: { prefabId: 'ruined_house_small', start: 672, w: 4, h: 4, label: 'Ruined House Small', collision: { x: 0, y: 1, w: 4, h: 3 } },
  ruinedLarge: { prefabId: 'ruined_house_large', start: 677, w: 5, h: 4, label: 'Ruined House Large', collision: { x: 0, y: 1, w: 5, h: 3 } },
  cityRow: { prefabId: 'city_house_row', start: 683, w: 8, h: 5, label: 'City House Row', collision: { x: 0, y: 1, w: 8, h: 4 } },
  gatehouse: { prefabId: 'gatehouse', start: 692, w: 7, h: 5, label: 'Gatehouse', collision: { x: 0, y: 1, w: 7, h: 4 } },
  asterfallVilla: { prefabId: 'asterfall_villa', start: 896, w: 6, h: 5, label: 'Asterfall Villa', collision: { x: 0, y: 2, w: 6, h: 3 } },
  blueShop: { prefabId: 'blue_roof_shop', start: 903, w: 5, h: 4, label: 'Blue Roof Shop', collision: { x: 0, y: 1, w: 5, h: 3 } },
  apothecary: { prefabId: 'apothecary_house', start: 909, w: 4, h: 4, label: 'Apothecary House', collision: { x: 0, y: 1, w: 4, h: 3 } },
  cornerTownhouse: { prefabId: 'corner_townhouse', start: 914, w: 5, h: 5, label: 'Corner Townhouse', collision: { x: 0, y: 2, w: 5, h: 3 } },
  guildHall: { prefabId: 'guild_hall', start: 920, w: 7, h: 6, label: 'Guild Hall', collision: { x: 0, y: 2, w: 7, h: 4 } },
  redTownhouse: { prefabId: 'red_townhouse', start: 1120, w: 4, h: 5, label: 'Red Townhouse', collision: { x: 0, y: 2, w: 4, h: 3 } },
  greenTownhouse: { prefabId: 'green_townhouse', start: 1125, w: 4, h: 5, label: 'Green Townhouse', collision: { x: 0, y: 2, w: 4, h: 3 } },
  bakery: { prefabId: 'city_bakery', start: 1130, w: 5, h: 4, label: 'City Bakery', collision: { x: 0, y: 1, w: 5, h: 3 } },
  courtyardHouse: { prefabId: 'courtyard_house', start: 1136, w: 6, h: 5, label: 'Courtyard House', collision: { x: 0, y: 2, w: 6, h: 3 } },
  towerHouse: { prefabId: 'tower_house', start: 1143, w: 4, h: 6, label: 'Tower House', collision: { x: 0, y: 2, w: 4, h: 4 } },
  stoneManse: { prefabId: 'stone_manse', start: 1147, w: 5, h: 5, label: 'Stone Manse', collision: { x: 0, y: 2, w: 5, h: 3 } },
  cityBank: { prefabId: 'city_bank', start: 1344, w: 7, h: 6, label: 'Asterfall Bank', collision: { x: 0, y: 2, w: 7, h: 4 } },
  auctionHouse: { prefabId: 'auction_house', start: 1352, w: 8, h: 6, label: 'Auction House', collision: { x: 0, y: 2, w: 8, h: 4 } },
  weaponsmithShop: { prefabId: 'weaponsmith_shop', start: 1361, w: 5, h: 4, label: 'Weaponsmith', collision: { x: 0, y: 1, w: 5, h: 3 } },
  armorerShop: { prefabId: 'armorer_shop', start: 1367, w: 5, h: 4, label: 'Armorer', collision: { x: 0, y: 1, w: 5, h: 3 } },
  arcaneShop: { prefabId: 'arcane_shop', start: 1600, w: 5, h: 5, label: 'Arcane Shop', collision: { x: 0, y: 2, w: 5, h: 3 } },
  alchemyShop: { prefabId: 'alchemy_shop', start: 1606, w: 5, h: 4, label: 'Alchemy Shop', collision: { x: 0, y: 1, w: 5, h: 3 } },
  professionHall: { prefabId: 'profession_hall', start: 1612, w: 7, h: 5, label: 'Profession Hall', collision: { x: 0, y: 2, w: 7, h: 3 } },
  tailorShop: { prefabId: 'tailor_shop', start: 1620, w: 5, h: 4, label: 'Tailor Shop', collision: { x: 0, y: 1, w: 5, h: 3 } },
  leatherworkerShop: { prefabId: 'leatherworker_shop', start: 1626, w: 5, h: 4, label: 'Leatherworker', collision: { x: 0, y: 1, w: 5, h: 3 } },
  fishingLodge: { prefabId: 'fishing_lodge', start: 1792, w: 5, h: 4, label: 'Fishing Lodge', collision: { x: 0, y: 1, w: 5, h: 3 } },
  miningOffice: { prefabId: 'mining_office', start: 1798, w: 5, h: 4, label: 'Mining Office', collision: { x: 0, y: 1, w: 5, h: 3 } },
  cityStorage: { prefabId: 'city_storage', start: 1804, w: 6, h: 4, label: 'City Storage', collision: { x: 0, y: 1, w: 6, h: 3 } },
  serviceKiosk: { prefabId: 'service_kiosk', start: 1811, w: 3, h: 3, label: 'Service Kiosk', collision: { x: 0, y: 1, w: 3, h: 2 } },
  canalHouse: { prefabId: 'canal_house', start: 1815, w: 5, h: 4, label: 'Canal House', collision: { x: 0, y: 1, w: 5, h: 3 } },
};

const REGION_THEMES = [
  ['Asterfall Green', 'emerald_vale', 'gentle starter woodland and hidden groves'],
  ['Brightwater Ford', 'silver_river', 'river crossing village, mills, and bridges'],
  ['Sunhill Marches', 'sunhill', 'rolling hills and watch roads'],
  ['Crownroad Fields', 'golden_fields', 'northern farm road and market hamlets'],
  ['Saltwind Quay', 'saltwind', 'cliff harbor, beaches, and dockyards'],
  ['Elderbough Wilds', 'elderwood', 'dense old forest with glades and shrines'],
  ['Hearthmere Farms', 'golden_fields', 'wide farms, hedges, and rural lanes'],
  ['Lionsgate Approach', 'golden_fields', 'outer city fields and river road'],
  ['Velorian Ruins', 'old_empire', 'fallen imperial avenue and broken towers'],
  ['Pinewatch Weald', 'elderwood', 'eastern pine forest and hunter tracks'],
  ['Glassmere Lakes', 'silver_river', 'lake district with fishing docks and reeds'],
  ['Bannerfall Downs', 'sunhill', 'old battlefield, meadows, and memorial stones'],
  ['Lionsgate City', 'golden_fields', 'large central city and trade crossroads'],
  ['Murkfen Verge', 'murkfen', 'wetland border, raised roads, and stilt huts'],
  ['Seabriar Coast', 'saltwind', 'coastal road, sea caves, and lookouts'],
  ['Cloudspine Foothold', 'cloudspine', 'western mountain gate and high trails'],
  ['Ironcrag Hold', 'ironcrag', 'mining town, quarry yards, and cliff paths'],
  ['Frostgate Pass', 'cloudspine', 'major mountain pass and stone bridge'],
  ['Blackreed Marsh', 'murkfen', 'dark marsh pools and old causeways'],
  ['Tidefallen Shore', 'old_empire', 'ruined coast and drowned imperial docks'],
  ['Windbreak Isles', 'saltwind', 'remote coast, ferry landing, and sea road'],
  ['Ambergrain Reach', 'amber_steppe', 'dry southern farms and amber fields'],
  ['Dawnwatch Bastion', 'amber_steppe', 'southern fortress and caravan road'],
  ['Old Crown Expanse', 'old_empire', 'ancient temples, causeways, and gardens'],
  ['Shadowfen Frontier', 'shadowfen', 'dangerous wild end zone with dark woods'],
].map(([name, biome, role], index) => ({
  rx: index % REGION_GRID,
  ry: Math.floor(index / REGION_GRID),
  id: `region_${index % REGION_GRID}_${Math.floor(index / REGION_GRID)}`,
  name,
  biome,
  role,
}));

const LANDMARKS = [
  { id: 'asterfall_city', displayName: 'Asterfall City', kind: 'city_hub', x: 560, y: 420, radius: 230, biome: 'emerald_vale', showOnMap: true },
  { id: 'greenwake_lodge', displayName: 'Greenwake Lodge', kind: 'lodge', x: 185, y: 625, radius: 72, biome: 'emerald_vale', showOnMap: true },
  { id: 'brightwater_ford', displayName: 'Brightwater Ford', kind: 'village', x: 1110, y: 530, radius: 105, biome: 'silver_river', showOnMap: true },
  { id: 'sunhill_watch', displayName: 'Sunhill Watch', kind: 'fort', x: 1850, y: 620, radius: 88, biome: 'sunhill', showOnMap: true },
  { id: 'crownroad_market', displayName: 'Crownroad Market', kind: 'town', x: 2760, y: 470, radius: 128, biome: 'golden_fields', showOnMap: true },
  { id: 'saltwind_quay', displayName: 'Saltwind Quay', kind: 'harbor', x: 3550, y: 600, radius: 145, biome: 'saltwind', showOnMap: true },
  { id: 'elderbough_sanctum', displayName: 'Elderbough Sanctum', kind: 'grove', x: 560, y: 1120, radius: 82, biome: 'elderwood', showOnMap: true },
  { id: 'hearthmere', displayName: 'Hearthmere', kind: 'farmstead', x: 1160, y: 1260, radius: 125, biome: 'golden_fields', showOnMap: true },
  { id: 'willowmill', displayName: 'Willowmill', kind: 'mill', x: 1900, y: 1240, radius: 95, biome: 'silver_river', showOnMap: true },
  { id: 'velorian_gate', displayName: 'Velorian Gate', kind: 'ruins', x: 2740, y: 1160, radius: 128, biome: 'old_empire', showOnMap: true },
  { id: 'pinewatch_camp', displayName: 'Pinewatch Camp', kind: 'camp', x: 3480, y: 1220, radius: 82, biome: 'elderwood', showOnMap: true },
  { id: 'glassmere_ferry', displayName: 'Glassmere Ferry', kind: 'dock', x: 640, y: 1860, radius: 90, biome: 'silver_river', showOnMap: true },
  { id: 'bannerfall_memorial', displayName: 'Bannerfall Memorial', kind: 'battlefield', x: 1260, y: 2040, radius: 118, biome: 'sunhill', showOnMap: true },
  { id: 'lionsgate_city', displayName: 'Lionsgate City', kind: 'city', x: 2050, y: 1970, radius: 220, biome: 'golden_fields', showOnMap: true },
  { id: 'reedmere', displayName: 'Reedmere', kind: 'village', x: 2910, y: 2040, radius: 96, biome: 'murkfen', showOnMap: true },
  { id: 'seabriar_light', displayName: 'Seabriar Light', kind: 'watchtower', x: 3620, y: 2100, radius: 76, biome: 'saltwind', showOnMap: true },
  { id: 'cloudspine_gate', displayName: 'Cloudspine Gate', kind: 'fort', x: 520, y: 2700, radius: 98, biome: 'cloudspine', showOnMap: true },
  { id: 'ironcrag_hold', displayName: 'Ironcrag Hold', kind: 'mining_town', x: 1210, y: 2850, radius: 126, biome: 'ironcrag', showOnMap: true },
  { id: 'frostgate_span', displayName: 'Frostgate Span', kind: 'bridge_landmark', x: 2040, y: 2800, radius: 82, biome: 'cloudspine', showOnMap: true },
  { id: 'blackreed_crossing', displayName: 'Blackreed Crossing', kind: 'marsh_camp', x: 2920, y: 2900, radius: 98, biome: 'murkfen', showOnMap: true },
  { id: 'tidefallen_abbey', displayName: 'Tidefallen Abbey', kind: 'ruins', x: 3500, y: 2860, radius: 115, biome: 'old_empire', showOnMap: true },
  { id: 'windbreak_landing', displayName: 'Windbreak Landing', kind: 'harbor', x: 520, y: 3540, radius: 105, biome: 'saltwind', showOnMap: true },
  { id: 'ambergrain', displayName: 'Ambergrain', kind: 'farmstead', x: 1160, y: 3480, radius: 125, biome: 'amber_steppe', showOnMap: true },
  { id: 'dawnwatch_bastion', displayName: 'Dawnwatch Bastion', kind: 'fortress', x: 2000, y: 3420, radius: 155, biome: 'amber_steppe', showOnMap: true },
  { id: 'old_crown_temple', displayName: 'Old Crown Temple', kind: 'temple_ruins', x: 2870, y: 3460, radius: 145, biome: 'old_empire', showOnMap: true },
  { id: 'shadowfen_edge', displayName: 'Shadowfen Edge', kind: 'wild_camp', x: 3560, y: 3520, radius: 112, biome: 'shadowfen', showOnMap: true },
  { id: 'cave_starfall', displayName: 'Starfall Cave', kind: 'cave_entrance', x: 1540, y: 2920, radius: 44, biome: 'ironcrag', transitionTarget: 'starfall_cave' },
  { id: 'dungeon_old_crown', displayName: 'Old Crown Depths', kind: 'dungeon_entrance', x: 2890, y: 3540, radius: 54, biome: 'old_empire', transitionTarget: 'old_crown_depths' },
  { id: 'boat_windbreak_saltwind', displayName: 'Windbreak Ferry', kind: 'boat_route', x: 560, y: 3580, radius: 50, biome: 'saltwind', transitionTarget: 'saltwind_quay' },
  { id: 'fernroot_hideout', displayName: 'Fernroot Hideout', kind: 'hidden_cabin', x: 730, y: 720, radius: 38, biome: 'emerald_vale', showOnMap: false },
  { id: 'moonpetal_garden', displayName: 'Moonpetal Garden', kind: 'hidden_garden', x: 760, y: 1330, radius: 44, biome: 'elderwood', showOnMap: false },
  { id: 'brookbend_camp', displayName: 'Brookbend Camp', kind: 'forest_camp', x: 1460, y: 1540, radius: 48, biome: 'golden_fields', showOnMap: false },
  { id: 'broken_wagon', displayName: 'Broken Wagon', kind: 'roadside_camp', x: 1560, y: 2200, radius: 36, biome: 'sunhill', showOnMap: false },
  { id: 'mossveil_shrine', displayName: 'Mossveil Shrine', kind: 'shrine', x: 2630, y: 1510, radius: 44, biome: 'old_empire', showOnMap: false },
  { id: 'reedhook_spot', displayName: 'Reedhook Spot', kind: 'fishing_spot', x: 3060, y: 2240, radius: 40, biome: 'murkfen', showOnMap: false },
  { id: 'highroad_watch', displayName: 'Highroad Watch', kind: 'watchtower_ruin', x: 1890, y: 2660, radius: 46, biome: 'cloudspine', showOnMap: false },
  { id: 'starfall_overlook', displayName: 'Starfall Overlook', kind: 'cave_mouth', x: 1680, y: 3090, radius: 42, biome: 'ironcrag', showOnMap: false },
  { id: 'sunken_court', displayName: 'Sunken Court', kind: 'hidden_garden', x: 3220, y: 3200, radius: 48, biome: 'old_empire', showOnMap: false },
  { id: 'shadowroot_cache', displayName: 'Shadowroot Cache', kind: 'forest_camp', x: 3750, y: 3740, radius: 42, biome: 'shadowfen', showOnMap: false },
  { id: 'old_willow_ruins', displayName: 'Old Willow Ruins', kind: 'ruins', x: 930, y: 920, radius: 58, biome: 'elderwood', showOnMap: false },
  { id: 'northspring_cave', displayName: 'Northspring Cave', kind: 'cave_mouth', x: 2200, y: 940, radius: 46, biome: 'cloudspine', showOnMap: false },
  { id: 'lakebend_shrine', displayName: 'Lakebend Shrine', kind: 'shrine', x: 500, y: 1980, radius: 42, biome: 'silver_river', showOnMap: false },
  { id: 'greywatch_pass', displayName: 'Greywatch Pass', kind: 'watchtower_ruin', x: 1725, y: 2730, radius: 48, biome: 'cloudspine', showOnMap: false },
  { id: 'hollowfen_cabin', displayName: 'Hollowfen Cabin', kind: 'hidden_cabin', x: 3240, y: 2650, radius: 44, biome: 'murkfen', showOnMap: false },
  { id: 'whispering_camp', displayName: 'Whispering Camp', kind: 'forest_camp', x: 3350, y: 1450, radius: 46, biome: 'elderwood', showOnMap: false },
  { id: 'saltcliff_overlook', displayName: 'Saltcliff Overlook', kind: 'watchtower', x: 3820, y: 940, radius: 46, biome: 'saltwind', showOnMap: false },
  { id: 'amber_copse', displayName: 'Amber Copse', kind: 'hidden_garden', x: 1550, y: 3560, radius: 44, biome: 'amber_steppe', showOnMap: false },
  { id: 'old_bridge_camp', displayName: 'Old Bridge Camp', kind: 'roadside_camp', x: 2100, y: 2300, radius: 38, biome: 'silver_river', showOnMap: false },
  { id: 'southmere_fishing', displayName: 'Southmere Fishing Spot', kind: 'fishing_spot', x: 3330, y: 3280, radius: 42, biome: 'shadowfen', showOnMap: false },
  { id: 'stormfall_cave', displayName: 'Stormfall Cave', kind: 'cave_mouth', x: 2460, y: 2920, radius: 45, biome: 'ironcrag', showOnMap: false },
  { id: 'mossroot_ruins', displayName: 'Mossroot Ruins', kind: 'ruins', x: 780, y: 2520, radius: 54, biome: 'cloudspine', showOnMap: false },
];

const ROADS = [
  { id: 'greenwake_road', kind: 'main', width: 6, points: [[420, 420], [620, 500], [860, 505], [1110, 530], [1360, 690], [1660, 1010], [1900, 1240], [1990, 1630], [2050, 1970]] },
  { id: 'crownroad', kind: 'main', width: 6, points: [[2050, 1970], [2140, 1660], [2290, 1320], [2480, 940], [2760, 470], [3160, 520], [3550, 600]] },
  { id: 'east_coast_road', kind: 'main', width: 6, points: [[2050, 1970], [2320, 1880], [2600, 1945], [2910, 2040], [3220, 1990], [3450, 2040], [3620, 2100]] },
  { id: 'dawnwatch_road', kind: 'main', width: 6, points: [[2050, 1970], [2130, 2300], [2040, 2800], [2070, 3170], [2000, 3420], [2440, 3380], [2870, 3460], [3230, 3440], [3560, 3520]] },
  { id: 'elderwood_trail', kind: 'trail', width: 3, points: [[420, 420], [535, 705], [560, 1120], [770, 1280], [990, 1325], [1160, 1260]] },
  { id: 'hearthmere_loop', kind: 'secondary', width: 4.5, points: [[1110, 530], [1090, 880], [1160, 1260], [1185, 1660], [1260, 2040], [1610, 2060], [2050, 1970]] },
  { id: 'glassmere_lane', kind: 'secondary', width: 4.5, points: [[560, 1120], [600, 1500], [640, 1860], [900, 1970], [1260, 2040], [1660, 2050], [2050, 1970]] },
  { id: 'cloudspine_pass', kind: 'pass', width: 4, points: [[640, 1860], [560, 2240], [520, 2700], [850, 2820], [1210, 2850], [1580, 2790], [2040, 2800]] },
  { id: 'ironcrag_road', kind: 'secondary', width: 4.5, points: [[520, 2700], [850, 2800], [1210, 2850], [1540, 2920], [1780, 2865], [2040, 2800]] },
  { id: 'ambergrain_track', kind: 'secondary', width: 4.5, points: [[1210, 2850], [1195, 3180], [1160, 3480], [1510, 3470], [2000, 3420]] },
  { id: 'old_crown_causeway', kind: 'secondary', width: 4.5, points: [[2000, 3420], [2440, 3380], [2870, 3460], [3210, 3435], [3560, 3520]] },
  { id: 'blackreed_causeway', kind: 'secondary', width: 4.5, points: [[2910, 2040], [2990, 2420], [2920, 2900], [2860, 3210], [2870, 3460]] },
  { id: 'saltwind_coast_road', kind: 'secondary', width: 4.5, points: [[3550, 600], [3440, 930], [3480, 1220], [3570, 1650], [3620, 2100], [3500, 2860], [3560, 3520]] },
  { id: 'quay_dock_track', kind: 'trail', width: 3, points: [[3550, 600], [3710, 650], [3850, 740]] },
  { id: 'windbreak_track', kind: 'trail', width: 3, points: [[520, 3540], [760, 3620], [940, 3590], [1160, 3480]] },
];

const RIVERS = [
  {
    id: 'brightwater',
    kind: 'river',
    width: 13,
    widthJitter: 5,
    seed: 1201,
    points: [[1010, 0], [1085, 230], [1110, 530], [1015, 745], [870, 960], [1005, 1245], [895, 1510], [640, 1860], [705, 2110], [520, 2380], [465, 2520], [575, 2885], [490, 3230], [560, 3580], [545, 4000]],
  },
  {
    id: 'lionrun',
    kind: 'river',
    width: 16,
    widthJitter: 6,
    seed: 2202,
    points: [[2380, 0], [2310, 250], [2440, 520], [2290, 820], [2385, 1060], [2190, 1320], [2240, 1600], [2050, 1970], [2170, 2230], [1990, 2500], [2040, 2800], [1940, 3090], [2140, 3370], [2025, 3660], [2100, 4000]],
  },
  {
    id: 'blackreed',
    kind: 'river',
    width: 13,
    widthJitter: 5,
    seed: 3303,
    points: [[3310, 880], [3190, 1130], [3270, 1380], [3090, 1660], [2910, 2040], [3010, 2295], [2860, 2580], [2920, 2900], [3060, 3190], [3005, 3510], [3120, 4000]],
  },
  {
    id: 'willow_brook',
    kind: 'stream',
    fordable: true,
    width: 5,
    widthJitter: 2,
    seed: 3601,
    points: [[720, 260], [860, 415], [1110, 530], [1170, 600]],
  },
  {
    id: 'glassmere_run',
    kind: 'stream',
    fordable: true,
    width: 6,
    widthJitter: 2,
    seed: 3602,
    points: [[260, 1450], [410, 1650], [540, 1900], [640, 1860]],
  },
  {
    id: 'lionrun_west_brook',
    kind: 'stream',
    fordable: true,
    width: 5,
    widthJitter: 2,
    seed: 3603,
    points: [[1640, 890], [1810, 1120], [1900, 1240], [2050, 1970]],
  },
  {
    id: 'reedfen_threads',
    kind: 'stream',
    fordable: true,
    width: 5,
    widthJitter: 2,
    seed: 3604,
    points: [[3430, 1880], [3260, 2090], [3060, 2460], [2920, 2900]],
  },
  {
    id: 'ambergrain_creek',
    kind: 'stream',
    fordable: true,
    width: 5,
    widthJitter: 2,
    seed: 3605,
    points: [[1450, 3180], [1300, 3360], [1160, 3480], [930, 3590]],
  },
];

const RIVER_WIDENINGS = [
  { riverId: 'brightwater', x: 1110, y: 530, rx: 42, ry: 26, bonus: 5.5 },
  { riverId: 'brightwater', x: 640, y: 1860, rx: 64, ry: 34, bonus: 7 },
  { riverId: 'lionrun', x: 2050, y: 1970, rx: 72, ry: 46, bonus: 7.5 },
  { riverId: 'lionrun', x: 2040, y: 2800, rx: 54, ry: 32, bonus: 5 },
  { riverId: 'blackreed', x: 2910, y: 2040, rx: 56, ry: 34, bonus: 6 },
  { riverId: 'blackreed', x: 2920, y: 2900, rx: 68, ry: 42, bonus: 7 },
];

const LAKES = [
  {
    id: 'glassmere',
    x: 540,
    y: 1900,
    rx: 285,
    ry: 190,
    biome: 'silver_river',
    seed: 4101,
    lobes: [[-130, -55, 160, 88, 0.9], [140, 35, 150, 78, 0.82], [12, 115, 120, 64, 0.58]],
    cuts: [[-30, -140, 175, 70, 0.48], [90, -20, 82, 130, 0.28]],
    islands: [[-70, 38, 34, 24], [76, -58, 26, 20]],
  },
  {
    id: 'willow_pond',
    x: 1170,
    y: 600,
    rx: 110,
    ry: 78,
    biome: 'silver_river',
    seed: 4202,
    lobes: [[-46, 22, 62, 44, 0.76], [58, -12, 54, 38, 0.66]],
    cuts: [[10, -56, 70, 24, 0.36]],
    islands: [[20, 14, 12, 9]],
  },
  {
    id: 'blackreed_pool',
    x: 3060,
    y: 2460,
    rx: 220,
    ry: 175,
    biome: 'murkfen',
    seed: 4303,
    lobes: [[-120, 65, 120, 92, 0.85], [105, -70, 112, 70, 0.72], [65, 96, 86, 78, 0.6]],
    cuts: [[-18, -122, 100, 52, 0.4], [140, 26, 74, 112, 0.36]],
    islands: [[-12, 36, 30, 22], [82, -16, 22, 15]],
  },
  {
    id: 'tidefallen_bay',
    x: 3680,
    y: 2920,
    rx: 220,
    ry: 215,
    biome: 'saltwind',
    seed: 4404,
    lobes: [[-115, -70, 115, 112, 0.78], [82, 98, 96, 112, 0.68], [-42, 150, 140, 62, 0.52]],
    cuts: [[126, -20, 86, 146, 0.44], [-148, 60, 62, 90, 0.34]],
    islands: [[-44, 20, 24, 18]],
  },
  {
    id: 'shadowfen_mere',
    x: 3520,
    y: 3480,
    rx: 165,
    ry: 135,
    biome: 'shadowfen',
    seed: 4505,
    lobes: [[-84, 38, 88, 66, 0.76], [74, -38, 70, 60, 0.66], [32, 80, 74, 46, 0.48]],
    cuts: [[-12, -88, 90, 40, 0.34]],
    islands: [[34, 22, 18, 12]],
  },
];

const MOUNTAIN_RIDGES = [
  { id: 'north_spine', width: 128, seed: 5101, points: [[1220, 340], [1470, 430], [1710, 590], [1940, 760], [2180, 980], [2360, 1180]] },
  { id: 'western_cloudspine', width: 104, seed: 5202, points: [[470, 2150], [520, 2440], [650, 2720], [910, 2860], [1180, 2820]] },
  { id: 'frostgate_highroad', width: 116, seed: 5303, points: [[1080, 2800], [1410, 2740], [1740, 2760], [2040, 2800], [2370, 2860], [2780, 2920]] },
  { id: 'east_cliffs', width: 72, seed: 5404, points: [[3120, 2680], [3350, 2820], [3590, 2920]] },
];

const MOUNTAIN_PASS_PATHS = [
  { id: 'western_cloudspine_pass', width: 78, strength: 0.34, points: [[640, 1860], [560, 2240], [520, 2700], [850, 2820], [1210, 2850]] },
  { id: 'frostgate_pass_valley', width: 86, strength: 0.36, points: [[1210, 2850], [1580, 2790], [2040, 2800], [2370, 2860], [2780, 2920]] },
  { id: 'ironcrag_mining_valley', width: 70, strength: 0.28, points: [[520, 2700], [850, 2800], [1210, 2850], [1540, 2920], [1780, 2865], [2040, 2800]] },
];

const BRIDGES = [
  { id: 'brightwater_bridge', x: 1110, y: 530, w: 8, h: 5, orientation: 'horizontal', roadId: 'greenwake_road' },
  { id: 'glassmere_bridge', x: 640, y: 1860, w: 9, h: 5, orientation: 'horizontal', roadId: 'glassmere_lane' },
  { id: 'lionsgate_bridge', x: 2050, y: 1970, w: 7, h: 10, orientation: 'vertical', roadId: 'dawnwatch_road' },
  { id: 'frostgate_bridge', x: 2040, y: 2800, w: 8, h: 5, orientation: 'horizontal', roadId: 'cloudspine_pass' },
  { id: 'reedmere_bridge', x: 2910, y: 2040, w: 8, h: 5, orientation: 'horizontal', roadId: 'east_coast_road' },
  { id: 'blackreed_bridge', x: 2920, y: 2900, w: 5, h: 9, orientation: 'vertical', roadId: 'blackreed_causeway' },
];

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(width, height, pixels) {
  const rowBytes = width * 4 + 1;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * rowBytes] = 0;
    pixels.copy(raw, y * rowBytes + 1, y * width * 4, (y + 1) * width * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function rgba(hex, alpha = 255) {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16), alpha];
}

function blend(a, b, amount) {
  return [
    Math.round(a[0] * (1 - amount) + b[0] * amount),
    Math.round(a[1] * (1 - amount) + b[1] * amount),
    Math.round(a[2] * (1 - amount) + b[2] * amount),
    Math.round(a[3] * (1 - amount) + b[3] * amount),
  ];
}

function alpha(color, value) {
  return [color[0], color[1], color[2], value];
}

function put(pixels, width, height, x, y, color) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const p = (Math.floor(y) * width + Math.floor(x)) * 4;
  pixels[p] = color[0];
  pixels[p + 1] = color[1];
  pixels[p + 2] = color[2];
  pixels[p + 3] = color[3];
}

function fill(pixels, width, height, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) put(pixels, width, height, xx, yy, color);
  }
}

function line(pixels, width, height, x0, y0, x1, y1, color) {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = Math.round(x0);
  let y = Math.round(y0);
  while (true) {
    put(pixels, width, height, x, y, color);
    if (x === Math.round(x1) && y === Math.round(y1)) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

function hash(x, y, salt = 0) {
  let n = Math.imul(Math.floor(x) + 374761393, 668265263) ^ Math.imul(Math.floor(y) + 1274126177, 2246822519) ^ salt;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function stringSeed(value) {
  return String(value).split('').reduce((acc, char) => ((acc * 31 + char.charCodeAt(0)) >>> 0), 2166136261);
}

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function valueNoise(x, y, scale, salt = 0) {
  const gx = x / scale;
  const gy = y / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = smoothstep(gx - x0);
  const ty = smoothstep(gy - y0);
  const a = hash(x0, y0, salt);
  const b = hash(x0 + 1, y0, salt);
  const c = hash(x0, y0 + 1, salt);
  const d = hash(x0 + 1, y0 + 1, salt);
  return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
}

function signedNoise(x, y, scale, salt = 0) {
  return valueNoise(x, y, scale, salt) * 2 - 1;
}

function terrainNoise(x, y, salt = 0) {
  return signedNoise(x, y, 220, salt) * 0.5
    + signedNoise(x, y, 96, salt + 11) * 0.32
    + signedNoise(x, y, 44, salt + 23) * 0.18;
}

function makeLayer(fillValue = 0) {
  return Array.from({ length: REGION_TILES * REGION_TILES }, () => fillValue);
}

function encodeTileData(data) {
  const buffer = Buffer.alloc(data.length * 4);
  for (let i = 0; i < data.length; i += 1) buffer.writeUInt32LE(data[i] >>> 0, i * 4);
  return zlib.deflateSync(buffer).toString('base64');
}

function localIndex(x, y) {
  return y * REGION_TILES + x;
}

function setTile(layer, x, y, gid) {
  if (x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) return;
  layer[localIndex(x, y)] = gid;
}

function getTile(layer, x, y) {
  if (x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) return 0;
  return layer[localIndex(x, y)];
}

function fillRectLayer(layer, x, y, w, h, gid) {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) setTile(layer, xx, yy, gid);
  }
}

function softEllipse(x, y, cx, cy, rx, ry) {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return 1 - (nx * nx + ny * ny);
}

function landScore(x, y) {
  const continent = Math.max(
    softEllipse(x, y, 1350, 1450, 1180, 1050),
    softEllipse(x, y, 2400, 1720, 1200, 1050),
    softEllipse(x, y, 1950, 2820, 1260, 820),
    softEllipse(x, y, 3100, 2920, 820, 800),
    softEllipse(x, y, 680, 2760, 520, 850),
  );
  const northern = Math.max(
    softEllipse(x, y, 2850, 540, 920, 420),
    softEllipse(x, y, 970, 470, 720, 390),
  );
  const islands = Math.max(
    softEllipse(x, y, 520, 3530, 280, 230),
    softEllipse(x, y, 720, 3710, 140, 110),
    softEllipse(x, y, 3680, 2950, 310, 300),
    softEllipse(x, y, 3790, 720, 170, 130),
  );
  const bays = Math.max(
    softEllipse(x, y, 360, 2180, 250, 260),
    softEllipse(x, y, 3670, 1530, 260, 340),
    softEllipse(x, y, 2160, 3580, 300, 170),
  );
  return Math.max(continent, northern, islands)
    - Math.max(0, bays) * 0.42
    + terrainNoise(x, y, 101) * 0.2
    + signedNoise(x, y, 430, 102) * 0.12;
}

function isLand(x, y) {
  return landScore(x, y) > 0.045;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function pathDistance(x, y, points) {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    best = Math.min(best, distanceToSegment(x, y, ax, ay, bx, by));
  }
  return best;
}

function meanderPathPoints(points, seed, amplitude, stepSize) {
  const output = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const steps = Math.max(1, Math.ceil(length / stepSize));
    for (let step = 0; step < steps; step += 1) {
      if (i > 0 && step === 0) continue;
      const t = step / steps;
      const px = ax + dx * t;
      const py = ay + dy * t;
      const taper = Math.sin(Math.PI * t);
      const wave = (
        signedNoise(px, py, stepSize * 2.8, seed + i * 41)
        + Math.sin((i + t) * 2.7 + seed * 0.017) * 0.35
      ) * amplitude * taper;
      output.push([px + nx * wave, py + ny * wave]);
    }
  }
  output.push(points[points.length - 1]);
  return output;
}

function riverPathPoints(river) {
  if (!river._naturalPath) {
    river._naturalPath = meanderPathPoints(
      river.points,
      river.seed,
      river.kind === 'stream' ? 7 : 22,
      river.kind === 'stream' ? 135 : 170,
    );
  }
  return river._naturalPath;
}

function roadPathPoints(road) {
  if (!road._naturalPath) {
    const amplitude = road.kind === 'trail' ? 16 : road.kind === 'secondary' ? 11 : road.kind === 'pass' ? 9 : 7;
    const stepSize = road.kind === 'trail' ? 95 : road.kind === 'main' ? 130 : 115;
    road._naturalPath = meanderPathPoints(road.points, stringSeed(road.id), amplitude, stepSize);
  }
  return road._naturalPath;
}

function riverWidthAt(x, y, river) {
  const broad = signedNoise(x, y, 360, river.seed + 10) * (river.widthJitter ?? 3);
  const local = signedNoise(x, y, 92, river.seed + 11) * 1.6;
  let widening = 0;
  for (const pool of RIVER_WIDENINGS) {
    if (pool.riverId !== river.id) continue;
    widening += Math.max(0, softEllipse(x, y, pool.x, pool.y, pool.rx, pool.ry)) * pool.bonus;
  }
  return Math.max(river.kind === 'stream' ? 4 : 6, river.width + broad + local + widening);
}

function roadWidthAt(x, y, road) {
  const base = road.width;
  const salt = stringSeed(road.id);
  const wobble = signedNoise(x, y, road.kind === 'main' ? 260 : 150, salt) * (road.kind === 'main' ? 0.65 : 0.95);
  const min = road.kind === 'trail' ? 2.8 : road.kind === 'pass' ? 3.8 : 4.2;
  return Math.max(min, base + wobble);
}

function lakeShapeScore(lake, x, y) {
  if (Math.abs(x - lake.x) > lake.rx + 240 || Math.abs(y - lake.y) > lake.ry + 220) return -1;
  let score = softEllipse(x, y, lake.x, lake.y, lake.rx, lake.ry);
  for (const [dx, dy, rx, ry, strength] of lake.lobes ?? []) {
    score = Math.max(score, softEllipse(x, y, lake.x + dx, lake.y + dy, rx, ry) * strength);
  }
  for (const [dx, dy, rx, ry, strength] of lake.cuts ?? []) {
    score -= Math.max(0, softEllipse(x, y, lake.x + dx, lake.y + dy, rx, ry)) * strength;
  }
  score += signedNoise(x, y, 92, lake.seed) * 0.13
    + signedNoise(x, y, 38, lake.seed + 1) * 0.055;
  for (const [dx, dy, rx, ry] of lake.islands ?? []) {
    if (softEllipse(x, y, lake.x + dx, lake.y + dy, rx, ry) > 0.05) score = Math.min(score, -0.04);
  }
  return score;
}

function lakeInfoAt(x, y) {
  let best = null;
  for (const lake of LAKES) {
    const score = lakeShapeScore(lake, x, y);
    if (score > 0 && (!best || score > best.score)) best = { lake, score };
  }
  return best;
}

function lakeShoreAt(x, y) {
  let best = null;
  for (const lake of LAKES) {
    const score = lakeShapeScore(lake, x, y);
    if (score > -0.12 && score < 0.2 && (!best || Math.abs(score) < Math.abs(best.score))) best = { lake, score };
  }
  return best;
}

function nearestRoad(x, y) {
  let nearest = null;
  for (const road of ROADS) {
    const dist = pathDistance(x, y, road.points);
    if (!nearest || dist < nearest.distance) nearest = { road, distance: dist };
  }
  return nearest;
}

function nearestRiver(x, y) {
  let nearest = null;
  for (const river of RIVERS) {
    const baseDistance = pathDistance(x, y, riverPathPoints(river));
    const width = riverWidthAt(x, y, river);
    const bankNoise = signedNoise(x, y, 54, river.seed + 30) * (river.kind === 'stream' ? 2.1 : 4.3)
      + signedNoise(x, y, 132, river.seed + 31) * (river.kind === 'stream' ? 1.2 : 3.2);
    const distance = Math.max(0, baseDistance + bankNoise);
    const edgeDistance = distance - width;
    if (!nearest || edgeDistance < nearest.edgeDistance) nearest = { river, distance, width, edgeDistance };
  }
  return nearest;
}

function lakeAt(x, y) {
  return lakeInfoAt(x, y)?.lake ?? null;
}

function bridgeAt(x, y) {
  return BRIDGES.find((bridge) => (
    Math.abs(x - bridge.x) <= bridge.w / 2 && Math.abs(y - bridge.y) <= bridge.h / 2
  )) ?? null;
}

function sampleWorld(x, y) {
  const score = landScore(x, y);
  const land = score > 0.045;
  const bridge = bridgeAt(x, y);
  const river = nearestRiver(x, y);
  const lakeInfo = lakeInfoAt(x, y);
  const lake = lakeInfo?.lake ?? null;
  const water = !land || (river && river.distance <= river.width) || Boolean(lake);
  const fordableWater = Boolean(water && river?.river?.fordable && river.distance <= river.width + 2);
  const mountain = mountainScore(x, y);
  const theme = regionThemeFor(x, y);
  const biome = biomeForTerrain(x, y, { score, land, water, lake, river, mountain, theme });
  const road = land || bridge ? nearestRoad(x, y) : null;
  return { x, y, score, land, water, fordableWater, bridge, river, lake, lakeInfo, mountain, theme, biome, road };
}

function groundTileFromSample(sample) {
  const { x, y, biome, road, mountain, score } = sample;
  if (sample.water) return gid(biome, TILES.bank);
  const shoreLimit = 0.16 + signedNoise(x, y, 120, 7010) * 0.025;
  if (score < shoreLimit) {
    const shoreKind = valueNoise(x, y, 210, 7020);
    if (shoreKind > 0.76) return gid(biome, TILES.mossStone);
    if (shoreKind > 0.58) return gid(biome, TILES.cliffDirt);
    if (shoreKind < 0.16) return gid(biome, TILES.base);
    return gid(biome, TILES.sand);
  }
  if (mountain > 0.62) return gid(biome, TILES.stone);
  if (mountain > 0.34) return gid(biome, TILES.cliffDirt);
  if (mountain > 0.2 && valueNoise(x, y, 150, 7011) > 0.58) return gid(biome, TILES.dirt);
  if (road && road.distance < roadWidthAt(x, y, road.road) + 4) return gid(biome, TILES.dirt);
  const broad = valueNoise(x, y, 260, biome.firstgid + 7000);
  const mid = valueNoise(x, y, 140, biome.firstgid + 7100);
  if (biome.id === 'murkfen' || biome.id === 'shadowfen') {
    if (broad > 0.64) return gid(biome, TILES.dark);
    if (broad < 0.26 && mid > 0.44) return gid(biome, TILES.mud);
    return gid(biome, TILES.base);
  }
  if (biome.id === 'old_empire') {
    if (broad > 0.7) return gid(biome, TILES.ruinFloor);
    if (broad < 0.18) return gid(biome, TILES.mossStone);
    return gid(biome, TILES.base);
  }
  if (biome.id === 'amber_steppe') return gid(biome, broad > 0.68 ? TILES.dirt : TILES.base);
  if (biome.id === 'elderwood' || biome.id === 'emerald_vale' || biome.id === 'shadowfen') {
    if (broad > 0.68) return gid(biome, TILES.dark);
    if (broad > 0.42) return gid(biome, TILES.alt);
    return gid(biome, TILES.base);
  }
  if (biome.id === 'golden_fields' || biome.id === 'sunhill') {
    if (broad > 0.72) return gid(biome, TILES.alt);
    if (broad < 0.16) return gid(biome, TILES.light);
    return gid(biome, TILES.base);
  }
  if (broad > 0.74) return gid(biome, TILES.alt);
  if (broad < 0.18) return gid(biome, TILES.dark);
  return gid(biome, TILES.base);
}

function detailTileFromSample(sample) {
  const { x, y, biome, river, lake, road, mountain } = sample;
  if (sample.water) return 0;
  const shore = lake ? sample.lakeInfo : lakeShoreAt(x, y);
  const waterEdge = river && river.distance < river.width + 9;
  if (waterEdge || shore) {
    if ((biome.id === 'murkfen' || biome.id === 'shadowfen' || shore?.lake?.biome === 'murkfen') && hash(x, y, 44) > 0.48) return gid(biome, TILES.reeds);
    if (hash(x, y, 45) > 0.72) return gid(biome, TILES.mossStone);
    return gid(biome, TILES.bank);
  }
  if (road) {
    const roadWidth = roadWidthAt(x, y, road.road);
    if (road.distance > roadWidth && road.distance < roadWidth + 4) return gid(biome, TILES.roadEdge);
  }
  if (mountain > 0.58 && hash(x, y, 42) > 0.66) return gid(biome, TILES.scree);
  if (mountain > 0.26 && mountain <= 0.58 && hash(x, y, 46) > 0.78) return gid(biome, TILES.rock);
  const n = hash(x, y, 43);
  if ((biome.id === 'murkfen' || biome.id === 'shadowfen') && n > 0.965) return gid(biome, TILES.reeds);
  if ((biome.id === 'golden_fields' || biome.id === 'sunhill') && n > 0.985) return gid(biome, TILES.flowers);
  if ((biome.id === 'elderwood' || biome.id === 'emerald_vale') && n > 0.978) return gid(biome, TILES.forestFloor);
  if (biome.id === 'old_empire' && n > 0.982) return gid(biome, TILES.mossStone);
  if (n > 0.992) return gid(biome, TILES.tallGrass);
  return 0;
}

function roadTileFromSample(sample) {
  if (sample.water && !sample.bridge && !sample.fordableWater) return 0;
  const { road, biome } = sample;
  if (!road || road.distance > roadWidthAt(sample.x, sample.y, road.road)) return 0;
  if (road.road.kind === 'trail') return gid(biome, TILES.path);
  if (road.road.kind === 'pass') return gid(biome, TILES.dirt);
  return gid(biome, TILES.road);
}

function waterTileFromSample(sample) {
  if (!sample.water) return 0;
  if (sample.bridge) return waterGid(WATER_TILES.shallow);
  if (sample.river?.river?.kind === 'stream') return waterGid(WATER_TILES.shallow);
  if (sample.river && sample.river.distance < sample.river.width + 3) return waterGid(WATER_TILES.river);
  if (sample.lakeInfo && sample.lakeInfo.score < 0.12) return waterGid(WATER_TILES.shallow);
  if (sample.score < 0.1) return waterGid(WATER_TILES.deep);
  return waterGid(WATER_TILES.shallow);
}

function isWater(x, y) {
  if (!isLand(x, y)) return true;
  const river = nearestRiver(x, y);
  if (river && river.distance <= river.width) return true;
  if (lakeAt(x, y)) return true;
  return false;
}

function mountainScore(x, y) {
  let best = 0;
  for (const ridge of MOUNTAIN_RIDGES) {
    const width = ridge.width * (1 + signedNoise(x, y, 420, ridge.seed) * 0.18);
    const distance = pathDistance(x, y, ridge.points);
    const ridgeCore = 1 - distance / width;
    const brokenEdge = signedNoise(x, y, 126, ridge.seed + 1) * 0.16
      + signedNoise(x, y, 54, ridge.seed + 2) * 0.08;
    best = Math.max(best, ridgeCore + brokenEdge);
  }
  const shoulders = Math.max(
    softEllipse(x, y, 1650, 760, 780, 340) * 0.26,
    softEllipse(x, y, 1260, 2800, 900, 300) * 0.24,
    softEllipse(x, y, 2280, 2860, 980, 280) * 0.23,
  );
  let passRelief = 0;
  for (const pass of MOUNTAIN_PASS_PATHS) {
    const passShape = Math.max(0, 1 - pathDistance(x, y, pass.points) / pass.width);
    passRelief = Math.max(passRelief, passShape * pass.strength);
  }
  return Math.max(0, Math.max(best, shoulders) - passRelief);
}

function regionThemeFor(x, y) {
  const rx = Math.max(0, Math.min(REGION_GRID - 1, Math.floor(x / REGION_TILES)));
  const ry = Math.max(0, Math.min(REGION_GRID - 1, Math.floor(y / REGION_TILES)));
  return REGION_THEMES[ry * REGION_GRID + rx];
}

function blendedRegionBiomeId(x, y) {
  const rx = Math.max(0, Math.min(REGION_GRID - 1, Math.floor(x / REGION_TILES)));
  const ry = Math.max(0, Math.min(REGION_GRID - 1, Math.floor(y / REGION_TILES)));
  const localX = x - rx * REGION_TILES;
  const localY = y - ry * REGION_TILES;
  let selected = REGION_THEMES[ry * REGION_GRID + rx].biome;
  const band = 150;
  const noise = valueNoise(x, y, 82, 6500);
  const candidates = [
    { active: rx > 0, pressure: (band - localX) / band, rx: rx - 1, ry },
    { active: rx < REGION_GRID - 1, pressure: (localX - (REGION_TILES - band)) / band, rx: rx + 1, ry },
    { active: ry > 0, pressure: (band - localY) / band, rx, ry: ry - 1 },
    { active: ry < REGION_GRID - 1, pressure: (localY - (REGION_TILES - band)) / band, rx, ry: ry + 1 },
  ];
  for (const candidate of candidates) {
    if (!candidate.active || candidate.pressure <= 0) continue;
    const neighbor = REGION_THEMES[candidate.ry * REGION_GRID + candidate.rx];
    if (neighbor.biome === selected) continue;
    if (noise < candidate.pressure * 0.72) selected = neighbor.biome;
  }
  return selected;
}

function biomeForTerrain(x, y, context) {
  const { score, water, lake, river, mountain, theme } = context;
  if (water) {
    if (lake) return BIOME_BY_ID[lake.biome] ?? BIOME_BY_ID.silver_river;
    if (score < 0.045) return BIOME_BY_ID.saltwind;
    return BIOME_BY_ID.silver_river;
  }

  const coastBand = 0.18 + signedNoise(x, y, 170, 6101) * 0.035;
  if (score < coastBand || x > 3500 || y > 3600 || x < 180) return BIOME_BY_ID.saltwind;

  if (mountain > 0.62) return BIOME_BY_ID.cloudspine;
  if (mountain > 0.34) return BIOME_BY_ID.ironcrag;
  if (mountain > 0.2 && signedNoise(x, y, 210, 6102) > -0.15) return BIOME_BY_ID.sunhill;

  const swamp = softEllipse(x, y, 3050, 2480, 560, 640) + terrainNoise(x, y, 6201) * 0.18;
  if (swamp > 0.16) return BIOME_BY_ID.murkfen;
  if (swamp > -0.04 && signedNoise(x, y, 115, 6202) > -0.1) return BIOME_BY_ID.silver_river;

  const oldEmpire = softEllipse(x, y, 3040, 3400, 650, 480) + terrainNoise(x, y, 6301) * 0.16;
  if (oldEmpire > 0.14) return BIOME_BY_ID.old_empire;
  if (oldEmpire > -0.04 && signedNoise(x, y, 150, 6302) > 0.0) return BIOME_BY_ID.amber_steppe;

  const westForest = softEllipse(x, y, 560, 1000, 540, 580) + terrainNoise(x, y, 6401) * 0.17;
  const eastForest = softEllipse(x, y, 3500, 1180, 540, 500) + terrainNoise(x, y, 6402) * 0.17;
  if (westForest > 0.12 || eastForest > 0.12) return BIOME_BY_ID.elderwood;
  if ((westForest > -0.04 || eastForest > -0.04) && signedNoise(x, y, 140, 6403) > -0.15) return BIOME_BY_ID.emerald_vale;

  const amber = Math.max(
    softEllipse(x, y, 1300, 3480, 640, 330),
    softEllipse(x, y, 2000, 3370, 680, 330),
  ) + terrainNoise(x, y, 6501) * 0.14;
  if (amber > 0.1) return BIOME_BY_ID.amber_steppe;

  const shadow = softEllipse(x, y, 3600, 3500, 430, 430) + terrainNoise(x, y, 6601) * 0.18;
  if (shadow > 0.08) return BIOME_BY_ID.shadowfen;

  if ((river && river.distance < river.width + 70) || lakeShoreAt(x, y)) return BIOME_BY_ID.silver_river;
  return BIOME_BY_ID[blendedRegionBiomeId(x, y) || theme.biome] ?? BIOME_BY_ID.golden_fields;
}

function biomeFor(x, y) {
  const coast = landScore(x, y);
  const mountain = mountainScore(x, y);
  const theme = regionThemeFor(x, y);
  const land = coast > 0.045;
  const river = nearestRiver(x, y);
  const lake = lakeAt(x, y);
  const water = !land || (river && river.distance <= river.width) || Boolean(lake);
  return biomeForTerrain(x, y, { score: coast, land, water, lake, river, mountain, theme });
}

function gid(biome, tile) {
  return biome.firstgid + tile - 1;
}

function waterGid(tile) {
  return WATER_FIRSTGID + tile - 1;
}

function landmarkAt(x, y) {
  return LANDMARKS.find((landmark) => Math.hypot(x - landmark.x, y - landmark.y) <= landmark.radius) ?? null;
}

function groundTileFor(x, y) {
  const biome = biomeFor(x, y);
  const road = nearestRoad(x, y);
  const mountain = mountainScore(x, y);
  const landmark = landmarkAt(x, y);
  if (landmark?.kind === 'city' || landmark?.kind === 'town') return gid(biome, TILES.light);
  if (isWater(x, y)) return gid(biome, TILES.bank);
  if (landScore(x, y) < 0.18) return gid(biome, TILES.sand);
  if (mountain > 0.62) return gid(biome, TILES.stone);
  if (mountain > 0.34) return gid(biome, TILES.cliffDirt);
  if (road && road.distance < road.road.width + 4) return gid(biome, TILES.dirt);
  if (biome.id === 'murkfen' || biome.id === 'shadowfen') return gid(biome, hash(x / 9, y / 9, 7) > 0.45 ? TILES.mud : TILES.dark);
  if (biome.id === 'old_empire') return gid(biome, hash(x / 10, y / 10, 8) > 0.62 ? TILES.ruinFloor : TILES.base);
  if (biome.id === 'amber_steppe') return gid(biome, hash(x / 10, y / 10, 9) > 0.55 ? TILES.dirt : TILES.base);
  const n = hash(x / 8, y / 8, biome.firstgid);
  if (n > 0.90) return gid(biome, TILES.flowers);
  if (n > 0.76) return gid(biome, TILES.dark);
  if (n > 0.55) return gid(biome, TILES.alt);
  return gid(biome, TILES.base);
}

function detailTileFor(x, y) {
  const biome = biomeFor(x, y);
  if (isWater(x, y)) return 0;
  const river = nearestRiver(x, y);
  const waterEdge = river && river.distance < river.width + 9;
  if (waterEdge || lakeShoreAt(x, y)) return gid(biome, TILES.bank);
  const road = nearestRoad(x, y);
  if (road && road.distance > road.road.width && road.distance < road.road.width + 4) return gid(biome, TILES.roadEdge);
  const mountain = mountainScore(x, y);
  if (mountain > 0.5 && hash(x, y, 42) > 0.65) return gid(biome, TILES.scree);
  const n = hash(x, y, 43);
  if ((biome.id === 'murkfen' || biome.id === 'shadowfen') && n > 0.935) return gid(biome, TILES.reeds);
  if ((biome.id === 'golden_fields' || biome.id === 'sunhill') && n > 0.965) return gid(biome, TILES.flowers);
  if ((biome.id === 'elderwood' || biome.id === 'emerald_vale') && n > 0.955) return gid(biome, TILES.forestFloor);
  if (biome.id === 'old_empire' && n > 0.965) return gid(biome, TILES.mossStone);
  if (n > 0.975) return gid(biome, TILES.tallGrass);
  return 0;
}

function roadTileFor(x, y) {
  if (isWater(x, y) && !bridgeAt(x, y)) return 0;
  const nearest = nearestRoad(x, y);
  if (!nearest || nearest.distance > nearest.road.width) return 0;
  const biome = biomeFor(x, y);
  if (nearest.road.kind === 'trail') return gid(biome, TILES.path);
  if (nearest.road.kind === 'pass') return gid(biome, TILES.dirt);
  return gid(biome, TILES.road);
}

function waterTileFor(x, y) {
  if (!isWater(x, y)) return 0;
  const bridge = bridgeAt(x, y);
  if (bridge) return waterGid(WATER_TILES.shallow);
  const river = nearestRiver(x, y);
  if (river && river.distance < river.width + 3) return waterGid(WATER_TILES.river);
  if (landScore(x, y) < 0.1) return waterGid(WATER_TILES.deep);
  return waterGid(WATER_TILES.shallow);
}

function makeTileLayer(name, id, data, visible = true) {
  return {
    compression: 'zlib',
    data: encodeTileData(data),
    encoding: 'base64',
    height: REGION_TILES,
    id,
    name,
    opacity: 1,
    type: 'tilelayer',
    visible,
    width: REGION_TILES,
    x: 0,
    y: 0,
  };
}

function objectProperties(props) {
  return Object.entries(props).filter(([, value]) => value !== undefined && value !== null).map(([name, value]) => ({
    name,
    type: typeof value === 'number' ? 'int' : typeof value === 'boolean' ? 'bool' : 'string',
    value,
  }));
}

let objectId = 1;
function rectObject(name, x, y, w, h, props = {}) {
  return {
    id: objectId += 1,
    name,
    x: x * TILE,
    y: y * TILE,
    width: w * TILE,
    height: h * TILE,
    properties: objectProperties(props),
  };
}

function pointObject(name, x, y, props = {}) {
  return {
    id: objectId += 1,
    name,
    point: true,
    x: x * TILE + TILE / 2,
    y: y * TILE + TILE / 2,
    properties: objectProperties(props),
  };
}

function makeObjectLayer(name, id, objects) {
  return {
    draworder: 'topdown',
    id,
    name,
    objects,
    opacity: 1,
    type: 'objectgroup',
    visible: true,
    x: 0,
    y: 0,
  };
}

function drawTileBase(pixels, width, height, tile, biome, mode) {
  const tx = (tile % TILESET_COLUMNS) * TILE;
  const ty = Math.floor(tile / TILESET_COLUMNS) * TILE;
  const [base, light, dark, sand, stone] = biome.colors.map((color) => rgba(color));
  const water = rgba('#1f677b');
  const shallow = rgba('#3b8391');
  const mud = rgba('#685f47');
  const road = rgba(biome.road);
  const color = mode === 'water' ? water
    : mode === 'shallowWater' ? shallow
      : mode === 'bank' || mode === 'sand' ? sand
        : mode === 'road' || mode === 'path' ? road
          : mode === 'plaza' ? rgba('#9c9179')
            : mode === 'stone' || mode === 'mountain' ? stone
              : mode === 'mud' ? mud
                : mode === 'dark' ? dark
                  : mode === 'light' ? light
                    : base;
  fill(pixels, width, height, tx, ty, TILE, TILE, color);
  for (let i = 0; i < 42; i += 1) {
    const px = tx + Math.floor(hash(tile, i, biome.firstgid) * TILE);
    const py = ty + Math.floor(hash(tile, i, biome.firstgid + 3) * TILE);
    const shade = blend(color, hash(tile, i, 5) > 0.5 ? light : dark, mode === 'water' ? 0.12 : 0.25);
    put(pixels, width, height, px, py, shade);
  }
}

function makeBiomeTilesheet(biome) {
  const width = TILE * TILESET_COLUMNS;
  const height = TILE * Math.ceil(BIOME_TILESET_TILES / TILESET_COLUMNS);
  const pixels = Buffer.alloc(width * height * 4);
  for (let tile = 0; tile < BIOME_TILESET_TILES; tile += 1) {
    const id = tile + 1;
    const mode = id === TILES.water ? 'water'
      : id === TILES.shallowWater ? 'shallowWater'
        : [TILES.bank, TILES.sand].includes(id) ? 'bank'
          : [TILES.road, TILES.path, TILES.roadEdge].includes(id) ? 'road'
            : id === TILES.plaza || id === TILES.ruinFloor ? 'plaza'
              : [TILES.stone, TILES.mountain, TILES.mountainSnow, TILES.cliff, TILES.scree, TILES.mossStone].includes(id) ? 'stone'
                : [TILES.mud, TILES.reeds].includes(id) ? 'mud'
                  : [TILES.dark, TILES.forestFloor, TILES.tree, TILES.treeAlt, TILES.pine, TILES.bush].includes(id) ? 'dark'
                    : [TILES.alt, TILES.field, TILES.flowers, TILES.tallGrass, TILES.crop, TILES.light].includes(id) ? 'light'
                      : null;
    drawTileBase(pixels, width, height, tile, biome, mode);
    const tx = (tile % TILESET_COLUMNS) * TILE;
    const ty = Math.floor(tile / TILESET_COLUMNS) * TILE;
    if ([TILES.tree, TILES.treeAlt, TILES.pine].includes(id)) {
      fill(pixels, width, height, tx + 14, ty + 18, 4, 9, rgba('#6c4b31'));
      for (let yy = 4; yy < 22; yy += 3) fill(pixels, width, height, tx + 7 + Math.floor(yy / 4), ty + yy, 18 - Math.floor(yy / 2), 4, rgba(biome.colors[2]));
    }
    if ([TILES.mountain, TILES.mountainSnow].includes(id)) {
      line(pixels, width, height, tx + 3, ty + 27, tx + 15, ty + 5, rgba('#f0ead8'));
      line(pixels, width, height, tx + 15, ty + 5, tx + 29, ty + 27, rgba('#55564f'));
      fill(pixels, width, height, tx + 10, ty + 8, 9, 5, rgba('#f4f1e6'));
    }
    if ([TILES.road, TILES.path].includes(id)) {
      fill(pixels, width, height, tx, ty + 10, TILE, 12, rgba(biome.road));
      for (let xx = 2; xx < 31; xx += 6) put(pixels, width, height, tx + xx, ty + 15, rgba('#e1c98e'));
    }
    if (id === TILES.water || id === TILES.shallowWater) {
      for (let yy = 7; yy < 28; yy += 8) line(pixels, width, height, tx + 3, ty + yy, tx + 27, ty + yy - 2, rgba('#75aeba', 190));
    }
    if (id === TILES.plaza) {
      for (let yy = 0; yy < TILE; yy += 8) line(pixels, width, height, tx, ty + yy, tx + TILE - 1, ty + yy, rgba('#777266'));
      for (let xx = 0; xx < TILE; xx += 8) line(pixels, width, height, tx + xx, ty, tx + xx, ty + TILE - 1, rgba('#777266'));
    }
  }
  return encodePng(width, height, pixels);
}

function makeWaterTilesheet() {
  const width = TILE * TILESET_COLUMNS;
  const height = TILE * Math.ceil(WATER_TILESET_TILES / TILESET_COLUMNS);
  const pixels = Buffer.alloc(width * height * 4);
  const colors = {
    deep: rgba('#1d6076'),
    deepAlt: rgba('#205b72'),
    river: rgba('#2f7890'),
    riverAlt: rgba('#357f94'),
    shallow: rgba('#4c98a5'),
    shallowAlt: rgba('#5aa2ab'),
    foam: rgba('#d4eef0', 180),
    fall: rgba('#bde5ee'),
  };
  const waterBase = [
    [WATER_TILES.deep, colors.deep],
    [WATER_TILES.deepAlt, colors.deepAlt],
    [WATER_TILES.river, colors.river],
    [WATER_TILES.riverAlt, colors.riverAlt],
    [WATER_TILES.shallow, colors.shallow],
    [WATER_TILES.shallowAlt, colors.shallowAlt],
    [WATER_TILES.foam, colors.shallow],
    [WATER_TILES.waterfall, colors.fall],
  ];
  for (const [tileId, color] of waterBase) {
    const tile = tileId - 1;
    const tx = (tile % TILESET_COLUMNS) * TILE;
    const ty = Math.floor(tile / TILESET_COLUMNS) * TILE;
    fill(pixels, width, height, tx, ty, TILE, TILE, color);
    for (let yy = 5; yy < 30; yy += 8) {
      const drift = Math.floor(hash(tileId, yy, 12) * 5);
      line(pixels, width, height, tx + 2 + drift, ty + yy, tx + 27, ty + yy - 2, rgba('#a8d5dc', 170));
    }
    if (tileId === WATER_TILES.foam || tileId === WATER_TILES.waterfall) {
      for (let yy = 3; yy < 30; yy += 5) line(pixels, width, height, tx + 3, ty + yy, tx + 29, ty + yy + 2, colors.foam);
    }
  }
  return encodePng(width, height, pixels);
}

function waterAnimations() {
  return [
    {
      tileId: WATER_TILES.deep - 1,
      frames: [
        { tileId: WATER_TILES.deep - 1, duration: 260 },
        { tileId: WATER_TILES.deepAlt - 1, duration: 260 },
      ],
    },
    {
      tileId: WATER_TILES.river - 1,
      frames: [
        { tileId: WATER_TILES.river - 1, duration: 180 },
        { tileId: WATER_TILES.riverAlt - 1, duration: 180 },
      ],
    },
    {
      tileId: WATER_TILES.shallow - 1,
      frames: [
        { tileId: WATER_TILES.shallow - 1, duration: 240 },
        { tileId: WATER_TILES.shallowAlt - 1, duration: 240 },
      ],
    },
  ];
}

function drawCityTile(pixels, width, height, tile, baseColor, accentColor = null) {
  const tx = (tile % CITY_TILESET_COLUMNS) * TILE;
  const ty = Math.floor(tile / CITY_TILESET_COLUMNS) * TILE;
  const base = rgba(baseColor);
  const accent = rgba(accentColor ?? baseColor);
  fill(pixels, width, height, tx, ty, TILE, TILE, base);
  for (let i = 0; i < 22; i += 1) {
    const px = tx + Math.floor(hash(tile, i, 9100) * TILE);
    const py = ty + Math.floor(hash(tile, i, 9101) * TILE);
    put(pixels, width, height, px, py, blend(base, accent, 0.28));
  }
}

function drawCityTilesheetTile(pixels, width, height, tile, draw) {
  const tx = (tile % CITY_TILESET_COLUMNS) * TILE;
  const ty = Math.floor(tile / CITY_TILESET_COLUMNS) * TILE;
  draw(tx, ty);
}

function fillPolygon(pixels, width, height, points, color) {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const xi = points[i][0];
        const yi = points[i][1];
        const xj = points[j][0];
        const yj = points[j][1];
        const intersects = ((yi > y) !== (yj > y))
          && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1) + xi;
        if (intersects) inside = !inside;
      }
      if (inside) put(pixels, width, height, x, y, color);
    }
  }
}

function clearAtlasPrefab(pixels, width, height, start, w, h) {
  const sx = (start % CITY_TILESET_COLUMNS) * TILE;
  const sy = Math.floor(start / CITY_TILESET_COLUMNS) * TILE;
  fill(pixels, width, height, sx, sy, w * TILE, h * TILE, [0, 0, 0, 0]);
}

function drawAtlasWindow(pixels, width, height, x, y, tint = '#f6d988') {
  fill(pixels, width, height, x - 1, y - 1, 11, 10, rgba('#493323'));
  fill(pixels, width, height, x, y, 9, 8, rgba(tint));
  line(pixels, width, height, x + 4, y, x + 4, y + 7, rgba('#283745', 190));
  line(pixels, width, height, x, y + 4, x + 8, y + 4, rgba('#283745', 190));
}

function drawAtlasDoor(pixels, width, height, x, y, doorW = 16, doorH = 24) {
  fill(pixels, width, height, x, y, doorW, doorH, rgba('#4a2e22'));
  fill(pixels, width, height, x + 3, y + 3, doorW - 6, doorH - 3, rgba('#6f4630'));
  fill(pixels, width, height, x + doorW - 5, y + Math.floor(doorH * 0.55), 3, 3, rgba('#f2c66b'));
  line(pixels, width, height, x + 2, y + doorH - 1, x + doorW - 2, y + doorH - 1, rgba('#221611'));
}

function drawAtlasSign(pixels, width, height, x, y, color, symbol = 'dot') {
  fill(pixels, width, height, x, y, 22, 18, rgba('#4f3324'));
  fill(pixels, width, height, x + 2, y + 2, 18, 14, rgba(color));
  if (symbol === 'coin') fill(pixels, width, height, x + 8, y + 5, 6, 6, rgba('#fff1a8'));
  if (symbol === 'sword') line(pixels, width, height, x + 6, y + 13, x + 16, y + 4, rgba('#f8fafc', 230));
  if (symbol === 'potion') fill(pixels, width, height, x + 8, y + 5, 7, 8, rgba('#d1fae5', 230));
  if (symbol === 'rune') {
    line(pixels, width, height, x + 6, y + 12, x + 15, y + 4, rgba('#e0f2fe', 230));
    line(pixels, width, height, x + 7, y + 5, x + 16, y + 13, rgba('#e0f2fe', 230));
  }
  if (symbol === 'fish') line(pixels, width, height, x + 5, y + 9, x + 17, y + 9, rgba('#e0f2fe', 230));
  if (symbol === 'cloth') fill(pixels, width, height, x + 6, y + 5, 10, 8, rgba('#fde7ff', 220));
  if (symbol === 'shield') fill(pixels, width, height, x + 7, y + 4, 8, 10, rgba('#f8fafc', 220));
}

function cityPrefabSymbol(theme) {
  if (theme === 'bank') return 'coin';
  if (theme === 'auction') return 'dot';
  if (['forge', 'weaponsmith', 'armorer', 'mining'].includes(theme)) return 'sword';
  if (theme === 'alchemy') return 'potion';
  if (theme === 'arcane') return 'rune';
  if (theme === 'fishing') return 'fish';
  if (theme === 'tailor' || theme === 'leather') return 'cloth';
  if (theme === 'chapel' || theme === 'civic') return 'shield';
  return 'dot';
}

function drawCityPrefabExterior(pixels, width, height, prefab) {
  clearAtlasPrefab(pixels, width, height, prefab.exterior, prefab.w, prefab.h);
  const sx = (prefab.exterior % CITY_TILESET_COLUMNS) * TILE;
  const sy = Math.floor(prefab.exterior / CITY_TILESET_COLUMNS) * TILE;
  const pxW = prefab.w * TILE;
  const pxH = prefab.h * TILE;
  const roof = rgba(prefab.roof);
  const roofHi = blend(roof, rgba('#f4d7a1'), 0.22);
  const roofDark = blend(roof, rgba('#17100d'), 0.30);
  const wall = rgba(prefab.wall);
  const wallHi = blend(wall, rgba('#f6dfb0'), 0.18);
  const trim = rgba(prefab.trim);
  const left = sx + 8;
  const right = sx + pxW - 8;
  const top = sy + 4;
  const roofPeak = top + Math.max(8, Math.floor(pxH * 0.05));
  const roofBase = sy + Math.floor(pxH * 0.43);
  const roofBottom = sy + Math.floor(pxH * 0.58);
  const wallTop = roofBottom - 5;
  const wallBottom = sy + pxH - 13;
  const doorW = prefab.w >= 16 ? 20 : 16;
  const doorX = sx + Math.floor(pxW / 2) - Math.floor(doorW / 2);

  fill(pixels, width, height, sx + 10, sy + pxH - 10, pxW - 20, 8, rgba('#111111', 45));
  fill(pixels, width, height, sx + 16, wallTop, pxW - 32, wallBottom - wallTop, wall);
  fill(pixels, width, height, sx + 18, wallTop + 5, pxW - 36, 4, wallHi);
  fillPolygon(pixels, width, height, [
    [sx + Math.floor(pxW / 2), roofPeak],
    [right - 10, roofBase],
    [right, roofBottom],
    [left, roofBottom],
    [left + 10, roofBase],
  ], roof);
  fillPolygon(pixels, width, height, [
    [sx + Math.floor(pxW / 2), roofPeak],
    [right - 10, roofBase],
    [sx + Math.floor(pxW / 2), roofBase + 8],
    [left + 10, roofBase],
  ], blend(roof, rgba('#ffffff'), 0.07));
  line(pixels, width, height, sx + Math.floor(pxW / 2), roofPeak, sx + Math.floor(pxW / 2), roofBottom - 4, roofHi);
  for (let yy = roofBase - 2; yy < roofBottom; yy += 7) {
    line(pixels, width, height, left + 6, yy, right - 6, yy + 2, alpha(roofHi, 145));
    line(pixels, width, height, left + 5, yy + 4, right - 9, yy + 6, alpha(roofDark, 110));
  }
  line(pixels, width, height, left, roofBottom, right, roofBottom, rgba('#251914', 190));

  for (let xx = sx + 34; xx < sx + pxW - 34; xx += 48) {
    if (Math.abs(xx - doorX) < 25) continue;
    drawAtlasWindow(pixels, width, height, xx, wallTop + 18, prefab.theme === 'arcane' ? '#a5f3fc' : '#f6d988');
  }
  if (prefab.w >= 14) {
    for (let xx = sx + 44; xx < sx + pxW - 44; xx += 64) {
      if (Math.abs(xx - doorX) < 27) continue;
      drawAtlasWindow(pixels, width, height, xx, wallTop + 42, prefab.theme === 'arcane' ? '#a5f3fc' : '#f6d988');
    }
  }

  drawAtlasDoor(pixels, width, height, doorX, wallBottom - 25, doorW, 25);
  fill(pixels, width, height, doorX - 7, wallBottom, doorW + 14, 7, trim);
  drawAtlasSign(pixels, width, height, doorX + doorW + 7, wallBottom - 25, prefab.trim, cityPrefabSymbol(prefab.theme));

  if (['forge', 'weaponsmith', 'armorer', 'mining'].includes(prefab.theme)) {
    fill(pixels, width, height, sx + pxW - 40, sy + 26, 16, 42, rgba('#4c3b35'));
    fill(pixels, width, height, sx + pxW - 44, sy + 20, 24, 8, rgba('#2a211f'));
    fill(pixels, width, height, sx + 24, wallBottom - 18, 16, 10, rgba('#272422'));
    fill(pixels, width, height, sx + 28, wallBottom - 22, 9, 6, rgba('#fb923c'));
  }
  if (prefab.theme === 'bank') {
    fill(pixels, width, height, sx + 24, wallTop + 4, 8, wallBottom - wallTop - 6, trim);
    fill(pixels, width, height, sx + pxW - 32, wallTop + 4, 8, wallBottom - wallTop - 6, trim);
  }
  if (prefab.theme === 'inn') {
    fill(pixels, width, height, sx + 26, wallBottom - 12, 30, 7, rgba('#8b5e34'));
    fill(pixels, width, height, sx + pxW - 56, wallBottom - 13, 32, 8, rgba('#8b5e34'));
  }
  if (prefab.theme === 'market') {
    for (let xx = sx + 28; xx < sx + pxW - 28; xx += 36) fill(pixels, width, height, xx, wallBottom - 19, 26, 10, trim);
  }
  if (prefab.theme === 'chapel') {
    fill(pixels, width, height, sx + Math.floor(pxW / 2) - 7, sy + 4, 14, 46, rgba('#747a82'));
    fill(pixels, width, height, sx + Math.floor(pxW / 2) - 2, sy + 8, 4, 24, rgba('#f8f0cf'));
    fill(pixels, width, height, sx + Math.floor(pxW / 2) - 9, sy + 18, 18, 4, rgba('#f8f0cf'));
  }
  if (prefab.theme === 'stable') {
    for (let xx = sx + 28; xx < sx + pxW - 36; xx += 42) drawAtlasDoor(pixels, width, height, xx, wallBottom - 22, 18, 22);
  }
}

function drawInteriorCounter(pixels, width, height, x, y, w, color = '#8b6040') {
  fill(pixels, width, height, x, y, w, 13, rgba(color));
  fill(pixels, width, height, x + 1, y + 1, w - 2, 4, rgba('#d0a06b'));
  line(pixels, width, height, x, y + 12, x + w - 1, y + 12, rgba('#2c211a', 150));
}

function drawInteriorShelf(pixels, width, height, x, y, w, color = '#6c4b31') {
  fill(pixels, width, height, x, y, w, 17, rgba(color));
  fill(pixels, width, height, x + 2, y + 2, w - 4, 4, rgba('#c28b54'));
  fill(pixels, width, height, x + 2, y + 10, w - 4, 3, rgba('#3a2a20'));
}

function drawCityPrefabInterior(pixels, width, height, prefab) {
  clearAtlasPrefab(pixels, width, height, prefab.interior, prefab.w, prefab.h);
  const sx = (prefab.interior % CITY_TILESET_COLUMNS) * TILE;
  const sy = Math.floor(prefab.interior / CITY_TILESET_COLUMNS) * TILE;
  const pxW = prefab.w * TILE;
  const pxH = prefab.h * TILE;
  const floor = ['bank', 'auction', 'arcane', 'forge', 'weaponsmith', 'armorer', 'mining', 'chapel', 'civic'].includes(prefab.theme) ? rgba('#8d897f') : rgba('#7b5738');
  const wall = ['bank', 'auction', 'arcane', 'forge', 'weaponsmith', 'armorer', 'mining', 'chapel', 'civic'].includes(prefab.theme) ? rgba('#77776f') : rgba('#9a7651');
  fill(pixels, width, height, sx + 10, sy + 10, pxW - 20, pxH - 20, floor);
  for (let yy = sy + 16; yy < sy + pxH - 16; yy += 14) line(pixels, width, height, sx + 14, yy, sx + pxW - 15, yy, rgba('#33251d', 70));
  for (let xx = sx + 16; xx < sx + pxW - 16; xx += 18) line(pixels, width, height, xx, sy + 14, xx, sy + pxH - 16, rgba('#33251d', 45));
  fill(pixels, width, height, sx + 10, sy + 10, pxW - 20, 16, wall);
  fill(pixels, width, height, sx + 10, sy + pxH - 26, pxW - 20, 8, wall);
  fill(pixels, width, height, sx + 10, sy + 10, 12, pxH - 20, wall);
  fill(pixels, width, height, sx + pxW - 22, sy + 10, 12, pxH - 20, wall);
  const centerX = sx + Math.floor(pxW / 2);
  const centerY = sy + Math.floor(pxH / 2);
  const doorW = prefab.w >= 16 ? 24 : 18;
  fill(pixels, width, height, centerX - doorW / 2, sy + pxH - 26, doorW, 18, floor);
  fill(pixels, width, height, centerX - 22, sy + pxH - 56, 44, 22, rgba(prefab.theme === 'bank' || prefab.theme === 'chapel' ? '#70562a' : '#274b63', 165));

  if (prefab.theme === 'bank') {
    drawInteriorCounter(pixels, width, height, sx + 48, sy + pxH - 76, pxW - 96, '#7a5537');
    fill(pixels, width, height, sx + pxW - 72, sy + 38, 42, 38, rgba('#5b6470'));
    fill(pixels, width, height, sx + pxW - 62, sy + 48, 22, 20, rgba('#d2b76e'));
    drawInteriorShelf(pixels, width, height, sx + 34, sy + 40, 54, '#6c4b31');
  } else if (prefab.theme === 'auction' || prefab.theme === 'market' || prefab.theme === 'general') {
    drawInteriorCounter(pixels, width, height, sx + 42, sy + pxH - 72, pxW - 84, '#7a5537');
    for (let xx = sx + 36; xx < sx + pxW - 50; xx += 54) {
      drawInteriorShelf(pixels, width, height, xx, sy + 42, 40, '#705138');
      fill(pixels, width, height, xx + 8, centerY - 6, 24, 18, rgba('#8c6338'));
    }
  } else if (prefab.theme === 'inn') {
    drawInteriorCounter(pixels, width, height, sx + 42, sy + pxH - 72, pxW - 84, '#8b6040');
    for (let xx = sx + 40; xx < sx + pxW - 60; xx += 55) {
      fill(pixels, width, height, xx, sy + 46, 24, 18, rgba('#755134'));
      fill(pixels, width, height, xx + 34, sy + 44, 30, 20, rgba('#71503d'));
    }
  } else if (['forge', 'weaponsmith', 'armorer', 'mining'].includes(prefab.theme)) {
    fill(pixels, width, height, sx + 36, centerY - 18, 36, 28, rgba('#2f2d2b'));
    fill(pixels, width, height, sx + 44, centerY - 22, 20, 9, rgba('#f08a38'));
    fill(pixels, width, height, centerX, centerY - 6, 28, 18, rgba('#555d65'));
    drawInteriorShelf(pixels, width, height, sx + pxW - 88, sy + 42, 55, prefab.theme === 'armorer' ? '#5f646b' : '#594333');
    fill(pixels, width, height, sx + 34, sy + pxH - 67, 28, 20, rgba('#55463b'));
  } else if (prefab.theme === 'alchemy') {
    drawInteriorCounter(pixels, width, height, sx + 36, sy + pxH - 70, pxW - 72, '#386b58');
    drawInteriorShelf(pixels, width, height, sx + 32, sy + 40, 44, '#386b58');
    drawInteriorShelf(pixels, width, height, sx + pxW - 76, sy + 40, 44, '#386b58');
    fill(pixels, width, height, centerX - 14, centerY - 10, 28, 20, rgba('#315e50'));
    fill(pixels, width, height, centerX - 5, centerY - 16, 10, 10, rgba('#63d3b2'));
  } else if (prefab.theme === 'arcane') {
    drawInteriorShelf(pixels, width, height, sx + 30, sy + 40, 48, '#483b78');
    drawInteriorShelf(pixels, width, height, sx + pxW - 78, sy + 40, 48, '#483b78');
    fill(pixels, width, height, centerX - 24, centerY - 24, 48, 48, rgba('#3b2b66', 150));
    line(pixels, width, height, centerX - 16, centerY + 14, centerX + 16, centerY - 14, rgba('#8be9fd', 210));
    line(pixels, width, height, centerX - 12, centerY - 16, centerX + 18, centerY + 12, rgba('#c4b5fd', 200));
  } else if (prefab.theme === 'fishing') {
    drawInteriorCounter(pixels, width, height, sx + 34, sy + pxH - 68, pxW - 68, '#45565b');
    drawInteriorShelf(pixels, width, height, sx + 30, sy + 40, 48, '#45565b');
    fill(pixels, width, height, sx + pxW - 68, sy + 44, 36, 18, rgba('#54666b'));
  } else if (prefab.theme === 'tailor') {
    drawInteriorCounter(pixels, width, height, sx + 34, sy + pxH - 68, pxW - 68, '#6b4778');
    drawInteriorShelf(pixels, width, height, sx + 30, sy + 42, 42, '#6b4778');
    drawInteriorShelf(pixels, width, height, sx + pxW - 72, sy + 42, 42, '#6b4778');
    fill(pixels, width, height, centerX - 18, centerY - 8, 36, 16, rgba('#f0abfc', 160));
  } else if (prefab.theme === 'leather') {
    drawInteriorCounter(pixels, width, height, sx + 34, sy + pxH - 68, pxW - 68, '#68462f');
    drawInteriorShelf(pixels, width, height, sx + 30, sy + 42, 42, '#68462f');
    drawInteriorShelf(pixels, width, height, sx + pxW - 72, sy + 42, 42, '#68462f');
    fill(pixels, width, height, centerX - 14, centerY - 10, 28, 20, rgba('#a16207', 165));
  } else if (prefab.theme === 'stable') {
    for (let xx = sx + 40; xx < sx + pxW - 50; xx += 48) {
      fill(pixels, width, height, xx, sy + 42, 32, 34, rgba('#7a5a35'));
      fill(pixels, width, height, xx + 4, sy + 70, 24, 8, rgba('#d0a26b'));
    }
    fill(pixels, width, height, centerX - 28, sy + pxH - 64, 56, 16, rgba('#54666b'));
  } else if (prefab.theme === 'chapel') {
    fill(pixels, width, height, centerX - 20, sy + 44, 40, 30, rgba('#77756d'));
    fill(pixels, width, height, centerX - 4, sy + 38, 8, 36, rgba('#f8f0cf'));
    fill(pixels, width, height, centerX - 18, sy + 52, 36, 8, rgba('#f8f0cf'));
    for (let xx = sx + 34; xx < sx + pxW - 46; xx += 48) fill(pixels, width, height, xx, sy + pxH - 78, 30, 10, rgba('#7b5738'));
  } else if (prefab.theme === 'civic') {
    drawInteriorCounter(pixels, width, height, sx + 48, sy + pxH - 76, pxW - 96, '#725132');
    fill(pixels, width, height, centerX - 20, sy + 48, 40, 22, rgba('#725132'));
    fill(pixels, width, height, sx + 34, sy + 42, 18, 42, rgba('#5276a8'));
    fill(pixels, width, height, sx + pxW - 52, sy + 42, 18, 42, rgba('#b55247'));
  } else {
    fill(pixels, width, height, sx + 34, sy + 42, 26, 18, rgba('#755134'));
    fill(pixels, width, height, sx + pxW - 70, sy + 42, 34, 20, rgba('#71503d'));
    drawInteriorShelf(pixels, width, height, sx + 34, sy + pxH - 76, 42, '#6c4b31');
  }
}

function makeCityTilesheet() {
  const width = CITY_TILESET_COLUMNS * TILE;
  const height = Math.ceil(CITY_TILESET_TILES / CITY_TILESET_COLUMNS) * TILE;
  const pixels = Buffer.alloc(width * height * 4);
  fill(pixels, width, height, 0, 0, width, height, [0, 0, 0, 0]);

  drawCityTile(pixels, width, height, CITY.cobble, '#8f8777', '#c8bfa8');
  drawCityTile(pixels, width, height, CITY.cobbleAlt, '#9a917f', '#d0c5aa');
  drawCityTile(pixels, width, height, CITY.cobbleDark, '#746d62', '#a29a88');
  drawCityTile(pixels, width, height, CITY.interiorWood, '#7b5738', '#b88352');
  drawCityTile(pixels, width, height, CITY.interiorStone, '#8d897f', '#c1bbb0');
  drawCityTile(pixels, width, height, CITY.interiorCarpet, '#7d3431', '#c56b5b');
  drawCityTile(pixels, width, height, CITY.interiorWall, '#bda47f', '#ead8b9');
  drawCityTile(pixels, width, height, CITY.interiorWallStone, '#797b73', '#bab5a6');

  [CITY.cobble, CITY.cobbleAlt, CITY.cobbleDark, CITY.interiorStone].forEach((tile) => {
    const tx = (tile % CITY_TILESET_COLUMNS) * TILE;
    const ty = Math.floor(tile / CITY_TILESET_COLUMNS) * TILE;
    for (let offset = 0; offset < TILE; offset += 8) {
      line(pixels, width, height, tx, ty + offset, tx + TILE - 1, ty + offset, rgba('#5a554e', 120));
      line(pixels, width, height, tx + offset, ty, tx + offset, ty + TILE - 1, rgba('#5a554e', 90));
    }
  });
  [CITY.interiorWood].forEach((tile) => {
    const tx = (tile % CITY_TILESET_COLUMNS) * TILE;
    const ty = Math.floor(tile / CITY_TILESET_COLUMNS) * TILE;
    for (let offset = 2; offset < TILE; offset += 6) line(pixels, width, height, tx, ty + offset, tx + TILE, ty + offset - 1, rgba('#3e2c20', 95));
  });

  const roofDefs = [
    [CITY.roofRed, '#8d3f39', '#d28a64'],
    [CITY.roofSlate, '#657181', '#a4b0bf'],
    [CITY.roofGreen, '#546b47', '#8faf72'],
    [CITY.roofGold, '#9c7640', '#d9b574'],
    [CITY.roofDark, '#4d3943', '#927482'],
    [CITY.roofEdge, '#3c2b27', '#7d5f51'],
  ];
  roofDefs.forEach(([tile, base, hi]) => {
    drawCityTile(pixels, width, height, tile, base, hi);
    const tx = (tile % CITY_TILESET_COLUMNS) * TILE;
    const ty = Math.floor(tile / CITY_TILESET_COLUMNS) * TILE;
    for (let yy = 4; yy < TILE; yy += 6) line(pixels, width, height, tx + 2, ty + yy, tx + 29, ty + yy - 2, rgba(hi, 135));
    line(pixels, width, height, tx + 2, ty + 29, tx + 29, ty + 24, rgba('#231917', 115));
  });

  [
    [CITY.facadePlaster, '#c7aa81', '#e8d5b7'],
    [CITY.facadeStone, '#8c8a82', '#c9c3b6'],
    [CITY.facadeWood, '#86603f', '#b58152'],
  ].forEach(([tile, base, hi]) => {
    drawCityTile(pixels, width, height, tile, base, hi);
    const tx = (tile % CITY_TILESET_COLUMNS) * TILE;
    const ty = Math.floor(tile / CITY_TILESET_COLUMNS) * TILE;
    fill(pixels, width, height, tx, ty, TILE, 4, rgba('#46372d', 130));
    fill(pixels, width, height, tx + 2, ty + 26, TILE - 4, 4, rgba('#4c3a2e', 115));
  });

  drawCityTilesheetTile(pixels, width, height, CITY.door, (x, y) => {
    fill(pixels, width, height, x, y, TILE, TILE, rgba('#bda47f'));
    fill(pixels, width, height, x + 8, y + 5, 16, 25, rgba('#4f3324'));
    fill(pixels, width, height, x + 10, y + 8, 12, 20, rgba('#6d4830'));
    fill(pixels, width, height, x + 20, y + 18, 3, 3, rgba('#d8b46f'));
  });
  drawCityTilesheetTile(pixels, width, height, CITY.window, (x, y) => {
    fill(pixels, width, height, x, y, TILE, TILE, rgba('#c7aa81'));
    fill(pixels, width, height, x + 7, y + 8, 18, 15, rgba('#2f4962'));
    fill(pixels, width, height, x + 9, y + 10, 14, 11, rgba('#f2d890'));
    line(pixels, width, height, x + 16, y + 8, x + 16, y + 22, rgba('#473323'));
    line(pixels, width, height, x + 7, y + 15, x + 24, y + 15, rgba('#473323'));
  });
  drawCityTilesheetTile(pixels, width, height, CITY.chimney, (x, y) => {
    fill(pixels, width, height, x + 8, y + 6, 15, 23, rgba('#70584d'));
    fill(pixels, width, height, x + 6, y + 4, 19, 5, rgba('#3a2d29'));
    fill(pixels, width, height, x + 11, y + 10, 9, 4, rgba('#a48272'));
  });

  [
    [CITY.awningRed, '#b55247'],
    [CITY.awningBlue, '#5276a8'],
    [CITY.awningGreen, '#5e8d5a'],
    [CITY.awningPurple, '#7660a8'],
  ].forEach(([tile, color]) => {
    drawCityTilesheetTile(pixels, width, height, tile, (x, y) => {
      fill(pixels, width, height, x, y, TILE, TILE, [0, 0, 0, 0]);
      fill(pixels, width, height, x + 2, y + 10, 28, 11, rgba(color));
      for (let xx = 5; xx < 28; xx += 8) fill(pixels, width, height, x + xx, y + 10, 4, 12, rgba('#ead7b8', 210));
      line(pixels, width, height, x + 2, y + 21, x + 29, y + 21, rgba('#3a2921'));
    });
  });

  drawCityTilesheetTile(pixels, width, height, CITY.fountainBasin, (x, y) => {
    fill(pixels, width, height, x, y, TILE, TILE, [0, 0, 0, 0]);
    fill(pixels, width, height, x + 2, y + 6, 28, 20, rgba('#726d65'));
    fill(pixels, width, height, x + 5, y + 9, 22, 14, rgba('#3f8494'));
    line(pixels, width, height, x + 3, y + 6, x + 29, y + 6, rgba('#beb6a5'));
    line(pixels, width, height, x + 3, y + 25, x + 29, y + 25, rgba('#4b4742'));
  });
  [CITY.fountainWater, CITY.fountainWaterAlt].forEach((tile, index) => drawCityTilesheetTile(pixels, width, height, tile, (x, y) => {
    fill(pixels, width, height, x, y, TILE, TILE, rgba(index ? '#58a7b3' : '#4c98a5'));
    for (let yy = 6; yy < 30; yy += 7) line(pixels, width, height, x + 3, y + yy, x + 28, y + yy - 2, rgba('#c7edf1', 170));
  }));
  drawCityTilesheetTile(pixels, width, height, CITY.fountainFoam, (x, y) => {
    fill(pixels, width, height, x, y, TILE, TILE, rgba('#63adba'));
    for (let yy = 4; yy < 30; yy += 5) line(pixels, width, height, x + 2, y + yy, x + 30, y + yy + 2, rgba('#e6fbff', 190));
  });
  drawCityTilesheetTile(pixels, width, height, CITY.fountainStatue, (x, y) => {
    fill(pixels, width, height, x, y, TILE, TILE, [0, 0, 0, 0]);
    fill(pixels, width, height, x + 9, y + 8, 14, 19, rgba('#c8c0ad'));
    fill(pixels, width, height, x + 7, y + 24, 18, 5, rgba('#817a6e'));
    line(pixels, width, height, x + 16, y + 3, x + 16, y + 13, rgba('#e9e0cc'));
  });
  drawCityTile(pixels, width, height, CITY.fountainEdge, '#6d675e', '#bbb19f');

  const simpleBoxes = [
    [CITY.counterH, '#8b6040', '#cf9b62'], [CITY.counterV, '#7d5638', '#c28d5a'],
    [CITY.shelf, '#6c4b31', '#c28b54'], [CITY.table, '#755134', '#bd8755'],
    [CITY.bed, '#71503d', '#d9c19a'], [CITY.forge, '#2f2d2b', '#f08a38'],
    [CITY.anvil, '#555d65', '#b7c0ca'], [CITY.bankVault, '#5b6470', '#d2b76e'],
    [CITY.auctionDesk, '#7a5537', '#e2c78d'], [CITY.alchemyShelf, '#386b58', '#63d3b2'],
    [CITY.arcaneShelf, '#483b78', '#8be9fd'], [CITY.professionBench, '#6b4b33', '#c7a56d'],
    [CITY.stableStall, '#7a5a35', '#d0a26b'], [CITY.counterCorner, '#8b6040', '#d9a56a'],
    [CITY.goldStack, '#8a6a2e', '#facc15'], [CITY.weaponRack, '#594333', '#d9dce2'],
    [CITY.armorStand, '#595f66', '#cbd5e1'], [CITY.potionTable, '#315e50', '#67e8f9'],
    [CITY.fishRack, '#45565b', '#bae6fd'], [CITY.oreCart, '#55463b', '#94a3b8'],
    [CITY.clothRack, '#6b4778', '#f0abfc'], [CITY.leatherRack, '#68462f', '#c08457'],
    [CITY.stableFeed, '#806338', '#e5c36b'], [CITY.civicDesk, '#725132', '#f2d990'],
    [CITY.chapelAltar, '#77756d', '#f8f0cf'], [CITY.waterTrough, '#54666b', '#7dd3fc'],
  ];
  simpleBoxes.forEach(([tile, base, hi]) => drawCityTilesheetTile(pixels, width, height, tile, (x, y) => {
    fill(pixels, width, height, x + 4, y + 9, 24, 16, rgba(base));
    fill(pixels, width, height, x + 5, y + 10, 22, 4, rgba(hi));
    fill(pixels, width, height, x + 5, y + 23, 22, 3, rgba('#2c211a', 140));
  }));

  [
    [CITY.rugBlue, '#274b63', '#7dd3fc'],
    [CITY.rugGold, '#70562a', '#fde68a'],
  ].forEach(([tile, base, trim]) => drawCityTilesheetTile(pixels, width, height, tile, (x, y) => {
    fill(pixels, width, height, x, y, TILE, TILE, [0, 0, 0, 0]);
    fill(pixels, width, height, x + 3, y + 7, 26, 18, rgba(base, 220));
    fill(pixels, width, height, x + 5, y + 9, 22, 14, rgba(trim, 85));
    line(pixels, width, height, x + 4, y + 8, x + 27, y + 8, rgba(trim, 180));
    line(pixels, width, height, x + 4, y + 24, x + 27, y + 24, rgba('#251912', 130));
  }));

  drawCityTilesheetTile(pixels, width, height, CITY.arcaneRune, (x, y) => {
    fill(pixels, width, height, x, y, TILE, TILE, [0, 0, 0, 0]);
    fill(pixels, width, height, x + 5, y + 5, 22, 22, rgba('#3b2b66', 155));
    line(pixels, width, height, x + 16, y + 5, x + 25, y + 24, rgba('#8be9fd', 210));
    line(pixels, width, height, x + 7, y + 23, x + 25, y + 11, rgba('#c4b5fd', 210));
    fill(pixels, width, height, x + 14, y + 14, 5, 5, rgba('#e0f2fe'));
  });

  [
    [CITY.signBank, '#d2b76e'], [CITY.signAuction, '#e879f9'], [CITY.signInn, '#fbbf24'],
    [CITY.signSword, '#d9dce2'], [CITY.signShield, '#9db0c2'], [CITY.signPotion, '#63d3b2'],
    [CITY.signArcane, '#8be9fd'], [CITY.signProfession, '#9ed36a'], [CITY.signGeneral, '#d6aa6b'],
    [CITY.signFishing, '#38bdf8'], [CITY.signMining, '#94a3b8'], [CITY.signTailor, '#f0abfc'],
    [CITY.signLeather, '#a16207'],
  ].forEach(([tile, color]) => drawCityTilesheetTile(pixels, width, height, tile, (x, y) => {
    fill(pixels, width, height, x, y, TILE, TILE, [0, 0, 0, 0]);
    fill(pixels, width, height, x + 7, y + 5, 18, 18, rgba('#5b3925'));
    fill(pixels, width, height, x + 9, y + 7, 14, 14, rgba(color));
    fill(pixels, width, height, x + 15, y + 23, 3, 8, rgba('#3a2921'));
  }));

  [
    [CITY.cityLamp, '#f7d774'], [CITY.bench, '#7b5738'], [CITY.planter, '#78a86a'],
    [CITY.marketAwning, '#b55247'], [CITY.crateStack, '#8c6338'], [CITY.barrelStack, '#7c5132'],
    [CITY.cartLarge, '#755134'], [CITY.bannerBlue, '#5276a8'], [CITY.bannerRed, '#b55247'],
  ].forEach(([tile, color]) => drawCityTilesheetTile(pixels, width, height, tile, (x, y) => {
    fill(pixels, width, height, x, y, TILE, TILE, [0, 0, 0, 0]);
    fill(pixels, width, height, x + 6, y + 14, 20, 12, rgba(color));
    fill(pixels, width, height, x + 9, y + 10, 14, 5, rgba('#ead7b8', 180));
    if (tile === CITY.cityLamp) {
      fill(pixels, width, height, x + 15, y + 10, 3, 18, rgba('#3a2921'));
      fill(pixels, width, height, x + 11, y + 5, 11, 9, rgba('#f7d774'));
    }
  }));

  Object.values(CITY_BUILDING_PREFABS).forEach((prefab) => {
    drawCityPrefabExterior(pixels, width, height, prefab);
    drawCityPrefabInterior(pixels, width, height, prefab);
  });

  return encodePng(width, height, pixels);
}

function cityAnimations() {
  return [
    {
      tileId: CITY.fountainWater,
      frames: [
        { tileId: CITY.fountainWater, duration: 180 },
        { tileId: CITY.fountainWaterAlt, duration: 180 },
      ],
    },
    {
      tileId: CITY.fountainFoam,
      frames: [
        { tileId: CITY.fountainFoam, duration: 140 },
        { tileId: CITY.fountainWater, duration: 140 },
      ],
    },
  ];
}

function drawBuildingPrefab(pixels, width, height, prefab) {
  const sx = (prefab.start % TILESET_COLUMNS) * TILE;
  const sy = Math.floor(prefab.start / TILESET_COLUMNS) * TILE;
  const w = prefab.w * TILE;
  const h = prefab.h * TILE;
  const wall = prefab.palette === 'stone' ? rgba('#938c7a')
    : prefab.palette === 'dark' ? rgba('#6f6255')
      : prefab.palette === 'dock' ? rgba('#7a5a35')
        : rgba('#b88d58');
  const roof = prefab.palette === 'green' ? rgba('#536b3d')
    : prefab.palette === 'stone' ? rgba('#706f68')
      : prefab.palette === 'farm' ? rgba('#8a5c30')
        : prefab.palette === 'dark' ? rgba('#4f3130')
          : rgba('#7d3431');
  const roofHi = blend(roof, rgba('#f3d18c'), 0.18);
  const wood = rgba('#5f3e28');
  fill(pixels, width, height, sx + 5, sy + 17, w - 10, h - 22, wall);
  fill(pixels, width, height, sx + 3, sy + 9, w - 6, 12, roof);
  line(pixels, width, height, sx + 3, sy + 9, sx + Math.floor(w / 2), sy + 2, roofHi);
  line(pixels, width, height, sx + Math.floor(w / 2), sy + 2, sx + w - 3, sy + 9, roof);
  fill(pixels, width, height, sx + Math.floor(w / 2) - 6, sy + h - 22, 12, 20, wood);
  fill(pixels, width, height, sx + Math.floor(w / 2) - 4, sy + h - 14, 8, 12, rgba('#2c1b15'));
  for (let col = 0; col < prefab.w; col += 1) {
    if (col === Math.floor(prefab.w / 2)) continue;
    if (col % 2 === 0 || prefab.w <= 5) fill(pixels, width, height, sx + col * TILE + 10, sy + h - 36, 10, 12, rgba('#f2d890'));
  }
  if (prefab.palette === 'stone' || prefab.palette === 'civic') {
    fill(pixels, width, height, sx + w - 26, sy + 1, 13, 34, rgba('#716d65'));
    fill(pixels, width, height, sx + w - 24, sy - 1, 9, 6, rgba('#534f4a'));
  }
  if (prefab.label === 'Forge') {
    fill(pixels, width, height, sx + 9, sy + h - 30, 14, 12, rgba('#2d2b2a'));
    fill(pixels, width, height, sx + 11, sy + h - 34, 10, 5, rgba('#e19145'));
  }
  if (prefab.label === 'Wayside Temple') {
    fill(pixels, width, height, sx + Math.floor(w / 2) - 2, sy + 3, 4, 18, rgba('#ddd3b5'));
    fill(pixels, width, height, sx + Math.floor(w / 2) - 8, sy + 9, 16, 4, rgba('#ddd3b5'));
  }
}

function makeBuildingsTilesheet() {
  const width = TILE * TILESET_COLUMNS;
  const height = TILE * Math.ceil(BUILDING_TILESET_TILES / TILESET_COLUMNS);
  const pixels = Buffer.alloc(width * height * 4);
  fill(pixels, width, height, 0, 0, width, height, [0, 0, 0, 0]);
  Object.values(BUILDINGS).forEach((prefab) => drawBuildingPrefab(pixels, width, height, prefab));
  return encodePng(width, height, pixels);
}

function drawPropTile(pixels, width, height, tile, draw) {
  const tx = (tile % TILESET_COLUMNS) * TILE;
  const ty = Math.floor(tile / TILESET_COLUMNS) * TILE;
  draw(tx, ty);
}

function drawMultiBox(pixels, width, height, tile, tw, th, color, trim = '#4a3424') {
  const tx = (tile % TILESET_COLUMNS) * TILE;
  const ty = Math.floor(tile / TILESET_COLUMNS) * TILE;
  fill(pixels, width, height, tx + 4, ty + 8, tw * TILE - 8, th * TILE - 12, rgba(color));
  fill(pixels, width, height, tx + 4, ty + 8, tw * TILE - 8, 5, rgba(trim));
  fill(pixels, width, height, tx + 4, ty + th * TILE - 10, tw * TILE - 8, 5, rgba(trim));
}

function makePropsTilesheet() {
  const width = TILE * TILESET_COLUMNS;
  const height = TILE * Math.ceil(PROP_TILESET_TILES / TILESET_COLUMNS);
  const pixels = Buffer.alloc(width * height * 4);
  fill(pixels, width, height, 0, 0, width, height, [0, 0, 0, 0]);
  const simple = [
    [PROPS.barrel, '#7b5437'], [PROPS.crate, '#8a623a'], [PROPS.hay, '#c8ae52'], [PROPS.cart, '#6d4930'],
    [PROPS.sign, '#7a5433'], [PROPS.fenceH, '#79542f'], [PROPS.fenceV, '#79542f'], [PROPS.brokenFence, '#5f4329'],
    [PROPS.lamp, '#d6b25d'], [PROPS.flowerPatch, '#d86a83'], [PROPS.reeds, '#607540'], [PROPS.mushroom, '#d7d1bd'],
    [PROPS.rockSmall, '#7a7c73'], [PROPS.rockLarge, '#696c65'], [PROPS.stump, '#6a482f'], [PROPS.log, '#68462f'],
  ];
  for (const [tile, color] of simple) {
    drawPropTile(pixels, width, height, tile, (tx, ty) => {
      fill(pixels, width, height, tx + 8, ty + 13, 16, 12, rgba(color));
      fill(pixels, width, height, tx + 10, ty + 9, 12, 5, blend(rgba(color), rgba('#f2d990'), 0.24));
      if (tile === PROPS.fenceH) fill(pixels, width, height, tx + 1, ty + 14, 30, 5, rgba(color));
      if (tile === PROPS.fenceV) fill(pixels, width, height, tx + 14, ty + 1, 5, 30, rgba(color));
      if (tile === PROPS.sign) fill(pixels, width, height, tx + 14, ty + 9, 4, 19, rgba('#5f3b24'));
    });
  }
  drawMultiBox(pixels, width, height, PROPS.oak2x2, 2, 2, '#32612f', '#644629');
  drawMultiBox(pixels, width, height, PROPS.pine2x2, 2, 2, '#294f38', '#60432b');
  drawMultiBox(pixels, width, height, PROPS.forestCluster3x3, 3, 3, '#2b5730', '#4d3a25');
  drawMultiBox(pixels, width, height, PROPS.bridgeH, 4, 2, '#8b6338', '#4d3424');
  drawMultiBox(pixels, width, height, PROPS.bridgeV, 2, 4, '#8b6338', '#4d3424');
  drawMultiBox(pixels, width, height, PROPS.dock, 4, 2, '#765437', '#34261b');
  drawMultiBox(pixels, width, height, PROPS.boat, 3, 2, '#714a31', '#d9c790');
  drawMultiBox(pixels, width, height, PROPS.mineEntrance, 3, 3, '#4c4c46', '#272722');
  drawMultiBox(pixels, width, height, PROPS.caveEntrance, 3, 3, '#3f403b', '#22231f');
  drawMultiBox(pixels, width, height, PROPS.marketStall, 2, 2, '#a7443c', '#f1d58b');
  drawPropTile(pixels, width, height, PROPS.well, (tx, ty) => {
    fill(pixels, width, height, tx + 8, ty + 13, 16, 12, rgba('#77736a'));
    fill(pixels, width, height, tx + 6, ty + 8, 20, 6, rgba('#6b4630'));
  });
  const drawTorch = (tile, flameColor, glowColor) => drawPropTile(pixels, width, height, tile, (tx, ty) => {
    fill(pixels, width, height, tx + 15, ty + 9, 3, 19, rgba('#5f3c25'));
    fill(pixels, width, height, tx + 10, ty + 3, 12, 9, rgba(glowColor, 105));
    fill(pixels, width, height, tx + 12, ty + 4, 8, 7, rgba(flameColor));
    fill(pixels, width, height, tx + 15, ty + 2, 3, 5, rgba('#ffd86a'));
  });
  const drawCampfire = (tile, flameColor, offset = 0) => drawPropTile(pixels, width, height, tile, (tx, ty) => {
    fill(pixels, width, height, tx + 9, ty + 19, 14, 4, rgba('#5a3d28'));
    fill(pixels, width, height, tx + 8, ty + 15, 16, 8, rgba('#5a3d28', 150));
    fill(pixels, width, height, tx + 12 + offset, ty + 12, 8, 8, rgba(flameColor));
    fill(pixels, width, height, tx + 15 - offset, ty + 9, 4, 8, rgba('#ffd86a'));
  });
  drawTorch(PROPS.torch, '#ef8b32', '#ef8b32');
  drawTorch(PROPS.torchFrame2, '#f6a23a', '#facc15');
  drawCampfire(PROPS.campfire, '#ef8b32', 0);
  drawCampfire(PROPS.campfireFrame2, '#f6a23a', -1);
  drawCampfire(PROPS.campfireFrame3, '#dc6428', 1);
  return encodePng(width, height, pixels);
}

function makeCollisionTilesheet() {
  const pixels = Buffer.alloc(TILE * TILE * 4);
  fill(pixels, TILE, TILE, 0, 0, TILE, TILE, rgba('#ff3333', 125));
  return encodePng(TILE, TILE, pixels);
}

function makeTsx(name, image, tileCount, columns = TILESET_COLUMNS, animations = []) {
  const animationXml = animations.map(({ tileId, frames }) => ` <tile id="${tileId}">
  <animation>
${frames.map((frame) => `   <frame tileid="${frame.tileId}" duration="${frame.duration}"/>`).join('\n')}
  </animation>
 </tile>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.11.2" name="${name}" tilewidth="32" tileheight="32" tilecount="${tileCount}" columns="${columns}">
 <image source="../assets/tilesets/${image}" width="${columns * TILE}" height="${Math.ceil(tileCount / columns) * TILE}"/>
${animationXml ? `${animationXml}\n` : ''}</tileset>
`;
}

function propGid(localTile) {
  return PROPS_FIRSTGID + localTile;
}

function buildingGid(localTile) {
  return BUILDINGS_FIRSTGID + localTile;
}

function cityGid(localTile) {
  return CITY_FIRSTGID + localTile;
}

function createRegion(rx, ry) {
  objectId = 1;
  const worldX = rx * REGION_TILES;
  const worldY = ry * REGION_TILES;
  const theme = REGION_THEMES[ry * REGION_GRID + rx];
  const region = {
    rx,
    ry,
    worldX,
    worldY,
    theme,
    ground: makeLayer(),
    water: makeLayer(),
    terrainDetails: makeLayer(),
    roads: makeLayer(),
    cityBase: makeLayer(),
    cityInteriors: makeLayer(),
    decor: makeLayer(),
    buildings: makeLayer(),
    cityRoofs: makeLayer(),
    collision: makeLayer(),
    objects: {
      zones: [],
      spawns: [],
      bossSpawns: [],
      npcs: [],
      questGivers: [],
      raceStarts: [],
      graveyards: [],
      interiorZones: [],
      regionMarkers: [],
      roadMarkers: [],
      landmarks: [],
      transitions: [],
    },
  };

  for (let y = 0; y < REGION_TILES; y += 1) {
    for (let x = 0; x < REGION_TILES; x += 1) {
      const gx = worldX + x;
      const gy = worldY + y;
      const sample = sampleWorld(gx, gy);
      setTile(region.ground, x, y, groundTileFromSample(sample));
      setTile(region.water, x, y, waterTileFromSample(sample));
      setTile(region.terrainDetails, x, y, detailTileFromSample(sample));
      setTile(region.roads, x, y, roadTileFromSample(sample));
      if (sample.water && !sample.bridge && !sample.fordableWater) setTile(region.collision, x, y, COLLISION_FIRSTGID);
    }
  }

  placeNaturalDecor(region);
  placePlayableNaturalDetails(region);
  placeBridges(region);
  placeRegionalDetails(region);
  for (const landmark of LANDMARKS) placeLandmark(region, landmark);
  placeAsterfallHubContent(region);
  addRegionMarkers(region);
  addRoadMarkers(region);

  return region;
}

function toLocal(region, gx, gy) {
  return { x: Math.round(gx - region.worldX), y: Math.round(gy - region.worldY) };
}

function inRegion(region, gx, gy, margin = 0) {
  return gx >= region.worldX - margin
    && gy >= region.worldY - margin
    && gx < region.worldX + REGION_TILES + margin
    && gy < region.worldY + REGION_TILES + margin;
}

function placeProp(region, gx, gy, localTile, solid = false) {
  const { x, y } = toLocal(region, gx, gy);
  if (x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) return;
  setTile(region.decor, x, y, propGid(localTile));
  if (solid) setTile(region.collision, x, y, COLLISION_FIRSTGID);
}

function placePropPrefab(region, gx, gy, localTile, w, h, solid = false) {
  const { x, y } = toLocal(region, gx, gy);
  if (x < -w || y < -h || x >= REGION_TILES || y >= REGION_TILES) return;
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      setTile(region.decor, x + xx, y + yy, propGid(localTile + yy * TILESET_COLUMNS + xx));
      if (solid) setTile(region.collision, x + xx, y + yy, COLLISION_FIRSTGID);
    }
  }
}

function placeBuilding(region, gx, gy, key, objectName) {
  const prefab = BUILDINGS[key];
  if (!prefab) return;
  const { x, y } = toLocal(region, gx, gy);
  if (x < -prefab.w || y < -prefab.h || x >= REGION_TILES || y >= REGION_TILES) return;
  for (let yy = 0; yy < prefab.h; yy += 1) {
    for (let xx = 0; xx < prefab.w; xx += 1) {
      const biome = biomeFor(gx + xx, gy + yy);
      setTile(region.ground, x + xx, y + yy, gid(biome, TILES.light));
      setTile(region.water, x + xx, y + yy, 0);
      setTile(region.terrainDetails, x + xx, y + yy, 0);
      setTile(region.buildings, x + xx, y + yy, buildingGid(prefab.start + yy * BUILDING_TILESET_COLUMNS + xx));
    }
  }
  const collision = prefab.collision ?? { x: 0, y: 0, w: prefab.w, h: prefab.h };
  fillRectLayer(region.collision, x + collision.x, y + collision.y, collision.w, collision.h, COLLISION_FIRSTGID);
  region.objects.landmarks.push(rectObject(objectName, x, y, prefab.w, prefab.h, {
    type: 'building',
    buildingType: prefab.prefabId ?? key,
    prefabId: prefab.prefabId ?? key,
    displayName: prefab.label,
    showOnMap: false,
    debugOnly: true,
  }));
}

function placeRoadPatch(region, gx, gy, radius, plaza = false) {
  const biome = biomeFor(gx, gy);
  const { x: cx, y: cy } = toLocal(region, gx, gy);
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if (x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) continue;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist <= radius) {
        setTile(region.roads, x, y, gid(biome, plaza ? TILES.plaza : TILES.road));
        if (getTile(region.collision, x, y) === COLLISION_FIRSTGID && getTile(region.water, x, y)) setTile(region.collision, x, y, 0);
      }
    }
  }
}

function fillRoadRect(region, gx, gy, w, h, tile = TILES.road) {
  const biome = biomeFor(gx, gy);
  const { x, y } = toLocal(region, gx, gy);
  fillRectLayer(region.roads, x, y, w, h, gid(biome, tile));
}

function fillTerrainRect(region, gx, gy, w, h, tile, biomeId = null) {
  const biome = BIOME_BY_ID[biomeId] ?? biomeFor(gx, gy);
  const { x, y } = toLocal(region, gx, gy);
  fillRectLayer(region.terrainDetails, x, y, w, h, gid(biome, tile));
}

function setCityTile(region, layerKey, gx, gy, tile) {
  const layer = region[layerKey];
  if (!layer) return;
  const { x, y } = toLocal(region, gx, gy);
  setTile(layer, x, y, cityGid(tile));
}

function fillCityRect(region, layerKey, gx, gy, w, h, tile) {
  const layer = region[layerKey];
  if (!layer) return;
  const { x, y } = toLocal(region, gx, gy);
  fillRectLayer(layer, x, y, w, h, cityGid(tile));
}

function stampCityPrefab(region, layerKey, gx, gy, start, w, h) {
  const layer = region[layerKey];
  if (!layer) return;
  const { x, y } = toLocal(region, gx, gy);
  for (let yy = 0; yy < h; yy += 1) {
    for (let xx = 0; xx < w; xx += 1) {
      const lx = x + xx;
      const ly = y + yy;
      if (lx < 0 || ly < 0 || lx >= REGION_TILES || ly >= REGION_TILES) continue;
      setTile(layer, lx, ly, cityGid(start + yy * CITY_TILESET_COLUMNS + xx));
    }
  }
}

function clearCityRect(region, layerKey, gx, gy, w, h) {
  const layer = region[layerKey];
  if (!layer) return;
  const { x, y } = toLocal(region, gx, gy);
  fillRectLayer(layer, x, y, w, h, 0);
}

function clearAllCityLayers(region, gx, gy, w, h) {
  ['cityBase', 'cityInteriors', 'cityRoofs'].forEach((layerKey) => clearCityRect(region, layerKey, gx, gy, w, h));
}

function placeLandmarkReadability(region, landmark) {
  if (!inRegion(region, landmark.x, landmark.y, 64)) return;
  if (landmark.kind === 'city' || landmark.kind === 'city_hub') {
    fillRoadRect(region, landmark.x - 28, landmark.y - 18, 58, 38, TILES.plaza);
    fillRoadRect(region, landmark.x - 8, landmark.y - 74, 16, 72, TILES.road);
    fillRoadRect(region, landmark.x - 8, landmark.y + 18, 16, 70, TILES.road);
    fillRoadRect(region, landmark.x - 76, landmark.y - 6, 78, 12, TILES.road);
    fillRoadRect(region, landmark.x + 28, landmark.y - 6, 76, 12, TILES.road);
  } else if (landmark.kind === 'town') {
    fillRoadRect(region, landmark.x - 22, landmark.y - 14, 44, 28, TILES.plaza);
    fillRoadRect(region, landmark.x - 6, landmark.y - 56, 12, 50, TILES.road);
    fillRoadRect(region, landmark.x - 54, landmark.y - 4, 48, 8, TILES.road);
    fillRoadRect(region, landmark.x + 18, landmark.y - 4, 46, 8, TILES.road);
  } else if (landmark.kind === 'village') {
    fillRoadRect(region, landmark.x - 16, landmark.y - 10, 32, 20, TILES.dirt);
    fillRoadRect(region, landmark.x - 5, landmark.y - 44, 10, 38, TILES.path);
    fillRoadRect(region, landmark.x - 44, landmark.y - 3, 38, 7, TILES.path);
    fillRoadRect(region, landmark.x + 16, landmark.y - 3, 38, 7, TILES.path);
  } else if (landmark.kind === 'harbor') {
    fillRoadRect(region, landmark.x - 30, landmark.y - 10, 58, 20, TILES.dirt);
    fillRoadRect(region, landmark.x + 16, landmark.y + 8, 26, 9, TILES.path);
  } else if (landmark.kind === 'farmstead' || landmark.kind === 'mill') {
    fillRoadRect(region, landmark.x - 18, landmark.y - 8, 36, 16, TILES.dirt);
    fillTerrainRect(region, landmark.x - 48, landmark.y - 34, 26, 18, TILES.crop, 'golden_fields');
    fillTerrainRect(region, landmark.x + 30, landmark.y + 14, 24, 18, TILES.crop, 'golden_fields');
  } else if (['fort', 'fortress'].includes(landmark.kind)) {
    fillRoadRect(region, landmark.x - 28, landmark.y - 20, 56, 42, TILES.dirt);
  } else if (landmark.kind.includes('ruins') || landmark.kind === 'battlefield' || landmark.kind === 'temple_ruins') {
    fillTerrainRect(region, landmark.x - 24, landmark.y - 18, 48, 36, TILES.ruinFloor, 'old_empire');
    fillRoadRect(region, landmark.x - 6, landmark.y + 12, 12, 42, TILES.path);
  } else if (landmark.kind === 'mining_town') {
    fillRoadRect(region, landmark.x - 24, landmark.y - 14, 50, 30, TILES.dirt);
    fillTerrainRect(region, landmark.x + 20, landmark.y - 16, 20, 20, TILES.scree, 'ironcrag');
  } else if (landmark.kind === 'bridge_landmark') {
    fillRoadRect(region, landmark.x - 32, landmark.y - 6, 64, 12, TILES.road);
  } else if (landmark.kind === 'watchtower' || landmark.kind === 'watchtower_ruin') {
    fillRoadRect(region, landmark.x - 10, landmark.y - 8, 20, 18, TILES.path);
  } else if (landmark.kind === 'fishing_spot') {
    fillTerrainRect(region, landmark.x - 18, landmark.y - 8, 36, 16, TILES.reeds);
  }
}

function placeFenceLine(region, gx, gy, length, horizontal = true) {
  for (let i = 0; i < length; i += 1) placeProp(region, gx + (horizontal ? i : 0), gy + (horizontal ? 0 : i), horizontal ? PROPS.fenceH : PROPS.fenceV, true);
}

function placeNaturalDecor(region) {
  for (let y = 2; y < REGION_TILES - 2; y += 5) {
    for (let x = 2; x < REGION_TILES - 2; x += 5) {
      const gx = region.worldX + x;
      const gy = region.worldY + y;
      const sample = sampleWorld(gx, gy);
      if (sample.water || sample.bridge || landmarkAt(gx, gy) || sample.road?.distance < 18) continue;
      const biome = sample.biome;
      const n = hash(gx, gy, 100);
      const mountain = sample.mountain;
      if (n > 0.997 && biome.density > 0.5) placePropPrefab(region, gx, gy, PROPS.forestCluster3x3, 3, 3, false);
      else if (n > 0.988 && ['emerald_vale', 'elderwood', 'shadowfen'].includes(biome.id)) placePropPrefab(region, gx, gy, PROPS.oak2x2, 2, 2, false);
      else if (n > 0.986 && ['cloudspine', 'ironcrag'].includes(biome.id)) placeProp(region, gx, gy, PROPS.rockLarge, false);
      else if (n > 0.984 && (biome.id === 'murkfen' || biome.id === 'shadowfen')) placeProp(region, gx, gy, PROPS.reeds, false);
      else if (n > 0.982 && biome.id === 'old_empire') placeProp(region, gx, gy, PROPS.ruinsPillar, false);
      else if (n > 0.978 && mountain < 0.25) placeProp(region, gx, gy, ['elderwood', 'emerald_vale'].includes(biome.id) ? PROPS.stump : PROPS.rockSmall, false);
      else if (n > 0.972 && biome.density > 0.45) placeProp(region, gx, gy, PROPS.log, false);
    }
  }
}

function setTerrainDetail(region, gx, gy, tile, biomeId = null) {
  const biome = BIOME_BY_ID[biomeId] ?? biomeFor(gx, gy);
  const { x, y } = toLocal(region, gx, gy);
  if (x < 0 || y < 0 || x >= REGION_TILES || y >= REGION_TILES) return;
  if (getTile(region.water, x, y) || getTile(region.roads, x, y)) return;
  setTile(region.terrainDetails, x, y, gid(biome, tile));
}

function isPlayableDecorSpot(region, gx, gy, roadPadding = 7) {
  const { x, y } = toLocal(region, gx, gy);
  if (x < 1 || y < 1 || x >= REGION_TILES - 1 || y >= REGION_TILES - 1) return false;
  if (getTile(region.water, x, y) || getTile(region.buildings, x, y) || getTile(region.collision, x, y)) return false;
  const road = nearestRoad(gx, gy);
  if (road && road.distance < roadWidthAt(gx, gy, road.road) + roadPadding) return false;
  return !landmarkAt(gx, gy);
}

function placeNaturalClearing(region, gx, gy, rx, ry, tag = 'clearing') {
  if (!inRegion(region, gx, gy, Math.max(rx, ry) + 8)) return;
  const biome = biomeFor(gx, gy);
  for (let y = Math.floor(gy - ry); y <= Math.ceil(gy + ry); y += 1) {
    for (let x = Math.floor(gx - rx); x <= Math.ceil(gx + rx); x += 1) {
      if (!isPlayableDecorSpot(region, x, y, 3)) continue;
      const edge = softEllipse(x, y, gx, gy, rx, ry);
      const ragged = signedNoise(x, y, 22, stringSeed(tag)) * 0.12;
      if (edge + ragged <= 0) continue;
      const detailRoll = hash(x, y, 171);
      const tile = edge > 0.45 && detailRoll > 0.72
        ? TILES.flowers
        : edge > 0.2
          ? TILES.light
          : TILES.forestFloor;
      setTerrainDetail(region, x, y, tile, biome.id);
    }
  }

  const edgeProps = [
    [-rx - 2, -1, PROPS.log],
    [rx + 1, 2, PROPS.stump],
    [-3, -ry - 2, PROPS.flowerPatch],
    [4, ry + 2, PROPS.rockSmall],
  ];
  for (const [dx, dy, prop] of edgeProps) {
    const px = Math.round(gx + dx);
    const py = Math.round(gy + dy);
    if (isPlayableDecorSpot(region, px, py, 4)) placeProp(region, px, py, prop, false);
  }
}

function placePlayableNaturalDetails(region) {
  for (let y = 3; y < REGION_TILES - 3; y += 6) {
    for (let x = 3; x < REGION_TILES - 3; x += 6) {
      const gx = region.worldX + x;
      const gy = region.worldY + y;
      const sample = sampleWorld(gx, gy);
      if (sample.water || sample.bridge || !isPlayableDecorSpot(region, gx, gy, 6)) continue;

      const biome = sample.biome;
      const shore = sample.score < 0.24 || lakeShoreAt(gx, gy) || (sample.river && sample.river.distance < sample.river.width + 16);
      const foresty = ['emerald_vale', 'elderwood', 'shadowfen'].includes(biome.id);
      const mountainBand = sample.mountain > 0.18 && sample.mountain < 0.62;
      const roll = hash(gx, gy, 170);
      const broad = valueNoise(gx, gy, 180, 8120);

      if (shore) {
        const tile = broad > 0.72 ? TILES.mossStone : broad > 0.48 ? TILES.bank : TILES.sand;
        setTerrainDetail(region, gx, gy, tile, biome.id);
        if (roll > 0.93) placeProp(region, gx, gy, PROPS.rockSmall, false);
        else if (roll > 0.86 && ['murkfen', 'shadowfen', 'silver_river'].includes(biome.id)) placeProp(region, gx, gy, PROPS.reeds, false);
        else if (roll > 0.8 && sample.score > 0.08) placeProp(region, gx, gy, PROPS.flowerPatch, false);
        continue;
      }

      if (mountainBand) {
        if (roll > 0.7) setTerrainDetail(region, gx, gy, sample.mountain > 0.36 ? TILES.scree : TILES.rock, biome.id);
        if (roll > 0.94) placeProp(region, gx, gy, roll > 0.985 ? PROPS.rockLarge : PROPS.rockSmall, false);
        continue;
      }

      if (foresty) {
        const edge = broad > 0.36 && broad < 0.74;
        if (edge && roll > 0.52) setTerrainDetail(region, gx, gy, roll > 0.82 ? TILES.flowers : TILES.forestFloor, biome.id);
        if (edge && roll > 0.92) placeProp(region, gx, gy, roll > 0.965 ? PROPS.log : PROPS.stump, false);
        else if (edge && roll > 0.84) placeProp(region, gx, gy, PROPS.flowerPatch, false);
        continue;
      }

      if ((biome.id === 'golden_fields' || biome.id === 'sunhill' || biome.id === 'amber_steppe') && roll > 0.72) {
        setTerrainDetail(region, gx, gy, roll > 0.88 ? TILES.flowers : TILES.tallGrass, biome.id);
        if (roll > 0.955) placeProp(region, gx, gy, PROPS.hay, false);
        continue;
      }

      if ((biome.id === 'old_empire' || biome.id === 'ironcrag') && roll > 0.82) {
        setTerrainDetail(region, gx, gy, biome.id === 'old_empire' ? TILES.ruinFloor : TILES.rock, biome.id);
        if (roll > 0.955) placeProp(region, gx, gy, biome.id === 'old_empire' ? PROPS.ruinsWall : PROPS.rockSmall, false);
      }
    }
  }

  const forestClearingCount = ['emerald_vale', 'elderwood', 'shadowfen'].includes(region.theme.biome) ? 3 : 1;
  for (let i = 0; i < forestClearingCount; i += 1) {
    const gx = region.worldX + 120 + Math.floor(hash(region.rx, i, 180) * 560);
    const gy = region.worldY + 120 + Math.floor(hash(region.ry, i, 181) * 560);
    const sample = sampleWorld(gx, gy);
    if (sample.water || sample.mountain > 0.46 || sample.road?.distance < 36 || landmarkAt(gx, gy)) continue;
    placeNaturalClearing(
      region,
      gx,
      gy,
      15 + Math.floor(hash(i, region.rx, 182) * 13),
      10 + Math.floor(hash(i, region.ry, 183) * 10),
      `${region.rx}_${region.ry}_${i}`,
    );
    if (hash(gx, gy, 184) > 0.64 && isPlayableDecorSpot(region, gx + 2, gy + 1, 5)) {
      placeProp(region, gx + 2, gy + 1, PROPS.campfire, false);
    }
  }
}

function placeBridges(region) {
  for (const bridge of BRIDGES) {
    if (!inRegion(region, bridge.x, bridge.y, 12)) continue;
    const start = bridge.orientation === 'horizontal' ? PROPS.bridgeH : PROPS.bridgeV;
    placePropPrefab(region, bridge.x - Math.floor(bridge.w / 2), bridge.y - Math.floor(bridge.h / 2), start, bridge.orientation === 'horizontal' ? 4 : 2, bridge.orientation === 'horizontal' ? 2 : 4, false);
    const { x, y } = toLocal(region, bridge.x - Math.floor(bridge.w / 2), bridge.y - Math.floor(bridge.h / 2));
    fillRectLayer(region.collision, x - 2, y - 2, bridge.w + 4, bridge.h + 4, 0);
    region.objects.landmarks.push(rectObject(`landmark_${bridge.id}`, x, y, bridge.w, bridge.h, {
      type: 'landmark',
      landmarkId: bridge.id,
      displayName: bridge.id.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' '),
      showOnMap: false,
      debugOnly: false,
    }));
  }
}

function placeRegionalDetails(region) {
  const theme = region.theme;
  const centerX = region.worldX + REGION_TILES / 2;
  const centerY = region.worldY + REGION_TILES / 2;
  region.objects.regionMarkers.push(rectObject(`region_marker_${region.rx}_${region.ry}`, 0, 0, REGION_TILES, REGION_TILES, {
    type: 'region',
    zoneId: theme.id,
    regionId: `world_region_${region.rx}_${region.ry}`,
    displayName: theme.name,
    biomeId: theme.biome,
    biomeType: theme.biome,
    description: theme.role,
    role: theme.role,
    recommendedLevel: Math.max(1, 1 + region.ry * 3 + Math.floor(region.rx / 2)),
    showOnMap: true,
    debugOnly: false,
  }));

  if (theme.name.includes('Farms') || theme.name.includes('Countryside') || theme.name.includes('Southbarley')) {
    for (let i = 0; i < 7; i += 1) {
      const gx = centerX - 160 + i * 48 + Math.floor((hash(i, region.rx, 20) - 0.5) * 40);
      const gy = centerY + 120 + Math.floor((hash(i, region.ry, 21) - 0.5) * 90);
      const { x, y } = toLocal(region, gx, gy);
      fillRectLayer(region.terrainDetails, x, y, 24, 18, gid(BIOME_BY_ID.golden_fields, TILES.crop));
      placeFenceLine(region, gx - 1, gy - 1, 26, true);
      placeFenceLine(region, gx - 1, gy + 18, 26, true);
      placeFenceLine(region, gx - 1, gy, 18, false);
      placeFenceLine(region, gx + 24, gy, 18, false);
    }
  }

  if (theme.name.includes('Lake') || theme.name.includes('Coast') || theme.name.includes('Harbor')) {
    for (let i = 0; i < 5; i += 1) {
      const gx = centerX + Math.floor((hash(i, region.rx, 30) - 0.5) * 460);
      const gy = centerY + Math.floor((hash(i, region.ry, 31) - 0.5) * 460);
      if (isWater(gx, gy) || nearestRiver(gx, gy)?.distance < 28 || landScore(gx, gy) < 0.2) {
        placePropPrefab(region, gx, gy, PROPS.dock, 4, 2, false);
        placePropPrefab(region, gx + 5, gy + 2, PROPS.boat, 3, 2, false);
      }
    }
  }

  for (let i = 0; i < 10; i += 1) {
    const gx = centerX + Math.floor((hash(i, region.rx, 41) - 0.5) * 620);
    const gy = centerY + Math.floor((hash(i, region.ry, 42) - 0.5) * 620);
    const road = nearestRoad(gx, gy);
    if (!road || road.distance > road.road.width + 10 || isWater(gx, gy)) continue;
    if (hash(gx, gy, 43) > 0.55) {
      placeProp(region, gx + 2, gy + 2, PROPS.sign, false);
      placeProp(region, gx - 3, gy + 4, PROPS.barrel, false);
    } else {
      placeProp(region, gx - 2, gy + 3, PROPS.campfire, false);
      placeProp(region, gx + 4, gy + 5, PROPS.log, false);
    }
  }

  if (['emerald_vale', 'elderwood', 'shadowfen'].includes(theme.biome)) {
    for (let i = 0; i < 9; i += 1) {
      const gx = centerX + Math.floor((hash(i, region.rx, 50) - 0.5) * 620);
      const gy = centerY + Math.floor((hash(i, region.ry, 51) - 0.5) * 620);
      if (isWater(gx, gy) || nearestRoad(gx, gy)?.distance < 20) continue;
      placeProp(region, gx - 4, gy - 2, PROPS.stump, false);
      placeProp(region, gx + 3, gy + 1, PROPS.log, false);
      placeProp(region, gx, gy + 6, PROPS.mushroom, false);
    }
  }

  if (theme.biome === 'old_empire') {
    for (let i = 0; i < 11; i += 1) {
      const gx = centerX + Math.floor((hash(i, region.rx, 60) - 0.5) * 640);
      const gy = centerY + Math.floor((hash(i, region.ry, 61) - 0.5) * 640);
      if (isWater(gx, gy) || nearestRoad(gx, gy)?.distance < 12) continue;
      placeProp(region, gx, gy, i % 2 ? PROPS.ruinsPillar : PROPS.ruinsWall, false);
    }
  }

  if (theme.biome === 'murkfen' || theme.biome === 'shadowfen') {
    for (let i = 0; i < 12; i += 1) {
      const gx = centerX + Math.floor((hash(i, region.rx, 70) - 0.5) * 620);
      const gy = centerY + Math.floor((hash(i, region.ry, 71) - 0.5) * 620);
      const river = nearestRiver(gx, gy);
      if (!isWater(gx, gy) && (!river || river.distance > 24)) continue;
      placeProp(region, gx + 2, gy + 2, PROPS.reeds, false);
      if (i % 4 === 0) placeProp(region, gx - 3, gy + 3, PROPS.rockSmall, false);
    }
  }
}

function placeLandmark(region, landmark) {
  if (!inRegion(region, landmark.x, landmark.y, 0)) return;
  placeRoadPatch(region, landmark.x, landmark.y, Math.max(12, Math.floor(landmark.radius / 4)), landmark.kind === 'city' || landmark.kind === 'town');
  placeLandmarkReadability(region, landmark);
  const { x, y } = toLocal(region, landmark.x, landmark.y);
  region.objects.landmarks.push(pointObject(`marker_${landmark.id}`, x, y, {
    type: 'landmark',
    landmarkId: landmark.id,
    displayName: landmark.displayName,
    landmarkKind: landmark.kind,
    showOnMap: Boolean(landmark.showOnMap),
    debugOnly: false,
  }));
  if (landmark.transitionTarget) {
    region.objects.transitions.push(rectObject(`transition_${landmark.id}`, x - 2, y - 2, 4, 4, {
      type: 'transition',
      transitionKind: landmark.kind,
      target: landmark.transitionTarget,
      displayName: landmark.displayName,
      showOnMap: true,
      debugOnly: false,
    }));
  }

  const plans = getLandmarkPlan(landmark);
  for (const item of plans.buildings) placeBuilding(region, landmark.x + item.x, landmark.y + item.y, item.key, `${landmark.id}_${item.key}_${item.x}_${item.y}`);
  for (const item of plans.props) {
    if (item.prefab) placePropPrefab(region, landmark.x + item.x, landmark.y + item.y, item.tile, item.w, item.h, Boolean(item.solid));
    else placeProp(region, landmark.x + item.x, landmark.y + item.y, item.tile, Boolean(item.solid));
  }
  for (const fence of plans.fences) placeFenceLine(region, landmark.x + fence.x, landmark.y + fence.y, fence.length, fence.horizontal);
  for (const field of plans.fields) {
    const { x: fx, y: fy } = toLocal(region, landmark.x + field.x, landmark.y + field.y);
    fillRectLayer(region.terrainDetails, fx, fy, field.w, field.h, gid(BIOME_BY_ID.golden_fields, TILES.crop));
  }
}

function addObjectPoint(region, layerKey, name, gx, gy, props = {}) {
  if (!inRegion(region, gx, gy, 0)) return;
  const { x, y } = toLocal(region, gx, gy);
  region.objects[layerKey].push(pointObject(name, x, y, props));
}

function addObjectRect(region, layerKey, name, gx, gy, w, h, props = {}) {
  if (!inRegion(region, gx, gy, Math.max(w, h))) return;
  const { x, y } = toLocal(region, gx, gy);
  region.objects[layerKey].push(rectObject(name, x, y, w, h, props));
}

function placeCityLampPair(region, gx, gy, spacing = 10) {
  placeProp(region, gx - spacing, gy, PROPS.lamp, false);
  placeProp(region, gx + spacing, gy, PROPS.lamp, false);
}

function placeCityMarket(region, gx, gy) {
  placePropPrefab(region, gx - 12, gy - 4, PROPS.marketStall, 2, 2, false);
  placePropPrefab(region, gx - 4, gy - 4, PROPS.marketStall, 2, 2, false);
  placePropPrefab(region, gx + 8, gy - 4, PROPS.marketStall, 2, 2, false);
  placeProp(region, gx - 14, gy + 8, PROPS.crate, false);
  placeProp(region, gx - 10, gy + 9, PROPS.barrel, false);
  placeProp(region, gx + 17, gy + 8, PROPS.flowerPatch, false);
}

function clearCollisionRect(region, gx, gy, w, h) {
  const { x, y } = toLocal(region, gx, gy);
  fillRectLayer(region.collision, x, y, w, h, 0);
}

function placeEntranceMarker(region, gx, gy, options = {}) {
  const width = options.width ?? 5;
  const height = options.height ?? 3;
  const x = gx - Math.floor(width / 2);
  fillTerrainRect(region, x, gy, width, height, TILES.light, options.biomeId ?? 'emerald_vale');
  fillRoadRect(region, x, gy, width, height, options.tile ?? TILES.plaza);
  if (options.torches !== false) {
    placeProp(region, x - 1, gy, PROPS.torch, false);
    placeProp(region, x + width, gy, PROPS.torch, false);
  }
  if (options.sign) placeProp(region, x + width + 1, gy + Math.floor(height / 2), PROPS.sign, false);
}

function placeInteriorProps(region, gx, gy, w, h, theme) {
  const right = gx + w - 1;
  const bottom = gy + h - 1;
  const centerX = gx + Math.floor(w / 2);
  const centerY = gy + Math.floor(h / 2);
  const safeProp = (x, y, tile) => {
    if (x > gx && y > gy && x < right && y < bottom) placeProp(region, x, y, tile, false);
  };

  safeProp(gx + 1, gy + 1, PROPS.lamp);
  safeProp(right - 1, gy + 1, PROPS.lamp);

  if (theme === 'bank') {
    safeProp(gx + 1, bottom - 1, PROPS.crate);
    safeProp(gx + 2, bottom - 1, PROPS.crate);
    safeProp(right - 1, bottom - 1, PROPS.barrel);
    safeProp(centerX, gy + 1, PROPS.sign);
  } else if (theme === 'auction') {
    placePropPrefab(region, centerX - 2, centerY - 1, PROPS.marketStall, 2, 2, false);
    safeProp(gx + 1, bottom - 1, PROPS.crate);
    safeProp(right - 1, bottom - 1, PROPS.barrel);
  } else if (theme === 'inn') {
    placePropPrefab(region, centerX - 2, centerY, PROPS.marketStall, 2, 2, false);
    safeProp(gx + 1, bottom - 1, PROPS.barrel);
    safeProp(gx + 2, bottom - 1, PROPS.barrel);
    safeProp(right - 1, bottom - 1, PROPS.crate);
  } else if (theme === 'forge') {
    safeProp(centerX, centerY, PROPS.campfire);
    safeProp(centerX + 2, centerY, PROPS.rockLarge);
    safeProp(gx + 1, bottom - 1, PROPS.log);
    safeProp(right - 1, bottom - 1, PROPS.crate);
  } else if (theme === 'alchemy') {
    safeProp(centerX, centerY, PROPS.mushroom);
    safeProp(gx + 1, bottom - 1, PROPS.barrel);
    safeProp(right - 1, bottom - 1, PROPS.flowerPatch);
  } else if (theme === 'arcane') {
    safeProp(centerX, centerY, PROPS.torch);
    safeProp(gx + 1, bottom - 1, PROPS.mushroom);
    safeProp(right - 1, bottom - 1, PROPS.sign);
  } else if (theme === 'profession') {
    safeProp(gx + 1, bottom - 1, PROPS.crate);
    safeProp(centerX, centerY, PROPS.sign);
    safeProp(right - 1, bottom - 1, PROPS.hay);
  } else {
    safeProp(gx + 1, bottom - 1, PROPS.crate);
    safeProp(right - 1, bottom - 1, PROPS.barrel);
  }
}

function addCityInterior(region, { name, gx, gy, w, h, buildingId, displayName, theme }) {
  fillTerrainRect(region, gx, gy, w, h, TILES.light, 'emerald_vale');
  if (w > 2 && h > 2) fillRoadRect(region, gx + 1, gy + 1, w - 2, h - 2, TILES.plaza);
  clearCollisionRect(region, gx, gy, w, h);
  placeInteriorProps(region, gx, gy, w, h, theme);
  addObjectRect(region, 'interiorZones', name, gx, gy, w, h, {
    type: 'buildingInterior',
    buildingId,
    displayName,
    roofLayer: 'Buildings',
    roofHide: true,
    interiorFocus: true,
    debugOnly: true,
  });
}

function placeAnimatedFountain(region, gx, gy) {
  fillCityRect(region, 'cityBase', gx - 10, gy - 9, 21, 19, CITY.cobbleAlt);
  for (let y = gy - 5; y <= gy + 5; y += 1) {
    for (let x = gx - 6; x <= gx + 6; x += 1) {
      const dist = Math.hypot((x - gx) / 1.25, y - gy);
      if (dist > 5.3) continue;
      setCityTile(region, 'cityBase', x, y, dist > 4.35 ? CITY.fountainEdge : CITY.fountainBasin);
      setTile(region.collision, toLocal(region, x, y).x, toLocal(region, x, y).y, 0);
    }
  }
  for (let y = gy - 3; y <= gy + 3; y += 1) {
    for (let x = gx - 4; x <= gx + 4; x += 1) {
      const dist = Math.hypot((x - gx) / 1.35, y - gy);
      if (dist > 3.5) continue;
      setCityTile(region, 'cityBase', x, y, dist < 1.15 ? CITY.fountainFoam : CITY.fountainWater);
    }
  }
  setCityTile(region, 'cityBase', gx, gy, CITY.fountainStatue);
  [
    [gx - 11, gy - 9], [gx + 11, gy - 9], [gx - 11, gy + 9], [gx + 11, gy + 9],
  ].forEach(([x, y]) => setCityTile(region, 'cityBase', x, y, CITY.planter));
}

function placeCityStreetLamp(region, gx, gy) {
  setCityTile(region, 'cityBase', gx, gy, CITY.cityLamp);
}

function placeCityClutter(region, gx, gy, tile = CITY.crateStack) {
  setCityTile(region, 'cityBase', gx, gy, tile);
}

function placeCityDoorstep(region, gx, gy, width = 5) {
  fillCityRect(region, 'cityBase', gx - Math.floor(width / 2), gy, width, 3, CITY.cobbleAlt);
  setCityTile(region, 'cityBase', gx, gy, CITY.door);
}

function fillCollisionFrame(region, gx, gy, w, h, doorX, doorWidth = 3) {
  const { x, y } = toLocal(region, gx, gy);
  for (let xx = 0; xx < w; xx += 1) {
    setTile(region.collision, x + xx, y, COLLISION_FIRSTGID);
    if (xx < doorX || xx >= doorX + doorWidth) setTile(region.collision, x + xx, y + h - 1, COLLISION_FIRSTGID);
  }
  for (let yy = 1; yy < h - 1; yy += 1) {
    setTile(region.collision, x, y + yy, COLLISION_FIRSTGID);
    setTile(region.collision, x + w - 1, y + yy, COLLISION_FIRSTGID);
  }
}

function cityInteriorIdForBuildingName(name) {
  return `interior_${name.replace(/^asterfall_city_/, '')}`;
}

function cityBuildingAwningForTheme(theme, sign) {
  if (sign === CITY.signBank || theme === 'bank') return CITY.awningBlue;
  if (sign === CITY.signAuction || theme === 'auction') return CITY.awningPurple;
  if (sign === CITY.signPotion || theme === 'alchemy') return CITY.awningGreen;
  if (sign === CITY.signArcane || theme === 'arcane') return CITY.awningPurple;
  if (sign === CITY.signSword || sign === CITY.signShield || theme === 'forge') return CITY.awningRed;
  if (sign === CITY.signFishing || theme === 'fishing') return CITY.awningBlue;
  if (sign === CITY.signTailor || theme === 'tailor') return CITY.awningPurple;
  return CITY.awningGreen;
}

function drawAsterfallBuildingExterior(region, spec, roofRows, doorX, doorWidth) {
  const {
    gx,
    gy,
    w,
    h,
    roof,
    facade,
    theme = 'house',
    sign = null,
  } = spec;
  const ridgeX = gx + Math.floor(w / 2);
  for (let row = 0; row < roofRows; row += 1) {
    const progress = row / Math.max(1, roofRows - 1);
    const margin = Math.max(0, Math.floor((1 - progress) * Math.min(8, Math.floor(w / 6))));
    const tile = row >= roofRows - 2 ? CITY.roofEdge : roof;
    for (let xx = gx + margin; xx < gx + w - margin; xx += 1) {
      setCityTile(region, 'cityRoofs', xx, gy + row, tile);
    }
    if (row > 1 && row < roofRows - 2) {
      setCityTile(region, 'cityRoofs', ridgeX, gy + row, CITY.roofEdge);
      if (w > 26) setCityTile(region, 'cityRoofs', ridgeX - 1, gy + row, CITY.roofEdge);
    }
  }

  const facadeY = gy + roofRows;
  const facadeH = h - roofRows;
  fillCityRect(region, 'cityRoofs', gx + 1, facadeY, w - 2, facadeH, facade);
  fillCityRect(region, 'cityRoofs', gx + 1, facadeY, w - 2, 1, CITY.roofEdge);
  for (let xx = gx + 3; xx < gx + w - 3; xx += 5) {
    setCityTile(region, 'cityRoofs', xx, facadeY + 1, facade === CITY.facadeStone ? CITY.facadeStone : CITY.facadeWood);
  }

  const windowRows = facadeH > 10 ? [gy + h - 8, gy + h - 4] : [gy + h - 4];
  windowRows.forEach((windowY, rowIndex) => {
    for (let xx = gx + 4 + (rowIndex % 2) * 2; xx < gx + w - 4; xx += 7) {
      if (windowY >= gy + h - 3) continue;
      if (xx >= doorX - 2 && xx <= doorX + doorWidth + 1) continue;
      setCityTile(region, 'cityRoofs', xx, windowY, CITY.window);
    }
  });

  fillCityRect(region, 'cityRoofs', doorX, gy + h - 3, doorWidth, 2, CITY.door);
  setCityTile(region, 'cityRoofs', doorX + Math.floor(doorWidth / 2), gy + h - 5, cityBuildingAwningForTheme(theme, sign));
  if (sign) setCityTile(region, 'cityRoofs', doorX + doorWidth + 1, gy + h - 5, sign);

  const chimneyCount = w > 42 ? 2 : 1;
  for (let i = 0; i < chimneyCount; i += 1) {
    const chimneyX = gx + w - 6 - i * Math.max(8, Math.floor(w / 3));
    if (chimneyX > gx + 3) setCityTile(region, 'cityRoofs', chimneyX, gy + 2 + i, CITY.chimney);
  }

  if (theme === 'forge' || theme === 'mining') {
    setCityTile(region, 'cityBase', gx + 3, gy + h, CITY.oreCart);
  } else if (theme === 'stable') {
    setCityTile(region, 'cityBase', gx + 3, gy + h, CITY.waterTrough);
  } else if (theme === 'inn') {
    setCityTile(region, 'cityBase', gx + w - 4, gy + h, CITY.bench);
  } else if (theme === 'bank') {
    setCityTile(region, 'cityBase', gx + w - 4, gy + h, CITY.signBank);
  } else if (theme === 'alchemy') {
    setCityTile(region, 'cityBase', gx + w - 4, gy + h, CITY.planter);
  }
}

function placeInteriorFurniture(region, gx, gy, w, h, theme) {
  const centerX = gx + Math.floor(w / 2);
  const centerY = gy + Math.floor(h / 2);
  const right = gx + w - 1;
  const bottom = gy + h - 1;
  const put = (x, y, tile) => {
    if (x <= gx || y <= gy || x >= right || y >= bottom) return;
    setCityTile(region, 'cityInteriors', x, y, tile);
  };
  const lineH = (x, y, len, tile) => {
    for (let xx = x; xx < x + len; xx += 1) put(xx, y, tile);
  };
  const lineV = (x, y, len, tile) => {
    for (let yy = y; yy < y + len; yy += 1) put(x, yy, tile);
  };
  const rug = theme === 'bank' || theme === 'auction' || theme === 'chapel' || theme === 'civic' ? CITY.rugGold : CITY.rugBlue;
  if (w > 9 && h > 8) {
    lineH(centerX - 3, centerY - 1, 7, rug);
    lineH(centerX - 3, centerY, 7, rug);
  }
  if (theme === 'bank') {
    lineH(gx + 3, bottom - 3, w - 6, CITY.counterH);
    put(right - 3, gy + 2, CITY.bankVault);
    put(right - 4, gy + 2, CITY.bankVault);
    put(right - 5, gy + 2, CITY.goldStack);
    put(gx + 2, gy + 2, CITY.civicDesk);
    put(gx + 3, gy + 2, CITY.goldStack);
  } else if (theme === 'auction') {
    lineH(gx + 3, bottom - 3, w - 6, CITY.counterH);
    put(centerX, centerY, CITY.auctionDesk);
    put(gx + 2, gy + 2, CITY.crateStack);
    put(right - 2, gy + 2, CITY.barrelStack);
    put(centerX - 2, gy + 3, CITY.table);
  } else if (theme === 'inn') {
    [gx + 3, gx + 7, centerX].forEach((x) => put(x, gy + 3, CITY.table));
    put(right - 4, gy + 2, CITY.bed);
    put(right - 7, gy + 2, CITY.bed);
    lineH(gx + 3, bottom - 3, w - 6, CITY.counterH);
    put(gx + 2, bottom - 4, CITY.barrelStack);
  } else if (theme === 'forge' || theme === 'weaponsmith' || theme === 'armorer') {
    put(centerX - 1, centerY, CITY.forge);
    put(centerX + 1, centerY, CITY.anvil);
    put(gx + 2, bottom - 2, CITY.oreCart);
    put(right - 2, bottom - 2, theme === 'armorer' ? CITY.armorStand : CITY.weaponRack);
    lineH(gx + 3, gy + 2, Math.min(6, w - 6), CITY.weaponRack);
  } else if (theme === 'alchemy') {
    put(gx + 2, gy + 2, CITY.alchemyShelf);
    put(right - 2, gy + 2, CITY.alchemyShelf);
    put(centerX, centerY, CITY.potionTable);
    lineH(gx + 3, bottom - 3, w - 6, CITY.counterH);
  } else if (theme === 'arcane') {
    put(gx + 2, gy + 2, CITY.arcaneShelf);
    put(right - 2, gy + 2, CITY.arcaneShelf);
    put(centerX, centerY, CITY.arcaneRune);
    lineH(centerX - 2, centerY + 2, 5, CITY.rugBlue);
  } else if (theme === 'fishing') {
    put(gx + 2, gy + 2, CITY.fishRack);
    put(right - 2, gy + 2, CITY.waterTrough);
    put(centerX, centerY, CITY.table);
    lineH(gx + 3, bottom - 3, w - 6, CITY.counterH);
  } else if (theme === 'mining') {
    put(gx + 2, gy + 2, CITY.oreCart);
    put(centerX, centerY, CITY.anvil);
    put(right - 2, gy + 2, CITY.professionBench);
    lineH(gx + 3, bottom - 3, w - 6, CITY.counterH);
  } else if (theme === 'tailor') {
    put(gx + 2, gy + 2, CITY.clothRack);
    put(right - 2, gy + 2, CITY.clothRack);
    put(centerX, centerY, CITY.table);
    lineH(gx + 3, bottom - 3, w - 6, CITY.counterH);
  } else if (theme === 'leather') {
    put(gx + 2, gy + 2, CITY.leatherRack);
    put(right - 2, gy + 2, CITY.leatherRack);
    put(centerX, centerY, CITY.professionBench);
    lineH(gx + 3, bottom - 3, w - 6, CITY.counterH);
  } else if (theme === 'profession') {
    put(gx + 2, gy + 2, CITY.professionBench);
    put(centerX, centerY, CITY.table);
    put(right - 2, gy + 2, CITY.shelf);
  } else if (theme === 'stable') {
    for (let xx = gx + 2; xx < right - 1; xx += 4) {
      put(xx, gy + 2, CITY.stableStall);
      put(xx + 1, gy + 2, CITY.stableFeed);
    }
    put(centerX, bottom - 2, CITY.waterTrough);
  } else if (theme === 'chapel') {
    put(centerX, gy + 3, CITY.chapelAltar);
    lineH(centerX - 3, centerY, 7, CITY.rugGold);
    put(gx + 3, bottom - 3, CITY.bench);
    put(right - 3, bottom - 3, CITY.bench);
  } else if (theme === 'civic') {
    put(centerX, gy + 3, CITY.civicDesk);
    lineH(gx + 4, centerY, Math.max(3, w - 8), CITY.bench);
    put(gx + 2, gy + 2, CITY.bannerBlue);
    put(right - 2, gy + 2, CITY.bannerRed);
  } else {
    put(gx + 2, gy + 2, CITY.table);
    put(right - 2, bottom - 2, CITY.shelf);
    if (w > 12) put(centerX, gy + 3, CITY.bed);
  }
}

function placeAsterfallCityBuilding(region, spec) {
  const prefab = CITY_BUILDING_PREFABS[spec.prefabKey ?? spec.prefab ?? spec.theme] ?? CITY_BUILDING_PREFABS.rowHouseRed;
  const {
    name,
    gx,
    gy,
    displayName,
    serviceType = null,
    doorOffset = Math.floor(prefab.w / 2) - 1,
    doorWidth = prefab.w >= 16 ? 2 : 1,
  } = spec;
  const w = prefab.w;
  const h = prefab.h;
  const theme = spec.theme ?? prefab.theme ?? 'house';
  const interiorY = gy;
  const interiorH = h;
  const interiorId = cityInteriorIdForBuildingName(name);

  clearAllCityLayers(region, gx - 1, gy - 1, w + 2, h + 4);
  stampCityPrefab(region, 'cityInteriors', gx, gy, prefab.interior, w, h);
  stampCityPrefab(region, 'cityRoofs', gx, gy, prefab.exterior, w, h);
  const doorX = gx + doorOffset;
  placeCityDoorstep(region, doorX + Math.floor(doorWidth / 2), gy + h, Math.max(5, doorWidth + 3));
  if (prefab.sign) setCityTile(region, 'cityBase', doorX + doorWidth + 2, gy + h, prefab.sign);
  if (theme === 'forge' || theme === 'weaponsmith' || theme === 'armorer' || theme === 'mining') {
    placeCityClutter(region, gx + w - 2, gy + h + 1, CITY.oreCart);
  } else if (theme === 'stable') {
    placeCityClutter(region, gx + 2, gy + h + 1, CITY.waterTrough);
  } else if (theme === 'inn' || theme === 'market') {
    placeCityClutter(region, gx + 1, gy + h + 1, CITY.bench);
  }
  fillCollisionFrame(region, gx, gy, w, h, doorOffset, doorWidth);
  clearCollisionRect(region, doorX, gy + h - 1, doorWidth, 3);

  region.objects.landmarks.push(rectObject(name, toLocal(region, gx, gy).x, toLocal(region, gx, gy).y, w, h, {
    type: 'building',
    buildingType: theme,
    prefabId: name,
    displayName,
    showOnMap: false,
    debugOnly: true,
  }));
  addObjectRect(region, 'interiorZones', interiorId, gx + 1, interiorY + 1, w - 2, interiorH - 2, {
    type: 'buildingInterior',
    buildingId: name,
    interiorId,
    displayName,
    roofLayer: 'CityRoofs',
    roofHide: true,
    interiorFocus: true,
    doorX: doorX + Math.floor(doorWidth / 2),
    doorY: gy + h,
    serviceType: serviceType ?? undefined,
    debugOnly: true,
  });
}

function clearCityFootprint(region, gx, gy, w, h, biomeId = 'emerald_vale') {
  const biome = BIOME_BY_ID[biomeId] ?? BIOME_BY_ID.emerald_vale;
  const { x, y } = toLocal(region, gx, gy);
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= REGION_TILES || yy >= REGION_TILES) continue;
      const detail = hash(region.worldX + xx, region.worldY + yy, 912) > 0.84 ? TILES.alt : TILES.base;
      setTile(region.ground, xx, yy, gid(biome, detail));
      setTile(region.water, xx, yy, 0);
      setTile(region.terrainDetails, xx, yy, 0);
      setTile(region.roads, xx, yy, 0);
      setTile(region.cityBase, xx, yy, 0);
      setTile(region.cityInteriors, xx, yy, 0);
      setTile(region.decor, xx, yy, 0);
      setTile(region.buildings, xx, yy, 0);
      setTile(region.cityRoofs, xx, yy, 0);
      setTile(region.collision, xx, yy, 0);
    }
  }
}

function placeAsterfallHubContentRedesigned(region) {
  if (region.rx !== 0 || region.ry !== 0) return;

  const cx = 608;
  const cy = 420;
  clearCityFootprint(region, cx - 206, cy - 206, 392, 410, 'emerald_vale');

  addObjectRect(region, 'zones', 'zone_asterfall_city_hub', 416, 252, 376, 358, {
    type: 'safe_zone',
    zoneId: 'asterfall_city',
    displayName: 'Asterfall City',
    description: 'Level 10-15 post-starting-zone city hub',
    recommendedLevel: 10,
    minLevel: 10,
    maxLevel: 15,
    allowEnemies: false,
    showOnMap: true,
    debugOnly: false,
  });
  addObjectRect(region, 'zones', 'leveling_zone_asterfall_outskirts_10_15', 330, 158, 462, 620, {
    type: 'leveling_zone',
    zoneId: 'asterfall_outskirts',
    displayName: 'Asterfall Outskirts',
    description: 'Level 10-15 fields, roads, and forest threats outside Asterfall City',
    recommendedLevel: 10,
    minLevel: 10,
    maxLevel: 15,
    showOnMap: true,
    debugOnly: false,
  });

  fillCityRect(region, 'cityBase', cx - 188, cy + 4, 374, 18, CITY.cobbleDark);
  fillCityRect(region, 'cityBase', cx - 10, cy - 166, 20, 358, CITY.cobbleDark);
  fillCityRect(region, 'cityBase', cx - 174, cy - 132, 348, 12, CITY.cobbleAlt);
  fillCityRect(region, 'cityBase', cx - 174, cy - 90, 348, 12, CITY.cobbleAlt);
  fillCityRect(region, 'cityBase', cx - 174, cy + 82, 348, 12, CITY.cobbleAlt);
  fillCityRect(region, 'cityBase', cx - 174, cy + 110, 348, 12, CITY.cobbleAlt);
  fillCityRect(region, 'cityBase', cx - 174, cy + 160, 348, 12, CITY.cobbleAlt);
  fillCityRect(region, 'cityBase', cx - 136, cy - 128, 12, 274, CITY.cobbleAlt);
  fillCityRect(region, 'cityBase', cx + 132, cy - 138, 12, 278, CITY.cobbleAlt);
  fillCityRect(region, 'cityBase', cx - 60, cy - 44, 120, 92, CITY.cobbleAlt);
  fillCityRect(region, 'cityBase', cx - 42, cy - 28, 84, 60, CITY.cobble);
  fillCityRect(region, 'cityBase', cx - 192, cy - 158, 384, 8, CITY.cobbleDark);
  fillCityRect(region, 'cityBase', cx - 192, cy + 186, 384, 8, CITY.cobbleDark);
  fillCityRect(region, 'cityBase', cx - 192, cy - 158, 8, 352, CITY.cobbleDark);
  fillCityRect(region, 'cityBase', cx + 184, cy - 158, 8, 352, CITY.cobbleDark);
  placeAnimatedFountain(region, cx, cy);

  const buildings = [
    { name: 'asterfall_city_town_hall', displayName: 'Asterfall Town Hall', prefabKey: 'townHall', gx: cx - 9, gy: cy - 168, serviceType: 'civic' },
    { name: 'asterfall_city_guard_post', displayName: 'Asterfall Guard Hall', prefabKey: 'guardPost', gx: cx - 90, gy: cy - 146, serviceType: 'guard' },
    { name: 'asterfall_city_weaponsmith', displayName: 'Asterfall Weaponsmith', prefabKey: 'weaponsmith', gx: cx + 66, gy: cy - 145, serviceType: 'vendor' },
    { name: 'asterfall_city_blacksmith', displayName: 'Asterfall Forge', prefabKey: 'blacksmith', gx: cx + 111, gy: cy - 146, serviceType: 'repair' },
    { name: 'asterfall_city_mining_office', displayName: 'Asterfall Mining Office', prefabKey: 'miningOffice', gx: cx + 151, gy: cy - 104, serviceType: 'professionTrainer' },
    { name: 'asterfall_city_bank', displayName: 'Asterfall Bank', prefabKey: 'bank', gx: cx - 154, gy: cy - 104, serviceType: 'bank' },
    { name: 'asterfall_city_auction_house', displayName: 'Asterfall Auction House', prefabKey: 'auctionHouse', gx: cx + 118, gy: cy - 104, serviceType: 'auction' },
    { name: 'asterfall_city_general_goods', displayName: 'Asterfall General Goods', prefabKey: 'generalGoods', gx: cx - 92, gy: cy - 22, serviceType: 'vendor' },
    { name: 'asterfall_city_market_hall', displayName: 'Asterfall Market Hall', prefabKey: 'marketHall', gx: cx - 10, gy: cy - 18, serviceType: 'vendor' },
    { name: 'asterfall_city_armorer', displayName: 'Asterfall Armorer', prefabKey: 'armorer', gx: cx + 92, gy: cy - 24, serviceType: 'vendor' },
    { name: 'asterfall_city_inn', displayName: 'Asterfall Inn', prefabKey: 'inn', gx: cx - 170, gy: cy + 64, serviceType: 'inn' },
    { name: 'asterfall_city_alchemy_shop', displayName: 'Asterfall Alchemy Shop', prefabKey: 'alchemy', gx: cx + 48, gy: cy + 64, serviceType: 'vendor' },
    { name: 'asterfall_city_arcane_shop', displayName: 'Asterfall Arcane Shop', prefabKey: 'arcane', gx: cx + 95, gy: cy + 64, serviceType: 'vendor' },
    { name: 'asterfall_city_fishing_lodge', displayName: 'Asterfall Fishing Lodge', prefabKey: 'fishingLodge', gx: cx - 178, gy: cy + 144, serviceType: 'professionTrainer' },
    { name: 'asterfall_city_tailor', displayName: 'Asterfall Tailor', prefabKey: 'tailor', gx: cx - 86, gy: cy + 144, serviceType: 'professionTrainer' },
    { name: 'asterfall_city_leatherworker', displayName: 'Asterfall Leatherworker', prefabKey: 'leatherworker', gx: cx - 42, gy: cy + 144, serviceType: 'professionTrainer' },
    { name: 'asterfall_city_stable', displayName: 'Asterfall Stable', prefabKey: 'stable', gx: cx + 54, gy: cy + 145, serviceType: 'vendor' },
    { name: 'asterfall_city_chapel', displayName: 'Asterfall Chapel', prefabKey: 'chapel', gx: cx + 145, gy: cy + 126, serviceType: 'chapel' },
  ];
  const cityBuildingByName = new Map(buildings.map((building) => {
    const prefab = CITY_BUILDING_PREFABS[building.prefabKey];
    return [building.name, { ...building, w: prefab.w, h: prefab.h, theme: prefab.theme }];
  }));
  const placeCityBuilding = (building) => {
    const prefab = CITY_BUILDING_PREFABS[building.prefabKey ?? building.prefab ?? building.theme] ?? CITY_BUILDING_PREFABS.rowHouseRed;
    placeAsterfallCityBuilding(region, building);
    const doorX = building.gx + (building.doorOffset ?? Math.floor(prefab.w / 2) - 1) + Math.floor((building.doorWidth ?? (prefab.w >= 16 ? 2 : 1)) / 2);
    fillCityRect(region, 'cityBase', doorX - 2, building.gy + prefab.h + 2, 5, 5, CITY.cobbleAlt);
    if (prefab.w > 11) {
      placeCityClutter(region, building.gx + 1, building.gy + prefab.h + 2, CITY.planter);
      placeCityClutter(region, building.gx + prefab.w - 2, building.gy + prefab.h + 2, CITY.planter);
    }
  };
  buildings.forEach(placeCityBuilding);

  [
    ['asterfall_city_west_row_01', 'West Rowhouse', 'rowHouseRed', cx - 180, cy - 34],
    ['asterfall_city_west_row_02', 'West Rowhouse', 'rowHouseGreen', cx - 136, cy - 34],
    ['asterfall_city_east_row_01', 'East Rowhouse', 'rowHouseGreen', cx + 34, cy - 34],
    ['asterfall_city_east_row_02', 'East Rowhouse', 'rowHouseRed', cx + 76, cy - 34],
    ['asterfall_city_south_row_01', 'South Rowhouse', 'rowHouseRed', cx - 132, cy + 144],
    ['asterfall_city_south_row_02', 'South Rowhouse', 'rowHouseGreen', cx + 8, cy + 144],
    ['asterfall_city_south_row_03', 'South Rowhouse', 'rowHouseRed', cx + 118, cy + 144],
    ['asterfall_city_north_row_01', 'North Rowhouse', 'rowHouseGreen', cx - 142, cy - 146],
  ].forEach(([name, displayName, prefabKey, gx, gy]) => placeCityBuilding({
    name,
    displayName,
    prefabKey,
    gx,
    gy,
  }));

  [
    [cx - 54, cy - 34, CITY.bench], [cx + 54, cy - 34, CITY.bench], [cx - 54, cy + 40, CITY.bench], [cx + 54, cy + 40, CITY.bench],
    [cx - 42, cy + 56, CITY.marketAwning], [cx - 28, cy + 56, CITY.crateStack], [cx + 28, cy + 56, CITY.barrelStack], [cx + 42, cy + 56, CITY.marketAwning],
    [cx - 170, cy + 76, CITY.cartLarge], [cx - 162, cy + 82, CITY.crateStack], [cx + 154, cy - 72, CITY.oreCart],
    [cx + 166, cy - 70, CITY.barrelStack], [cx - 154, cy + 142, CITY.waterTrough], [cx + 142, cy + 142, CITY.planter],
    [cx - 44, cy - 112, CITY.bannerBlue], [cx + 44, cy - 112, CITY.bannerRed], [cx - 18, cy - 48, CITY.planter], [cx + 18, cy - 48, CITY.planter],
  ].forEach(([x, y, tile]) => placeCityClutter(region, x, y, tile));
  [
    [cx - 64, cy - 48], [cx + 64, cy - 48], [cx - 66, cy + 56], [cx + 66, cy + 56],
    [cx - 178, cy - 12], [cx + 178, cy - 12], [cx - 24, cy - 118], [cx + 24, cy - 118],
    [cx - 24, cy + 134], [cx + 24, cy + 134], [cx - 150, cy - 72], [cx + 150, cy - 72],
  ].forEach(([x, y]) => placeCityStreetLamp(region, x, y));

  placeBuilding(region, cx - 200, cy - 150, 'watchtower', 'asterfall_west_watchtower');
  placeBuilding(region, cx + 174, cy - 150, 'watchtower', 'asterfall_east_watchtower');
  placeBuilding(region, cx - 3, cy - 188, 'gatehouse', 'asterfall_north_gatehouse');
  placeFenceLine(region, cx - 190, cy - 158, 132, true);
  placeFenceLine(region, cx + 58, cy - 158, 132, true);
  placeFenceLine(region, cx - 190, cy + 182, 132, true);
  placeFenceLine(region, cx + 58, cy + 182, 132, true);

  addObjectPoint(region, 'raceStarts', 'asterfall_city_arrival', cx + 18, cy + 24, {
    type: 'player_start',
    spawnId: 'asterfall_city_arrival',
    displayName: 'Asterfall City Arrival Plaza',
    facing: -1.57,
    recommendedLevel: 10,
    showOnMap: true,
    debugOnly: false,
  });
  addObjectPoint(region, 'graveyards', 'asterfall_city_graveyard', cx + 116, cy + 126, {
    type: 'graveyard',
    displayName: 'Asterfall Chapel Graveyard',
    facing: -1.57,
    showOnMap: false,
    debugOnly: false,
  });

  addObjectPoint(region, 'questGivers', 'questgiver_asterfall_quartermaster', cx - 18, cy + 24, {
    type: 'questgiver',
    questGiverId: 'asterfall-quartermaster',
    displayName: 'Quartermaster Vale',
    title: 'Asterfall Quartermaster',
    dialogue: 'Welcome to Asterfall. The roads outside the gate need steady hands.',
    interactRange: 120,
  });
  addObjectPoint(region, 'questGivers', 'questgiver_captain_arden', cx - 55, cy - 118, {
    type: 'questgiver',
    questGiverId: 'captain-arden',
    displayName: 'Captain Arden',
    title: 'City Guard Captain',
    dialogue: 'Bandits test the north road every night. Break their courage.',
    interactRange: 110,
  });
  addObjectPoint(region, 'questGivers', 'questgiver_huntmaster_brann', cx - 186, cy + 4, {
    type: 'questgiver',
    questGiverId: 'huntmaster-brann',
    displayName: 'Huntmaster Brann',
    title: 'Outskirts Warden',
    dialogue: 'The old grove has teeth. Keep your eyes open beyond the hedges.',
    interactRange: 110,
  });
  addObjectPoint(region, 'questGivers', 'questgiver_sister_maera', cx + 116, cy + 112, {
    type: 'questgiver',
    questGiverId: 'sister-maera',
    displayName: 'Sister Maera',
    title: 'Chapel Keeper',
    dialogue: 'Something is twisting the trees near the southern copse.',
    interactRange: 110,
  });

  const npcColor = '#8be9fd';
  const pointInsideBuilding = (buildingName, px = 0.5, py = 0.66) => {
    const building = cityBuildingByName.get(buildingName);
    if (!building) return { x: cx, y: cy, interiorId: '', buildingId: '' };
    return {
      x: building.gx + Math.floor(building.w * px),
      y: building.gy + 1 + Math.floor(Math.max(2, building.h - 2) * py),
      interiorId: cityInteriorIdForBuildingName(building.name),
      buildingId: building.name,
    };
  };
  [
    ['npc_iriam_banker', 'asterfall_city_bank', 0.54, 0.64, 'Iriam Goldwake', 'banker', '#facc15', 'bank', 'bank', null],
    ['npc_maeve_auctioneer', 'asterfall_city_auction_house', 0.52, 0.64, 'Maeve Highbid', 'auctioneer', '#e879f9', 'auction', 'auction', null],
    ['npc_hollis_innkeeper', 'asterfall_city_inn', 0.56, 0.68, 'Hollis Hearth', 'innkeeper', '#fbbf24', 'inn', 'inn', null],
    ['npc_mira_general_goods', 'asterfall_city_general_goods', 0.52, 0.68, 'Mira the Provisioner', 'shopkeeper', '#c084fc', 'vendor', 'general', null],
    ['npc_tomas_market_vendor', 'asterfall_city_market_hall', 0.50, 0.66, 'Tomas Greenstall', 'shopkeeper', '#86efac', 'vendor', 'general', null],
    ['npc_ren_alchemist', 'asterfall_city_alchemy_shop', 0.52, 0.66, 'Ren Willowglass', 'alchemist', '#5eead4', 'vendor', 'alchemy', null],
    ['npc_velis_arcane_vendor', 'asterfall_city_arcane_shop', 0.52, 0.66, 'Velis Starquill', 'mage_vendor', '#818cf8', 'vendor', 'arcane', null],
    ['npc_weaponmaster_varn', 'asterfall_city_weaponsmith', 0.52, 0.66, 'Varn Ironedge', 'weaponsmith', '#f97316', 'vendor', 'weaponsmith', null],
    ['npc_borin_repair_smith', 'asterfall_city_blacksmith', 0.52, 0.66, 'Borin Anvilhand', 'blacksmith', '#f97316', 'repair', 'armorer', 'blacksmithing'],
    ['npc_ellian_blacksmithing_trainer', 'asterfall_city_blacksmith', 0.32, 0.54, 'Ellian Brightblade', 'trainer', '#60a5fa', 'professionTrainer', 'profession', 'blacksmithing'],
    ['npc_sera_armorer', 'asterfall_city_armorer', 0.52, 0.66, 'Sera Platehand', 'armorer', '#fb923c', 'vendor', 'armorer', null],
    ['npc_nessa_fishing_trainer', 'asterfall_city_fishing_lodge', 0.52, 0.66, 'Nessa Reedline', 'trainer', '#38bdf8', 'professionTrainer', 'profession', 'fishing'],
    ['npc_grum_mining_trainer', 'asterfall_city_mining_office', 0.52, 0.66, 'Grum Stonepick', 'trainer', '#94a3b8', 'professionTrainer', 'profession', 'mining'],
    ['npc_silva_tailor', 'asterfall_city_tailor', 0.52, 0.66, 'Silva Threadwise', 'trainer', '#f0abfc', 'professionTrainer', 'profession', 'tailoring'],
    ['npc_kellan_leatherworker', 'asterfall_city_leatherworker', 0.52, 0.66, 'Kellan Hidebinder', 'trainer', '#a3e635', 'professionTrainer', 'profession', 'leatherworking'],
    ['npc_corra_stablemaster', 'asterfall_city_stable', 0.50, 0.66, 'Corra Stablemaster', 'stablemaster', '#facc15', 'vendor', 'stable', null],
  ].forEach(([name, buildingName, px, py, displayName, npcType, color, serviceType, shopType, professionId]) => {
    const point = pointInsideBuilding(buildingName, px, py);
    addObjectPoint(region, 'npcs', name, point.x, point.y, {
      type: npcType,
      npcType,
      displayName,
      color,
      serviceType: serviceType ?? undefined,
      shopType: shopType ?? undefined,
      professionId: professionId ?? undefined,
      interiorId: point.interiorId,
      buildingId: point.buildingId,
      interactRange: serviceType ? 116 : 72,
      showOnMap: false,
    });
  });
  [
    ['npc_gate_guard_west', cx - 24, cy - 144, 'Asterfall Guard', 'guard', '#94a3b8', null, null, null],
    ['npc_gate_guard_east', cx + 26, cy - 144, 'Asterfall Guard', 'guard', '#94a3b8', null, null, null],
    ['npc_city_citizen_01', cx - 62, cy + 4, 'Lysa Fen', 'citizen', npcColor, null, null, null],
    ['npc_city_citizen_02', cx + 62, cy + 8, 'Old Marrin', 'citizen', npcColor, null, null, null],
    ['npc_city_citizen_03', cx - 38, cy - 28, 'Pella Dawn', 'citizen', npcColor, null, null, null],
    ['npc_city_citizen_04', cx + 24, cy + 78, 'Rook Vale', 'citizen', npcColor, null, null, null],
    ['npc_patrol_guard_01', cx - 144, cy - 72, 'Asterfall Patrol', 'guard', '#94a3b8', null, null, null],
    ['npc_patrol_guard_02', cx + 146, cy + 34, 'Asterfall Patrol', 'guard', '#94a3b8', null, null, null],
  ].forEach(([name, x, y, displayName, npcType, color, serviceType, shopType, professionId]) => addObjectPoint(region, 'npcs', name, x, y, {
    type: npcType,
    npcType,
    displayName,
    color,
    serviceType: serviceType ?? undefined,
    shopType: shopType ?? undefined,
    professionId: professionId ?? undefined,
    interactRange: serviceType ? 116 : 72,
    showOnMap: false,
  }));

  addObjectRect(region, 'spawns', 'asterfall_north_road_bandits', 520, 154, 138, 86, {
    type: 'enemySpawn',
    spawnId: 'asterfall_north_road_bandits',
    zoneId: 'asterfall_outskirts',
    displayName: 'North Road Bandits',
    enemyType: 'road-bandit',
    questGiverId: 'captain-arden',
    questTitle: 'Bandits at the North Road',
    questDescription: 'Road bandits have set an ambush north-east of Asterfall. Clear them out before caravans return.',
    questObjectiveText: 'Defeat 10 Road Bandits',
    questRequired: 10,
    recommendedLevel: 10,
    minLevel: 10,
    maxLevel: 12,
    maxEnemies: 12,
    maxAlive: 8,
    respawnMin: 18000,
    respawnMax: 32000,
    movementMode: 'patrol',
  });
  addObjectRect(region, 'spawns', 'asterfall_west_dire_wolves', 430, 626, 128, 100, {
    type: 'enemySpawn',
    spawnId: 'asterfall_west_dire_wolves',
    zoneId: 'asterfall_outskirts',
    displayName: 'Greenwake Dire Wolves',
    enemyType: 'dire-wolf',
    questGiverId: 'huntmaster-brann',
    questTitle: 'Howls Beyond the Lodge',
    questDescription: 'Dire wolves are closing around Greenwake Lodge. Thin the pack before they reach the road.',
    questObjectiveText: 'Defeat 8 Dire Wolves',
    questRequired: 8,
    recommendedLevel: 12,
    minLevel: 11,
    maxLevel: 14,
    maxEnemies: 10,
    maxAlive: 7,
    respawnMin: 20000,
    respawnMax: 36000,
    movementMode: 'patrol',
  });
  addObjectRect(region, 'spawns', 'asterfall_south_corrupted_grove', 548, 626, 142, 102, {
    type: 'enemySpawn',
    spawnId: 'asterfall_south_corrupted_grove',
    zoneId: 'asterfall_outskirts',
    displayName: 'Corrupted Grove',
    enemyType: 'corrupted-treant',
    questGiverId: 'sister-maera',
    questTitle: 'Roots Gone Wrong',
    questDescription: 'The southern copse is waking angry. Burn back the corrupted growth before it reaches Asterfall.',
    questObjectiveText: 'Defeat 5 Corrupted Treants',
    questRequired: 5,
    recommendedLevel: 15,
    minLevel: 13,
    maxLevel: 15,
    maxEnemies: 6,
    maxAlive: 4,
    respawnMin: 26000,
    respawnMax: 42000,
    movementMode: 'roam-pause',
  });
  addObjectRect(region, 'spawns', 'asterfall_field_ambushers', 698, 656, 86, 102, {
    type: 'enemySpawn',
    spawnId: 'asterfall_field_ambushers',
    zoneId: 'asterfall_outskirts',
    displayName: 'Field Ambushers',
    enemyType: 'bandit',
    questGiverId: 'asterfall-quartermaster',
    questTitle: 'Secure the Arrival Road',
    questDescription: 'Fresh arrivals are being watched from the field paths. Sweep the ambushers away from the city approach.',
    questObjectiveText: 'Defeat 9 Bandits',
    questRequired: 9,
    recommendedLevel: 10,
    minLevel: 10,
    maxLevel: 13,
    maxEnemies: 11,
    maxAlive: 7,
    respawnMin: 18000,
    respawnMax: 34000,
    movementMode: 'patrol',
  });
}

function placeAsterfallHubContent(region) {
  return placeAsterfallHubContentRedesigned(region);

  if (region.rx !== 0 || region.ry !== 0) return;

  const cx = 608;
  const cy = 420;
  clearCityFootprint(region, cx - 154, cy - 142, 308, 278, 'emerald_vale');

  addObjectRect(region, 'zones', 'zone_asterfall_city_hub', 468, 286, 280, 250, {
    type: 'safe_zone',
    zoneId: 'asterfall_city',
    displayName: 'Asterfall City',
    description: 'Level 10-15 post-starting-zone city hub',
    recommendedLevel: 10,
    minLevel: 10,
    maxLevel: 15,
    allowEnemies: false,
    showOnMap: true,
    debugOnly: false,
  });
  addObjectRect(region, 'zones', 'leveling_zone_asterfall_outskirts_10_15', 338, 164, 450, 600, {
    type: 'leveling_zone',
    zoneId: 'asterfall_outskirts',
    displayName: 'Asterfall Outskirts',
    description: 'Level 10-15 fields, roads, and forest threats outside Asterfall City',
    recommendedLevel: 10,
    minLevel: 10,
    maxLevel: 15,
    showOnMap: true,
    debugOnly: false,
  });

  fillTerrainRect(region, cx - 146, cy - 116, 44, 32, TILES.flowers, 'emerald_vale');
  fillTerrainRect(region, cx + 104, cy - 112, 40, 30, TILES.flowers, 'emerald_vale');
  fillTerrainRect(region, cx - 142, cy + 92, 42, 32, TILES.crop, 'golden_fields');
  fillTerrainRect(region, cx + 94, cy + 96, 42, 30, TILES.crop, 'golden_fields');

  fillRoadRect(region, cx - 38, cy - 30, 78, 62, TILES.plaza);
  fillRoadRect(region, cx - 6, cy - 118, 13, 248, TILES.road);
  fillRoadRect(region, cx - 126, cy - 5, 258, 12, TILES.road);
  fillRoadRect(region, cx - 104, cy - 68, 214, 7, TILES.path);
  fillRoadRect(region, cx - 112, cy + 64, 226, 7, TILES.path);
  fillRoadRect(region, cx - 92, cy - 94, 7, 184, TILES.path);
  fillRoadRect(region, cx + 84, cy - 98, 7, 196, TILES.path);
  fillRoadRect(region, cx - 132, cy + 25, 82, 7, TILES.path);
  fillRoadRect(region, cx + 52, cy + 25, 96, 7, TILES.path);
  fillRoadRect(region, cx - 112, cy + 106, 226, 7, TILES.path);
  fillRoadRect(region, cx + 120, cy - 5, 76, 8, TILES.path);
  fillRoadRect(region, cx - 178, cy - 5, 62, 8, TILES.path);

  placeBuilding(region, cx - 4, cy - 122, 'gatehouse', 'asterfall_north_gatehouse');
  placeBuilding(region, cx - 98, cy - 116, 'watchtower', 'asterfall_west_watchtower');
  placeBuilding(region, cx + 96, cy - 116, 'watchtower', 'asterfall_east_watchtower');
  placeBuilding(region, cx - 4, cy - 78, 'townHall', 'asterfall_city_town_hall');
  placeBuilding(region, cx - 74, cy - 54, 'cityBank', 'asterfall_city_bank');
  placeBuilding(region, cx + 44, cy - 54, 'auctionHouse', 'asterfall_city_auction_house');
  placeBuilding(region, cx - 122, cy - 58, 'cityRow', 'asterfall_west_rowhouses');
  placeBuilding(region, cx + 116, cy - 56, 'cityStorage', 'asterfall_city_storage');
  placeBuilding(region, cx - 118, cy + 6, 'inn', 'asterfall_city_inn');
  placeBuilding(region, cx - 76, cy + 46, 'blueShop', 'asterfall_city_general_goods');
  placeBuilding(region, cx - 18, cy + 42, 'marketSet', 'asterfall_city_market_set');
  placeBuilding(region, cx + 46, cy + 38, 'alchemyShop', 'asterfall_city_alchemy_shop');
  placeBuilding(region, cx + 96, cy + 38, 'arcaneShop', 'asterfall_city_arcane_shop');
  placeBuilding(region, cx + 88, cy - 104, 'weaponsmithShop', 'asterfall_city_weaponsmith');
  placeBuilding(region, cx + 126, cy - 102, 'blacksmith', 'asterfall_city_blacksmith');
  placeBuilding(region, cx + 126, cy - 34, 'armorerShop', 'asterfall_city_armorer');
  placeBuilding(region, cx - 112, cy + 88, 'professionHall', 'asterfall_city_profession_hall');
  placeBuilding(region, cx - 50, cy + 90, 'tailorShop', 'asterfall_city_tailor');
  placeBuilding(region, cx + 12, cy + 90, 'leatherworkerShop', 'asterfall_city_leatherworker');
  placeBuilding(region, cx + 72, cy + 94, 'stable', 'asterfall_city_stable');
  placeBuilding(region, cx - 14, cy + 112, 'chapel', 'asterfall_city_chapel');
  placeBuilding(region, cx - 122, cy - 108, 'courtyardHouse', 'asterfall_northwest_courtyard_house');
  placeBuilding(region, cx + 42, cy - 122, 'towerHouse', 'asterfall_arcane_tower_house');
  placeBuilding(region, cx - 150, cy + 48, 'redTownhouse', 'asterfall_west_townhouse');
  placeBuilding(region, cx + 132, cy + 54, 'greenTownhouse', 'asterfall_east_townhouse');
  placeBuilding(region, cx + 18, cy - 118, 'barracks', 'asterfall_city_guard_post');
  placeBuilding(region, cx - 42, cy - 118, 'stoneManse', 'asterfall_city_command_house');

  [
    [cx - 4, cy - 116, 9, 4], [cx - 4, cy - 72, 9, 3], [cx - 74, cy - 48, 9, 3], [cx + 48, cy - 48, 10, 3],
    [cx - 118, cy + 12, 8, 3], [cx - 76, cy + 52, 7, 3], [cx + 50, cy + 44, 7, 3], [cx + 100, cy + 44, 7, 3],
    [cx + 90, cy - 98, 7, 3], [cx + 128, cy - 96, 7, 3], [cx + 128, cy - 28, 7, 3],
    [cx - 108, cy + 94, 9, 3], [cx - 48, cy + 96, 7, 3], [cx + 14, cy + 96, 7, 3],
    [cx + 76, cy + 100, 8, 3], [cx - 12, cy + 118, 7, 3],
  ].forEach(([x, y, width, height]) => placeEntranceMarker(region, x, y, { width, height, sign: false }));
  placeEntranceMarker(region, cx - 74, cy + 52, { width: 7, height: 3, sign: true });
  placeEntranceMarker(region, cx + 50, cy + 44, { width: 7, height: 3, sign: true });
  placeEntranceMarker(region, cx + 100, cy + 44, { width: 7, height: 3, sign: true });
  placeEntranceMarker(region, cx + 90, cy - 98, { width: 7, height: 3, sign: true });
  placeEntranceMarker(region, cx + 128, cy - 28, { width: 7, height: 3, sign: true });

  placeAnimatedFountain(region, cx, cy);
  placeCityMarket(region, cx - 8, cy + 40);
  placeProp(region, cx - 16, cy + 13, PROPS.sign, false);
  [
    [cx - 44, cy - 34], [cx + 44, cy - 34], [cx - 44, cy + 34], [cx + 44, cy + 34],
    [cx - 90, cy - 62], [cx + 90, cy - 62], [cx - 90, cy + 66], [cx + 90, cy + 66],
    [cx - 124, cy - 5], [cx + 124, cy - 5], [cx - 124, cy + 28], [cx + 124, cy + 28],
    [cx - 104, cy + 108], [cx + 104, cy + 108], [cx - 168, cy - 4], [cx + 166, cy - 4],
  ].forEach(([x, y]) => placeProp(region, x, y, PROPS.lamp, false));
  [
    [cx - 112, cy + 30, PROPS.cart], [cx - 106, cy + 32, PROPS.crate], [cx - 101, cy + 32, PROPS.barrel],
    [cx + 60, cy + 28, PROPS.barrel], [cx + 66, cy + 28, PROPS.crate], [cx + 112, cy - 86, PROPS.rockLarge],
    [cx + 118, cy - 84, PROPS.campfire], [cx + 134, cy - 86, PROPS.crate], [cx - 136, cy + 104, PROPS.hay],
    [cx - 130, cy + 108, PROPS.cart], [cx - 68, cy + 116, PROPS.flowerPatch], [cx + 22, cy + 116, PROPS.flowerPatch],
    [cx + 82, cy + 122, PROPS.hay], [cx + 104, cy + 122, PROPS.barrel], [cx - 36, cy - 116, PROPS.torch],
    [cx + 40, cy - 116, PROPS.torch], [cx - 54, cy - 26, PROPS.crate], [cx - 48, cy - 26, PROPS.barrel],
    [cx + 54, cy - 26, PROPS.crate], [cx + 60, cy - 26, PROPS.barrel], [cx - 30, cy + 54, PROPS.flowerPatch],
    [cx + 30, cy + 54, PROPS.flowerPatch], [cx - 150, cy + 72, PROPS.flowerPatch], [cx + 152, cy + 76, PROPS.flowerPatch],
  ].forEach(([x, y, tile]) => placeProp(region, x, y, tile, false));

  placeFenceLine(region, cx - 150, cy - 132, 92, true);
  placeFenceLine(region, cx + 58, cy - 132, 92, true);
  placeFenceLine(region, cx - 152, cy - 116, 226, false);
  placeFenceLine(region, cx + 154, cy - 116, 226, false);
  placeFenceLine(region, cx - 150, cy + 134, 102, true);
  placeFenceLine(region, cx + 48, cy + 134, 104, true);

  addObjectPoint(region, 'raceStarts', 'asterfall_city_arrival', cx, cy + 18, {
    type: 'player_start',
    spawnId: 'asterfall_city_arrival',
    displayName: 'Asterfall City Arrival Plaza',
    facing: -1.57,
    recommendedLevel: 10,
    showOnMap: true,
    debugOnly: false,
  });
  addObjectPoint(region, 'graveyards', 'asterfall_city_graveyard', cx - 6, cy + 130, {
    type: 'graveyard',
    displayName: 'Asterfall Chapel Graveyard',
    facing: -1.57,
    showOnMap: false,
    debugOnly: false,
  });

  [
    { name: 'interior_bank', gx: cx - 74, gy: cy - 50, w: 7, h: 4, buildingId: 'asterfall_city_bank', displayName: 'Asterfall Bank', theme: 'bank' },
    { name: 'interior_auction_house', gx: cx + 44, gy: cy - 50, w: 8, h: 4, buildingId: 'asterfall_city_auction_house', displayName: 'Asterfall Auction House', theme: 'auction' },
    { name: 'interior_inn', gx: cx - 118, gy: cy + 10, w: 6, h: 4, buildingId: 'asterfall_city_inn', displayName: 'Asterfall Inn', theme: 'inn' },
    { name: 'interior_general_goods', gx: cx - 76, gy: cy + 48, w: 5, h: 3, buildingId: 'asterfall_city_general_goods', displayName: 'Asterfall General Goods', theme: 'auction' },
    { name: 'interior_weaponsmith', gx: cx + 88, gy: cy - 100, w: 5, h: 3, buildingId: 'asterfall_city_weaponsmith', displayName: 'Asterfall Weaponsmith', theme: 'forge' },
    { name: 'interior_blacksmith_repair', gx: cx + 126, gy: cy - 98, w: 5, h: 3, buildingId: 'asterfall_city_blacksmith', displayName: 'Asterfall Forge', theme: 'forge' },
    { name: 'interior_armorer', gx: cx + 126, gy: cy - 30, w: 5, h: 3, buildingId: 'asterfall_city_armorer', displayName: 'Asterfall Armorer', theme: 'forge' },
    { name: 'interior_alchemy_shop', gx: cx + 46, gy: cy + 42, w: 5, h: 3, buildingId: 'asterfall_city_alchemy_shop', displayName: 'Asterfall Alchemy Shop', theme: 'alchemy' },
    { name: 'interior_arcane_shop', gx: cx + 96, gy: cy + 42, w: 5, h: 4, buildingId: 'asterfall_city_arcane_shop', displayName: 'Asterfall Arcane Shop', theme: 'arcane' },
    { name: 'interior_profession_hall', gx: cx - 112, gy: cy + 92, w: 7, h: 4, buildingId: 'asterfall_city_profession_hall', displayName: 'Asterfall Profession Hall', theme: 'profession' },
    { name: 'interior_tailor_shop', gx: cx - 50, gy: cy + 94, w: 5, h: 3, buildingId: 'asterfall_city_tailor', displayName: 'Asterfall Tailor', theme: 'profession' },
    { name: 'interior_leatherworker_shop', gx: cx + 12, gy: cy + 94, w: 5, h: 3, buildingId: 'asterfall_city_leatherworker', displayName: 'Asterfall Leatherworker', theme: 'profession' },
    { name: 'interior_stable', gx: cx + 72, gy: cy + 95, w: 6, h: 3, buildingId: 'asterfall_city_stable', displayName: 'Asterfall Stable', theme: 'profession' },
  ].forEach((interior) => addCityInterior(region, interior));

  addObjectPoint(region, 'questGivers', 'questgiver_asterfall_quartermaster', cx - 12, cy + 19, {
    type: 'questgiver',
    questGiverId: 'asterfall-quartermaster',
    displayName: 'Quartermaster Vale',
    title: 'Asterfall Quartermaster',
    dialogue: 'Welcome to Asterfall. The roads outside the gate need steady hands.',
    interactRange: 120,
  });
  addObjectPoint(region, 'questGivers', 'questgiver_captain_arden', cx + 22, cy - 104, {
    type: 'questgiver',
    questGiverId: 'captain-arden',
    displayName: 'Captain Arden',
    title: 'City Guard Captain',
    dialogue: 'Bandits test the north road every night. Break their courage.',
    interactRange: 110,
  });
  addObjectPoint(region, 'questGivers', 'questgiver_huntmaster_brann', cx - 166, cy + 8, {
    type: 'questgiver',
    questGiverId: 'huntmaster-brann',
    displayName: 'Huntmaster Brann',
    title: 'Outskirts Warden',
    dialogue: 'The old grove has teeth. Keep your eyes open beyond the hedges.',
    interactRange: 110,
  });
  addObjectPoint(region, 'questGivers', 'questgiver_sister_maera', cx - 6, cy + 124, {
    type: 'questgiver',
    questGiverId: 'sister-maera',
    displayName: 'Sister Maera',
    title: 'Chapel Keeper',
    dialogue: 'Something is twisting the trees near the southern copse.',
    interactRange: 110,
  });

  const npcColor = '#8be9fd';
  [
    ['npc_mira_general_goods', cx - 74, cy + 50, 'Mira the Provisioner', 'shopkeeper', '#c084fc', 'vendor', 'general', null],
    ['npc_tomas_market_vendor', cx + 4, cy + 44, 'Tomas Greenstall', 'shopkeeper', '#86efac', 'vendor', 'general', null],
    ['npc_weaponmaster_varn', cx + 90, cy - 98, 'Varn Ironedge', 'weaponsmith', '#f97316', 'vendor', 'weaponsmith', null],
    ['npc_borin_repair_smith', cx + 128, cy - 96, 'Borin Anvilhand', 'blacksmith', '#f97316', 'repair', 'armorer', null],
    ['npc_sera_armorer', cx + 128, cy - 28, 'Sera Platehand', 'armorer', '#fb923c', 'vendor', 'armorer', null],
    ['npc_ren_alchemist', cx + 48, cy + 44, 'Ren Willowglass', 'alchemist', '#5eead4', 'vendor', 'alchemy', null],
    ['npc_velis_arcane_vendor', cx + 98, cy + 44, 'Velis Starquill', 'mage_vendor', '#818cf8', 'vendor', 'arcane', null],
    ['npc_iriam_banker', cx - 72, cy - 48, 'Iriam Goldwake', 'banker', '#facc15', 'bank', 'bank', null],
    ['npc_maeve_auctioneer', cx + 47, cy - 48, 'Maeve Highbid', 'auctioneer', '#e879f9', 'auction', 'auction', null],
    ['npc_hollis_innkeeper', cx - 116, cy + 12, 'Hollis Hearth', 'innkeeper', '#fbbf24', 'inn', 'inn', null],
    ['npc_corra_stablemaster', cx + 74, cy + 96, 'Corra Stablemaster', 'stablemaster', '#facc15', 'vendor', 'stable', null],
    ['npc_ellian_trainer', cx - 110, cy + 94, 'Ellian Brightblade', 'trainer', '#60a5fa', 'professionTrainer', 'profession', 'blacksmithing'],
    ['npc_nessa_fishing_trainer', cx - 108, cy + 94, 'Nessa Reedline', 'trainer', '#38bdf8', 'professionTrainer', 'profession', 'fishing'],
    ['npc_grum_mining_trainer', cx - 106, cy + 94, 'Grum Stonepick', 'trainer', '#94a3b8', 'professionTrainer', 'profession', 'mining'],
    ['npc_silva_tailor', cx - 48, cy + 96, 'Silva Threadwise', 'trainer', '#f0abfc', 'professionTrainer', 'profession', 'tailoring'],
    ['npc_kellan_leatherworker', cx + 14, cy + 96, 'Kellan Hidebinder', 'trainer', '#a3e635', 'professionTrainer', 'profession', 'leatherworking'],
    ['npc_gate_guard_west', cx - 28, cy - 112, 'Asterfall Guard', 'guard', '#94a3b8', null, null, null],
    ['npc_gate_guard_east', cx + 30, cy - 112, 'Asterfall Guard', 'guard', '#94a3b8', null, null, null],
    ['npc_city_citizen_01', cx - 78, cy + 4, 'Lysa Fen', 'citizen', npcColor, null, null, null],
    ['npc_city_citizen_02', cx + 80, cy + 8, 'Old Marrin', 'citizen', npcColor, null, null, null],
    ['npc_city_citizen_03', cx - 28, cy - 8, 'Pella Dawn', 'citizen', npcColor, null, null, null],
    ['npc_city_citizen_04', cx + 20, cy + 78, 'Rook Vale', 'citizen', npcColor, null, null, null],
    ['npc_patrol_guard_01', cx - 132, cy - 44, 'Asterfall Patrol', 'guard', '#94a3b8', null, null, null],
    ['npc_patrol_guard_02', cx + 132, cy + 2, 'Asterfall Patrol', 'guard', '#94a3b8', null, null, null],
  ].forEach(([name, x, y, displayName, npcType, color, serviceType, shopType, professionId]) => addObjectPoint(region, 'npcs', name, x, y, {
    type: npcType,
    npcType,
    displayName,
    color,
    serviceType: serviceType ?? undefined,
    shopType: shopType ?? undefined,
    professionId: professionId ?? undefined,
    interactRange: serviceType ? 106 : 72,
    showOnMap: false,
  }));

  addObjectRect(region, 'spawns', 'asterfall_north_road_bandits', 520, 168, 138, 94, {
    type: 'enemySpawn',
    spawnId: 'asterfall_north_road_bandits',
    zoneId: 'asterfall_outskirts',
    displayName: 'North Road Bandits',
    enemyType: 'road-bandit',
    questGiverId: 'captain-arden',
    questTitle: 'Bandits at the North Road',
    questDescription: 'Road bandits have set an ambush north-east of Asterfall. Clear them out before caravans return.',
    questObjectiveText: 'Defeat 10 Road Bandits',
    questRequired: 10,
    recommendedLevel: 10,
    minLevel: 10,
    maxLevel: 12,
    maxEnemies: 12,
    maxAlive: 8,
    respawnMin: 18000,
    respawnMax: 32000,
    movementMode: 'patrol',
  });
  addObjectRect(region, 'spawns', 'asterfall_west_dire_wolves', 440, 600, 130, 105, {
    type: 'enemySpawn',
    spawnId: 'asterfall_west_dire_wolves',
    zoneId: 'asterfall_outskirts',
    displayName: 'Greenwake Dire Wolves',
    enemyType: 'dire-wolf',
    questGiverId: 'huntmaster-brann',
    questTitle: 'Howls Beyond the Lodge',
    questDescription: 'Dire wolves are closing around Greenwake Lodge. Thin the pack before they reach the road.',
    questObjectiveText: 'Defeat 8 Dire Wolves',
    questRequired: 8,
    recommendedLevel: 12,
    minLevel: 11,
    maxLevel: 14,
    maxEnemies: 10,
    maxAlive: 7,
    respawnMin: 20000,
    respawnMax: 36000,
    movementMode: 'patrol',
  });
  addObjectRect(region, 'spawns', 'asterfall_south_corrupted_grove', 548, 626, 142, 102, {
    type: 'enemySpawn',
    spawnId: 'asterfall_south_corrupted_grove',
    zoneId: 'asterfall_outskirts',
    displayName: 'Corrupted Grove',
    enemyType: 'corrupted-treant',
    questGiverId: 'sister-maera',
    questTitle: 'Roots Gone Wrong',
    questDescription: 'The southern copse is waking angry. Burn back the corrupted growth before it reaches Asterfall.',
    questObjectiveText: 'Defeat 5 Corrupted Treants',
    questRequired: 5,
    recommendedLevel: 15,
    minLevel: 13,
    maxLevel: 15,
    maxEnemies: 6,
    maxAlive: 4,
    respawnMin: 26000,
    respawnMax: 42000,
    movementMode: 'roam-pause',
  });
  addObjectRect(region, 'spawns', 'asterfall_field_ambushers', 706, 406, 78, 118, {
    type: 'enemySpawn',
    spawnId: 'asterfall_field_ambushers',
    zoneId: 'asterfall_outskirts',
    displayName: 'Field Ambushers',
    enemyType: 'bandit',
    questGiverId: 'asterfall-quartermaster',
    questTitle: 'Secure the Arrival Road',
    questDescription: 'Fresh arrivals are being watched from the field paths. Sweep the ambushers away from the city approach.',
    questObjectiveText: 'Defeat 9 Bandits',
    questRequired: 9,
    recommendedLevel: 10,
    minLevel: 10,
    maxLevel: 13,
    maxEnemies: 11,
    maxAlive: 7,
    respawnMin: 18000,
    respawnMax: 34000,
    movementMode: 'patrol',
  });
}

function placeAsterfallHubContentLegacy(region) {
  if (region.rx !== 0 || region.ry !== 0) return;

  const cx = 608;
  const cy = 420;
  clearCityFootprint(region, cx - 188, cy - 166, 374, 326, 'emerald_vale');

  addObjectRect(region, 'zones', 'zone_asterfall_city_hub', 430, 262, 330, 302, {
    type: 'safe_zone',
    zoneId: 'asterfall_city',
    displayName: 'Asterfall City',
    description: 'Level 10-15 post-starting-zone city hub',
    recommendedLevel: 10,
    minLevel: 10,
    maxLevel: 15,
    allowEnemies: false,
    showOnMap: true,
    debugOnly: false,
  });
  addObjectRect(region, 'zones', 'leveling_zone_asterfall_outskirts_10_15', 338, 164, 450, 600, {
    type: 'leveling_zone',
    zoneId: 'asterfall_outskirts',
    displayName: 'Asterfall Outskirts',
    description: 'Level 10-15 fields, roads, and forest threats outside Asterfall City',
    recommendedLevel: 10,
    minLevel: 10,
    maxLevel: 15,
    showOnMap: true,
    debugOnly: false,
  });

  fillTerrainRect(region, cx - 170, cy - 134, 42, 38, TILES.flowers, 'emerald_vale');
  fillTerrainRect(region, cx + 130, cy - 132, 34, 34, TILES.flowers, 'emerald_vale');
  fillTerrainRect(region, cx - 176, cy + 106, 44, 28, TILES.crop, 'golden_fields');
  fillTerrainRect(region, cx + 118, cy + 114, 38, 24, TILES.crop, 'golden_fields');

  fillRoadRect(region, cx - 34, cy - 23, 70, 50, TILES.plaza);
  fillRoadRect(region, cx - 5, cy - 152, 11, 304, TILES.road);
  fillRoadRect(region, cx - 162, cy - 5, 330, 10, TILES.road);
  fillRoadRect(region, cx - 142, cy - 84, 286, 7, TILES.path);
  fillRoadRect(region, cx - 145, cy + 74, 292, 7, TILES.path);
  fillRoadRect(region, cx - 116, cy - 124, 7, 206, TILES.path);
  fillRoadRect(region, cx + 118, cy - 122, 7, 204, TILES.path);
  fillRoadRect(region, cx - 166, cy + 38, 104, 7, TILES.path);
  fillRoadRect(region, cx + 62, cy + 38, 122, 7, TILES.path);
  fillRoadRect(region, cx - 136, cy + 122, 270, 8, TILES.path);
  fillRoadRect(region, cx + 154, cy - 5, 88, 7, TILES.path);
  fillRoadRect(region, cx - 196, cy - 5, 48, 8, TILES.path);

  placeBuilding(region, cx - 3, cy - 154, 'gatehouse', 'asterfall_north_gatehouse');
  placeBuilding(region, cx - 174, cy - 145, 'watchtower', 'asterfall_west_watchtower');
  placeBuilding(region, cx + 164, cy - 145, 'watchtower', 'asterfall_east_watchtower');
  placeBuilding(region, cx - 4, cy - 116, 'townHall', 'asterfall_city_town_hall');
  placeBuilding(region, cx - 86, cy - 78, 'cityBank', 'asterfall_city_bank');
  placeBuilding(region, cx + 42, cy - 78, 'auctionHouse', 'asterfall_city_auction_house');
  placeBuilding(region, cx - 148, cy - 84, 'cityRow', 'asterfall_west_rowhouses');
  placeBuilding(region, cx + 132, cy - 82, 'cityStorage', 'asterfall_city_storage');
  placeBuilding(region, cx - 146, cy - 24, 'inn', 'asterfall_city_inn');
  placeBuilding(region, cx - 82, cy + 34, 'blueShop', 'asterfall_city_general_goods');
  placeBuilding(region, cx - 18, cy + 42, 'marketSet', 'asterfall_city_market_set');
  placeBuilding(region, cx + 52, cy + 20, 'alchemyShop', 'asterfall_city_alchemy_shop');
  placeBuilding(region, cx + 110, cy + 18, 'arcaneShop', 'asterfall_city_arcane_shop');
  placeBuilding(region, cx + 116, cy - 36, 'weaponsmithShop', 'asterfall_city_weaponsmith');
  placeBuilding(region, cx + 150, cy + 66, 'armorerShop', 'asterfall_city_armorer');
  placeBuilding(region, cx + 118, cy + 104, 'blacksmith', 'asterfall_city_blacksmith');
  placeBuilding(region, cx - 142, cy + 82, 'professionHall', 'asterfall_city_profession_hall');
  placeBuilding(region, cx - 178, cy + 28, 'tailorShop', 'asterfall_city_tailor');
  placeBuilding(region, cx - 178, cy + 72, 'leatherworkerShop', 'asterfall_city_leatherworker');
  placeBuilding(region, cx - 48, cy + 104, 'chapel', 'asterfall_city_chapel');
  placeBuilding(region, cx + 12, cy + 104, 'stable', 'asterfall_city_stable');
  placeBuilding(region, cx - 108, cy - 134, 'courtyardHouse', 'asterfall_north_courtyard_house');
  placeBuilding(region, cx + 88, cy - 136, 'towerHouse', 'asterfall_arcane_tower_house');
  placeBuilding(region, cx - 178, cy - 40, 'redTownhouse', 'asterfall_red_townhouse');
  placeBuilding(region, cx - 154, cy + 122, 'greenTownhouse', 'asterfall_green_townhouse');
  placeBuilding(region, cx + 42, cy - 18, 'serviceKiosk', 'asterfall_plaza_service_kiosk');
  placeBuilding(region, cx + 20, cy - 146, 'barracks', 'asterfall_city_guard_post');

  placeProp(region, cx, cy - 2, PROPS.well, false);
  placeProp(region, cx - 13, cy + 8, PROPS.sign, false);
  placeCityMarket(region, cx - 2, cy + 36);
  [
    [cx - 42, cy - 38], [cx + 42, cy - 38], [cx - 42, cy + 38], [cx + 42, cy + 38],
    [cx - 116, cy - 4], [cx + 118, cy - 4], [cx - 116, cy + 76], [cx + 118, cy + 76],
    [cx - 152, cy - 84], [cx + 152, cy - 84], [cx - 152, cy + 122], [cx + 152, cy + 122],
    [cx - 182, cy - 5], [cx + 178, cy - 5], [cx - 174, cy + 42], [cx + 174, cy + 42],
  ].forEach(([x, y]) => placeProp(region, x, y, PROPS.lamp, false));
  [
    [cx - 134, cy - 18, PROPS.cart], [cx - 126, cy - 16, PROPS.crate], [cx - 121, cy - 16, PROPS.barrel],
    [cx + 86, cy - 20, PROPS.barrel], [cx + 93, cy - 18, PROPS.crate], [cx + 103, cy - 18, PROPS.crate],
    [cx + 126, cy + 88, PROPS.anvil], [cx + 130, cy + 91, PROPS.woodPile], [cx + 140, cy + 88, PROPS.crate],
    [cx - 130, cy + 136, PROPS.hay], [cx - 124, cy + 139, PROPS.cart], [cx - 72, cy + 132, PROPS.flowerPatch],
    [cx + 26, cy + 132, PROPS.flowerPatch], [cx + 62, cy + 134, PROPS.hay], [cx + 148, cy - 60, PROPS.sign],
    [cx - 36, cy - 145, PROPS.torch], [cx + 38, cy - 145, PROPS.torch],
    [cx - 70, cy - 32, PROPS.crate], [cx - 64, cy - 32, PROPS.barrel],
    [cx + 65, cy - 32, PROPS.crate], [cx + 71, cy - 32, PROPS.barrel],
  ].forEach(([x, y, tile]) => placeProp(region, x, y, tile, false));

  placeFenceLine(region, cx - 186, cy - 156, 126, true);
  placeFenceLine(region, cx + 62, cy - 156, 126, true);
  placeFenceLine(region, cx - 188, cy - 138, 252, false);
  placeFenceLine(region, cx + 188, cy - 138, 252, false);
  placeFenceLine(region, cx - 186, cy + 150, 116, true);
  placeFenceLine(region, cx + 76, cy + 150, 112, true);

  addObjectPoint(region, 'raceStarts', 'asterfall_city_arrival', cx, cy + 18, {
    type: 'player_start',
    spawnId: 'asterfall_city_arrival',
    displayName: 'Asterfall City Arrival Plaza',
    facing: -1.57,
    recommendedLevel: 10,
    showOnMap: true,
    debugOnly: false,
  });
  addObjectPoint(region, 'graveyards', 'asterfall_city_graveyard', cx - 34, cy + 124, {
    type: 'graveyard',
    displayName: 'Asterfall Chapel Graveyard',
    facing: -1.57,
    showOnMap: false,
    debugOnly: false,
  });

  [
    ['interior_inn', cx - 144, cy - 16, 56, 34, 'asterfall_city_inn', 'Asterfall Inn'],
    ['interior_bank', cx - 82, cy - 54, 66, 42, 'asterfall_city_bank', 'Asterfall Bank'],
    ['interior_auction_house', cx + 46, cy - 54, 74, 42, 'asterfall_city_auction_house', 'Asterfall Auction House'],
    ['interior_alchemy_shop', cx + 55, cy + 40, 46, 28, 'asterfall_city_alchemy_shop', 'Asterfall Alchemy Shop'],
    ['interior_arcane_shop', cx + 113, cy + 42, 46, 34, 'asterfall_city_arcane_shop', 'Asterfall Arcane Shop'],
    ['interior_weaponsmith', cx + 119, cy - 18, 46, 28, 'asterfall_city_weaponsmith', 'Asterfall Weaponsmith'],
    ['interior_armorer', cx + 153, cy + 84, 46, 28, 'asterfall_city_armorer', 'Asterfall Armorer'],
  ].forEach(([name, x, y, w, h, buildingId, displayName]) => addObjectRect(region, 'interiorZones', name, x, y, w, h, {
    type: 'buildingInterior',
    buildingId,
    displayName,
    roofLayer: 'Buildings',
    roofHide: true,
    debugOnly: true,
  }));

  addObjectPoint(region, 'questGivers', 'questgiver_asterfall_quartermaster', cx - 14, cy + 18, {
    type: 'questgiver',
    questGiverId: 'asterfall-quartermaster',
    displayName: 'Quartermaster Vale',
    title: 'Asterfall Quartermaster',
    dialogue: 'Welcome to Asterfall. The roads outside the gate need steady hands.',
    interactRange: 120,
  });
  addObjectPoint(region, 'questGivers', 'questgiver_captain_arden', cx + 36, cy - 118, {
    type: 'questgiver',
    questGiverId: 'captain-arden',
    displayName: 'Captain Arden',
    title: 'City Guard Captain',
    dialogue: 'Bandits test the north road every night. Break their courage.',
    interactRange: 110,
  });
  addObjectPoint(region, 'questGivers', 'questgiver_huntmaster_brann', cx - 176, cy + 18, {
    type: 'questgiver',
    questGiverId: 'huntmaster-brann',
    displayName: 'Huntmaster Brann',
    title: 'Outskirts Warden',
    dialogue: 'The old grove has teeth. Keep your eyes open beyond the hedges.',
    interactRange: 110,
  });
  addObjectPoint(region, 'questGivers', 'questgiver_sister_maera', cx - 42, cy + 126, {
    type: 'questgiver',
    questGiverId: 'sister-maera',
    displayName: 'Sister Maera',
    title: 'Chapel Keeper',
    dialogue: 'Something is twisting the trees near the southern copse.',
    interactRange: 110,
  });

  const npcColor = '#8be9fd';
  [
    ['npc_mira_general_goods', cx - 70, cy + 28, 'Mira the Provisioner', 'shopkeeper', '#c084fc', 'vendor', 'general', null],
    ['npc_tomas_market_vendor', cx + 18, cy + 44, 'Tomas Greenstall', 'shopkeeper', '#86efac', 'vendor', 'general', null],
    ['npc_weaponmaster_varn', cx + 126, cy - 8, 'Varn Ironedge', 'weaponsmith', '#f97316', 'vendor', 'weaponsmith', null],
    ['npc_borin_repair_smith', cx + 138, cy + 100, 'Borin Anvilhand', 'blacksmith', '#f97316', 'repair', 'armorer', null],
    ['npc_sera_armorer', cx + 158, cy + 78, 'Sera Platehand', 'armorer', '#fb923c', 'vendor', 'armorer', null],
    ['npc_ren_alchemist', cx + 64, cy + 48, 'Ren Willowglass', 'alchemist', '#5eead4', 'vendor', 'alchemy', null],
    ['npc_velis_arcane_vendor', cx + 120, cy + 48, 'Velis Starquill', 'mage_vendor', '#818cf8', 'vendor', 'arcane', null],
    ['npc_iriam_banker', cx - 54, cy - 30, 'Iriam Goldwake', 'banker', '#facc15', 'bank', 'bank', null],
    ['npc_maeve_auctioneer', cx + 72, cy - 30, 'Maeve Highbid', 'auctioneer', '#e879f9', 'auction', 'auction', null],
    ['npc_hollis_innkeeper', cx - 122, cy - 4, 'Hollis Hearth', 'innkeeper', '#fbbf24', 'inn', 'inn', null],
    ['npc_corra_stablemaster', cx + 34, cy + 126, 'Corra Stablemaster', 'stablemaster', '#facc15', 'vendor', 'stable', null],
    ['npc_ellian_trainer', cx - 112, cy + 90, 'Ellian Brightblade', 'trainer', '#60a5fa', 'professionTrainer', 'profession', 'blacksmithing'],
    ['npc_nessa_fishing_trainer', cx - 168, cy + 112, 'Nessa Reedline', 'trainer', '#38bdf8', 'professionTrainer', 'profession', 'fishing'],
    ['npc_grum_mining_trainer', cx - 92, cy + 112, 'Grum Stonepick', 'trainer', '#94a3b8', 'professionTrainer', 'profession', 'mining'],
    ['npc_silva_tailor', cx - 170, cy + 52, 'Silva Threadwise', 'trainer', '#f0abfc', 'professionTrainer', 'profession', 'tailoring'],
    ['npc_kellan_leatherworker', cx - 172, cy + 94, 'Kellan Hidebinder', 'trainer', '#a3e635', 'professionTrainer', 'profession', 'leatherworking'],
    ['npc_gate_guard_west', cx - 28, cy - 136, 'Asterfall Guard', 'guard', '#94a3b8', null, null, null],
    ['npc_gate_guard_east', cx + 30, cy - 136, 'Asterfall Guard', 'guard', '#94a3b8', null, null, null],
    ['npc_city_citizen_01', cx - 94, cy + 8, 'Lysa Fen', 'citizen', npcColor, null, null, null],
    ['npc_city_citizen_02', cx + 100, cy + 12, 'Old Marrin', 'citizen', npcColor, null, null, null],
    ['npc_city_citizen_03', cx - 38, cy - 8, 'Pella Dawn', 'citizen', npcColor, null, null, null],
    ['npc_city_citizen_04', cx + 2, cy + 92, 'Rook Vale', 'citizen', npcColor, null, null, null],
    ['npc_patrol_guard_01', cx - 154, cy - 44, 'Asterfall Patrol', 'guard', '#94a3b8', null, null, null],
    ['npc_patrol_guard_02', cx + 154, cy + 2, 'Asterfall Patrol', 'guard', '#94a3b8', null, null, null],
  ].forEach(([name, x, y, displayName, npcType, color, serviceType, shopType, professionId]) => addObjectPoint(region, 'npcs', name, x, y, {
    type: npcType,
    npcType,
    displayName,
    color,
    serviceType: serviceType ?? undefined,
    shopType: shopType ?? undefined,
    professionId: professionId ?? undefined,
    interactRange: serviceType ? 106 : 72,
    showOnMap: false,
  }));

  addObjectRect(region, 'spawns', 'asterfall_north_road_bandits', 520, 168, 138, 94, {
    type: 'enemySpawn',
    spawnId: 'asterfall_north_road_bandits',
    zoneId: 'asterfall_outskirts',
    displayName: 'North Road Bandits',
    enemyType: 'road-bandit',
    questGiverId: 'captain-arden',
    questTitle: 'Bandits at the North Road',
    questDescription: 'Road bandits have set an ambush north-east of Asterfall. Clear them out before caravans return.',
    questObjectiveText: 'Defeat 10 Road Bandits',
    questRequired: 10,
    recommendedLevel: 10,
    minLevel: 10,
    maxLevel: 12,
    maxEnemies: 12,
    maxAlive: 8,
    respawnMin: 18000,
    respawnMax: 32000,
    movementMode: 'patrol',
  });
  addObjectRect(region, 'spawns', 'asterfall_west_dire_wolves', 440, 600, 130, 105, {
    type: 'enemySpawn',
    spawnId: 'asterfall_west_dire_wolves',
    zoneId: 'asterfall_outskirts',
    displayName: 'Greenwake Dire Wolves',
    enemyType: 'dire-wolf',
    questGiverId: 'huntmaster-brann',
    questTitle: 'Howls Beyond the Lodge',
    questDescription: 'Dire wolves are closing around Greenwake Lodge. Thin the pack before they reach the road.',
    questObjectiveText: 'Defeat 8 Dire Wolves',
    questRequired: 8,
    recommendedLevel: 12,
    minLevel: 11,
    maxLevel: 14,
    maxEnemies: 10,
    maxAlive: 7,
    respawnMin: 20000,
    respawnMax: 36000,
    movementMode: 'patrol',
  });
  addObjectRect(region, 'spawns', 'asterfall_south_corrupted_grove', 548, 626, 142, 102, {
    type: 'enemySpawn',
    spawnId: 'asterfall_south_corrupted_grove',
    zoneId: 'asterfall_outskirts',
    displayName: 'Corrupted Grove',
    enemyType: 'corrupted-treant',
    questGiverId: 'sister-maera',
    questTitle: 'Roots Gone Wrong',
    questDescription: 'The southern copse is waking angry. Burn back the corrupted growth before it reaches Asterfall.',
    questObjectiveText: 'Defeat 5 Corrupted Treants',
    questRequired: 5,
    recommendedLevel: 15,
    minLevel: 13,
    maxLevel: 15,
    maxEnemies: 6,
    maxAlive: 4,
    respawnMin: 26000,
    respawnMax: 42000,
    movementMode: 'roam-pause',
  });
  addObjectRect(region, 'spawns', 'asterfall_field_ambushers', 706, 406, 78, 118, {
    type: 'enemySpawn',
    spawnId: 'asterfall_field_ambushers',
    zoneId: 'asterfall_outskirts',
    displayName: 'Field Ambushers',
    enemyType: 'bandit',
    questGiverId: 'asterfall-quartermaster',
    questTitle: 'Secure the Arrival Road',
    questDescription: 'Fresh arrivals are being watched from the field paths. Sweep the ambushers away from the city approach.',
    questObjectiveText: 'Defeat 9 Bandits',
    questRequired: 9,
    recommendedLevel: 10,
    minLevel: 10,
    maxLevel: 13,
    maxEnemies: 11,
    maxAlive: 7,
    respawnMin: 18000,
    respawnMax: 34000,
    movementMode: 'patrol',
  });
}

function getLandmarkPlan(landmark) {
  const base = { buildings: [], props: [], fences: [], fields: [] };
  const marketProps = [
    { x: -12, y: 8, tile: PROPS.marketStall, prefab: true, w: 2, h: 2 },
    { x: -5, y: 10, tile: PROPS.marketStall, prefab: true, w: 2, h: 2 },
    { x: 10, y: 8, tile: PROPS.marketStall, prefab: true, w: 2, h: 2 },
    { x: 2, y: -2, tile: PROPS.well },
    { x: -18, y: -10, tile: PROPS.lamp },
    { x: 18, y: -10, tile: PROPS.lamp },
    { x: -18, y: 18, tile: PROPS.lamp },
    { x: 18, y: 18, tile: PROPS.lamp },
  ];
  if (landmark.kind === 'city_hub') {
    return base;
  }
  if (landmark.kind === 'city') {
    base.buildings.push(
      { key: 'townHall', x: -4, y: -24 },
      { key: 'inn', x: -25, y: -5 },
      { key: 'cityRow', x: 11, y: -8 },
      { key: 'chapel', x: -3, y: 16 },
      { key: 'blacksmith', x: 28, y: 16 },
      { key: 'stable', x: -33, y: 22 },
      { key: 'warehouse', x: -38, y: -24 },
      { key: 'gatehouse', x: 33, y: -27 },
      { key: 'house', x: -45, y: 8 },
      { key: 'shop', x: 43, y: 4 },
      { key: 'marketSet', x: -2, y: 34 },
      { key: 'watchtower', x: -55, y: -31 },
    );
    base.props.push(
      ...marketProps,
      { x: -36, y: 34, tile: PROPS.crate },
      { x: -33, y: 35, tile: PROPS.barrel },
      { x: 30, y: 36, tile: PROPS.flowerPatch },
      { x: 37, y: 36, tile: PROPS.flowerPatch },
      { x: 0, y: 30, tile: PROPS.sign },
    );
    base.fences.push(
      { x: -56, y: -36, length: 112, horizontal: true },
      { x: -56, y: 42, length: 112, horizontal: true },
      { x: -56, y: -36, length: 78, horizontal: false },
      { x: 56, y: -36, length: 78, horizontal: false },
    );
  } else if (landmark.kind === 'town') {
    if (landmark.biome === 'golden_fields') {
      base.buildings.push(
        { key: 'townHall', x: -6, y: -20 },
        { key: 'inn', x: -28, y: 2 },
        { key: 'shop', x: 16, y: 3 },
        { key: 'stable', x: -38, y: 23 },
        { key: 'barn', x: 30, y: 22 },
        { key: 'marketSet', x: -4, y: 26 },
        { key: 'house', x: -42, y: -14 },
        { key: 'farmhouse', x: 42, y: -16 },
      );
      base.fields.push({ x: -55, y: 36, w: 26, h: 18 }, { x: 46, y: 38, w: 28, h: 18 });
      base.fences.push({ x: -58, y: 34, length: 34, horizontal: true }, { x: 42, y: 34, length: 36, horizontal: true });
    } else {
      base.buildings.push(
        { key: 'townHall', x: -4, y: -18 },
        { key: 'inn', x: -18, y: 4 },
        { key: 'shop', x: 12, y: 6 },
        { key: 'stable', x: -30, y: 20 },
        { key: 'blacksmith', x: 22, y: -16 },
        { key: 'marketSet', x: -4, y: 25 },
        { key: 'house', x: -35, y: -10 },
      );
    }
    base.props.push(...marketProps.slice(0, 5), { x: 18, y: 22, tile: PROPS.crate }, { x: -24, y: 28, tile: PROPS.hay }, { x: 31, y: -22, tile: PROPS.lamp });
  } else if (landmark.kind === 'village') {
    if (landmark.biome === 'silver_river') {
      base.buildings.push(
        { key: 'inn', x: -16, y: -12 },
        { key: 'dockBuilding', x: 16, y: -8 },
        { key: 'warehouse', x: -20, y: 16 },
        { key: 'cottage', x: 24, y: 20 },
      );
      base.props.push(
        { x: 36, y: 20, tile: PROPS.dock, prefab: true, w: 4, h: 2 },
        { x: 43, y: 24, tile: PROPS.boat, prefab: true, w: 3, h: 2 },
        { x: -18, y: 8, tile: PROPS.well },
        { x: -30, y: -18, tile: PROPS.sign },
        { x: 8, y: 24, tile: PROPS.barrel },
        { x: 12, y: 24, tile: PROPS.crate },
      );
      base.fences.push({ x: -34, y: -24, length: 42, horizontal: true }, { x: -34, y: 36, length: 38, horizontal: true });
    } else if (landmark.biome === 'murkfen') {
      base.buildings.push(
        { key: 'cottage', x: -18, y: -10 },
        { key: 'dockBuilding', x: 8, y: -8 },
        { key: 'warehouse', x: -10, y: 18 },
        { key: 'watchtower', x: 28, y: 12 },
      );
      base.props.push(
        { x: -30, y: -14, tile: PROPS.reeds },
        { x: -24, y: 22, tile: PROPS.reeds },
        { x: 26, y: 22, tile: PROPS.dock, prefab: true, w: 4, h: 2 },
        { x: -2, y: 7, tile: PROPS.well },
        { x: 9, y: 22, tile: PROPS.barrel },
        { x: -22, y: -18, tile: PROPS.brokenFence },
      );
      base.fences.push({ x: -30, y: -22, length: 26, horizontal: true }, { x: 14, y: 34, length: 28, horizontal: true });
    } else {
      base.buildings.push(
        { key: 'inn', x: -12, y: -10 },
        { key: 'farmhouse', x: 12, y: -4 },
        { key: 'stable', x: -26, y: 12 },
        { key: 'cottage', x: 18, y: 17 },
        { key: 'marketSet', x: 3, y: 17 },
      );
      base.props.push(
        { x: -2, y: 8, tile: PROPS.well },
        { x: -16, y: -16, tile: PROPS.sign },
        { x: -20, y: 22, tile: PROPS.hay },
        { x: 28, y: 22, tile: PROPS.flowerPatch },
        { x: 7, y: 18, tile: PROPS.marketStall, prefab: true, w: 2, h: 2 },
      );
      base.fences.push({ x: -32, y: -22, length: 64, horizontal: true }, { x: -32, y: 34, length: 64, horizontal: true });
    }
  } else if (landmark.kind === 'harbor') {
    base.buildings.push(
      { key: 'dockBuilding', x: -20, y: -12 },
      { key: 'inn', x: 8, y: -16 },
      { key: 'warehouse', x: -6, y: 14 },
    );
    base.props.push(
      { x: 18, y: 18, tile: PROPS.dock, prefab: true, w: 4, h: 2 },
      { x: 25, y: 22, tile: PROPS.boat, prefab: true, w: 3, h: 2 },
      { x: -18, y: 10, tile: PROPS.crate },
      { x: -15, y: 12, tile: PROPS.barrel },
      { x: -12, y: 14, tile: PROPS.crate },
    );
  } else if (landmark.kind === 'farmstead' || landmark.kind === 'mill') {
    base.buildings.push(
      { key: 'farmhouse', x: -4, y: -8 },
      { key: 'barn', x: 13, y: -6 },
      { key: 'stable', x: -21, y: 18 },
    );
    base.fields.push({ x: -38, y: -22, w: 24, h: 18 }, { x: -38, y: 8, w: 26, h: 20 }, { x: 26, y: 10, w: 24, h: 18 });
    base.fences.push({ x: -42, y: -26, length: 33, horizontal: true }, { x: -42, y: 30, length: 33, horizontal: true }, { x: 22, y: 6, length: 30, horizontal: true });
    base.props.push({ x: 6, y: 9, tile: PROPS.hay }, { x: 10, y: 10, tile: PROPS.cart }, { x: -8, y: 11, tile: PROPS.well });
  } else if (landmark.kind === 'lodge') {
    base.buildings.push({ key: 'cottage', x: -8, y: -10 }, { key: 'stable', x: 12, y: 6 });
    base.props.push(
      { x: -20, y: 10, tile: PROPS.log },
      { x: -18, y: -16, tile: PROPS.stump },
      { x: 16, y: -14, tile: PROPS.campfire },
      { x: -2, y: 14, tile: PROPS.sign },
    );
  } else if (['fort', 'fortress'].includes(landmark.kind)) {
    base.buildings.push(
      { key: landmark.kind === 'fortress' ? 'gatehouse' : 'barracks', x: -5, y: -14 },
      { key: 'watchtower', x: 18, y: 8 },
      { key: 'stable', x: -28, y: 12 },
      { key: 'blacksmith', x: 12, y: -18 },
    );
    base.fences.push({ x: -36, y: -28, length: 72, horizontal: true }, { x: -36, y: 32, length: 72, horizontal: true }, { x: -36, y: -28, length: 60, horizontal: false }, { x: 36, y: -28, length: 60, horizontal: false });
    base.props.push({ x: -34, y: -30, tile: PROPS.torch }, { x: 34, y: -30, tile: PROPS.torch }, { x: -34, y: 34, tile: PROPS.torch }, { x: 34, y: 34, tile: PROPS.torch });
  } else if (landmark.kind === 'bridge_landmark') {
    base.buildings.push({ key: 'watchtower', x: -22, y: -14 }, { key: 'watchtower', x: 18, y: -14 });
    base.props.push(
      { x: -12, y: 8, tile: PROPS.sign },
      { x: -5, y: 10, tile: PROPS.crate },
      { x: 8, y: 10, tile: PROPS.barrel },
      { x: -28, y: -20, tile: PROPS.torch },
      { x: 28, y: -20, tile: PROPS.torch },
    );
  } else if (landmark.kind === 'watchtower') {
    base.buildings.push({ key: 'watchtower', x: -2, y: -14 });
    base.props.push(
      { x: -10, y: 10, tile: PROPS.sign },
      { x: 8, y: 11, tile: PROPS.crate },
      { x: -14, y: -12, tile: PROPS.torch },
      { x: 12, y: -12, tile: PROPS.torch },
    );
  } else if (landmark.kind.includes('ruins') || landmark.kind === 'battlefield') {
    base.buildings.push({ key: 'ruinedLarge', x: -8, y: -12 }, { key: 'ruinedSmall', x: 18, y: 5 });
    base.props.push(
      { x: -26, y: -14, tile: PROPS.ruinsPillar },
      { x: -18, y: 12, tile: PROPS.ruinsWall },
      { x: 18, y: -22, tile: PROPS.ruinsPillar },
      { x: 30, y: 14, tile: PROPS.ruinsWall },
      { x: -4, y: 20, tile: PROPS.campfire },
    );
  } else if (landmark.kind === 'mining_town') {
    base.buildings.push({ key: 'inn', x: -12, y: -8 }, { key: 'blacksmith', x: 12, y: -6 }, { key: 'warehouse', x: -4, y: 16 }, { key: 'watchtower', x: 28, y: 7 });
    base.props.push({ x: 28, y: -12, tile: PROPS.mineEntrance, prefab: true, w: 3, h: 3 }, { x: -24, y: 15, tile: PROPS.cart }, { x: -20, y: 17, tile: PROPS.crate });
  } else if (landmark.kind === 'forest_camp' || landmark.kind === 'roadside_camp') {
    base.props.push(
      { x: -3, y: -2, tile: PROPS.campfire },
      { x: -10, y: 5, tile: PROPS.log },
      { x: 8, y: 5, tile: PROPS.crate },
      { x: 12, y: -3, tile: PROPS.cart },
      { x: -13, y: -6, tile: PROPS.sign },
    );
  } else if (landmark.kind === 'hidden_cabin') {
    base.buildings.push({ key: 'cottage', x: -5, y: -8 });
    base.props.push(
      { x: -16, y: 6, tile: PROPS.log },
      { x: 13, y: 7, tile: PROPS.flowerPatch },
      { x: -12, y: -12, tile: PROPS.stump },
      { x: 10, y: -13, tile: PROPS.campfire },
    );
  } else if (landmark.kind === 'hidden_garden' || landmark.kind === 'shrine') {
    base.props.push(
      { x: -2, y: -3, tile: PROPS.ruinsPillar },
      { x: 5, y: -3, tile: PROPS.ruinsPillar },
      { x: -7, y: 7, tile: PROPS.flowerPatch },
      { x: 2, y: 8, tile: PROPS.flowerPatch },
      { x: 10, y: 7, tile: PROPS.flowerPatch },
    );
  } else if (landmark.kind === 'watchtower_ruin') {
    base.buildings.push({ key: 'ruinedSmall', x: -4, y: -8 });
    base.props.push({ x: -12, y: -12, tile: PROPS.ruinsWall }, { x: 10, y: 10, tile: PROPS.ruinsPillar }, { x: -10, y: 12, tile: PROPS.campfire });
  } else if (landmark.kind === 'fishing_spot') {
    base.props.push(
      { x: -4, y: -2, tile: PROPS.dock, prefab: true, w: 4, h: 2 },
      { x: 5, y: 3, tile: PROPS.barrel },
      { x: 8, y: 3, tile: PROPS.crate },
      { x: -10, y: 5, tile: PROPS.reeds },
    );
  } else if (landmark.kind === 'cave_mouth') {
    base.props.push({ x: -2, y: -2, tile: PROPS.caveEntrance, prefab: true, w: 3, h: 3 }, { x: 8, y: 5, tile: PROPS.rockLarge }, { x: -8, y: 6, tile: PROPS.rockSmall });
  } else if (landmark.kind === 'cave_entrance' || landmark.kind === 'dungeon_entrance') {
    base.props.push({ x: -2, y: -2, tile: landmark.kind === 'cave_entrance' ? PROPS.caveEntrance : PROPS.mineEntrance, prefab: true, w: 3, h: 3 });
  } else {
    base.buildings.push({ key: 'inn', x: -8, y: -10 }, { key: 'farmhouse', x: 12, y: 4 }, { key: 'stable', x: -18, y: 8 });
    base.props.push({ x: -2, y: 7, tile: PROPS.well }, { x: 18, y: 12, tile: PROPS.cart }, { x: -16, y: -14, tile: PROPS.sign });
  }
  return base;
}

function addRegionMarkers(region) {
  const neighbors = [
    [region.rx - 1, region.ry, 'west'],
    [region.rx + 1, region.ry, 'east'],
    [region.rx, region.ry - 1, 'north'],
    [region.rx, region.ry + 1, 'south'],
  ].filter(([rx, ry]) => rx >= 0 && ry >= 0 && rx < REGION_GRID && ry < REGION_GRID);
  for (const [rx, ry, direction] of neighbors) {
    const markerX = direction === 'west' ? 0 : direction === 'east' ? REGION_TILES - 2 : Math.floor(REGION_TILES / 2);
    const markerY = direction === 'north' ? 0 : direction === 'south' ? REGION_TILES - 2 : Math.floor(REGION_TILES / 2);
    region.objects.regionMarkers.push(rectObject(`region_marker_${region.rx}_${region.ry}_${direction}`, markerX, markerY, 2, 2, {
      type: 'regionNeighbor',
      direction,
      connectsToRegion: `${rx},${ry}`,
      showOnMap: false,
      debugOnly: true,
    }));
  }
}

function addRoadMarkers(region) {
  const edges = [
    { direction: 'west', x: region.worldX, y0: region.worldY, y1: region.worldY + REGION_TILES },
    { direction: 'east', x: region.worldX + REGION_TILES - 1, y0: region.worldY, y1: region.worldY + REGION_TILES },
    { direction: 'north', y: region.worldY, x0: region.worldX, x1: region.worldX + REGION_TILES },
    { direction: 'south', y: region.worldY + REGION_TILES - 1, x0: region.worldX, x1: region.worldX + REGION_TILES },
  ];
  for (const road of ROADS) {
    for (const edge of edges) {
      const samples = [];
      for (let i = 20; i < REGION_TILES; i += 40) {
        const gx = edge.x ?? region.worldX + i;
        const gy = edge.y ?? region.worldY + i;
        if (pathDistance(gx, gy, road.points) <= road.width + 2) samples.push([gx, gy]);
      }
      if (!samples.length) continue;
      const [gx, gy] = samples[Math.floor(samples.length / 2)];
      const { x, y } = toLocal(region, gx, gy);
      const nx = edge.direction === 'west' ? region.rx - 1 : edge.direction === 'east' ? region.rx + 1 : region.rx;
      const ny = edge.direction === 'north' ? region.ry - 1 : edge.direction === 'south' ? region.ry + 1 : region.ry;
      if (nx < 0 || ny < 0 || nx >= REGION_GRID || ny >= REGION_GRID) continue;
      region.objects.roadMarkers.push(rectObject(`road_marker_${road.id}_${region.rx}_${region.ry}_${edge.direction}`, x - 2, y - 2, 4, 4, {
        type: 'roadMarker',
        roadId: road.id,
        connectsToRegion: `${nx},${ny}`,
        showOnMap: false,
        debugOnly: true,
      }));
    }
  }
}

function makeMap(region) {
  return {
    compressionlevel: -1,
    height: REGION_TILES,
    infinite: false,
    layers: [
      makeTileLayer('Ground', 1, region.ground),
      makeTileLayer('Water', 2, region.water),
      makeTileLayer('TerrainDetails', 3, region.terrainDetails),
      makeTileLayer('Roads', 4, region.roads),
      makeTileLayer('CityBase', 5, region.cityBase),
      makeTileLayer('CityInteriors', 6, region.cityInteriors),
      makeTileLayer('Decor', 7, region.decor),
      makeTileLayer('Buildings', 8, region.buildings),
      makeTileLayer('CityRoofs', 9, region.cityRoofs),
      makeTileLayer('Collision', 10, region.collision, false),
      makeObjectLayer('Zones', 11, region.objects.zones),
      makeObjectLayer('Spawns', 12, region.objects.spawns),
      makeObjectLayer('BossSpawns', 13, region.objects.bossSpawns),
      makeObjectLayer('NPCs', 14, region.objects.npcs),
      makeObjectLayer('QuestGiver', 15, region.objects.questGivers),
      makeObjectLayer('raceStart', 16, region.objects.raceStarts),
      makeObjectLayer('Graveyards', 17, region.objects.graveyards),
      makeObjectLayer('InteriorZones', 18, region.objects.interiorZones),
      makeObjectLayer('RegionMarkers', 19, region.objects.regionMarkers),
      makeObjectLayer('RoadMarkers', 20, region.objects.roadMarkers),
      makeObjectLayer('Landmarks', 21, region.objects.landmarks),
      makeObjectLayer('Transitions', 22, region.objects.transitions),
    ],
    nextlayerid: 23,
    nextobjectid: objectId + 1,
    orientation: 'orthogonal',
    properties: [
      { name: 'regionX', type: 'int', value: region.rx },
      { name: 'regionY', type: 'int', value: region.ry },
      { name: 'worldX', type: 'int', value: region.worldX },
      { name: 'worldY', type: 'int', value: region.worldY },
      { name: 'zoneId', type: 'string', value: region.theme.id },
      { name: 'displayName', type: 'string', value: region.theme.name },
      { name: 'biomeId', type: 'string', value: region.theme.biome },
      { name: 'biomeType', type: 'string', value: region.theme.biome },
      { name: 'description', type: 'string', value: region.theme.role },
      { name: 'recommendedLevel', type: 'int', value: Math.max(1, 1 + region.ry * 3 + Math.floor(region.rx / 2)) },
      { name: 'worldVersion', type: 'string', value: 'v3' },
    ],
    renderorder: 'right-down',
    tiledversion: '1.11.2',
    tileheight: TILE,
    tilesets: [
      ...BIOMES.map((biome) => ({ firstgid: biome.firstgid, source: `../tilesets/world_v3_${biome.id}.tsx` })),
      { firstgid: WATER_FIRSTGID, source: '../tilesets/world_v3_water.tsx' },
      { firstgid: BUILDINGS_FIRSTGID, source: '../tilesets/world_v4_buildings.tsx' },
      { firstgid: PROPS_FIRSTGID, source: '../tilesets/world_v3_props.tsx' },
      { firstgid: COLLISION_FIRSTGID, source: '../tilesets/collision_debug_v3.tsx' },
      { firstgid: CITY_FIRSTGID, source: '../tilesets/world_v6_city.tsx' },
    ],
    tilewidth: TILE,
    type: 'map',
    version: '1.10',
    width: REGION_TILES,
  };
}

function makeWorldFile() {
  return {
    type: 'world',
    maps: Array.from({ length: REGION_GRID * REGION_GRID }, (_, index) => {
      const rx = index % REGION_GRID;
      const ry = Math.floor(index / REGION_GRID);
      return {
        fileName: `world_region_${rx}_${ry}_v3.tmj`,
        x: rx * REGION_TILES * TILE,
        y: ry * REGION_TILES * TILE,
        width: REGION_TILES * TILE,
        height: REGION_TILES * TILE,
      };
    }),
    onlyShowAdjacentMaps: false,
    patterns: [],
  };
}

function makeRegistry() {
  return {
    version: 'v3',
    tileSize: TILE,
    worldTiles: { width: WORLD_TILES, height: WORLD_TILES },
    regionTiles: { width: REGION_TILES, height: REGION_TILES },
    regions: REGION_THEMES.map((theme) => ({
      id: `world_region_${theme.rx}_${theme.ry}`,
      zoneId: theme.id,
      file: `world_region_${theme.rx}_${theme.ry}_v3.tmj`,
      x: theme.rx * REGION_TILES,
      y: theme.ry * REGION_TILES,
      width: REGION_TILES,
      height: REGION_TILES,
      displayName: theme.name,
      biomeId: theme.biome,
      biomeType: theme.biome,
      description: theme.role,
      role: theme.role,
      recommendedLevel: Math.max(1, 1 + theme.ry * 3 + Math.floor(theme.rx / 2)),
    })),
    biomes: BIOMES.map(({ id, name, firstgid, density }) => ({ id, name, firstgid, density })),
    roads: ROADS.map((road) => ({
      id: road.id,
      kind: road.kind,
      width: road.width,
      points: roadPathPoints(road).map(([x, y]) => [Math.round(x), Math.round(y)]),
    })),
    rivers: RIVERS.map((river) => ({
      id: river.id,
      kind: river.kind,
      fordable: Boolean(river.fordable),
      width: river.width,
      widthJitter: river.widthJitter,
      seed: river.seed,
      points: riverPathPoints(river).map(([x, y]) => [Math.round(x), Math.round(y)]),
    })),
    lakes: LAKES,
    bridges: BRIDGES,
    landmarks: LANDMARKS.map(({ id, displayName, kind, x, y, radius, biome, showOnMap, transitionTarget }) => ({
      id,
      displayName,
      kind,
      x,
      y,
      radius,
      biome,
      showOnMap: Boolean(showOnMap),
      transitionTarget: transitionTarget ?? null,
    })),
  };
}

async function writeJson(file, value) {
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function makeNotes() {
  return `# World Map V3 Notes

## Scale

- Logical world size: 4000x4000 tiles.
- Tile size: 32px.
- Region split: 5x5.
- Region size: 800x800 tiles.
- Tiled world file: \`public/maps/world_continent_v3.world\`
- Region registry: \`public/maps/world_regions_v3.json\`
- Region files: \`public/maps/world_region_X_Y_v3.tmj\`

## Regions

${REGION_THEMES.map((theme) => `- \`${theme.rx},${theme.ry}\`: ${theme.name} - ${theme.role}`).join('\n')}

## Biomes

${BIOMES.map((biome) => `- \`${biome.id}\`: ${biome.name}, tileset \`world_v3_${biome.id}.tsx\``).join('\n')}

## Terrain Shape Pass

The current V3 terrain pass focuses on organic natural shapes:

- Lakes use asymmetric lobe/cut/island masks instead of clean ellipses.
- Rivers use deterministic meander paths, variable width, local widenings, small branches, and noisy bank edges.
- Small fordable stream branches add riverland texture without blocking movement.
- Mountains are generated from ridge polylines with foothill shoulders, not isolated grey blobs.
- Biome borders use noisy transition bands and region-edge blending so neighboring zones mix more naturally.
- Shorelines mix sandy, grassy, and rocky sections with extra bank/reed/stone detail around rivers, lakes, marshes, and coast-adjacent areas.
- Ground tile noise is intentionally reduced; most small texture lives on \`TerrainDetails\` or \`Decor\`.
- Roads use narrower main/secondary/trail widths with meandered paths and subtle width wobble.
- Playable natural detail is placed on \`TerrainDetails\` and \`Decor\`: forest edges, clearings, shore props, foothill rocks, reeds, logs, stumps, and hidden camp-like details.
- Settlement landmarks add plaza/courtyard/path/farm/dock readability patches around the prefab buildings.
- Asterfall City in \`world_region_0_0_v3\` is the post-starting-zone level 10-15 hub with a city safe zone, an outskirts leveling zone, NPCs, quest givers, and nearby enemy spawn areas.

## Landmarks

${LANDMARKS.map((landmark) => `- \`${landmark.id}\`: ${landmark.displayName}, ${landmark.kind}, world tile ${landmark.x},${landmark.y}${landmark.transitionTarget ? `, transition target \`${landmark.transitionTarget}\`` : ''}`).join('\n')}

## Layers

- \`Ground\`: base biome terrain.
- \`Water\`: rivers, lakes, ocean, shallow water.
- \`TerrainDetails\`: banks, flowers, tall grass, crops, road edge blends, ruin floor detail.
- \`Roads\`: main roads, trails, mountain passes, plaza tiles.
- \`Decor\`: foliage, props, fences, bridges, docks, boats, rocks, ruins props.
- \`Buildings\`: multi-tile prefab buildings.
- \`Collision\`: hidden gameplay collision. V3 keeps collision minimal: water, buildings, and fences. Bridges clear water collision.
- \`Zones\`: gameplay zone rectangles such as the Asterfall hub and its level 10-15 outskirts.
- \`Spawns\`: enemy spawn areas. V3 currently uses these only around Asterfall City for level 10-15 progression.
- \`BossSpawns\`: reserved for future boss objects.
- \`NPCs\`: city/service/flavor NPC markers.
- \`QuestGiver\`: functional quest giver markers parsed by the game.
- \`raceStart\`: player arrival markers, including \`asterfall_city_arrival\`.
- \`Graveyards\`: respawn markers.
- \`RegionMarkers\`: region identity and neighbor debug markers.
- \`RoadMarkers\`: debug-only road continuation markers at region borders.
- \`Landmarks\`: player-facing landmark/building markers.
- \`Transitions\`: only real transition-like entries such as caves, dungeons, or boat routes.

## Asterfall City Hub

- Region: \`world_region_0_0_v3.tmj\`.
- Landmark: \`asterfall_city\`, display name \`Asterfall City\`.
- Arrival marker: \`raceStart/asterfall_city_arrival\`.
- Safe hub zone: \`zone_asterfall_city_hub\`.
- Leveling zone: \`leveling_zone_asterfall_outskirts_10_15\`.
- Quest givers: Quartermaster Vale, Captain Arden, Huntmaster Brann, Sister Maera.
- Nearby level 10-15 enemy spawns: road bandits, dire wolves, corrupted treants, and field ambushers.

## Map UI

- Normal map open (\`M\` or minimap click): zone map mode focused on the current or selected zone.
- Right click on the map panel: toggles full world map mode.
- Full world map mode: shows the whole 4000x4000 tile world with biome-colored zones, roads, rivers, lakes, and major landmarks.
- Clicking a zone in full world mode selects that zone, shows its \`displayName\`, and switches back to zone map mode.
- Player-facing names come from \`displayName\`; technical object names and debug markers stay hidden.

## Zone Metadata

Each region marker and registry region contains:

- \`zoneId\`
- \`displayName\`
- \`biomeType\`
- \`description\`
- \`recommendedLevel\`

## Marker Properties

Player-facing marker example:

\`\`\`json
{
  "type": "landmark",
  "landmarkId": "stonebridge_city",
  "displayName": "Stonebridge City",
  "showOnMap": true,
  "debugOnly": false
}
\`\`\`

Road marker example:

\`\`\`json
{
  "type": "roadMarker",
  "roadId": "main_east_road",
  "connectsToRegion": "3,2",
  "showOnMap": false,
  "debugOnly": true
}
\`\`\`

There are no \`road_transition_*\` objects in V3. Roads are seamless world geometry; region streaming should use global coordinates, not teleport objects.

## Adding Enemies And NPCs Later

Add future gameplay layers separately, for example \`EnemySpawns\`, \`NpcSpawns\`, or \`QuestGivers\`. Keep them out of V3 terrain generation unless gameplay placement is being intentionally authored.

Recommended object properties:

- \`spawnId\`
- \`displayName\`
- \`faction\`
- \`minLevel\`
- \`maxLevel\`
- \`population\`
- \`respawnMs\`
- \`debugOnly\`

## Region Streaming Hook

Use \`world_regions_v3.json\` as the registry.

## Building Art

V3 region maps now use the standalone V4 building art pack:

- Tileset: \`public/tilesets/world_v4_buildings.tsx\`
- Source image: \`public/assets/tilesets/world_v4_buildings.png\`
- Prefab metadata: \`public/maps/tilesets/world_v4_building_prefabs.json\`

The full V3 world layout remains the same, but all settlement building placements use V4 prefab GIDs.

1. Store player position as global world tile or pixel coordinates.
2. Compute region with \`floor(tileX / 800)\`, \`floor(tileY / 800)\`.
3. Load the current region plus neighboring regions.
4. Draw each map at \`region.x * 32\`, \`region.y * 32\`.
5. Collision lookup should resolve global tile coordinates into the correct region-local tile.
6. Bridges are walkable because their generated areas clear water collision.
`;
}

async function main() {
  await Promise.all([
    fs.mkdir(mapsDir, { recursive: true }),
    fs.mkdir(tilesetsDir, { recursive: true }),
    fs.mkdir(assetTilesetsDir, { recursive: true }),
    fs.mkdir(docsDir, { recursive: true }),
  ]);

  await Promise.all([
    ...BIOMES.flatMap((biome) => [
      fs.writeFile(path.join(assetTilesetsDir, `world_v3_${biome.id}.png`), makeBiomeTilesheet(biome)),
      fs.writeFile(path.join(tilesetsDir, `world_v3_${biome.id}.tsx`), makeTsx(`world_v3_${biome.id}`, `world_v3_${biome.id}.png`, BIOME_TILESET_TILES)),
    ]),
    fs.writeFile(path.join(assetTilesetsDir, 'world_v3_water.png'), makeWaterTilesheet()),
    fs.writeFile(path.join(tilesetsDir, 'world_v3_water.tsx'), makeTsx('world_v3_water', 'world_v3_water.png', WATER_TILESET_TILES, TILESET_COLUMNS, waterAnimations())),
    fs.writeFile(path.join(assetTilesetsDir, 'world_v3_props.png'), makePropsTilesheet()),
    fs.writeFile(path.join(tilesetsDir, 'world_v3_props.tsx'), makeTsx('world_v3_props', 'world_v3_props.png', PROP_TILESET_TILES, TILESET_COLUMNS, [
      {
        tileId: PROPS.torch,
        frames: [
          { tileId: PROPS.torch, duration: 180 },
          { tileId: PROPS.torchFrame2, duration: 180 },
        ],
      },
      {
        tileId: PROPS.campfire,
        frames: [
          { tileId: PROPS.campfire, duration: 140 },
          { tileId: PROPS.campfireFrame2, duration: 140 },
          { tileId: PROPS.campfireFrame3, duration: 140 },
        ],
      },
    ])),
    fs.writeFile(path.join(assetTilesetsDir, 'world_v6_city.png'), makeCityTilesheet()),
    fs.writeFile(path.join(tilesetsDir, 'world_v6_city.tsx'), makeTsx('world_v6_city', 'world_v6_city.png', CITY_TILESET_TILES, CITY_TILESET_COLUMNS, cityAnimations())),
    fs.writeFile(path.join(assetTilesetsDir, 'collision_debug_v3.png'), makeCollisionTilesheet()),
    fs.writeFile(path.join(tilesetsDir, 'collision_debug_v3.tsx'), makeTsx('collision_debug_v3', 'collision_debug_v3.png', 1, 1)),
  ]);

  for (let ry = 0; ry < REGION_GRID; ry += 1) {
    for (let rx = 0; rx < REGION_GRID; rx += 1) {
      const region = createRegion(rx, ry);
      await writeJson(path.join(mapsDir, `world_region_${rx}_${ry}_v3.tmj`), makeMap(region));
    }
  }

  await writeJson(path.join(mapsDir, 'world_continent_v3.world'), makeWorldFile());
  await writeJson(path.join(mapsDir, 'world_regions_v3.json'), makeRegistry());
  await fs.writeFile(path.join(docsDir, 'world_map_v3_notes.md'), makeNotes());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

