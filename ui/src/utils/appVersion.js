const FALLBACK_VERSION = 'v0.1.0';

function cleanVersion(value) {
  return String(value || '').trim().replace(/^["']|["']$/g, '');
}

export async function loadAppVersion() {
  try {
    const textResp = await fetch('/.version', { cache: 'no-store' });
    if (textResp.ok) {
      const text = cleanVersion(await textResp.text());
      const firstLine = text.split(/\r?\n/).map(cleanVersion).find((line) => line && !line.startsWith('#'));
      if (firstLine) return firstLine.includes('=') ? firstLine.split('=', 2)[1].trim() : firstLine;
    }
  } catch (_error) { /* fall through */ }

  try {
    const apiResp = await fetch('/api/app_version', { cache: 'no-store' });
    if (apiResp.ok) {
      const payload = await apiResp.json();
      const version = cleanVersion(payload?.data?.version || payload?.version);
      if (version) return version;
    }
  } catch (_error) { /* fall through */ }

  return FALLBACK_VERSION;
}

export function applyAppVersion(version) {
  const cleaned = cleanVersion(version) || FALLBACK_VERSION;
  document.querySelectorAll('.logo-version, [data-app-version]').forEach((el) => {
    el.textContent = cleaned;
  });
  document.title = `LoRA ${cleaned} | Lulynx Trainer`;
  return cleaned;
}
