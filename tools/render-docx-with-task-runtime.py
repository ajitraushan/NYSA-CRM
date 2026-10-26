import os
import runpy
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
soffice_dir = root / "tmp" / "libreoffice-runtime" / "extracted" / "program"
poppler_dir = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin"
task_tmp = root / "tmp" / "document-render-runtime"
task_tmp.mkdir(parents=True, exist_ok=True)
os.environ["PATH"] = os.pathsep.join((str(soffice_dir), str(poppler_dir), os.environ.get("PATH", "")))
os.environ["TEMP"] = str(task_tmp)
os.environ["TMP"] = str(task_tmp)
tempfile.tempdir = str(task_tmp)
codex_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex"))
renderers = sorted((codex_home / "plugins/cache/openai-primary-runtime/documents").glob("*/skills/documents/render_docx.py"))
if not renderers:
    raise SystemExit("Bundled document renderer was not found")
renderer = renderers[-1]
sys.argv[0] = str(renderer)
runpy.run_path(str(renderer), run_name="__main__")
