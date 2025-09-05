// src\utils\colorUtils.test.ts

import { hslColorToRgbColor, kelvinToMired, kelvinToRGB, miredToKelvin, rgbColorToHslColor, rgbColorToXYColor, xyColorToRgbColor, xyToHsl } from './colorUtils.js';

/* prettier-ignore */
const colors = [
  { name: 'Pure Red          0', hsl: { h: 0, s: 100, l: 50 }, rgb: { r: 255, g: 0, b: 0 }, xy: { x: 0.7006, y: 0.2993 } },
  { name: 'Bright Orange    30', hsl: { h: 30, s: 100, l: 50 }, rgb: { r: 255, g: 128, b: 0 }, xy: { x: 0.6112, y: 0.375 } },
  { name: 'Pure Yellow      60', hsl: { h: 60, s: 100, l: 50 }, rgb: { r: 255, g: 255, b: 0 }, xy: { x: 0.4442, y: 0.5166 } },
  { name: 'Lime Green       90', hsl: { h: 90, s: 100, l: 50 }, rgb: { r: 128, g: 255, b: 0 }, xy: { x: 0.2707, y: 0.6635 } },
  { name: 'Pure Green      120', hsl: { h: 120, s: 100, l: 50 }, rgb: { r: 0, g: 255, b: 0 }, xy: { x: 0.1724, y: 0.7468 } },
  { name: 'Light Sea Green 150', hsl: { h: 150, s: 100, l: 50 }, rgb: { r: 0, g: 255, b: 128 }, xy: { x: 0.1642, y: 0.5886 } },
  { name: 'Pure Cyan       180', hsl: { h: 180, s: 100, l: 50 }, rgb: { r: 0, g: 255, b: 255 }, xy: { x: 0.1513, y: 0.3425 } },
  { name: 'Deep Sky Blue   210', hsl: { h: 210, s: 100, l: 50 }, rgb: { r: 0, g: 128, b: 255 }, xy: { x: 0.1406, y: 0.1382 } },
  { name: 'Pure Blue       240', hsl: { h: 240, s: 100, l: 50 }, rgb: { r: 0, g: 0, b: 255 }, xy: { x: 0.1355, y: 0.0399 } },
  { name: 'Blue Violet     270', hsl: { h: 270, s: 100, l: 50 }, rgb: { r: 128, g: 0, b: 255 }, xy: { x: 0.2181, y: 0.0778 } },
  { name: 'Pure Magenta    300', hsl: { h: 300, s: 100, l: 50 }, rgb: { r: 255, g: 0, b: 255 }, xy: { x: 0.3855, y: 0.1546 } },
  { name: 'Deep Pink       330', hsl: { h: 330, s: 100, l: 50 }, rgb: { r: 255, g: 0, b: 128 }, xy: { x: 0.5797, y: 0.2438 } },

  { name: 'Pure Red        50%   0', hsl: { h: 0, s: 50, l: 50 }, rgb: { r: 192, g: 64, b: 64 }, xy: { x: 0.6036, y: 0.3069 } },
  { name: 'Bright Orange   50%  30', hsl: { h: 30, s: 50, l: 50 }, rgb: { r: 192, g: 128, b: 64 }, xy: { x: 0.5194, y: 0.3928 } },
  { name: 'Pure Yellow     50%  60', hsl: { h: 60, s: 50, l: 50 }, rgb: { r: 192, g: 192, b: 64 }, xy: { x: 0.4258, y: 0.4883 } },
  { name: 'Lime Green      50%  90', hsl: { h: 90, s: 50, l: 50 }, rgb: { r: 128, g: 192, b: 64 }, xy: { x: 0.3159, y: 0.5639 } },
  { name: 'Pure Green      50% 120', hsl: { h: 120, s: 50, l: 50 }, rgb: { r: 64, g: 192, b: 64 }, xy: { x: 0.2127, y: 0.6349 } },
  { name: 'Light Sea Green 50% 150', hsl: { h: 150, s: 50, l: 50 }, rgb: { r: 64, g: 192, b: 128 }, xy: { x: 0.1932, y: 0.4845 } },
  { name: 'Pure Cyan       50% 180', hsl: { h: 180, s: 50, l: 50 }, rgb: { r: 64, g: 192, b: 192 }, xy: { x: 0.1745, y: 0.3407 } },
  { name: 'Deep Sky Blue   50% 210', hsl: { h: 210, s: 50, l: 50 }, rgb: { r: 64, g: 128, b: 192 }, xy: { x: 0.1752, y: 0.211 } },
  { name: 'Pure Blue       50% 240', hsl: { h: 240, s: 50, l: 50 }, rgb: { r: 64, g: 64, b: 192 }, xy: { x: 0.1758, y: 0.102 } },
  { name: 'Blue Violet     50% 270', hsl: { h: 270, s: 50, l: 50 }, rgb: { r: 128, g: 64, b: 192 }, xy: { x: 0.2688, y: 0.137 } },
  { name: 'Pure Magenta    50% 300', hsl: { h: 300, s: 50, l: 50 }, rgb: { r: 192, g: 64, b: 192 }, xy: { x: 0.3772, y: 0.1777 } },
  { name: 'Deep Pink       50% 330', hsl: { h: 330, s: 50, l: 50 }, rgb: { r: 192, g: 64, b: 128 }, xy: { x: 0.489, y: 0.2416 } },
];

