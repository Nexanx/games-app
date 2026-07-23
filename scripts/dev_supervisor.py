from __future__ import annotations

import argparse
import ctypes
import os
import shlex
import signal
import socket
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence


GRACEFUL_TIMEOUT_SECONDS = 5.0
FORCED_TIMEOUT_SECONDS = 3.0
PORT_RELEASE_TIMEOUT_SECONDS = 3.0
LAUNCHER_EXIT_PORT_GRACE_SECONDS = 1.0


@dataclass(frozen=True)
class ProcessSpec:
    name: str
    command: tuple[str, ...]
    working_directory: Path


@dataclass
class ManagedProcess:
    spec: ProcessSpec
    process: subprocess.Popen[bytes]
    launcher_exit_reported: bool = False


if os.name == "nt":
    from ctypes import wintypes

    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000
    JOB_OBJECT_EXTENDED_LIMIT_INFORMATION_CLASS = 9

    class IoCounters(ctypes.Structure):
        _fields_ = [
            ("read_operation_count", ctypes.c_ulonglong),
            ("write_operation_count", ctypes.c_ulonglong),
            ("other_operation_count", ctypes.c_ulonglong),
            ("read_transfer_count", ctypes.c_ulonglong),
            ("write_transfer_count", ctypes.c_ulonglong),
            ("other_transfer_count", ctypes.c_ulonglong),
        ]

    class JobObjectBasicLimitInformation(ctypes.Structure):
        _fields_ = [
            ("per_process_user_time_limit", ctypes.c_longlong),
            ("per_job_user_time_limit", ctypes.c_longlong),
            ("limit_flags", wintypes.DWORD),
            ("minimum_working_set_size", ctypes.c_size_t),
            ("maximum_working_set_size", ctypes.c_size_t),
            ("active_process_limit", wintypes.DWORD),
            ("affinity", ctypes.c_size_t),
            ("priority_class", wintypes.DWORD),
            ("scheduling_class", wintypes.DWORD),
        ]

    class JobObjectExtendedLimitInformation(ctypes.Structure):
        _fields_ = [
            ("basic_limit_information", JobObjectBasicLimitInformation),
            ("io_info", IoCounters),
            ("process_memory_limit", ctypes.c_size_t),
            ("job_memory_limit", ctypes.c_size_t),
            ("peak_process_memory_used", ctypes.c_size_t),
            ("peak_job_memory_used", ctypes.c_size_t),
        ]


class WindowsJob:
    def __init__(self) -> None:
        self.handle: int | None = None
        if os.name != "nt":
            return

        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.CreateJobObjectW.argtypes = (ctypes.c_void_p, wintypes.LPCWSTR)
        kernel32.CreateJobObjectW.restype = wintypes.HANDLE
        kernel32.SetInformationJobObject.argtypes = (
            wintypes.HANDLE,
            ctypes.c_int,
            ctypes.c_void_p,
            wintypes.DWORD,
        )
        kernel32.SetInformationJobObject.restype = wintypes.BOOL
        kernel32.AssignProcessToJobObject.argtypes = (wintypes.HANDLE, wintypes.HANDLE)
        kernel32.AssignProcessToJobObject.restype = wintypes.BOOL
        kernel32.TerminateJobObject.argtypes = (wintypes.HANDLE, wintypes.UINT)
        kernel32.TerminateJobObject.restype = wintypes.BOOL
        kernel32.CloseHandle.argtypes = (wintypes.HANDLE,)
        kernel32.CloseHandle.restype = wintypes.BOOL
        self._kernel32 = kernel32

        handle = kernel32.CreateJobObjectW(None, None)
        if not handle:
            raise ctypes.WinError(ctypes.get_last_error())

        info = JobObjectExtendedLimitInformation()
        info.basic_limit_information.limit_flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not kernel32.SetInformationJobObject(
            handle,
            JOB_OBJECT_EXTENDED_LIMIT_INFORMATION_CLASS,
            ctypes.byref(info),
            ctypes.sizeof(info),
        ):
            error = ctypes.get_last_error()
            kernel32.CloseHandle(handle)
            raise ctypes.WinError(error)
        self.handle = handle

    def assign(self, process: subprocess.Popen[bytes]) -> None:
        if self.handle is None:
            return
        process_handle = wintypes.HANDLE(process._handle)  # type: ignore[attr-defined]
        if not self._kernel32.AssignProcessToJobObject(self.handle, process_handle):
            raise ctypes.WinError(ctypes.get_last_error())

    def terminate(self, exit_code: int = 1) -> None:
        if self.handle is not None:
            self._kernel32.TerminateJobObject(self.handle, exit_code)

    def close(self) -> None:
        if self.handle is not None:
            self._kernel32.CloseHandle(self.handle)
            self.handle = None


