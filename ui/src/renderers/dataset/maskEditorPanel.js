import { createMaskEditorHistory } from './maskEditorHistory.js';
import { unwrapEditorResponse } from './tagEditorSession.js';

const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
const dataUrl = blob => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
});
const imageFrom = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('无法解码图片')); img.src = src; });

export function createMaskEditorPanel({ container, api, showToast }) {
  const history = createMaskEditorHistory();
  let source = null;
  let loadVersion = 0;
  let generating = false;
  let saving = false;
  let savedMask = null;
  let stroke = null;
  container.innerHTML = `<summary>遮罩编辑（MobileSAM 点选）</summary>
    <p>点击原图后生成所选区域；也可在右侧画布涂白或擦黑。每次生成和每笔绘制均可单步撤销，保存写入图片旁的 _mask.png。</p>
    <span data-mask-path></span><span data-mask-status role="status"></span>
    <label>模式 <select data-mask-mode><option value="auto">点选分割</option><option value="paint">涂白</option><option value="erase">擦黑</option></select></label>
    <label>笔刷 <input data-mask-size type="number" min="1" max="256" value="24"></label>
    <div style="display:flex;gap:12px;flex-wrap:wrap;"><img data-mask-source style="max-width:45%;object-fit:contain;align-self:start;" alt="遮罩源图"><canvas data-mask-canvas style="max-width:45%;height:auto;touch-action:none;" aria-label="遮罩画布"></canvas></div>
    <button class="btn btn-outline btn-sm" data-mask-undo>撤销</button><button class="btn btn-outline btn-sm" data-mask-redo>重做</button>
    <button class="btn btn-primary btn-sm" data-mask-save>保存当前遮罩</button>`;
  const $ = query => container.querySelector(query);
  const canvas = $('[data-mask-canvas]');
  const context = canvas.getContext('2d');
  const status = value => { $('[data-mask-status]').textContent = value; };
  const readSource = async path => {
    const response = await fetch('/local/media/image?path=' + encodeURIComponent(path), { cache: 'no-store' });
    if (!response.ok) throw new Error('无法读取源图');
    return response.blob();
  };
  async function sourceUnchanged(current) {
    const blob = await readSource(current.path);
    return await digest(await blob.arrayBuffer()) === current.revision;
  }
  function buttons() {
    $('[data-mask-undo]').disabled = saving || !history.canUndo;
    $('[data-mask-redo]').disabled = saving || !history.canRedo;
    $('[data-mask-save]').disabled = saving || !source || !history.current || history.current === savedMask || !!stroke;
  }
  async function draw() {
    const ticket = history.ticket();
    if (history.current) {
      const img = await imageFrom(history.current);
      if (!history.isCurrent(ticket)) return;
      context.drawImage(img, 0, 0, canvas.width, canvas.height);
    } else { context.fillStyle = 'black'; context.fillRect(0, 0, canvas.width, canvas.height); }
    buttons();
  }
  async function generate(point) {
    if (!source || saving || generating) return;
    generating = true;
    const current = source;
    const ticket = history.ticket();
    status('分割中…');
    try {
      const result = unwrapEditorResponse(await api.runCoreTool('/tools/segment', {
        image_base64: current.encoded.split(',')[1], points: [point], feather_radius: 3,
      }));
      if (!history.isCurrent(ticket)) return;
      if (!await sourceUnchanged(current)) {
        history.invalidate(); status('源图已变化，请重新选择图片。'); return;
      }
      const mask = `data:image/png;base64,${result.mask}`;
      const maskImage = await imageFrom(mask);
      if (maskImage.naturalWidth !== canvas.width || maskImage.naturalHeight !== canvas.height) throw new Error('分割遮罩尺寸与源图不一致，请重新载入。');
      if (!container.isConnected || !history.commit(mask, ticket)) return;
      await draw(); status('已生成，可继续编辑或保存。');
    } catch (error) { if (history.isCurrent(ticket)) status(error.message); }
    finally { generating = false; buttons(); }
  }
  function point(event, element) {
    const rect = element.getBoundingClientRect();
    return { x: Math.max(0, Math.min(canvas.width - 1, Math.floor((event.clientX - rect.left) * canvas.width / rect.width))),
      y: Math.max(0, Math.min(canvas.height - 1, Math.floor((event.clientY - rect.top) * canvas.height / rect.height))), label: 1 };
  }
  $('[data-mask-source]').onclick = event => generate(point(event, event.currentTarget));
  canvas.onpointerdown = event => {
    if (!source || saving || $('[data-mask-mode]').value === 'auto') return;
    history.invalidate();
    stroke = { value: canvas.toDataURL('image/png'), point: point(event, canvas) };
    canvas.setPointerCapture(event.pointerId);
    paint(event); buttons();
  };
  function paint(event) {
    if (!stroke) return;
    const next = point(event, canvas);
    context.strokeStyle = $('[data-mask-mode]').value === 'erase' ? 'black' : 'white';
    context.lineWidth = Math.max(1, Math.min(256, Number($('[data-mask-size]').value) || 24));
    context.lineCap = 'round'; context.beginPath(); context.moveTo(stroke.point.x, stroke.point.y);
    context.lineTo(next.x + 0.01, next.y + 0.01); context.stroke(); stroke.point = next;
  }
  canvas.onpointermove = paint;
  canvas.onpointerup = () => { if (stroke) { history.commit(canvas.toDataURL('image/png')); stroke = null; buttons(); } };
  canvas.onpointercancel = () => { stroke = null; draw(); };
  $('[data-mask-undo]').onclick = () => { if (!saving) { stroke = null; history.undo(); draw(); } };
  $('[data-mask-redo]').onclick = () => { if (!saving) { stroke = null; history.redo(); draw(); } };
  $('[data-mask-save]').onclick = async () => {
    if (!source || saving || !history.current || stroke) return;
    const current = source;
    const ticket = history.ticket();
    saving = true; buttons();
    try {
      const result = unwrapEditorResponse(await api.runCoreTool('/tools/segment/save', {
        image_path: current.path, mask_base64: history.current, expected_source_revision: current.revision,
      }));
      if (history.isCurrent(ticket)) { savedMask = history.current; status(`已保存 ${result.mask_path}`); }
    } catch (error) { if (history.isCurrent(ticket)) status(error.message); }
    finally { saving = false; buttons(); }
  };
  buttons();
  return {
    async load(path) {
      const version = ++loadVersion;
      history.load(null, null); source = null; stroke = null; buttons();
      container.open = true;
      $('[data-mask-path]').textContent = path;
      status('读取源图…');
      try {
        const blob = await readSource(path);
        const [encoded, revision] = await Promise.all([dataUrl(blob), digest(await blob.arrayBuffer())]);
        const image = await imageFrom(encoded);
        if (version !== loadVersion || !container.isConnected) return;
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        $('[data-mask-source]').src = encoded;
        context.fillStyle = 'black'; context.fillRect(0, 0, canvas.width, canvas.height);
        const maskPath = path.replace(/\.[^.\\/]+$/, '') + '_mask.png';
        const maskResponse = await fetch('/local/media/image?path=' + encodeURIComponent(maskPath), { cache: 'no-store' });
        if (maskResponse.ok) {
          const existingMask = await imageFrom(await dataUrl(await maskResponse.blob()));
          if (version !== loadVersion) return;
          if (existingMask.naturalWidth !== canvas.width || existingMask.naturalHeight !== canvas.height) throw new Error('已有遮罩尺寸不匹配，请先检查文件。');
          context.drawImage(existingMask, 0, 0);
        } else if (maskResponse.status !== 404) throw new Error('无法读取已有遮罩，请检查路径权限。');
        if (version !== loadVersion || !container.isConnected) return;
        source = { path, encoded, revision };
        savedMask = canvas.toDataURL('image/png');
        history.load(`${path}:${revision}`, savedMask);
        await draw(); status('已读取；请选择分割区域或手动画遮罩。');
      } catch (error) { if (version === loadVersion) { status(error.message); showToast(error.message); } }
    },
  };
}
