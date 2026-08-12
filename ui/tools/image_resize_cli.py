"""Command-line interface for the image resize tool."""

import argparse
import logging
import re
import sys
from pathlib import Path

try:
    from .image_resize_core import collect_images, load_resolutions, process_image
except ImportError:
    from image_resize_core import collect_images, load_resolutions, process_image


def main_cli():
    """命令行模式"""
    parser = argparse.ArgumentParser(
        description='训练图像缩放预处理工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument('-d', '--directory', type=Path, default=Path('.'))
    parser.add_argument('-o', '--output', type=Path, default=None)
    parser.add_argument('-r', '--recursive', action='store_true')
    parser.add_argument('-q', '--quality', type=int, default=95)
    parser.add_argument(
        '-f',
        '--format',
        choices=['ORIGINAL', 'JPEG', 'WEBP', 'PNG'],
        default='ORIGINAL',
        help='目标输出格式',
    )
    parser.add_argument('--no-resize', action='store_true', help='禁用缩放处理，仅转换格式')
    parser.add_argument('--rename', action='store_true', help='启用自动重命名 (文件夹名_数字)')
    parser.add_argument('--delete-source', action='store_true', help='处理成功后删除原图')
    parser.add_argument('--no-exact-size', action='store_true', help='禁用精确裁剪模式（仅等比缩放不裁剪）')
    parser.add_argument(
        '--resolutions',
        type=str,
        default=None,
        help='自定义目标分辨率列表，格式: 1024x1024,768x1344',
    )
    parser.add_argument('--no-sync', action='store_false', dest='sync', default=True, help='不处理关联的描述文件')
    parser.add_argument('-v', '--verbose', action='store_true')
    parser.add_argument('--no-gui', action='store_true', help='强制使用命令行模式')
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S',
    )
    if not args.directory.exists():
        logging.error(f"目录不存在: {args.directory}")
        sys.exit(1)
    if args.output:
        args.output.mkdir(parents=True, exist_ok=True)

    images = collect_images(args.directory, args.recursive)
    if args.resolutions:
        resolutions = [
            tuple(int(x.strip()) for x in resolution.split('x'))
            for resolution in args.resolutions.split(',')
            if resolution.strip()
        ]
    else:
        resolutions = load_resolutions()

    if not images:
        logging.warning("未找到图片文件")
        sys.exit(0)
    logging.info(f"找到 {len(images)} 张图片")

    success = 0
    rename_counters = {}
    for image in images:
        new_name = None
        if args.rename:
            parent_name = image.parent.name
            dir_key = str(image.parent)
            target_dir = args.output if args.output else image.parent
            if dir_key not in rename_counters:
                max_num = 0
                prefix = parent_name + '_'
                if target_dir.exists():
                    for existing in target_dir.iterdir():
                        if existing.is_file() and existing.stem.startswith(prefix):
                            suffix_part = existing.stem[len(prefix):]
                            match = re.match(r'^(\d+)$', suffix_part)
                            if match:
                                num = int(match.group(1))
                                if num > max_num:
                                    max_num = num
                rename_counters[dir_key] = max_num

            prefix = parent_name + '_'
            already_named = False
            if image.stem.startswith(prefix):
                suffix_part = image.stem[len(prefix):]
                if re.match(r'^\d+$', suffix_part):
                    already_named = True
            if not already_named:
                rename_counters[dir_key] += 1
                new_name = f"{parent_name}_{rename_counters[dir_key]}"

        result = process_image(
            image,
            resolutions,
            args.output,
            args.quality,
            exact_size=not args.no_exact_size,
            target_format=args.format,
            enable_resize=not args.no_resize,
            new_name=new_name,
            delete_original=args.delete_source,
            sync_metadata=args.sync,
        )
        if result == 'success':
            success += 1
    logging.info(f"完成: 成功 {success}/{len(images)}")
