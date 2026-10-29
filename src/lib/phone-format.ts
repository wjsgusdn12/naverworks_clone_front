// 입력 중인 전화번호를 숫자만 남겨 한국 형식으로 하이픈을 자동으로 넣음.
// 010-1234-5678, 02-123-4567, 02-1234-5678, 031-123-4567, 1588-1234 등.
export const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";

  // 서울(02)은 지역번호가 두 자리.
  if (digits.startsWith("02")) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  // 대표번호(1588 등)는 네 자리-네 자리.
  if (/^1[5-9]\d{2}/.test(digits) && digits.length <= 8) {
    return digits.length <= 4 ? digits : `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  // 휴대폰·그 외 지역번호는 세 자리로 시작.
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};
