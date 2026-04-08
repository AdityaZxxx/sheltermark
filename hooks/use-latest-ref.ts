import { useEffect, useRef } from "react";

export function useLatestRef<T>(value: T): React.MutableRefObject<T> {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
