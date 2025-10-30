/**
 * This file contains the color utilities.
 *
 * @file colorUtils.ts
 * @author Luca Liguori
 * @created 2023-10-05
 * @version 1.3.0
 * @license Apache-2.0
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
 * limitations under the License.
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

/**
 * Converts from HSL to RGB color space
 *
 * @param {number} hue - The hue value (0-360).
 * @param {number} saturation - The saturation value (0-100).
 * @param {number} luminance - The luminance value (0-100).
 * @returns {RGB} An object containing the RGB values.
 */
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

/**
 * Converts RGB color space to CIE 1931 XY color space
 *
 * @param {RGB} rgb - The RGB color object.
 * @returns {XY} An object containing the x and y values in CIE 1931 XY color space.
 */
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

/**
 * Converts CIE 1931 XY color space to RGB color space
 *
 * @param {number} x - The x value in CIE 1931 XY color space.
 * @param {number} y - The y value in CIE 1931 XY color space.
 * @param {number} [brightness] - The brightness value (1-254). Defaults to 254.
 * @returns {RGB} An object containing the RGB values.
 */
export function xyColorToRgbColor(x: number, y: number, brightness: number = 254): RGB {
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

  // Normalize even if this code should never be reached...
  if (isNaN(red) || red < 0) {
    /* istanbul ignore next */
    red = 0;
  }
  if (isNaN(green) || green < 0) {
    /* istanbul ignore next */
    green = 0;
  }
  if (isNaN(blue) || blue < 0) {
    /* istanbul ignore next */
    blue = 0;
  }

  // Fix negative zero issue by ensuring we return positive zero
  return {
    r: red === 0 ? 0 : red,
    g: green === 0 ? 0 : green,
    b: blue === 0 ? 0 : blue,
  };
}

/**
 *  Converts RGB color space to HSL color space
 *
 * @param {RGB} rgb - The RGB color object.
 * @returns {HSL} An object containing the HSL values.
 */
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

/**
 * Converts CIE 1931 XY color space to HSL color space
 *
 * @param {number} x - The x value in CIE 1931 XY color space.
 * @param {number} y - The y value in CIE 1931 XY color space.
 * @returns {HSL} An object containing the HSL values.
 */
export function xyToHsl(x: number, y: number): HSL {
  const rgb = xyColorToRgbColor(x, y);
  return rgbColorToHslColor(rgb);
}

/**
 * Converts mireds to kelvin.
 *
 * @param {number} mired - The mired value to convert.
 * @returns {number} The converted kelvin value.
 */
export function miredToKelvin(mired: number): number {
  return Math.round(1000000 / mired);
}
export const miredsToKelvin = miredToKelvin;

/**
 * Converts kelvin to mireds.
 *
 * @param {number} kelvin - The kelvin value to convert.
 * @returns {number} The converted mired value.
 */
export function kelvinToMired(kelvin: number): number {
  return Math.round(1000000 / kelvin);
}
export const kelvinToMireds = kelvinToMired;

/**
 * Converts kelvin to RGB color space.
 *
 * @param {number} kelvin - The kelvin value to convert (1000K to 40000K).
 * @returns {RGB} An object containing the RGB values.
 */
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
