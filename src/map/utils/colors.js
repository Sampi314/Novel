// src/map/utils/colors.js

/**
 * 34 biome color palettes for terrain rendering.
 * Each biome has a dark theme and light theme color.
 * Colors are [r, g, b] arrays (0-255).
 */

// Biome IDs — used as keys throughout the pipeline
export const BIOME = {
  // Hot/Warm
  VOLCANIC_BADLANDS: 0,
  MAGMA_RIFT: 1,
  SCORCHED_SAVANNA: 2,
  TROPICAL_JUNGLE: 3,
  BAMBOO_GROVES: 4,
  MIASMA_SWAMP: 5,
  // Temperate
  CULTIVATION_PLAINS: 6,
  ANCIENT_FOREST: 7,
  DECIDUOUS_HIGHLANDS: 8,
  FLOWER_MEADOWS: 9,
  PETRIFIED_FOREST: 10,
  MISTY_VALLEY: 11,
  TERRACED_FARMLANDS: 12,
  // Cold
  FROST_TUNDRA: 13,
  GLACIAL_PEAKS: 14,
  BOREAL_FOREST: 15,
  FROZEN_MARSHES: 16,
  SNOWFIELD_STEPPE: 17,
  // Arid
  QI_BARREN_WASTE: 18,
  CRYSTAL_DESERT: 19,
  CANYONLANDS: 20,
  SALT_FLATS: 21,
  // Mountain
  SACRED_MOUNTAINS: 22,
  SKY_RIFT: 23,
  CLOUD_FOREST: 24,
  ALPINE_MEADOW: 25,
  // Aquatic
  DEEP_OCEAN: 26,
  CORAL_SHALLOWS: 27,
  MANGROVE_COAST: 28,
  ABYSSAL_TRENCH: 29,
  // Spiritual overlays
  SPIRIT_GARDEN: 30,
  RIFT_CAVES: 31,
  QI_STORM: 32,
  CELESTIAL_PLATEAU: 33,
};

// Dark theme (xianxia aesthetic)
export const DARK_PALETTE = {
  [BIOME.VOLCANIC_BADLANDS]:   [89, 30, 15],
  [BIOME.MAGMA_RIFT]:          [120, 35, 10],
  [BIOME.SCORCHED_SAVANNA]:    [140, 110, 55],
  [BIOME.TROPICAL_JUNGLE]:     [25, 80, 35],
  [BIOME.BAMBOO_GROVES]:       [55, 100, 50],
  [BIOME.MIASMA_SWAMP]:        [40, 60, 35],
  [BIOME.CULTIVATION_PLAINS]:  [70, 100, 50],
  [BIOME.ANCIENT_FOREST]:      [20, 65, 30],
  [BIOME.DECIDUOUS_HIGHLANDS]: [65, 85, 45],
  [BIOME.FLOWER_MEADOWS]:      [90, 110, 65],
  [BIOME.PETRIFIED_FOREST]:    [75, 65, 50],
  [BIOME.MISTY_VALLEY]:        [50, 75, 60],
  [BIOME.TERRACED_FARMLANDS]:  [85, 105, 55],
  [BIOME.FROST_TUNDRA]:        [160, 170, 180],
  [BIOME.GLACIAL_PEAKS]:       [200, 210, 220],
  [BIOME.BOREAL_FOREST]:       [30, 55, 40],
  [BIOME.FROZEN_MARSHES]:      [100, 115, 120],
  [BIOME.SNOWFIELD_STEPPE]:    [170, 175, 175],
  [BIOME.QI_BARREN_WASTE]:     [150, 130, 95],
  [BIOME.CRYSTAL_DESERT]:      [180, 165, 130],
  [BIOME.CANYONLANDS]:         [140, 90, 55],
  [BIOME.SALT_FLATS]:          [190, 185, 170],
  [BIOME.SACRED_MOUNTAINS]:    [90, 80, 70],
  [BIOME.SKY_RIFT]:            [70, 80, 110],
  [BIOME.CLOUD_FOREST]:        [40, 70, 55],
  [BIOME.ALPINE_MEADOW]:       [80, 110, 70],
  [BIOME.DEEP_OCEAN]:          [10, 20, 50],
  [BIOME.CORAL_SHALLOWS]:      [30, 70, 90],
  [BIOME.MANGROVE_COAST]:      [35, 65, 45],
  [BIOME.ABYSSAL_TRENCH]:      [5, 8, 30],
  [BIOME.SPIRIT_GARDEN]:       [60, 100, 80],
  [BIOME.RIFT_CAVES]:          [30, 20, 40],
  [BIOME.QI_STORM]:            [80, 70, 100],
  [BIOME.CELESTIAL_PLATEAU]:   [120, 130, 160],
};

