"""Layout construction for the image resize GUI."""

import os

try:
    from .image_resize_gui_support import scrolledtext, tk, ttk
    from .image_resize_widgets import ToolTip
except ImportError:
    from image_resize_gui_support import scrolledtext, tk, ttk
    from image_resize_widgets import ToolTip


class ImageProcessorLayoutMixin:
    """Build the GUI without owning processing behavior."""

    def setup_ui(self):
        """创建界面"""
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        input_frame = ttk.LabelFrame(main_frame, text="输入目录", padding="5")
        input_frame.pack(fill=tk.X, pady=(0, 10))
        self.input_dir = tk.StringVar(value=os.getcwd())
        input_entry = ttk.Entry(input_frame, textvariable=self.input_dir, width=60)
        input_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        ttk.Button(input_frame, text="浏览...", command=self.browse_input).pack(side=tk.RIGHT)

        output_frame = ttk.LabelFrame(
            main_frame,
            text="输出目录 (留空则覆盖原文件/生成在同目录)",
            padding="5",
        )
        output_frame.pack(fill=tk.X, pady=(0, 10))
        self.output_dir = tk.StringVar(value="")
        output_entry = ttk.Entry(output_frame, textvariable=self.output_dir, width=60)
        output_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        ttk.Button(output_frame, text="浏览...", command=self.browse_output).pack(side=tk.RIGHT)

        options_frame = ttk.LabelFrame(main_frame, text="处理选项", padding="10")
        options_frame.pack(fill=tk.X, pady=(0, 10))
        row1_frame = ttk.Frame(options_frame)
        row1_frame.pack(fill=tk.X, pady=(0, 5))

        self.recursive = tk.BooleanVar(value=False)
        ttk.Checkbutton(
            row1_frame,
            text="递归处理子目录",
            variable=self.recursive,
        ).pack(side=tk.LEFT, padx=(0, 20))

        self.enable_resize = tk.BooleanVar(value=True)
        resize_cb = ttk.Checkbutton(
            row1_frame,
            text="启用智能缩放",
            variable=self.enable_resize,
            command=self.toggle_resize_options,
        )
        resize_cb.pack(side=tk.LEFT)
        ToolTip(
            resize_cb,
            "启用后根据预设分辨率列表缩放图片。\n"
            "禁用时仅执行格式转换或压缩，保持原图尺寸。",
        )

        self.exact_size_frame = ttk.Frame(options_frame)
        self.exact_size_frame.pack(fill=tk.X, pady=(5, 5))
        self.exact_size = tk.BooleanVar(value=False)
        exact_size_cb = ttk.Checkbutton(
            self.exact_size_frame,
            text="精确裁剪到目标尺寸",
            variable=self.exact_size,
        )
        exact_size_cb.pack(side=tk.LEFT)
        ToolTip(exact_size_cb, "缩放后居中裁剪，输出精确等于目标尺寸。若禁用则仅缩放保持原比例。")

        rename_frame = ttk.Frame(options_frame)
        rename_frame.pack(fill=tk.X, pady=(5, 5))
        self.enable_rename = tk.BooleanVar(value=False)
        rename_cb = ttk.Checkbutton(
            rename_frame,
            text="自动重命名 (文件夹名_数字)",
            variable=self.enable_rename,
        )
        rename_cb.pack(side=tk.LEFT)
        ToolTip(
            rename_cb,
            "启用后将图片重命名为：父文件夹名_序号\n"
            "例如：my_images_1.jpg, my_images_2.jpg",
        )

        self.delete_original = tk.BooleanVar(value=False)
        delete_cb = ttk.Checkbutton(
            rename_frame,
            text="处理后删除原图",
            variable=self.delete_original,
        )
        delete_cb.pack(side=tk.LEFT, padx=(20, 0))
        ToolTip(delete_cb, "处理成功后删除原始图片文件。建议在开启自动重命名或转换格式且不设输出目录时使用。")

        self.sync_metadata = tk.BooleanVar(value=True)
        sync_cb = ttk.Checkbutton(
            rename_frame,
            text="同步处理描述文件",
            variable=self.sync_metadata,
        )
        sync_cb.pack(side=tk.LEFT, padx=(20, 0))
        ToolTip(sync_cb, "自动同步重命名或移动同名的 .txt / .npz / .caption 文件。")

        row3_frame = ttk.Frame(options_frame)
        row3_frame.pack(fill=tk.X, pady=(10, 0))
        ttk.Label(row3_frame, text="输出格式:").pack(side=tk.LEFT)
        self.format_var = tk.StringVar(value="原格式")
        format_combo = ttk.Combobox(
            row3_frame,
            textvariable=self.format_var,
            values=["原格式", "JPEG (.jpg)", "WEBP (.webp)", "PNG (.png)"],
            state="readonly",
            width=12,
        )
        format_combo.pack(side=tk.LEFT, padx=(5, 20))

        ttk.Label(row3_frame, text="质量 (JPG/WEBP):").pack(side=tk.LEFT)
        self.quality = tk.IntVar(value=95)
        quality_scale = ttk.Scale(
            row3_frame,
            from_=1,
            to=100,
            orient=tk.HORIZONTAL,
            variable=self.quality,
            command=lambda v: self.quality_label.config(text=f"{int(float(v))}%"),
        )
        quality_scale.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=10)
        self.quality_label = ttk.Label(row3_frame, text="95%", width=5)
        self.quality_label.pack(side=tk.RIGHT)

        self.res_frame = ttk.LabelFrame(
            main_frame,
            text="目标分辨率 (仅在启用缩放时有效)",
            padding="5",
        )
        self.res_frame.pack(fill=tk.X, pady=(0, 10))
        res_list_frame = ttk.Frame(self.res_frame)
        res_list_frame.pack(fill=tk.X, pady=(0, 5))
        list_container = ttk.Frame(res_list_frame)
        list_container.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        self.res_listbox = tk.Listbox(
            list_container,
            height=4,
            selectmode=tk.SINGLE,
            font=('Consolas', 10),
        )
        self.res_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar = ttk.Scrollbar(
            list_container,
            orient=tk.VERTICAL,
            command=self.res_listbox.yview,
        )
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.res_listbox.config(yscrollcommand=scrollbar.set)

        res_btn_frame = ttk.Frame(res_list_frame)
        res_btn_frame.pack(side=tk.RIGHT, padx=(10, 0))
        ttk.Button(res_btn_frame, text="添加", width=8, command=self.add_resolution).pack(pady=2)
        ttk.Button(res_btn_frame, text="编辑", width=8, command=self.edit_resolution).pack(pady=2)
        ttk.Button(res_btn_frame, text="删除", width=8, command=self.delete_resolution).pack(pady=2)
        ttk.Button(res_btn_frame, text="恢复默认", width=8, command=self.reset_resolutions).pack(pady=2)
        self.refresh_resolution_list()

        button_frame = ttk.Frame(main_frame)
        button_frame.pack(fill=tk.X, pady=(0, 10))
        self.start_btn = ttk.Button(
            button_frame,
            text="开始处理",
            command=self.start_processing,
            style='Accent.TButton',
        )
        self.start_btn.pack(side=tk.LEFT, padx=(0, 10))
        self.stop_btn = ttk.Button(
            button_frame,
            text="停止",
            command=self.stop_processing,
            state=tk.DISABLED,
        )
        self.stop_btn.pack(side=tk.LEFT)
        ttk.Button(
            button_frame,
            text="清空日志",
            command=self.clear_log,
        ).pack(side=tk.RIGHT)

        log_frame = ttk.LabelFrame(main_frame, text="处理日志", padding="5")
        log_frame.pack(fill=tk.BOTH, expand=True)
        self.log_text = scrolledtext.ScrolledText(
            log_frame,
            height=10,
            wrap=tk.WORD,
            font=('Consolas', 9),
        )
        self.log_text.pack(fill=tk.BOTH, expand=True)

        self.status_var = tk.StringVar(value="就绪")
        status_bar = ttk.Label(
            main_frame,
            textvariable=self.status_var,
            relief=tk.SUNKEN,
            anchor=tk.W,
            padding=(5, 2),
        )
        status_bar.pack(fill=tk.X, pady=(10, 0))
        self.progress = ttk.Progressbar(main_frame, mode='determinate')
        self.progress.pack(fill=tk.X, pady=(5, 0))
