export const dateKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
};

// 연속 메시지를 시:분 단위로 묶어 프로필·시간 반복 표시를 줄임.
export const minuteKey = (value: string) => {
  const date = new Date(value);
  return `${dateKey(value)}-${date.getHours()}-${date.getMinutes()}`;
};

export const formatChatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));

export const formatRoomTime = (value: string | null) => {
  if (!value) return "";
  const target = new Date(value);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const dayDifference = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / 86_400_000);
  if (dayDifference === 0)
    return target.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (dayDifference === 1) return "어제";
  return `${String(target.getMonth() + 1).padStart(2, "0")}. ${String(target.getDate()).padStart(2, "0")}.`;
};
