"""Behavior and batch orchestration for the image resize GUI."""

import os
import re
import threading
from pathlib import Path
from typing import List, Optional

try:
    from .image_resize_core import (
        DEFAULT_RESOLUTIONS,
        SUPPORTED_EXTENSIONS,
        collect_images,
        load_resolutions,
        process_image,
        save_resolutions,
    )
    from .image_resize_gui_layout import ImageProcessorLayoutMixin
    from .image_resize_gui_support import filedialog, messagebox, tk
    from .image_resize_widgets import ResolutionDialog
except ImportError:
    from image_resize_core import (
        DEFAULT_RESOLUTIONS,
        SUPPORTED_EXTENSIONS,
        collect_images,
        load_resolutions,
        process_image,
        save_resolutions,
    )
    from image_resize_gui_layout import ImageProcessorLayoutMixin
    from image_resize_gui_support import filedialog, messagebox, tk
    from image_resize_widgets import ResolutionDialog


class ImageProcessorGUI(ImageProcessorLayoutMixin):
    """图形界面主类"""

    def __init__(self):
        self.root = tk.Tk()
        self.root.title("训练图像缩放预处理工具")
        self.root.geometry("750x700")
        self.root.resizable(True, True)
        self.resolutions = load_resolutions()
        self.processing = False
        self.setup_ui()

    def toggle_resize_options(self):
        """根据是否启用缩放，切换相关选项的可见性/可用性"""
        state = tk.NORMAL if self.enable_resize.get() else tk.DISABLED
        for child in self.res_frame.winfo_children():
            child.configure(state=state)
        for child in self.exact_size_frame.winfo_children():
            child.configure(state=state)
        self.res_listbox.configure(state=state)

    def refresh_resolution_list(self):
        """刷新分辨率列表显示"""
        self.res_listbox.delete(0, tk.END)
        for width, height in sorted(self.resolutions, key=lambda r: r[0] / r[1]):
            self.res_listbox.insert(tk.END, f"{width} × {height}")

    def add_resolution(self):
        """添加新分辨率"""
        dialog = ResolutionDialog(self.root, title="添加分辨率")
        if dialog.result:
            if dialog.result in self.resolutions:
                messagebox.showwarning("提示", "该分辨率已存在")
                return
            self.resolutions.append(dialog.result)
            save_resolutions(self.resolutions)
            self.refresh_resolution_list()
            self.log(f"已添加分辨率: {dialog.result[0]}×{dialog.result[1]}")

    def edit_resolution(self):
        """编辑选中的分辨率"""
        selection = self.res_listbox.curselection()
        if not selection:
            messagebox.showwarning("提示", "请先选择要编辑的分辨率")
            return
        old_res = sorted(self.resolutions, key=lambda r: r[0] / r[1])[selection[0]]
        dialog = ResolutionDialog(
            self.root,
            title="编辑分辨率",
            initial_width=old_res[0],
            initial_height=old_res[1],
        )
        if dialog.result:
            if dialog.result != old_res and dialog.result in self.resolutions:
                messagebox.showwarning("提示", "该分辨率已存在")
                return
            self.resolutions[self.resolutions.index(old_res)] = dialog.result
            save_resolutions(self.resolutions)
            self.refresh_resolution_list()
            self.log(f"已修改分辨率: {old_res[0]}×{old_res[1]} → {dialog.result[0]}×{dialog.result[1]}")

    def delete_resolution(self):
        """删除选中的分辨率"""
        selection = self.res_listbox.curselection()
        if not selection:
            messagebox.showwarning("提示", "请先选择要删除的分辨率")
            return
        if len(self.resolutions) <= 1:
            messagebox.showwarning("提示", "至少需要保留一个分辨率")
            return
        res_to_delete = sorted(self.resolutions, key=lambda r: r[0] / r[1])[selection[0]]
        if messagebox.askyesno(
            "确认删除",
            f"确定要删除分辨率 {res_to_delete[0]}×{res_to_delete[1]} 吗？",
        ):
            self.resolutions.remove(res_to_delete)
            save_resolutions(self.resolutions)
            self.refresh_resolution_list()
            self.log(f"已删除分辨率: {res_to_delete[0]}×{res_to_delete[1]}")

    def reset_resolutions(self):
        """恢复默认分辨率"""
        if messagebox.askyesno("确认恢复", "确定要恢复默认分辨率列表吗？\n当前自定义的分辨率将被覆盖。"):
            self.resolutions = DEFAULT_RESOLUTIONS.copy()
            save_resolutions(self.resolutions)
            self.refresh_resolution_list()
            self.log("已恢复默认分辨率列表")

    def browse_input(self):
        """选择输入目录"""
        directory = filedialog.askdirectory(
            title="选择要处理的图片目录",
            initialdir=self.input_dir.get() or os.getcwd(),
        )
        if directory:
            self.input_dir.set(directory)

    def browse_output(self):
        """选择输出目录"""
        directory = filedialog.askdirectory(
            title="选择输出目录",
            initialdir=self.output_dir.get() or self.input_dir.get() or os.getcwd(),
        )
        if directory:
            self.output_dir.set(directory)

    def log(self, message: str):
        """添加日志"""
        def _log():
            self.log_text.insert(tk.END, message + "\n")
            self.log_text.see(tk.END)
        self.root.after(0, _log)

    def clear_log(self):
        """清空日志"""
        self.log_text.delete(1.0, tk.END)

    def start_processing(self):
        """开始处理"""
        if not self.resolutions and self.enable_resize.get():
            messagebox.showerror("错误", "请至少添加一个目标分辨率")
            return

        input_path = Path(self.input_dir.get())
        if not input_path.exists():
            messagebox.showerror("错误", f"输入目录不存在:\n{input_path}")
            return

        output_path = None
        if self.output_dir.get().strip():
            output_path = Path(self.output_dir.get())
            output_path.mkdir(parents=True, exist_ok=True)
        images = collect_images(input_path, self.recursive.get())
        if not images:
            messagebox.showwarning(
                "提示",
                f"未找到支持的图片文件\n支持格式: {', '.join(SUPPORTED_EXTENSIONS)}",
            )
            return

        self.processing = True
        self.start_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.progress['maximum'] = len(images)
        self.progress['value'] = 0

        fmt_selection = self.format_var.get()
        target_format = 'ORIGINAL'
        if "JPEG" in fmt_selection:
            target_format = 'JPEG'
        elif "WEBP" in fmt_selection:
            target_format = 'WEBP'
        elif "PNG" in fmt_selection:
            target_format = 'PNG'

        self.log(f"找到 {len(images)} 张图片待处理")
        if self.enable_resize.get():
            self.log(f"目标分辨率: {len(self.resolutions)} 个")
        else:
            self.log("缩放已禁用 (仅转换格式/压缩)")
        self.log(f"目标格式: {target_format} | 质量: {self.quality.get()}%")
        self.log("-" * 50)
        self._rename_counters = {}

        thread = threading.Thread(
            target=self._process_images,
            args=(
                images,
                output_path,
                self.quality.get(),
                self.exact_size.get(),
                target_format,
                self.enable_resize.get(),
                self.enable_rename.get(),
                self.delete_original.get(),
                self.sync_metadata.get(),
            ),
            daemon=True,
        )
        thread.start()

    def _process_images(self, images: List[Path], output_dir: Optional[Path], quality: int, exact_size: bool, target_format: str, enable_resize: bool, enable_rename: bool, delete_original: bool, sync_metadata: bool):
        """后台处理图片"""
        success_count = 0
        fail_count = 0
        skip_count = 0

        for i, filepath in enumerate(images):
            if not self.processing:
                self.log("\n⚠ 处理已停止")
                break
            self.root.after(0, lambda: self.status_var.set(f"处理中: {filepath.name}"))

            new_name = None
            if enable_rename:
                parent_name = filepath.parent.name
                dir_key = str(filepath.parent)
                target_dir = output_dir if output_dir else filepath.parent
                if dir_key not in self._rename_counters:
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
                    self._rename_counters[dir_key] = max_num

                prefix = parent_name + '_'
                already_named = False
                if filepath.stem.startswith(prefix):
                    suffix_part = filepath.stem[len(prefix):]
                    if re.match(r'^\d+$', suffix_part):
                        already_named = True
                if not already_named:
                    self._rename_counters[dir_key] += 1
                    new_name = f"{parent_name}_{self._rename_counters[dir_key]}"

            result = process_image(
                filepath,
                self.resolutions,
                output_dir,
                quality,
                exact_size,
                target_format,
                enable_resize,
                self.log,
                new_name=new_name,
                delete_original=delete_original,
                sync_metadata=sync_metadata,
            )
            if result == 'success':
                success_count += 1
            elif result == 'skip':
                skip_count += 1
            else:
                fail_count += 1
            self.root.after(0, lambda v=i + 1: self.progress.configure(value=v))

        self.log("-" * 50)
        self.log(f"处理完成: 成功 {success_count} 张, 跳过 {skip_count} 张, 失败 {fail_count} 张")
        self.root.after(0, self._processing_done)

    def _processing_done(self):
        """处理完成后的清理"""
        self.processing = False
        self.start_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)
        self.status_var.set("处理完成")

    def stop_processing(self):
        """停止处理"""
        self.processing = False
        self.status_var.set("正在停止...")

    def run(self):
        """运行主循环"""
        self.root.mainloop()
