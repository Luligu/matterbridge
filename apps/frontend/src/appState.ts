// Frontend utils
import { MbfLsk } from './utils/localStorage';

// Global debug flag
export let debug = false;
export const toggleDebug = () => {
  debug = !debug;
};

export const enableWindows = false;

export let enableMobile = localStorage.getItem(MbfLsk['enable-mobile']) !== 'false'; // default true
export const setEnableMobile = () => {
  enableMobile = true;
  localStorage.setItem(MbfLsk['enable-mobile'], 'true');
};
export const clearEnableMobile = () => {
  enableMobile = false;
  localStorage.setItem(MbfLsk['enable-mobile'], 'false');
};

export let wssPassword: string | undefined;
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
