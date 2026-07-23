from __future__ import annotations

import importlib.util
import socket
import sys
import time
from pathlib import Path


SUPERVISOR_PATH = Path(__file__).resolve().parents[2] / "scripts" / "dev_supervisor.py"
START_SCRIPT_PATH = SUPERVISOR_PATH.with_name("start_app.ps1")
SPEC = importlib.util.spec_from_file_location("games_tracker_dev_supervisor", SUPERVISOR_PATH)
assert SPEC and SPEC.loader
dev_supervisor = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = dev_supervisor
SPEC.loader.exec_module(dev_supervisor)

ProcessSpec = dev_supervisor.ProcessSpec
ProcessSupervisor = dev_supervisor.ProcessSupervisor


def get_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.bind(("127.0.0.1", 0))
        return int(server.getsockname()[1])


def wait_until(predicate, timeout: float = 5.0) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.05)
    return predicate()


def test_supervisor_stops_a_process_tree_and_releases_its_port(tmp_path):
    port = get_free_port()
    server_code = (
        "import socket,time;"
        "server=socket.socket();"
        "server.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);"
        f"server.bind(('127.0.0.1',{port}));"
        "server.listen();"
        "time.sleep(60)"
    )
    parent_code = (
        "import subprocess,sys,time;"
        f"subprocess.Popen([sys.executable,'-c',{server_code!r}]);"
        "time.sleep(60)"
    )
    supervisor = ProcessSupervisor(
        [ProcessSpec("test tree", (sys.executable, "-c", parent_code), tmp_path)],
        [port],
    )

    try:
        supervisor.start()
        assert wait_until(lambda: dev_supervisor.is_port_open(port))
        assert supervisor.shutdown() is True
        assert wait_until(lambda: not dev_supervisor.is_port_open(port))
        assert supervisor.managed[0].process.poll() is not None
    finally:
        supervisor.shutdown()


def test_supervisor_cleans_up_when_a_later_process_cannot_start(tmp_path):
    supervisor = ProcessSupervisor(
        [
            ProcessSpec("running child", (sys.executable, "-c", "import time; time.sleep(60)"), tmp_path),
            ProcessSpec("broken child", (str(tmp_path / "missing-command.exe"),), tmp_path),
        ],
        [],
    )

    assert supervisor.run() == 1
    assert supervisor.managed[0].process.poll() is not None


def test_supervisor_forces_its_job_when_a_child_ignores_the_graceful_signal(tmp_path, monkeypatch):
    ignored_signal = "SIGBREAK" if sys.platform == "win32" else "SIGTERM"
    child_code = (
        "import signal,time;"
        f"signal.signal(signal.{ignored_signal},signal.SIG_IGN);"
        "time.sleep(60)"
    )
    monkeypatch.setattr(dev_supervisor, "GRACEFUL_TIMEOUT_SECONDS", 0.2)
    supervisor = ProcessSupervisor(
        [ProcessSpec("stubborn child", (sys.executable, "-c", child_code), tmp_path)],
        [],
    )

    try:
        supervisor.start()
        time.sleep(0.2)
        assert supervisor.shutdown() is True
        assert supervisor.managed[0].process.poll() is not None
    finally:
        supervisor.shutdown()


def test_supervisor_returns_the_failed_child_exit_code_and_stops_the_other(tmp_path):
    supervisor = ProcessSupervisor(
        [
            ProcessSpec("failed child", (sys.executable, "-c", "raise SystemExit(7)"), tmp_path),
            ProcessSpec("running child", (sys.executable, "-c", "import time; time.sleep(60)"), tmp_path),
        ],
        [],
    )

    assert supervisor.run() == 7
    assert all(item.process.poll() is not None for item in supervisor.managed)


def test_start_script_uses_scoped_supervision_and_tracks_database_ownership():
    script = START_SCRIPT_PATH.read_text(encoding="utf-8")

    assert "dev_supervisor.py" in script
    assert "Test-IsProjectProcess" in script
    assert "Stop-ProjectProcessesOnPort" in script
    assert "$PostgresStartedByScript" in script
    assert "compose stop --timeout 10 postgres" in script
    assert "Get-Process -Name" not in script
    assert "taskkill.exe /IM" not in script
