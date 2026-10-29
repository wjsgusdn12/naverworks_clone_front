import { useCallback, useLayoutEffect, useRef } from "react";

// 매 렌더마다 새로 만들어지는 함수를 늘 같은 참조로 감싸 줌.
// memo된 자식(메시지 목록)에 넘길 때 "함수가 바뀌었다"는 이유로 다시 그려지는 것을 막음.
export function useStableCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
) {
  const ref = useRef(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  });
  return useCallback((...args: Args) => ref.current(...args), []);
}
