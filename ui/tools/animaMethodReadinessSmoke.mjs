import assert from 'node:assert/strict';
import {
  getAnimaMethodReadiness,
  getGuideOnlyMethodIds,
  getVisibleTrainingToggleIds,
  getWiredReserveMethodIds,
  listAnimaMethodReadiness,
  shouldExposeAsTrainingToggle,
} from '../src/features/animaMethodReadiness.js';
import { TRAINING_TYPES } from '../src/trainingTypeRegistry.js';
import { getSectionsForType } from '../src/schemaIndex.js';

const registeredTrainingTypes = new Set(TRAINING_TYPES.map((item) => item.id));

// 可见开关有两种载体:训练路由(routeId)和 schema 字段(fieldKey)。
// 原来只认前者,拿 readiness.id 去查 TRAINING_TYPES —— dit_blockskip 这类字段级
// 开关必然落空。改成按注册表自带的判别位分流,并把"字段真在 schema 里"验成实证,
// 而不是用"是不是训练路由"当代理。
const schemaFieldKeys = new Set();
for (const type of TRAINING_TYPES) {
  let sections;
  try {
    sections = getSectionsForType(type.id) || [];
  } catch {
    continue;
  }
  for (const section of sections) {
    for (const field of section.fields || []) {
      if (field && field.key) schemaFieldKeys.add(field.key);
    }
  }
}
assert.ok(schemaFieldKeys.size > 0, 'expected schema field keys to be enumerable');

const visibleToggleIds = getVisibleTrainingToggleIds();
const guideOnlyIds = getGuideOnlyMethodIds();
const wiredReserveIds = getWiredReserveMethodIds();

assert.ok(listAnimaMethodReadiness().length >= 12);

for (const id of visibleToggleIds) {
  const readiness = getAnimaMethodReadiness(id);
  assert.ok(readiness, `missing readiness for ${id}`);
  assert.equal(readiness.trainingLaunchAllowed, true, `${id} must be launchable if visible`);
  assert.equal(readiness.runtimeActivationEnabled, true, `${id} must have runtime activation if visible`);
  assert.equal(readiness.requestFieldsEmitted, true, `${id} must emit request fields if visible`);
  if (readiness.routeId) {
    assert.equal(
      registeredTrainingTypes.has(readiness.routeId),
      true,
      `${id} routeId ${readiness.routeId} must be a registered training type`,
    );
  } else {
    assert.ok(readiness.fieldKey, `${id} is visible but carries neither routeId nor fieldKey`);
    assert.equal(
      schemaFieldKeys.has(readiness.fieldKey),
      true,
      `${id} fieldKey ${readiness.fieldKey} must exist in the UI schema`,
    );
  }
}

for (const id of guideOnlyIds) {
  const readiness = getAnimaMethodReadiness(id);
  assert.ok(readiness, `missing guide-only readiness for ${id}`);
  assert.equal(readiness.visibleTrainingToggleAllowed, false, `${id} must not expose a training toggle`);
  assert.equal(registeredTrainingTypes.has(id), false, `${id} must not be registered as a training type`);
}

