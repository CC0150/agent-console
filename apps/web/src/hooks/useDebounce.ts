/**
 * 输入防抖 Hook：useDebouncedValue 延迟更新值，
 * useDebouncedInput 用于受控输入框，外部值变化时立即同步，用户输入延迟后触发 onChange。
 */
import { useEffect, useRef, useState } from "react";

export function useDebouncedValue<T>(value: T, delay = 1000): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function useDebouncedInput(
  value: string,
  onChange: (value: string) => void,
  delay = 1000,
): [string, (value: string) => void] {
  const [input, setInput] = useState(value);
  const debounced = useDebouncedValue(input, delay);
  const lastCommitted = useRef(value);

  useEffect(() => {
    if (value !== lastCommitted.current) {
      lastCommitted.current = value;
      setInput(value);
    }
  }, [value]);

  useEffect(() => {
    if (debounced !== lastCommitted.current) {
      lastCommitted.current = debounced;
      onChange(debounced);
    }
  }, [debounced, onChange]);

  return [input, setInput];
}
