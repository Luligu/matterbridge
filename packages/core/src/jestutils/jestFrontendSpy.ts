/**
 * @description This file contains the Jest helpers.
 * @file src/jestFrontendSpy.ts
 * @author Luca Liguori
 * @created 2026-04-15
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
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

import { jest } from '@jest/globals';

import { Frontend } from '../frontend.js';

// Spy on Frontend methods
export const wssSendSnackbarMessageFrontendSpy = jest.spyOn(Frontend.prototype, 'wssSendSnackbarMessage');
export const wssSendCloseSnackbarMessageFrontendSpy = jest.spyOn(Frontend.prototype, 'wssSendCloseSnackbarMessage');
export const wssSendUpdateRequiredFrontendSpy = jest.spyOn(Frontend.prototype, 'wssSendUpdateRequired');
export const wssSendRefreshRequiredFrontendSpy = jest.spyOn(Frontend.prototype, 'wssSendRefreshRequired');
export const wssSendRestartRequiredFrontendSpy = jest.spyOn(Frontend.prototype, 'wssSendRestartRequired');
export const wssSendRestartNotRequiredFrontendSpy = jest.spyOn(Frontend.prototype, 'wssSendRestartNotRequired');
