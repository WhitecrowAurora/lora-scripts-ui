// SPDX-License-Identifier: LicenseRef-PolyFormNoncommercial-1.0.0
// Shared by the three WebUIs; include only in Anima/Newbie training sections.
export const LAYERSYNC_FIELDS = [
  { key: 'layersync_enabled', type: 'boolean', label: 'LayerSync 层自对齐', desc: 'Anima / Newbie 同一次前向中，让中间层对齐更深层；无需外挂编码器，可能增加激活显存。', defaultValue: false },
  { key: 'layersync_weight', type: 'number', label: 'LayerSync 权重', desc: '辅助损失权重；大于 0 才参与训练，0 保持关闭。尚无通用推荐值。', defaultValue: 0.0, min: 0, step: 0.01, visibleWhen: (c) => c.layersync_enabled },
  { key: 'layersync_student_block', type: 'number', label: 'Student 块索引', desc: '从 0 开始的中间层索引；0 是第一个块，-1 自动选约 1/3 深度。', defaultValue: -1, min: -1, step: 1, visibleWhen: (c) => c.layersync_enabled },
  { key: 'layersync_teacher_block', type: 'number', label: 'Teacher 块索引', desc: '从 0 开始的更深层索引，须大于 student；-1 自动选约 2/3 深度。', defaultValue: -1, min: -1, step: 1, visibleWhen: (c) => c.layersync_enabled },
  { key: 'layersync_every_n_steps', type: 'number', label: 'LayerSync 间隔步', desc: '每 N 步计算一次辅助损失；默认 1 为每步计算。', defaultValue: 1, min: 1, max: 64, step: 1, visibleWhen: (c) => c.layersync_enabled },
];
