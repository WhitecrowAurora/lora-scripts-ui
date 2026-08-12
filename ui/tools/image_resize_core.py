"""Core image and sidecar-file processing for :mod:`image_resize`."""

import json
import os
import re
import shutil
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image


DEFAULT_RESOLUTIONS: List[Tuple[int, int]] = [
    (768, 1344),
    (832, 1216),
    (896, 1152),
    (1024, 1024),
    (1152, 896),
    (1216, 832),
    (1344, 768),
]

CONFIG_FILE = Path(__file__).parent / "image_resize_config.json"
SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp'}


def load_resolutions() -> List[Tuple[int, int]]:
    """从配置文件加载分辨率列表"""
    try:
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                resolutions = [tuple(r) for r in data.get('resolutions', [])]
                if resolutions:
                    return resolutions
    except Exception:
        pass
    return DEFAULT_RESOLUTIONS.copy()


def save_resolutions(resolutions: List[Tuple[int, int]]):
    """保存分辨率列表到配置文件"""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump({'resolutions': resolutions}, f, indent=2)
    except Exception as e:
        print(f"保存配置失败: {e}")


def find_closest_resolution(
    image_ratio: float,
    resolutions: List[Tuple[int, int]],
) -> Tuple[int, int]:
    """根据图片宽高比，找到最接近的目标分辨率。"""
    if not resolutions:
        return (1024, 1024)

    sorted_res = sorted(resolutions, key=lambda r: r[0] / r[1])
    min_diff = float('inf')
    best_target = sorted_res[0]

    for target in sorted_res:
        target_ratio = target[0] / target[1]
        diff = abs(image_ratio - target_ratio)
        if diff < min_diff:
            min_diff = diff
            best_target = target
        elif diff > min_diff:
            break
    return best_target


def get_output_format(filepath: Path) -> str:
    """根据文件扩展名确定保存格式"""
    format_map = {
        '.jpg': 'JPEG',
        '.jpeg': 'JPEG',
        '.png': 'PNG',
        '.webp': 'WEBP',
        '.bmp': 'BMP',
    }
    return format_map.get(filepath.suffix.lower(), 'PNG')


