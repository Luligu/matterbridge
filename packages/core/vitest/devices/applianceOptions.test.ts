/**
 * @file packages/core/vitest/devices/applianceOptions.test.ts
 * @description Tests endpoint options shared by Chapter 13 appliance classes.
 * @author Luca Liguori
 */

import { EndpointNumber } from '@matter/types/datatype';
import { setupTest } from '@matterbridge/vitest-utils';

import { AirConditioner } from '../../src/devices/airConditioner.js';
import { Cooktop } from '../../src/devices/cooktop.js';
import { Dishwasher } from '../../src/devices/dishwasher.js';
import { ExtractorHood } from '../../src/devices/extractorHood.js';
import { LaundryDryer } from '../../src/devices/laundryDryer.js';
import { LaundryWasher } from '../../src/devices/laundryWasher.js';
import { MicrowaveOven } from '../../src/devices/microwaveOven.js';
import { Oven } from '../../src/devices/oven.js';
import { Refrigerator } from '../../src/devices/refrigerator.js';
import type { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

await setupTest('ApplianceOptions', false);

describe('Chapter 13 appliance endpoint options', () => {
  const tagList = [{ mfgCode: null, namespaceId: 1, tag: 1, label: 'One' }];
  const cases: { name: string; number: EndpointNumber; create: () => MatterbridgeEndpoint }[] = [
    {
      name: 'LaundryWasher',
      number: EndpointNumber(13_01),
      create: () => new LaundryWasher('Laundry Washer', 'LW-OPTIONS', { id: 'LaundryWasherOptions', number: EndpointNumber(13_01), tagList }),
    },
    {
      name: 'Refrigerator',
      number: EndpointNumber(13_02),
      create: () => new Refrigerator('Refrigerator', 'RF-OPTIONS', { id: 'RefrigeratorOptions', number: EndpointNumber(13_02), tagList }),
    },
    {
      name: 'AirConditioner',
      number: EndpointNumber(13_03),
      create: () => new AirConditioner('Air Conditioner', 'AC-OPTIONS', { id: 'AirConditionerOptions', number: EndpointNumber(13_03), tagList }),
    },
    {
      name: 'Dishwasher',
      number: EndpointNumber(13_05),
      create: () => new Dishwasher('Dishwasher', 'DW-OPTIONS', { id: 'DishwasherOptions', number: EndpointNumber(13_05), tagList }),
    },
    {
      name: 'LaundryDryer',
      number: EndpointNumber(13_06),
      create: () => new LaundryDryer('Laundry Dryer', 'LD-OPTIONS', { id: 'LaundryDryerOptions', number: EndpointNumber(13_06), tagList }),
    },
    {
      name: 'Cooktop',
      number: EndpointNumber(13_08),
      create: () => new Cooktop('Cooktop', 'CT-OPTIONS', { id: 'CooktopOptions', number: EndpointNumber(13_08), tagList }),
    },
    {
      name: 'Oven',
      number: EndpointNumber(13_09),
      create: () => new Oven('Oven', 'OV-OPTIONS', { id: 'OvenOptions', number: EndpointNumber(13_09), tagList }),
    },
    {
      name: 'ExtractorHood',
      number: EndpointNumber(13_10),
      create: () => new ExtractorHood('Extractor Hood', 'EH-OPTIONS', { id: 'ExtractorHoodOptions', number: EndpointNumber(13_10), tagList }),
    },
    {
      name: 'MicrowaveOven',
      number: EndpointNumber(13_11),
      create: () => new MicrowaveOven('Microwave Oven', 'MW-OPTIONS', { id: 'MicrowaveOvenOptions', number: EndpointNumber(13_11), tagList }),
    },
  ];

  test.each(cases)('create $name with endpoint options', ({ name, number, create }) => {
    const device = create();

    expect(device.id).toBe(`${name}Options`);
    expect(device.number).toBe(number);
    expect(device.tagList).toEqual(tagList);
  });
});
