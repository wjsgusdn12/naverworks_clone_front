// 로그인 폼에서 전달받는 입력값의 형태.
export type DemoLoginInput = {
  userId: string;
  password: string;
  rememberMe: boolean;
};

// API와 DB를 연결하기 전 화면 검증에만 사용하는 임시 계정.
const DEMO_USER_ID = "admin";
const DEMO_PASSWORD = "1234";
const AUTH_STORAGE_KEY = "naverworks-clone-demo-auth";
const AUTH_REQUIRED_TOAST_KEY = "naverworks-clone-auth-required";

// 입력한 아이디와 비밀번호가 데모 계정과 일치하는지 확인.
export const isDemoCredential = (userId: string, password: string) =>
  userId === DEMO_USER_ID && password === DEMO_PASSWORD;

// 로그인 유지 선택 여부에 따라 브라우저 저장 위치를 구분.
export const saveDemoAuthentication = (rememberMe: boolean) => {
  const storage = rememberMe ? window.localStorage : window.sessionStorage;
  const otherStorage = rememberMe ? window.sessionStorage : window.localStorage;

  storage.setItem(AUTH_STORAGE_KEY, "authenticated");
  otherStorage.removeItem(AUTH_STORAGE_KEY);
};

// 두 저장소 중 하나에 인증 표시가 있으면 로그인된 것으로 판단.
export const isDemoAuthenticated = () =>
  window.localStorage.getItem(AUTH_STORAGE_KEY) === "authenticated" ||
  window.sessionStorage.getItem(AUTH_STORAGE_KEY) === "authenticated";

// 로그아웃 시 모든 임시 인증 표시를 제거.
export const clearDemoAuthentication = () => {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
};

// 보호 화면 접근 후 로그인 화면에서 안내 토스트를 띄우기 위한 표시.
export const markAuthenticationRequired = () => {
  window.sessionStorage.setItem(AUTH_REQUIRED_TOAST_KEY, "true");
};

// 안내 토스트는 한 번만 보여 준 뒤 즉시 소비.
export const consumeAuthenticationRequired = () => {
  const isRequired = window.sessionStorage.getItem(AUTH_REQUIRED_TOAST_KEY) === "true";
  window.sessionStorage.removeItem(AUTH_REQUIRED_TOAST_KEY);
  return isRequired;
};
