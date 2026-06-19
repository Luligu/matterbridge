// Frontend utils
import { MbfLsk } from './utils/localStorage';

// Global debug flag
export let debug = false;
export const toggleDebug = () => {
  debug = !debug;
};

export const enableWindows = false;

export let enableMobile = localStorage.getItem(MbfLsk.enableMobile) !== 'false'; // default true
export const setEnableMobile = () => {
  enableMobile = true;
  localStorage.setItem(MbfLsk.enableMobile, 'true');
};
export const clearEnableMobile = () => {
  enableMobile = false;
  localStorage.setItem(MbfLsk.enableMobile, 'false');
};

export let wssPassword: string | undefined = undefined;
export const setWssPassword = (password: string) => {
  wssPassword = password;
};

export let isIngress = false;
export const setIsIngress = (value: boolean) => {
  isIngress = value;
};

export let basePath = '/';
export const setBasePath = (value: string) => {
  basePath = value;
};
