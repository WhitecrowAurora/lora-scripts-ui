const FIELDS = ['name', 'provider', 'model', 'timeout', 'retries', 'interval', 'retry_interval'];

export function portableChannel(channel) {
  return { format: 'lulynx-llm-channel', version: 1, channel: Object.fromEntries(
    FIELDS.filter(key => ['string', 'number', 'boolean'].includes(typeof channel[key])).map(key => [key, channel[key]]),
  ) };
}

export function parsePortableChannel(text) {
  const payload = JSON.parse(text);
  if (payload?.format !== 'lulynx-llm-channel' || payload.version !== 1 || !payload.channel
      || !['openai_compatible', 'gemini', 'anthropic'].includes(payload.channel.provider)
      || typeof payload.channel.model !== 'string' || !payload.channel.model.trim()) {
    throw new Error('不是支持的 lulynx 通道预设。');
  }
  return portableChannel(payload.channel).channel;
}

export function bindPortableChannel({ container, channels, $, showToast }) {
  const input = container.querySelector('[data-channel-import-file]');
  container.querySelector('[data-channel-export]')?.addEventListener('click', () => {
    const channel = channels.find(item => item.id === $('#llm-channel')?.value);
    if (!channel) { showToast('请先选择要导出的通道。'); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(portableChannel(channel), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lulynx-llm-channel.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  container.querySelector('[data-channel-import]')?.addEventListener('click', () => input.click());
  input?.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 64 * 1024) throw new Error('通道预设文件过大。');
      const channel = parsePortableChannel(await file.text());
      for (const [id, value] of Object.entries({
        'llm-channel-name': channel.name || '', 'llm-channel-provider': channel.provider,
        'llm-channel-model': channel.model, 'llm-channel-base': '', 'llm-channel-keys': '',
        'llm-retries': channel.retries ?? 1, 'llm-interval': channel.interval ?? 0,
        'llm-retry-interval': channel.retry_interval ?? 0,
        'llm-channel-timeout': channel.timeout ?? 120,
      })) {
        const field = $('#' + id);
        if (field) field.value = value;
      }
      $('#llm-channel-keys').dataset.importedPreset = 'true';
      showToast('预设已载入表单；请设置本机 API 地址、密钥和通道名称后保存。');
    } catch (error) { showToast(error.message || '导入失败。'); }
    finally { input.value = ''; }
  });
}