class ProcessSupervisor:
    def __init__(self, specs: Sequence[ProcessSpec], ports: Sequence[int]) -> None:
        self.specs = list(specs)
        self.ports = list(ports)
        self.managed: list[ManagedProcess] = []
        self.job = WindowsJob()
        self._shutdown_complete = False

    def start(self) -> None:
        for spec in self.specs:
            print(f"Uruchamianie {spec.name}: {format_command(spec.command)}", flush=True)
            creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
            process = subprocess.Popen(
                list(spec.command),
                cwd=spec.working_directory,
                creationflags=creation_flags,
                start_new_session=os.name != "nt",
            )
            managed = ManagedProcess(spec=spec, process=process)
            self.managed.append(managed)
            try:
                self.job.assign(process)
            except Exception:
                process.kill()
                process.wait(timeout=FORCED_TIMEOUT_SECONDS)
                raise

    def run(self) -> int:
        try:
            self.start()
            print("", flush=True)
            print("Aplikacja została uruchomiona:", flush=True)
            for port, managed in zip(self.ports, self.managed, strict=False):
                print(f"  {managed.spec.name}: http://localhost:{port}", flush=True)
            if self.ports:
                print(f"  OpenAPI: http://localhost:{self.ports[0]}/docs", flush=True)
            print("", flush=True)
            print("Naciśnij Ctrl+C, aby zatrzymać całą aplikację.", flush=True)

            while True:
                for index, managed in enumerate(self.managed):
                    exit_code = managed.process.poll()
                    if exit_code is not None:
                        port = self.ports[index] if index < len(self.ports) else None
                        if port is not None and wait_for_port_open(
                            port,
                            LAUNCHER_EXIT_PORT_GRACE_SECONDS,
                        ):
                            if not managed.launcher_exit_reported:
                                print(
                                    f"{managed.spec.name}: proces uruchamiający zakończył działanie "
                                    f"(kod {exit_code}), ale usługa nadal działa na porcie {port}. "
                                    "Kontynuowanie nadzoru procesu potomnego.",
                                    file=sys.stderr,
                                    flush=True,
                                )
                                managed.launcher_exit_reported = True
                            continue
                        print(
                            f"{managed.spec.name} zakończył działanie (kod {exit_code}). "
                            "Zatrzymywanie pozostałych procesów...",
                            file=sys.stderr,
                            flush=True,
                        )
                        clean = self.shutdown()
                        return exit_code if exit_code != 0 and clean else 1
                time.sleep(0.25)
        except KeyboardInterrupt:
            print("", flush=True)
            print("Odebrano Ctrl+C. Zatrzymywanie aplikacji...", flush=True)
            return 130 if self.shutdown() else 1
        except BaseException as exc:
            print(f"Nie udało się uruchomić aplikacji: {exc}", file=sys.stderr, flush=True)
            self.shutdown()
            return 1
        finally:
            if not self._shutdown_complete:
                self.shutdown()

    def shutdown(self) -> bool:
        if self._shutdown_complete:
            return ports_are_released(self.ports)

        self._shutdown_complete = True
        alive = [item for item in self.managed if item.process.poll() is None]
        if alive:
            print("Wysyłanie sygnału łagodnego zakończenia...", flush=True)
            for managed in alive:
                send_graceful_signal(managed.process)

        wait_for_processes(self.managed, GRACEFUL_TIMEOUT_SECONDS)
        roots_alive = any(item.process.poll() is None for item in self.managed)
        ports_busy = not ports_are_released(self.ports)

        if roots_alive or ports_busy:
            print("Nie wszystkie procesy odpowiedziały. Wymuszanie zakończenia własnej grupy procesów...", flush=True)
            if os.name == "nt":
                self.job.terminate(1)
            else:
                for managed in self.managed:
                    kill_process_group(managed.process)
            wait_for_processes(self.managed, FORCED_TIMEOUT_SECONDS)

        self.job.close()
        released = wait_for_ports_released(self.ports, PORT_RELEASE_TIMEOUT_SECONDS)
        if released:
            print("Aplikacja została zatrzymana, a porty zostały zwolnione.", flush=True)
        else:
            busy = ", ".join(str(port) for port in self.ports if is_port_open(port))
            print(
                f"Procesy skryptu zakończono, ale porty nadal są zajęte: {busy}. "
                "Nie zatrzymano obcych procesów.",
                file=sys.stderr,
                flush=True,
            )
        return released


