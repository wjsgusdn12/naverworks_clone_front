// 진행 중인 서버 요청 수를 세는 작은 저장소. 화면 맨 위 진행 막대가 이 값을 구독함.
// 각 API 모듈의 fetch를 trackRequest로 감싸기만 하면 자동으로 집계됨.
let pendingCount = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export function trackRequest<T>(request: Promise<T>): Promise<T> {
  pendingCount += 1;
  emit();
  return request.finally(() => {
    pendingCount -= 1;
    emit();
  });
}

export function subscribePendingRequests(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPendingRequestCount() {
  return pendingCount;
}
