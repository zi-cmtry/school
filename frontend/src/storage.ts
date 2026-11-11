/** 浏览器 localStorage 的最小读写面，测试可以换成内存实现。 */

export type KeyValueStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function browserStore(): KeyValueStore | null {
  if (typeof localStorage === "undefined") return null
  return localStorage
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = { ...initial }
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null
    },
    setItem(key, value) {
      data[key] = value
    },
  }
}
