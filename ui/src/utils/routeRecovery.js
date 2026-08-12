const RETRY_KEY = 'sd-rescripts:route-recovery-retry';

export function isRouteChunkError(error) {
  const text = String(error?.message || error?.reason?.message || error || '').toLowerCase();
  return text.includes('chunkloaderror')
    || text.includes('loading chunk')
    || text.includes('failed to fetch dynamically imported module')
    || text.includes('importing a module script failed');
}

function renderFailure(documentRef, reload) {
  if (!documentRef?.body || documentRef.getElementById('route-recovery-banner')) return;
  const banner = documentRef.createElement('div');
  banner.id = 'route-recovery-banner';
  banner.setAttribute('role', 'alert');
  banner.style.cssText = 'position:fixed;z-index:9999;inset:12px 12px auto 12px;padding:12px 16px;border:1px solid var(--danger,#ef4444);border-radius:8px;background:var(--bg-panel,#1c1f26);color:var(--text-primary,#fff);display:flex;gap:12px;align-items:center;justify-content:space-between;';
  banner.innerHTML = '<span>页面资源加载失败，请重试。</span><button type="button" class="btn btn-outline btn-sm">重试</button>';
  banner.querySelector('button')?.addEventListener('click', () => {
    globalThis.sessionStorage?.removeItem(RETRY_KEY);
    reload?.();
  });
  documentRef.body.appendChild(banner);
}

export function installRouteChunkRecovery({ windowRef = globalThis, documentRef = globalThis.document, storage = globalThis.sessionStorage, reload = () => windowRef.location?.reload() } = {}) {
  if (!windowRef?.addEventListener) return () => {};
  let handled = false;
  const handle = (event) => {
    if (handled || !isRouteChunkError(event?.error || event?.reason || event?.message)) return;
    handled = true;
    if (storage?.getItem(RETRY_KEY) !== '1') {
      storage?.setItem(RETRY_KEY, '1');
      reload?.();
      return;
    }
    renderFailure(documentRef, reload);
  };
  windowRef.addEventListener('error', handle, true);
  windowRef.addEventListener('unhandledrejection', handle);
  const clearRetry = () => windowRef.setTimeout?.(() => storage?.removeItem(RETRY_KEY), 5000);
  windowRef.addEventListener('load', clearRetry, { once: true });
  return () => {
    windowRef.removeEventListener('error', handle, true);
    windowRef.removeEventListener('unhandledrejection', handle);
    windowRef.removeEventListener('load', clearRetry);
  };
}
