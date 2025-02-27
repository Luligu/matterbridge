/**
 * This file contains the color utilities.
 *
 * @file colorUtils.ts
 * @author Luca Liguori
 * @date 2023-10-05
 * @version 1.3.0
 *
 * Copyright 2023, 2024, 2025 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. *
 */

import { assert } from 'node:console';

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface XY {
  x: number;
  y: number;
}

export interface HSL {
  h: number;
  s: number;
  l: number;
}

export function hslColorToRgbColor(hue: number, saturation: number, luminance: number): RGB {
  if (hue === 360) {
    hue = 0;
  }
  assert(hue >= 0 && hue <= 359, 'hslColorToRgbColor Hue error');
  assert(saturation >= 0 && saturation <= 100, 'hslColorToRgbColor Saturation error');
  assert(luminance === 50, 'hslColorToRgbColor Luminance error');

  saturation /= 100;
  luminance /= 100;
  let r: number, g: number, b: number;

  if (saturation === 0) {
    r = g = b = luminance; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) {
        t += 1;
      }
      if (t > 1) {
        t -= 1;
      }
      if (t < 1 / 6) {
        return p + (q - p) * 6 * t;
      }
      if (t < 1 / 2) {
        return q;
      }
      if (t < 2 / 3) {
        return p + (q - p) * (2 / 3 - t) * 6;
      }
      return p;
    };

    const q = luminance < 0.5 ? luminance * (1 + saturation) : luminance + saturation - luminance * saturation;
    const p = 2 * luminance - q;

    r = hue2rgb(p, q, hue / 360 + 1 / 3);
    g = hue2rgb(p, q, hue / 360);
    b = hue2rgb(p, q, hue / 360 - 1 / 3);
  }

  return {
    r: Math.ceil(r * 255),
    g: Math.ceil(g * 255),
    b: Math.ceil(b * 255),
  };
}

// Converts from RGB to the XY color (CIE 1931 color space)
export function rgbColorToXYColor(rgb: RGB): XY {
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  // Apply gamma correction
  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Scale the values to the D65 illuminant
  r = r * 100;
  g = g * 100;
  b = b * 100;

  // Convert RGB to XYZ
  const X = r * 0.664511 + g * 0.154324 + b * 0.162028;
  const Y = r * 0.283881 + g * 0.668433 + b * 0.047685;
  const Z = r * 0.000088 + g * 0.07231 + b * 0.986039;

  // Normalization
  let x = X / (X + Y + Z);
  let y = Y / (X + Y + Z);

  // Round to 4 digits
  x = Math.round(x * 10000) / 10000;
  y = Math.round(y * 10000) / 10000;

  return { x, y };
}

export function xyColorToRgbColor(x: number, y: number, brightness = 254): RGB {
  const z = 1.0 - x - y;
  const Y = (brightness / 254).toFixed(2);
  const X = (Number(Y) / y) * x;
  const Z = (Number(Y) / y) * z;

  // Convert to RGB using Wide RGB D65 conversion
  let red = X * 1.656492 - Number(Y) * 0.354851 - Z * 0.255038;
  let green = -X * 0.707196 + Number(Y) * 1.655397 + Z * 0.036152;
  let blue = X * 0.051713 - Number(Y) * 0.121364 + Z * 1.01153;

  // If red, green or blue is larger than 1.0 set it back to the maximum of 1.0
  if (red > blue && red > green && red > 1.0) {
    green = green / red;
    blue = blue / red;
    red = 1.0;
  } else if (green > blue && green > red && green > 1.0) {
    red = red / green;
    blue = blue / green;
    green = 1.0;
  } else if (blue > red && blue > green && blue > 1.0) {
    red = red / blue;
    green = green / blue;
    blue = 1.0;
  }

  // Reverse gamma correction
  red = red <= 0.0031308 ? 12.92 * red : (1.0 + 0.055) * Math.pow(red, 1.0 / 2.4) - 0.055;
  green = green <= 0.0031308 ? 12.92 * green : (1.0 + 0.055) * Math.pow(green, 1.0 / 2.4) - 0.055;
  blue = blue <= 0.0031308 ? 12.92 * blue : (1.0 + 0.055) * Math.pow(blue, 1.0 / 2.4) - 0.055;

  // Convert normalized decimal to decimal
  red = Math.round(red * 255);
  green = Math.round(green * 255);
  blue = Math.round(blue * 255);

  // Normalize
  if (isNaN(red) || red < 0) {
    red = 0;
  }
  if (isNaN(green) || green < 0) {
    green = 0;
  }
  if (isNaN(blue) || blue < 0) {
    blue = 0;
  }

  return { r: Math.round(red), g: Math.round(green), b: Math.round(blue) };
}

