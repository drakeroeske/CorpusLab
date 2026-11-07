// Browser persistence adapter. Only bundled when built with VITE_PERSIST=local
// (standalone hosting). The sandboxed preview build keeps data in memory instead.
export function getLocalStore(): Storage | null {
  try {
    const s = window.localStorage;
    s.setItem("__corpus_test__", "1");
    s.removeItem("__corpus_test__");
    return s;
  } catch {
    return null;
  }
}
