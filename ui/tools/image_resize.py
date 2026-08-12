"""
训练图像缩放预处理工具
将图片缩放到最接近的预设目标分辨率，保持宽高比
支持批量转换为 JPG/WEBP 格式，支持禁用缩放仅转换
支持双击运行的图形界面

This module remains the public compatibility facade. Implementation lives in
the adjacent ``image_resize_*`` modules so direct script and imported use keep
the same entry points.
"""

import json
import os
import sys
import threading
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image

if not __package__:
    _script_dir = str(Path(__file__).resolve().parent)
    if _script_dir not in sys.path:
        sys.path.insert(0, _script_dir)

try:
    from .image_resize_cli import main_cli
    from .image_resize_core import (
        CONFIG_FILE,
        DEFAULT_RESOLUTIONS,
        SUPPORTED_EXTENSIONS,
        collect_images,
        find_closest_resolution,
        get_output_format,
        load_resolutions,
        process_image,
        save_resolutions,
    )
    from .image_resize_gui import ImageProcessorGUI
    from .image_resize_gui_support import (
        HAS_GUI,
        filedialog,
        messagebox,
        scrolledtext,
        simpledialog,
        tk,
        ttk,
    )
    from .image_resize_widgets import ResolutionDialog, ToolTip
except ImportError:
    from image_resize_cli import main_cli
    from image_resize_core import (
        CONFIG_FILE,
        DEFAULT_RESOLUTIONS,
        SUPPORTED_EXTENSIONS,
        collect_images,
        find_closest_resolution,
        get_output_format,
        load_resolutions,
        process_image,
        save_resolutions,
    )
    from image_resize_gui import ImageProcessorGUI
    from image_resize_gui_support import (
        HAS_GUI,
        filedialog,
        messagebox,
        scrolledtext,
        simpledialog,
        tk,
        ttk,
    )
    from image_resize_widgets import ResolutionDialog, ToolTip

if not HAS_GUI:
    import types


def main():
    """主入口"""
    if len(sys.argv) > 1 or not HAS_GUI:
        main_cli()
    else:
        app = ImageProcessorGUI()
        app.run()


if __name__ == "__main__":
    main()