export function rgbColorToHslColor(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function xyToHsl(x: number, y: number): HSL {
  const rgb = xyColorToRgbColor(x, y);
  return rgbColorToHslColor(rgb);
}

export function miredToKelvin(mired: number): number {
  return Math.round(1000000 / mired);
}

export function kelvinToMired(kelvin: number): number {
  return Math.round(1000000 / kelvin);
}

export function kelvinToRGB(kelvin: number): RGB {
  // Clamp the temperature to the range 1000K to 40000K
  kelvin = Math.max(1000, Math.min(40000, kelvin)) / 100;

  let r: number, g: number, b: number;

  // Calculate red
  if (kelvin <= 66) {
    r = 255;
  } else {
    r = kelvin - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    r = Math.max(0, Math.min(255, r));
  }

  // Calculate green
  if (kelvin <= 66) {
    g = kelvin;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    g = Math.max(0, Math.min(255, g));
  } else {
    g = kelvin - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    g = Math.max(0, Math.min(255, g));
  }

  // Calculate blue
  if (kelvin >= 66) {
    b = 255;
  } else if (kelvin <= 19) {
    b = 0;
  } else {
    b = kelvin - 10;
    b = 138.5177312231 * Math.log(b) - 305.0447927307;
    b = Math.max(0, Math.min(255, b));
  }

  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

/*
export function testColors(): void {
  // this table has been checked with different apps and sites and is correct 100%
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

  colors.forEach((color) => {
    // eslint-disable-next-line no-console
    console.log(
      `\x1b[48;2;${color.rgb.r};${color.rgb.g};${color.rgb.b}mColor: ${color.name}\x1b[0m, hsl: { h: ${color.hsl.h}, s: ${color.hsl.s}, l: ${color.hsl.l} }, rgb: { r: ${color.rgb.r}, g: ${color.rgb.g}, b: ${color.rgb.b} }, xy: { x: ${color.xy.x}, y: ${color.xy.y} }`,
    );

    const rgb = hslColorToRgbColor(color.hsl.h, color.hsl.s, color.hsl.l);
    assert(rgb.r === color.rgb.r && rgb.g === color.rgb.g && rgb.b === color.rgb.b, `\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}mColor: ${color.name}\x1b[0m hslColorToRgbColor { r: ${rgb.r}, g: ${rgb.g}, b: ${rgb.b} } conversion error`);

    const hsl = rgbColorToHslColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    assert(hsl.h === color.hsl.h && hsl.s === color.hsl.s && hsl.l === color.hsl.l, `Color: ${color.name} rgbColorToHslColor conversion error`);

    const xy = rgbColorToXYColor({ r: color.rgb.r, g: color.rgb.g, b: color.rgb.b });
    assert(xy.x === color.xy.x && xy.y === color.xy.y, `Color: ${color.name} rgbColorToXYColor conversion error got x ${xy.x} y ${xy.y}`);

    const rgb2 = xyColorToRgbColor(color.xy.x, color.xy.y);
    assert(
      rgb2.r === color.rgb.r && rgb2.g === color.rgb.g && rgb2.b === color.rgb.b,
      `\x1b[48;2;${rgb2.r};${rgb2.g};${rgb2.b}mColor: ${color.name}\x1b[0m xyColorToRgbColor(${color.xy.x}, ${color.xy.y}) conversion error -> r: ${rgb2.r} g: ${rgb2.g} b: ${rgb2.g}`,
    );
  });
}
*/
/**
 * Converts CIE color space to RGB color space
 * @param {Number} x
 * @param {Number} y
 * @param {Number} brightness - Ranges from 1 to 254
 * @return {Array} Array that contains the color values for red, green and blue
 * From: https://github.com/usolved/cie-rgb-converter/blob/master/cie_rgb_converter.js
 */
/*
export function cie_to_rgb(x: number, y: number, brightness = 254): RGB {
  // Set to maximum brightness if no custom value was given (Not the slick ECMAScript 6 way for compatibility reasons)

  const z = 1.0 - x - y;
  const Y = (brightness / 254).toFixed(2);
  const X = (Number(Y) / y) * x;
  const Z = (Number(Y) / y) * z;

  // Convert to RGB using Wide RGB D65 conversion
  let red = X * 1.656492 - Number(Y) * 0.354851 - Z * 0.255038;
  let green = -X * 0.707196 + Number(Y) * 1.655397 + Z * 0.036152;
  let blue = X * 0.051713 - Number(Y) * 0.121364 + Z * 1.01153;

  // If red, green or blue is larger than 1.0 set it back to the maximum of 1.0
  if (red > blue && red > green && red > 1.0) {
    green = green / red;
    blue = blue / red;
    red = 1.0;
  } else if (green > blue && green > red && green > 1.0) {
    red = red / green;
    blue = blue / green;
    green = 1.0;
  } else if (blue > red && blue > green && blue > 1.0) {
    red = red / blue;
    green = green / blue;
    blue = 1.0;
  }

  // Reverse gamma correction
  red = red <= 0.0031308 ? 12.92 * red : (1.0 + 0.055) * Math.pow(red, 1.0 / 2.4) - 0.055;
  green = green <= 0.0031308 ? 12.92 * green : (1.0 + 0.055) * Math.pow(green, 1.0 / 2.4) - 0.055;
  blue = blue <= 0.0031308 ? 12.92 * blue : (1.0 + 0.055) * Math.pow(blue, 1.0 / 2.4) - 0.055;

  // Convert normalized decimal to decimal
  red = Math.round(red * 255);
  green = Math.round(green * 255);
  blue = Math.round(blue * 255);

  // Normalize
  if (isNaN(red) || red < 0) {
    red = 0;
  }
  if (isNaN(green) || green < 0) {
    green = 0;
  }
  if (isNaN(blue) || blue < 0) {
    blue = 0;
  }

  return { r: red, g: green, b: blue };
}
*/
/**
 * Converts RGB color space to CIE color space
 * @param {Number} red
 * @param {Number} green
 * @param {Number} blue
 * @return {Array} Array that contains the CIE color values for x and y
 * From: https://github.com/usolved/cie-rgb-converter/blob/master/cie_rgb_converter.js
 */
/*
export function rgb_to_cie(red: number, green: number, blue: number): XY {
  // Apply a gamma correction to the RGB values, which makes the color more vivid and more the like the color displayed on the screen of your device
  red = red > 0.04045 ? Math.pow((red + 0.055) / (1.0 + 0.055), 2.4) : red / 12.92;
  green = green > 0.04045 ? Math.pow((green + 0.055) / (1.0 + 0.055), 2.4) : green / 12.92;
  blue = blue > 0.04045 ? Math.pow((blue + 0.055) / (1.0 + 0.055), 2.4) : blue / 12.92;

  // RGB values to XYZ using the Wide RGB D65 conversion formula
  const X = red * 0.664511 + green * 0.154324 + blue * 0.162028;
  const Y = red * 0.283881 + green * 0.668433 + blue * 0.047685;
  const Z = red * 0.000088 + green * 0.07231 + blue * 0.986039;

  // Calculate the xy values from the XYZ values
  let x = (X / (X + Y + Z)).toFixed(4);
  let y = (Y / (X + Y + Z)).toFixed(4);

  if (isNaN(Number(x))) {
    x = '0';
  }

  if (isNaN(Number(y))) {
    y = '0';
  }

  return { x: Number(x), y: Number(y) };
}
*/
/*
testColors();
console.log('rgb_to_cie(0, 128, 255)', rgb_to_cie(0, 128, 255));
console.log('cie_to_rgb(0.1401, 0.1284, 254)', cie_to_rgb(0.1401, 0.1284, 254));
console.log('cie_to_rgb(0.1406, 0.1382, 254)', cie_to_rgb(0.1406, 0.1382, 254));
for (let h = 0; h < 360; h++) {
  const rgb = hslColorToRgbColor(h, 100, 50);
  const xy = rgbColorToXYColor({ r: rgb.r, g: rgb.g, b: rgb.b });
  const rgb2 = cie_to_rgb(xy.x, xy.y, 254);
  const hsl = rgbColorToHslColor({ r: rgb2.r, g: rgb2.g, b: rgb2.b });
  assert(rgb.r === rgb2.r && rgb.g === rgb2.g && rgb.b === rgb2.b, 'Color rgb conversion error');
  assert(h === hsl.h, 'Color hsl conversion error');
  console.log(`\x1b[48;2;${rgb.r};${rgb.g};${rgb.b}mColor: r:${rgb.r} g:${rgb.g} b:${rgb.b}\x1b[0m => x:${xy.x} y:${xy.y} => \x1b[48;2;${rgb2.r};${rgb2.g};${rgb2.b}mColor: r:${rgb2.r} g:${rgb2.g} b:${rgb2.b} h:${hsl.h} s:${hsl.s}\x1b[0m\x1b[K`);
}
*/
