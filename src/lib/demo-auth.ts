export type DemoLoginInput = {
  userId: string;
  password: string;
  rememberMe: boolean;
};

const DEMO_USER_ID = "admin";
const DEMO_PASSWORD = "1234";
const AUTH_STORAGE_KEY = "naverworks-clone-demo-auth";
const AUTH_REQUIRED_TOAST_KEY = "naverworks-clone-auth-required";

export const isDemoCredential = (userId: string, password: string) =>
  userId === DEMO_USER_ID && password === DEMO_PASSWORD;

export const saveDemoAuthentication = (rememberMe: boolean) => {
  const storage = rememberMe ? window.localStorage : window.sessionStorage;
  const otherStorage = rememberMe ? window.sessionStorage : window.localStorage;

  storage.setItem(AUTH_STORAGE_KEY, "authenticated");
  otherStorage.removeItem(AUTH_STORAGE_KEY);
};

export const isDemoAuthenticated = () =>
  window.localStorage.getItem(AUTH_STORAGE_KEY) === "authenticated" ||
  window.sessionStorage.getItem(AUTH_STORAGE_KEY) === "authenticated";

export const clearDemoAuthentication = () => {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
};

export const markAuthenticationRequired = () => {
  window.sessionStorage.setItem(AUTH_REQUIRED_TOAST_KEY, "true");
};

export const consumeAuthenticationRequired = () => {
  const isRequired = window.sessionStorage.getItem(AUTH_REQUIRED_TOAST_KEY) === "true";
  window.sessionStorage.removeItem(AUTH_REQUIRED_TOAST_KEY);
  return isRequired;
};