def process_image(
    filepath: Path,
    resolutions: List[Tuple[int, int]],
    output_dir: Optional[Path] = None,
    quality: int = 95,
    exact_size: bool = True,
    target_format: str = 'ORIGINAL',
    enable_resize: bool = True,
    log_callback=None,
    new_name: Optional[str] = None,
    delete_original: bool = False,
    sync_metadata: bool = True
) -> str:
    """处理单张图片：缩放到最接近的目标分辨率或转换格式。"""
    def log(msg):
        if log_callback:
            log_callback(msg)
        else:
            try:
                print(msg)
            except UnicodeEncodeError:
                print(msg.encode('utf-8', errors='replace').decode('ascii', errors='replace'))

    target_format = target_format.upper()
    save_format = target_format
    output_ext = filepath.suffix.lower()
    if target_format == 'JPEG':
        save_format = 'JPEG'
        output_ext = '.jpg'
    elif target_format == 'WEBP':
        save_format = 'WEBP'
        output_ext = '.webp'
    elif target_format == 'PNG':
        save_format = 'PNG'
        output_ext = '.png'
    else:
        save_format = get_output_format(filepath)

    try:
        with Image.open(filepath) as img:
            if save_format == 'JPEG':
                if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                    if img.mode != 'RGBA':
                        img = img.convert('RGBA')
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[-1])
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
            elif save_format == 'WEBP':
                if img.mode == 'P':
                    img = img.convert('RGBA')
            elif img.mode == 'P':
                img = img.convert('RGBA')

            width, height = img.size
            final_w, final_h = width, height
            final_img = img

            if enable_resize and resolutions:
                target_w, target_h = find_closest_resolution(width / height, resolutions)
                if (width == target_w and height == target_h
                        and target_format == 'ORIGINAL' and not new_name):
                    log(f"⏭ 跳过 (尺寸已符合): {filepath.name}")
                    return 'skip'

                if exact_size:
                    scale_ratio = max(target_w / width, target_h / height)
                    scaled_width = int(width * scale_ratio)
                    scaled_height = int(height * scale_ratio)
                    resized_img = img.resize(
                        (scaled_width, scaled_height),
                        resample=Image.Resampling.LANCZOS,
                    )
                    left = (scaled_width - target_w) // 2
                    top = (scaled_height - target_h) // 2
                    final_img = resized_img.crop((left, top, left + target_w, top + target_h))
                    final_w, final_h = target_w, target_h
                else:
                    scale_ratio = min(target_w / width, target_h / height)
                    scaled_w = int(width * scale_ratio)
                    scaled_h = int(height * scale_ratio)
                    if scaled_w != width or scaled_h != height:
                        final_img = img.resize(
                            (scaled_w, scaled_h),
                            resample=Image.Resampling.LANCZOS,
                        )
                        final_w, final_h = scaled_w, scaled_h

            base_name = new_name if new_name else filepath.stem
            destination = output_dir if output_dir else filepath.parent
            output_path = destination / f"{base_name}{output_ext}"
            is_same_path = output_path.resolve() == filepath.resolve()

            if is_same_path and final_w == width and final_h == height:
                log(f"⏭ 跳过 (无需处理): {filepath.name}")
                return 'skip'

            if not is_same_path and output_path.exists():
                conflict_dir = output_dir if output_dir else filepath.parent
                match = re.match(r'^(.+?)_(\d+)$', output_path.stem)
                if match:
                    prefix_part = match.group(1)
                    start_num = int(match.group(2)) + 1
                else:
                    prefix_part = output_path.stem
                    start_num = 1

                for try_num in range(start_num, start_num + 10000):
                    candidate_name = f"{prefix_part}_{try_num}"
                    candidate_path = conflict_dir / f"{candidate_name}{output_ext}"
                    if candidate_path.resolve() == filepath.resolve():
                        output_path = candidate_path
                        is_same_path = True
                        break
                    if not candidate_path.exists():
                        output_path = candidate_path
                        log(f"⚠ 目标文件已存在，顺延为: {candidate_path.name}")
                        break
                else:
                    log(f"✗ 无法找到可用文件名: {filepath.name}")
                    return 'fail'

            if sync_metadata:
                for meta_ext in ['.txt', '.npz', '.caption', '.json']:
                    meta_file = filepath.with_suffix(meta_ext)
                    if not meta_file.exists():
                        continue
                    new_meta_path = output_path.with_suffix(meta_ext)
                    if new_meta_path == meta_file:
                        continue
                    try:
                        if new_meta_path.exists():
                            log(f"⚠ 关联文件已存在，将覆盖: {new_meta_path.name}")
                            new_meta_path.unlink()
                        if output_dir:
                            shutil.copy2(meta_file, new_meta_path)
                        else:
                            meta_file.rename(new_meta_path)
                    except Exception as e:
                        log(f"⚠ 无法处理关联文件 {meta_file.name}: {e}")

            save_kwargs = {'optimize': True}
            if save_format in ('JPEG', 'WEBP'):
                save_kwargs['quality'] = quality
                if save_format == 'WEBP':
                    save_kwargs['method'] = 6
            final_img.save(output_path, format=save_format, **save_kwargs)

            action_str = f"{width}x{height} → {final_w}x{final_h}"
            if target_format != 'ORIGINAL':
                action_str += f" ({save_format})"
            rename_str = f" → {output_path.name}" if new_name else ""
            log(f"✓ 已处理: {filepath.name}{rename_str} | {action_str}")

            if not is_same_path and delete_original:
                try:
                    filepath.unlink()
                except Exception as e:
                    log(f"⚠ 无法删除原图 {filepath.name}: {e}")
            return 'success'
    except Exception as e:
        log(f"✗ 处理失败 {filepath.name}: {e}")
        return 'fail'


def collect_images(directory: Path, recursive: bool = False) -> List[Path]:
    """收集目录下的所有图片文件"""
    images = []
    if recursive:
        for root, _, files in os.walk(directory):
            for filename in files:
                filepath = Path(root) / filename
                if filepath.suffix.lower() in SUPPORTED_EXTENSIONS:
                    images.append(filepath)
    else:
        for filepath in directory.iterdir():
            if filepath.is_file() and filepath.suffix.lower() in SUPPORTED_EXTENSIONS:
                images.append(filepath)
    return sorted(images)
