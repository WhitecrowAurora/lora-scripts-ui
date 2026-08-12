"""Shared optional tkinter imports for image resize GUI modules."""

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, scrolledtext, simpledialog, ttk

    HAS_GUI = True
except ImportError:
    import types

    HAS_GUI = False
    tk = types.ModuleType('tk')
    tk.Toplevel = object
    tk.Tk = object
    ttk = filedialog = scrolledtext = messagebox = simpledialog = None
