// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
// Guard: anima 的 LoRA 目标预设必须以 config 字段送到后端,而 LyCORIS 库 preset
// 必须折进 network_args。两者共用 lycoris_preset 这个键,走的却是两条路:
//
//   anima-*      → payload.lycoris_preset = 'anima_mlp_only'（后端展开成目标族）
//   sdxl+lycoris → network_args 里 'preset=attn-only',键本身删掉
//
// normalizeLycorisNetworkArgs 靠 `typeId.startsWith('anima')` 提前 return 才没把
// anima 的预设一起删掉。这条 guard 就钉那个 return —— 它一旦被"顺手简化",
// anima 预设会静默失效(下拉能选、后端收不到、注入目标不变)。

import assert from 'node:assert/strict';
import { getSectionsForType, buildRunConfig, createDefaultConfig } from '../src/schemaIndex.js';

const ANIMA_PRESETS = [
  'anima_main_block',
  'anima_main_block_with_adln',
  'anima_attention_only',
  'anima_self_attn_only',
  'anima_cross_attn_only',
  'anima_mlp_only',
];

function presetField(typeId) {
  const fields = getSectionsForType(typeId).flatMap((section) => section.fields || []);
  const found = fields.filter((field) => field.key === 'lycoris_preset');
  assert.equal(found.length, 1, `${typeId} 的 lycoris_preset 字段有 ${found.length} 个(应为 1)`);
  return found[0];
}

function testAnimaDropdownExposesEveryPreset() {
  const field = presetField('anima-lora');
  assert.equal(field.type, 'select', 'anima 预设应是下拉,不是自由文本');
  const values = (field.options || []).map((o) => (typeof o === 'object' ? o.value : o));
  assert.ok(values.includes(''), '缺少「不使用预设」选项');
  for (const slug of ANIMA_PRESETS) {
    assert.ok(values.includes(slug), `下拉缺少 ${slug}`);
  }
  // 每个选项都得有人话标签,否则用户看到的是一串 slug
  for (const option of field.options) {
    assert.ok(option.label && option.label.trim(), `选项 ${option.value} 没有标签`);
  }
  console.log(`PASS anima 下拉暴露 ${ANIMA_PRESETS.length} 个预设,均有中文标签`);
}

function testAnimaPresetReachesBackendAsConfigField() {
  for (const slug of ANIMA_PRESETS) {
    const config = createDefaultConfig('anima-lora');
    config.lycoris_preset = slug;
    const payload = buildRunConfig(config, 'anima-lora');
    assert.equal(payload.lycoris_preset, slug, `${slug} 没能送到 payload`);
    // 不能同时又被塞进 network_args,否则后端会看到两份互相矛盾的意图
    const args = payload.network_args || [];
    assert.ok(
      !args.some((arg) => String(arg).startsWith('preset=')),
      `${slug} 被同时折进了 network_args: ${JSON.stringify(args)}`,
    );
  }
  console.log('PASS 6 个 anima 预设都以 config 字段抵达后端,未被折进 network_args');
}

function testAnimaWithLycorisAlgoStillKeepsThePreset() {
  // anima 也能选 lokr 之类的 LyCORIS 算法。此时仍应走 anima 语义,
  // 因为注入目标由 anima_lora_target_groups 决定,与算法无关。
  const config = createDefaultConfig('anima-lora');
  config.lora_type = 'lokr';
  config.network_module = 'lycoris.kohya';
  config.lycoris_preset = 'anima_attention_only';
  const payload = buildRunConfig(config, 'anima-lora');
  assert.equal(payload.lycoris_preset, 'anima_attention_only', 'anima + LyCORIS 算法时预设被吞掉了');
  console.log('PASS anima 选 LyCORIS 算法时预设依然保留');
}

function testLycorisLibraryPresetStillFoldsIntoNetworkArgs() {
  const config = createDefaultConfig('sdxl-lora');
  config.network_module = 'lycoris.kohya';
  config.lycoris_preset = 'attn-only';
  const payload = buildRunConfig(config, 'sdxl-lora');
  assert.equal(payload.lycoris_preset, undefined, '库 preset 应从 payload 删除');
  assert.ok(
    (payload.network_args || []).includes('preset=attn-only'),
    `库 preset 未折进 network_args: ${JSON.stringify(payload.network_args)}`,
  );
  console.log('PASS LyCORIS 库 preset 仍折进 network_args(未被 anima 改动波及)');
}

function testLycorisLibraryDropdownOnlyOffersUnderstoodValues() {
  // LyCORISInjector.PRESET_TARGETS 只有这三个;别的字符串会被当模块名子串匹配,
  // 匹配不到就静默注入 0 层 —— 所以这里不能留自由文本。
  const field = presetField('sdxl-lora');
  assert.equal(field.type, 'select', 'LyCORIS 库 preset 仍是自由文本');
  const values = (field.options || []).map((o) => (typeof o === 'object' ? o.value : o));
  assert.deepEqual(values, ['', 'full', 'attn-only', 'attn-mlp'], `取值集漂移: ${JSON.stringify(values)}`);
  for (const slug of ANIMA_PRESETS) {
    assert.ok(!values.includes(slug), `anima 预设 ${slug} 混进了库 preset 下拉`);
  }
  console.log('PASS 库 preset 下拉只给 injector 认识的三个取值');
}

testAnimaDropdownExposesEveryPreset();
testAnimaPresetReachesBackendAsConfigField();
testAnimaWithLycorisAlgoStillKeepsThePreset();
testLycorisLibraryPresetStillFoldsIntoNetworkArgs();
testLycorisLibraryDropdownOnlyOffersUnderstoodValues();
console.log('animaAdapterPresetSmoke: ok');
