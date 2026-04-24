"""Entry point for the SD-reScripts Launcher."""

import sys
import os

# Add the project root to sys.path so that `launcher.xxx` imports work.
# Handles both root/launcher/ and root/plugin/xxx/launcher/ layouts.
_launcher_dir = os.path.dirname(os.path.abspath(__file__))
_candidate = os.path.dirname(_launcher_dir)
for _ in range(5):
    if os.path.isfile(os.path.join(_candidate, 'gui.py')):
        break
    _parent = os.path.dirname(_candidate)
    if _parent == _candidate:
        break
    _candidate = _parent
if _candidate not in sys.path:
    sys.path.insert(0, _candidate)
# Also add the launcher's parent dir so `from launcher.xxx` works
# when launcher/ lives under plugin/lora-scripts-ui-main/
_launcher_parent = os.path.dirname(_launcher_dir)
if _launcher_parent not in sys.path:
    sys.path.insert(0, _launcher_parent)


def main():
    import customtkinter as ctk
    from launcher.app import App

    ctk.set_appearance_mode("dark")
    ctk.set_default_color_theme("dark-blue")

    app = App()
    app.protocol("WM_DELETE_WINDOW", app._on_close)
    app.mainloop()


if __name__ == "__main__":
    main()
