# 孤儿词条分诊处置（2026-09-29）
# 依据 ui/wiki_parity_report.json + orphan_code_refs.json + schema 对账：
#   - ALIAS_TO   : 语义 1:1 改名遗留 -> 把旧 key 追加为目标词条 alias，删除旧词条文件
#   - REKEY      : 目标 key 无词条 -> 旧词条改 key 为现役 UI key，旧 key 降为 alias
#   - SUPERSEDED : 被 UI 现役字段族取代（拆分/两字段表达）-> 直接删除
#   - KEEP       : 后端/启动器侧仍消费但 UI 未露出（分布式/Pilot/前沿储备/工具页），不动
# 所有删除必须在全部 SOURCES 副本执行，否则 sync_training_wiki.py 会从镜像回填。
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
SOT = ROOT / "resources" / "training_wiki"
COPY_DIRS = [
    ROOT / "resources" / "training_wiki",
    ROOT / "plugin" / "lora-scripts-ui-main" / "training-wiki",
    ROOT / "resources" / "web" / "training-wiki",
    ROOT / "plugin" / "lora-scripts-ui-main" / "ui" / "public" / "training-wiki",
    ROOT / "plugin" / "Lulynx-evolution-ui" / "ui" / "public" / "training-wiki",
    ROOT / "plugin" / "Lulynx-evolution-V2-ui" / "ui" / "public" / "training-wiki",
]

ALIAS_TO = {
    "auto_controller_enabled": "ac_enabled",
    "ema_use_ema": "ema_enabled",
    "lulynx_ema_enabled": "ema_enabled",  # 携带其 aliases 一起并入
    "lulynx_safeguard_enabled": "safeguard_enabled",
    "optimizer_args": "optimizer_args_custom",
    "lulynx_tensor_ring_adapter_enabled": "tensorring_lora_enabled",
    "bw_enable": "enable_block_weights",
    "block_swap_sliding_window_granularity": "swap_granularity",
    "pruning_enabled": "adapter_mask_pruning_enabled",
    "native_training_method": "network_module",
    "fp8_base_compute": "fp8_base",
    "fused_optimizer": "blockwise_fused_optimizers",
    "p2_weighting_enabled": "p2_weighting_mode",
    "perceptual_anchor_loss_enabled": "lulynx_latent_anchor_enabled",
    "anima_model_prediction_type": "model_prediction_type",
}

REKEY = {
    "lulynx_progressive_rank_min": "tlora_min_rank",
    "lulynx_progressive_rank_schedule": "tlora_rank_schedule",
    "muon_momentum": "opt_muon_momentum",
    "use_dora": "dora_variant",
    "lora_rank_dropout": "rank_dropout",
    "newbie_lora_target": "newbie_target_modules",
}

SUPERSEDED = [
    "num_train_epochs",  # sync_training_wiki.ALIASES 自动并成 max_train_epochs 的 alias
    "lulynx_progressive_rank_lora",  # 开关语义并入 network_module 选项 + tlora 两词条
    "anima_compile_scope",  # 拆入 torch_compile_scope + compile_anima_full_core_enabled
    "train_text_encoder",  # 拆入 network_train_unet_only / network_train_text_encoder_only
    "lineart_loss_enabled",  # 拆入 lineart_preservation_* + dct_frequency_*
]


def load_entry(key):
    p = SOT / "entries" / f"{key}.json"
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def delete_everywhere(key):
    n = 0
    for d in COPY_DIRS:
        p = d / "entries" / f"{key}.json"
        if p.exists():
            p.unlink()
            n += 1
    return n


def main():
    log = {"alias": [], "rekey": [], "superseded": [], "errors": []}

    for old, target in ALIAS_TO.items():
        old_data = load_entry(old)
        tgt = load_entry(target)
        if tgt is None:
            log["errors"].append(f"alias target missing: {old} -> {target}")
            continue
        aliases = set(tgt.get("aliases") or [])
        aliases.add(old)
        for a in old_data.get("aliases") or [] if old_data else []:
            aliases.add(a)
        tgt["aliases"] = sorted(aliases)
        (SOT / "entries" / f"{target}.json").write_text(
            json.dumps(tgt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n"
        )
        delete_everywhere(old)
        log["alias"].append(f"{old} -> {target}")

    for old, new in REKEY.items():
        data = load_entry(old)
        if data is None:
            log["errors"].append(f"rekey source missing: {old}")
            continue
        existing_new = load_entry(new)
        if existing_new is not None:
            # 目标已存在：并入 alias 而不是覆盖
            al = set(existing_new.get("aliases") or [])
            al.add(old)
            al.update(data.get("aliases") or [])
            existing_new["aliases"] = sorted(al)
            (SOT / "entries" / f"{new}.json").write_text(
                json.dumps(existing_new, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            delete_everywhere(old)
            log["rekey"].append(f"{old} -> merged into existing {new}")
            continue
        aliases = set(data.get("aliases") or [])
        aliases.add(old)
        data["key"] = new
        data["aliases"] = sorted(aliases)
        (SOT / "entries" / f"{new}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n"
        )
        delete_everywhere(old)
        log["rekey"].append(f"{old} -> {new}")

    for key in SUPERSEDED:
        n = delete_everywhere(key)
        log["superseded"].append(f"{key} (removed from {n} copies)")

    (Path(__file__).parent / "fix_wiki_orphans_log.json").write_text(
        json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(log, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