for (const id of [
  'cns_sampling',
  'spectrum_probe',
  'smoothcache_probe',
  'tgate_probe',
  'easycontrol_v2',
  'step_expert_routing',
  'chimera_hydra',
  'soft_tokens',
  'modulation_guidance',
  // dp_dmd_turbo 已不在此列:R9 单卡路线把它从储备升为真实 request/config/runtime
  // 可达,registry 四个位(requestFieldsEmitted / runtimeActivationEnabled /
  // trainingLaunchAllowed / visibleTrainingToggleAllowed)全为 true。
  // 真机判据(2026-08-18,非 CPU 外推):
  //   backend/smoke/benchmarks/_out/dp_dmd_standard_full_model_3step_epoch_fix_20260818_1330
  //     → status=passed, global_step=3, runtime_contract.dp_dmd_enabled=True,
  //       runtime_contract.dp_dmd_variant='standard'
  //   .../dp_dmd_standard_full_model_resume_epoch_fix_20260818_1245 → status=passed
  // 载体是 schema 字段 distillation_enabled(见 readiness 表 fieldKey),不是训练路由。
  // 注意 spd_inference 仍留在本列:它与 dp_dmd_turbo 共用 dp_dmd_spd_reserve_seam.py,
  // 但 sampler-loop 激活仍关着 —— 同一个 seam 模块里只有 DP-DMD 毕业了。
  'spd_inference',
  'pid_decoder_backend',
  'adapter_target_policy',
  'fg_lora_rank_policy',
  'tlora',
  // dit_blockskip 已不在此列:UI select(schemaFrontierGroups dit_compute_reducer_strategy)
  // → training_loop._get_compute_reducer_seam(闸门就是 strategy≠none)
  // → compute_reducer_seam_context → anima_native_dit_executable 前向真消费。
  // 它是字段级可见开关,上面按 fieldKey 分支验;不是储备。
]) {
  assert.equal(shouldExposeAsTrainingToggle(id), false, `${id} should stay guide-only`);
}

assert.equal(shouldExposeAsTrainingToggle('lab-distiller'), true);
assert.equal(shouldExposeAsTrainingToggle('sdxl-turbo-lora'), true);
assert.equal(shouldExposeAsTrainingToggle('anima-few-step-lora'), true);
assert.equal(shouldExposeAsTrainingToggle('newbie-few-step-lora'), true);

const pid = getAnimaMethodReadiness('pid_decoder_backend');
assert.equal(pid.requestFieldsEmitted, false);
assert.equal(pid.runtimeActivationEnabled, false);
assert.equal(pid.reserveSeamWired, true);
// reason 必须写明这是 opt-in。原来只认连字符写法,"opted in" 这个语法变体就挂——
// 卡的是措辞不是行为(行为由上面三条结构断言钉)。放宽到兼容两种写法。
assert.match(pid.reason, /opt(-|ed )?in/i);

// Wired reserves (blocks 3-4: EasyControl v2 / P3 adapters / P4 / P5) must surface
// as opt-in guide entries while every launch gate stays closed until operator sign-off.
const expectedWiredReserves = [
  'easycontrol_v2',
  'step_expert_routing',
  'chimera_hydra',
  'soft_tokens',
  'modulation_guidance',
  // dp_dmd_turbo 已毕业,不再是 wired reserve。getWiredReserveMethodIds() 的口径是
  // `reserveSeamWired && !visibleTrainingToggleAllowed`,它一翻可见位就自动出集合;
  // 这张表若继续列它,断言的是 selector 不可能满足的条件(理由与证据见上方同名注释)。
  'spd_inference',
  'pid_decoder_backend',
];
for (const id of expectedWiredReserves) {
  assert.ok(wiredReserveIds.includes(id), `${id} should be a wired reserve`);
}
for (const id of wiredReserveIds) {
  const readiness = getAnimaMethodReadiness(id);
  assert.ok(readiness, `missing wired-reserve readiness for ${id}`);
  assert.equal(readiness.reserveSeamWired, true, `${id} must be flagged reserveSeamWired`);
  assert.ok(readiness.reserveSeamModule, `${id} must name its reserve seam module`);
  assert.equal(readiness.visibleTrainingToggleAllowed, false, `${id} reserve must stay guide-only`);
  assert.equal(readiness.trainingLaunchAllowed, false, `${id} reserve must not be launchable without operator sign-off`);
  assert.equal(readiness.runtimeActivationEnabled, false, `${id} reserve runtime-activation must stay off`);
  assert.equal(shouldExposeAsTrainingToggle(id), false, `${id} reserve must not be a training toggle`);
}

console.log('animaMethodReadinessSmoke: ok');