describe('Utils test', () => {
  beforeAll(async () => {
    //
  });

  afterAll(async () => {
    //
  });

  describe('hslColorToRgbColor', () => {
    test('Pure Red', async () => {
      const color = colors[0];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Bright Orange', async () => {
      const color = colors[1];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Yellow', async () => {
      const color = colors[2];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Lime Green', async () => {
      const color = colors[3];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Green', async () => {
      const color = colors[4];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Light Sea Green', async () => {
      const color = colors[5];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Cyan', async () => {
      const color = colors[6];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Deep Sky Blue', async () => {
      const color = colors[7];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Blue', async () => {
      const color = colors[8];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Blue Violet', async () => {
      const color = colors[9];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Magenta', async () => {
      const color = colors[10];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Deep Pink', async () => {
      const color = colors[11];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    // 50% saturation

    test('Pure Red 50%', async () => {
      const color = colors[12];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Bright Orange 50%', async () => {
      const color = colors[13];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Yellow 50%', async () => {
      const color = colors[14];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Lime Green 50%', async () => {
      const color = colors[15];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Green 50%', async () => {
      const color = colors[16];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Light Sea Green 50%', async () => {
      const color = colors[17];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Cyan 50%', async () => {
      const color = colors[18];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Deep Sky Blue 50%', async () => {
      const color = colors[19];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Blue 50%', async () => {
      const color = colors[20];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Blue Violet 50%', async () => {
      const color = colors[21];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Magenta 50%', async () => {
      const color = colors[22];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Deep Pink 50%', async () => {
      const color = colors[23];
      expect(hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Red 360', async () => {
      expect(hslColorToRgbColor(360, 100, 50)).toStrictEqual({ r: 255, g: 0, b: 0 });
    });

    test('Pure Red Saturation 0', async () => {
      expect(hslColorToRgbColor(0, 0, 50)).toStrictEqual({ r: 128, g: 128, b: 128 });
    });
  });

  describe('rgbColorToHslColor', () => {
    test('Pure Red', async () => {
      const color = colors[0];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Bright Orange', async () => {
      const color = colors[1];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Pure Yellow', async () => {
      const color = colors[2];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Lime Green', async () => {
      const color = colors[3];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Pure Green', async () => {
      const color = colors[4];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Light Sea Green', async () => {
      const color = colors[5];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Pure Cyan', async () => {
      const color = colors[6];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Deep Sky Blue', async () => {
      const color = colors[7];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Pure Blue', async () => {
      const color = colors[8];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Blue Violet', async () => {
      const color = colors[9];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Pure Magenta', async () => {
      const color = colors[10];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Deep Pink', async () => {
      const color = colors[11];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    // 50% saturation

    test('Pure Red 50%', async () => {
      const color = colors[12];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Bright Orange 50%', async () => {
      const color = colors[13];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Pure Yellow 50%', async () => {
      const color = colors[14];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Lime Green 50%', async () => {
      const color = colors[15];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Pure Green 50%', async () => {
      const color = colors[16];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Light Sea Green 50%', async () => {
      const color = colors[17];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Pure Cyan 50%', async () => {
      const color = colors[18];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Deep Sky Blue 50%', async () => {
      const color = colors[19];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Pure Blue 50%', async () => {
      const color = colors[20];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Blue Violet 50%', async () => {
      const color = colors[21];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Pure Magenta 50%', async () => {
      const color = colors[22];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Deep Pink 50%', async () => {
      const color = colors[23];
      expect(rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });

    test('Achromatic', async () => {
      expect(rgbColorToHslColor({ r: 128, g: 128, b: 128 })).toStrictEqual({ h: 0, s: 0, l: 50 });
    });
  });

  describe('rgbColorToXYColor', () => {
    test('Pure Red', async () => {
      const color = colors[0];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Bright Orange', async () => {
      const color = colors[1];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Pure Yellow', async () => {
      const color = colors[2];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Lime Green', async () => {
      const color = colors[3];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Pure Green', async () => {
      const color = colors[4];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Light Sea Green', async () => {
      const color = colors[5];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Pure Cyan', async () => {
      const color = colors[6];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Deep Sky Blue', async () => {
      const color = colors[7];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Pure Blue', async () => {
      const color = colors[8];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Blue Violet', async () => {
      const color = colors[9];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Pure Magenta', async () => {
      const color = colors[10];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Deep Pink', async () => {
      const color = colors[11];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    // 50% saturation

    test('Pure Red 50%', async () => {
      const color = colors[12];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Bright Orange 50%', async () => {
      const color = colors[13];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Pure Yellow 50%', async () => {
      const color = colors[14];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Lime Green 50%', async () => {
      const color = colors[15];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Pure Green 50%', async () => {
      const color = colors[16];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Light Sea Green 50%', async () => {
      const color = colors[17];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Pure Cyan 50%', async () => {
      const color = colors[18];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Deep Sky Blue 50%', async () => {
      const color = colors[19];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Pure Blue 50%', async () => {
      const color = colors[20];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Blue Violet 50%', async () => {
      const color = colors[21];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Pure Magenta 50%', async () => {
      const color = colors[22];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });

    test('Deep Pink 50%', async () => {
      const color = colors[23];
      expect(rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b })).toStrictEqual({ x: color.xy.x, y: color.xy.y });
    });
  });

  describe('xyColorToRgbColor', () => {
    test('Pure Red', async () => {
      const color = colors[0];
      expect(xyColorToRgbColor(color.xy.x, color.xy.y)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Bright Orange', async () => {
      const color = colors[1];
      expect(xyColorToRgbColor(color.xy.x, color.xy.y)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Yellow', async () => {
      const color = colors[2];
      expect(xyColorToRgbColor(color.xy.x, color.xy.y)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Lime Green', async () => {
      const color = colors[3];
      expect(xyColorToRgbColor(color.xy.x, color.xy.y)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Green', async () => {
      const color = colors[4];
      expect(xyColorToRgbColor(color.xy.x, color.xy.y)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Light Sea Green', async () => {
      const color = colors[5];
      expect(xyColorToRgbColor(color.xy.x, color.xy.y)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Cyan', async () => {
      const color = colors[6];
      expect(xyColorToRgbColor(color.xy.x, color.xy.y)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Deep Sky Blue', async () => {
      const color = colors[7];
      expect(xyColorToRgbColor(color.xy.x, color.xy.y)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Blue', async () => {
      const color = colors[8];
      expect(xyColorToRgbColor(color.xy.x, color.xy.y)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Blue Violet', async () => {
      const color = colors[9];
      expect(xyColorToRgbColor(color.xy.x, color.xy.y)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Pure Magenta', async () => {
      const color = colors[10];
      expect(xyColorToRgbColor(color.xy.x, color.xy.y)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });

    test('Deep Pink', async () => {
      const color = colors[11];
      expect(xyColorToRgbColor(color.xy.x, color.xy.y)).toStrictEqual({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    });
  });

  describe('colorTemperature', () => {
    test('Mired to kelvin', async () => {
      expect(miredToKelvin(500)).toBe(2000);
      expect(miredToKelvin(400)).toBe(2500);
      expect(miredToKelvin(300)).toBe(3333);
      expect(miredToKelvin(250)).toBe(4000);
      expect(miredToKelvin(200)).toBe(5000);
      expect(miredToKelvin(147)).toBe(6803);
    });

    test('Kelvin to mired', async () => {
      expect(kelvinToMired(2000)).toBe(500);
      expect(kelvinToMired(2500)).toBe(400);
      expect(kelvinToMired(2700)).toBe(370);
      expect(kelvinToMired(3000)).toBe(333);
      expect(kelvinToMired(3333)).toBe(300);
      expect(kelvinToMired(4000)).toBe(250);
      expect(kelvinToMired(5000)).toBe(200);
      expect(kelvinToMired(6803)).toBe(147);
    });

    test('Kelvin to RGB', async () => {
      expect(kelvinToRGB(10)).toEqual({ r: 255, g: 68, b: 0 });
      expect(kelvinToRGB(2000)).toEqual({ r: 255, g: 137, b: 14 });
      expect(kelvinToRGB(2500)).toEqual({ r: 255, g: 159, b: 70 });
      expect(kelvinToRGB(2700)).toEqual({ r: 255, g: 167, b: 87 });
      expect(kelvinToRGB(3000)).toEqual({ r: 255, g: 177, b: 110 });
      expect(kelvinToRGB(3333)).toEqual({ r: 255, g: 188, b: 131 });
      expect(kelvinToRGB(4000)).toEqual({ r: 255, g: 206, b: 166 });
      expect(kelvinToRGB(5000)).toEqual({ r: 255, g: 228, b: 206 });
      expect(kelvinToRGB(6803)).toEqual({ r: 250, g: 246, b: 255 });
    });
  });

  describe('xyToHsl', () => {
    test('Pure Red', async () => {
      const color = colors[0];
      expect(xyToHsl(color.xy.x, color.xy.y)).toStrictEqual({ h: color.hsl.h, s: color.hsl.s, l: color.hsl.l });
    });
  });
});
