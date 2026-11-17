# V2 UI 插件 wiki 缺口补齐（2026-09-29）
# Evolution V2 的 schema 是主线的一份分叉（runConfigBuilder 差 1292 行），
# 对账出 102 个字段无词条。desc 富的直接做底稿，薄 desc 的按族/启发式补写。
# 写入共享 SoT（resources/training_wiki），由 sync_training_wiki.py 统一镜像。
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOT = HERE.parents[3] / "resources" / "training_wiki" / "entries"

fields = json.loads((HERE / "v2_fields_dump.json").read_text(encoding="utf-8"))

FAM = {}
def fam(prefix, s, e, w, a):
    for f in fields:
        if f["key"].startswith(prefix):
            FAM[f["key"]] = (s, e, w, a)

fam("adaptive_rank_",
    "模块级自适应 Rank 的 {label}，默认 {default}。",
    "按模块敏感度在固定总预算内动态分配各模块的 Rank，{label} 控制分配策略或节奏。",
    "想精确控制各层容量时使用。",
    "默认关闭（统一 Rank）；开启后 rank 分配随训练演化，对比实验不可控。")
fam("adaptive_training_",
    "自适应训练策略的 {label}，默认 {default}。",
    "自适应训练按训练证据自动调整学习率/区域权重等目标，{label} 控制调整幅度、频率或证据门槛。",
    "长训想自动化超参微调时使用。",
    "调参实验阶段关闭，避免干扰归因。")

OVERRIDES = {
 "auto_convert_to_slora": ("保存时自动转 SLoRA。", "PiSSA/LoftQ 等初始化策略训练完成后，保存时自动转换为标准 LoRA 兼容格式。", "下游只支持标准 LoRA 时保持默认开启。", "想保留 PiSSA/LoftQ 原生结构时关闭。"),
 "allow_unverified_dataset_start": ("允许未完成数据集验证时启动（高级）。", "数据集探测异常或顾问不可用导致的阻断降级为警告，训练可能启动后立刻因数据集问题失败。", "明确知道数据集没问题、只想绕过阻断时使用。", "默认关闭；带着警告跑长训风险自负。"),
 "subset_content_roles": ("素材解耦配置。", "每行为 train_data_dir 下一个素材子文件夹指定内容角色、标注模式与 mask 模式。", "素材分层（主体/背景/配饰分开管理）时使用。", "普通单目录数据集不需要。"),
 "tag_dropout_rate": ("按标签丢弃概率。", "对指定逗号分隔标签以该概率随机丢弃（与均匀 dropout 不同，只作用于点名标签）。", "特定 tag 干扰训练时定向丢弃。", "默认 0 关闭。"),
 "glora_compat_layout": ("GLoRA 实现方式。", "标准=精确低秩分解（lora_up/lora_down+alpha），无精度损失、体积最小、兼容性最好。", "默认标准即可。", ""),
 "validation_every_n_epochs": ("验证间隔（epoch）。", "每隔多少个 epoch 在验证集上跑一次评估。", "配置了验证集时按需调整。", "未配置验证集不生效。"),
 "validation_loss_only": ("验证只算 loss。", "验证阶段只计算 loss 不跑完整指标，速度快。", "只关心泛化 loss 时开启。", "需要完整指标时关闭。"),
 "sageattn_drift_threshold": ("SageAttn 漂移阈值。", "SageAttention 输出与 SDPA 参考对比的容差，超过判定为漂移。", "开启漂移检测时按精度要求设定。", "默认关闭检测路径。"),
 "custom_toml": ("自定义 TOML 覆盖。", "以 TOML 文本直接覆盖训练配置的任意键，最后生效、优先级最高。", "临时试验后端参数、UI 还没有对应字段时使用。", "常规配置请用正式字段；写错键名会被后端忽略或报错。"),
 "ema_power": ("EMA 幂次。", "EMA 衰减的幂次参数，控制历史权重的影响曲线形状。", "使用 EMA 且默认衰减不合适时调整。", "未启用 EMA 不生效。"),
}

def clean(label, key):
    s = re.sub(r"（[^）]*）\s*$", "", str(label or "")).strip()
    return s or key

def default_text(f):
    d = f.get("def")
    if d is None or d == "":
        return ""
    if isinstance(d, bool):
        return "默认开启" if d else "默认关闭"
    if isinstance(d, float) and d == int(d):
        return f"默认 {int(d)}"
    return f"默认 {d}"

def guidance(f, dt):
    t = f.get("type")
    if t == "boolean":
        if f.get("def"):
            return ("默认开启，适合大多数场景。", "排查问题想回到原始行为时可关闭对比。")
        return ("需要该行为时开启。", "默认关闭；不确定影响时先保持关闭。")
    if t in ("file", "folder"):
        return ("路径留空走默认解析或功能不启用。", "填错路径会在预检或启动时报错。")
    if dt:
        return (f"{dt}，无明确目标时保持默认。", "一次只改一项，便于归因。")
    return ("按训练目标与显存预算调整。", "一次只改一项，便于归因。")

written = 0
for f in fields:
    key = f["key"]
    desc = str(f.get("desc") or "").strip()
    dt = default_text(f)
    ov = OVERRIDES.get(key) or FAM.get(key)
    if ov:
        summary, effect, wtu, awd = ov
        lab = clean(f.get("label"), key)
        summary = summary.replace("{label}", lab).replace("{default}", dt.replace("默认 ", "") if dt else "见描述")
        effect = effect.replace("{label}", lab)
        wtu = wtu.replace("{label}", lab)
        awd = awd.replace("{label}", lab)
    else:
        ss = [p for p in re.split(r"(?<=[。！？!?])", desc) if p.strip()]
        summary = ss[0] if ss else f"{clean(f.get('label'), key)}。" + (dt or "")
        effect = "".join(ss[1:]).strip() or f"写入训练配置 {key}，由训练后端在相应阶段消费。"
        wtu, awd = guidance(f, dt)
    entry = {
        "key": key,
        "title": clean(f.get("label"), key),
        "category": f.get("section") or "训练参数",
        "appliesTo": sorted(set(f.get("types") or [])),
        "standard": {"summary": summary, "effect": effect, "whenToUse": wtu, "avoidWhen": awd},
        "advanced": None,
        "relatedConfigs": [],
    }
    if f.get("type") == "select" and f.get("options"):
        od = {}
        for o in f["options"]:
            v = str(o if not isinstance(o, dict) else o.get("value", o))
            od[v] = ""
        entry["standard"]["optionDescriptions"] = {k: v for k, v in od.items() if v} or None
        if not entry["standard"]["optionDescriptions"]:
            del entry["standard"]["optionDescriptions"]
    (SOT / f"{key}.json").write_text(json.dumps(entry, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    written += 1
print(f"written {written} V2-gap entries")