def send_graceful_signal(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    try:
        if os.name == "nt":
            process.send_signal(signal.CTRL_BREAK_EVENT)  # type: ignore[attr-defined]
        else:
            os.killpg(process.pid, signal.SIGTERM)
    except (OSError, ProcessLookupError):
        return


def kill_process_group(process: subprocess.Popen[bytes]) -> None:
    try:
        if os.name == "nt":
            process.kill()
        else:
            os.killpg(process.pid, signal.SIGKILL)
    except (OSError, ProcessLookupError):
        return


def wait_for_processes(processes: Sequence[ManagedProcess], timeout: float) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if all(item.process.poll() is not None for item in processes):
            return
        time.sleep(0.1)


def is_port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
        connection.settimeout(0.15)
        return connection.connect_ex(("127.0.0.1", port)) == 0


def ports_are_released(ports: Sequence[int]) -> bool:
    return all(not is_port_open(port) for port in ports)


def wait_for_port_open(port: int, timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if is_port_open(port):
            return True
        time.sleep(0.1)
    return is_port_open(port)


def wait_for_ports_released(ports: Sequence[int], timeout: float) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if ports_are_released(ports):
            return True
        time.sleep(0.1)
    return ports_are_released(ports)


def format_command(command: Sequence[str]) -> str:
    return subprocess.list2cmdline(command) if os.name == "nt" else shlex.join(command)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Nadzoruje procesy developerskie Games Tracker.")
    parser.add_argument("--backend-python", required=True)
    parser.add_argument("--node", required=True)
    parser.add_argument("--next-cli", required=True)
    parser.add_argument("--backend-directory", required=True, type=Path)
    parser.add_argument("--frontend-directory", required=True, type=Path)
    parser.add_argument("--backend-port", type=int, default=8000)
    parser.add_argument("--frontend-port", type=int, default=3000)
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    def request_shutdown(_signal_number, _frame) -> None:
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, request_shutdown)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, request_shutdown)

    specs = [
        ProcessSpec(
            name="Backend",
            command=(
                args.backend_python,
                "-m",
                "uvicorn",
                "app.main:app",
                "--reload",
                "--host",
                "0.0.0.0",
                "--port",
                str(args.backend_port),
            ),
            working_directory=args.backend_directory,
        ),
        ProcessSpec(
            name="Frontend",
            command=(
                args.node,
                args.next_cli,
                "dev",
                "-H",
                "0.0.0.0",
                "-p",
                str(args.frontend_port),
            ),
            working_directory=args.frontend_directory,
        ),
    ]
    return ProcessSupervisor(specs, [args.backend_port, args.frontend_port]).run()


if __name__ == "__main__":
    raise SystemExit(main())
