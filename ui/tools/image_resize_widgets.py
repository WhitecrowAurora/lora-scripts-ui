"""Small tkinter widgets used by the image resize GUI."""

try:
    from .image_resize_gui_support import messagebox, tk, ttk
except ImportError:
    from image_resize_gui_support import messagebox, tk, ttk


class ToolTip:
    """简单的悬浮提示工具"""

    def __init__(self, widget, text):
        self.widget = widget
        self.text = text
        self.tip_window = None
        widget.bind('<Enter>', self.show_tip)
        widget.bind('<Leave>', self.hide_tip)

    def show_tip(self, event=None):
        if self.tip_window:
            return
        bounds = self.widget.bbox("insert") if hasattr(self.widget, 'bbox') else (0, 0, 0, 0)
        x = bounds[0] + self.widget.winfo_rootx() + 25
        y = bounds[1] + self.widget.winfo_rooty() + 25

        self.tip_window = tw = tk.Toplevel(self.widget)
        tw.wm_overrideredirect(True)
        tw.wm_geometry(f"+{x}+{y}")
        label = tk.Label(
            tw,
            text=self.text,
            justify=tk.LEFT,
            background="#ffffe0",
            relief=tk.SOLID,
            borderwidth=1,
            font=("Microsoft YaHei UI", 9),
            padx=6,
            pady=4,
        )
        label.pack()

    def hide_tip(self, event=None):
        if self.tip_window:
            self.tip_window.destroy()
            self.tip_window = None


class ResolutionDialog(tk.Toplevel):
    """分辨率输入对话框"""

    def __init__(self, parent, title="添加分辨率", initial_width=1024, initial_height=1024):
        super().__init__(parent)
        self.title(title)
        self.resizable(False, False)
        self.result = None
        self.transient(parent)
        self.grab_set()

        frame = ttk.Frame(self, padding="20")
        frame.pack()
        ttk.Label(frame, text="宽度:").grid(row=0, column=0, sticky=tk.W, pady=5)
        self.width_var = tk.StringVar(value=str(initial_width))
        self.width_entry = ttk.Entry(frame, textvariable=self.width_var, width=10)
        self.width_entry.grid(row=0, column=1, padx=5, pady=5)
        ttk.Label(frame, text="px").grid(row=0, column=2, sticky=tk.W)

        ttk.Label(frame, text="高度:").grid(row=1, column=0, sticky=tk.W, pady=5)
        self.height_var = tk.StringVar(value=str(initial_height))
        self.height_entry = ttk.Entry(frame, textvariable=self.height_var, width=10)
        self.height_entry.grid(row=1, column=1, padx=5, pady=5)
        ttk.Label(frame, text="px").grid(row=1, column=2, sticky=tk.W)

        btn_frame = ttk.Frame(frame)
        btn_frame.grid(row=2, column=0, columnspan=3, pady=(15, 0))
        ttk.Button(btn_frame, text="确定", command=self.on_ok).pack(side=tk.LEFT, padx=5)
        ttk.Button(btn_frame, text="取消", command=self.on_cancel).pack(side=tk.LEFT, padx=5)

        self.width_entry.bind('<Return>', lambda e: self.on_ok())
        self.height_entry.bind('<Return>', lambda e: self.on_ok())
        self.width_entry.focus_set()
        self.width_entry.select_range(0, tk.END)
        self.wait_window()

    def on_ok(self):
        """确认"""
        try:
            width = int(self.width_var.get())
            height = int(self.height_var.get())
            if width <= 0 or height <= 0:
                messagebox.showerror("错误", "宽度和高度必须大于 0")
                return
            if width > 10000 or height > 10000:
                messagebox.showerror("错误", "宽度和高度不能超过 10000")
                return
            self.result = (width, height)
            self.destroy()
        except ValueError:
            messagebox.showerror("错误", "请输入有效的数字")

    def on_cancel(self):
        """取消"""
        self.destroy()