// Light theme (parchment/cartographic)
export const LIGHT_PALETTE = {
  [BIOME.VOLCANIC_BADLANDS]:   [160, 80, 60],
  [BIOME.MAGMA_RIFT]:          [180, 70, 50],
  [BIOME.SCORCHED_SAVANNA]:    [200, 180, 120],
  [BIOME.TROPICAL_JUNGLE]:     [60, 140, 70],
  [BIOME.BAMBOO_GROVES]:       [100, 160, 90],
  [BIOME.MIASMA_SWAMP]:        [80, 110, 70],
  [BIOME.CULTIVATION_PLAINS]:  [130, 170, 100],
  [BIOME.ANCIENT_FOREST]:      [50, 120, 65],
  [BIOME.DECIDUOUS_HIGHLANDS]: [120, 150, 90],
  [BIOME.FLOWER_MEADOWS]:      [160, 180, 120],
  [BIOME.PETRIFIED_FOREST]:    [140, 120, 95],
  [BIOME.MISTY_VALLEY]:        [100, 140, 115],
  [BIOME.TERRACED_FARMLANDS]:  [150, 175, 110],
  [BIOME.FROST_TUNDRA]:        [210, 215, 220],
  [BIOME.GLACIAL_PEAKS]:       [235, 240, 245],
  [BIOME.BOREAL_FOREST]:       [60, 100, 75],
  [BIOME.FROZEN_MARSHES]:      [160, 175, 180],
  [BIOME.SNOWFIELD_STEPPE]:    [220, 220, 215],
  [BIOME.QI_BARREN_WASTE]:     [210, 190, 150],
  [BIOME.CRYSTAL_DESERT]:      [230, 215, 180],
  [BIOME.CANYONLANDS]:         [195, 145, 100],
  [BIOME.SALT_FLATS]:          [235, 230, 215],
  [BIOME.SACRED_MOUNTAINS]:    [150, 140, 130],
  [BIOME.SKY_RIFT]:            [130, 145, 175],
  [BIOME.CLOUD_FOREST]:        [80, 130, 100],
  [BIOME.ALPINE_MEADOW]:       [140, 175, 130],
  [BIOME.DEEP_OCEAN]:          [40, 70, 130],
  [BIOME.CORAL_SHALLOWS]:      [70, 140, 170],
  [BIOME.MANGROVE_COAST]:      [75, 125, 85],
  [BIOME.ABYSSAL_TRENCH]:      [20, 30, 70],
  [BIOME.SPIRIT_GARDEN]:       [110, 170, 140],
  [BIOME.RIFT_CAVES]:          [80, 60, 95],
  [BIOME.QI_STORM]:            [140, 125, 165],
  [BIOME.CELESTIAL_PLATEAU]:   [180, 190, 215],
};

/**
 * Get biome color for a given biome ID and theme.
 * @param {number} biomeId  BIOME enum value
 * @param {string} theme    'dark' | 'light'
 * @returns {number[]} [r, g, b]
 */
export function getBiomeColor(biomeId, theme = 'dark') {
  const palette = theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
  return palette[biomeId] || [128, 128, 128];
}

/**
 * Water color by depth.
 * @param {number} depth  0 = shallow, 1 = deep
 * @param {string} theme
 * @returns {number[]} [r, g, b]
 */
export function getWaterColor(depth, theme = 'dark') {
  const shallow = theme === 'dark' ? [20, 40, 80] : [60, 120, 170];
  const deep = theme === 'dark' ? [5, 10, 35] : [25, 50, 110];
  const t = Math.max(0, Math.min(1, depth));
  return [
    Math.round(shallow[0] + (deep[0] - shallow[0]) * t),
    Math.round(shallow[1] + (deep[1] - shallow[1]) * t),
    Math.round(shallow[2] + (deep[2] - shallow[2]) * t),
  ];
}
