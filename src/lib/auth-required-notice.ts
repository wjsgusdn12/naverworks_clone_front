const AUTH_REQUIRED_TOAST_KEY = "naverworks-clone-auth-required";

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
