// memo-v1: keep a query result in this server instance's memory for a while. Errors are never kept.
const store = new Map<string, { at: number; p: Promise<any> }>();
const hasError = (r: any) => !!(r && (r.error || (Array.isArray(r) && r.some((x: any) => x && x.error))));
export function memo<T>(key: string, ttlMs: number, fn: () => PromiseLike<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.p;
  const p = Promise.resolve(fn()).then(
    (r) => { if (hasError(r)) store.delete(key); return r; },
    (e) => { store.delete(key); throw e; },
  );
  store.set(key, { at: Date.now(), p });
  if (store.size > 500) store.delete(store.keys().next().value as string);
  return p;
}