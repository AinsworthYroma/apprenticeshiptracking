#!/usr/bin/env python3
"""Lanceur simple pour l'application Apprenticeship Tracking."""

from __future__ import annotations

import argparse
import os
import signal
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def run(cmd: list[str], env: dict[str, str] | None = None) -> None:
    """Execute une commande et stoppe le script en cas d'erreur."""
    print(f"\n$ {' '.join(cmd)}")
    subprocess.run(cmd, cwd=ROOT, check=True, env=env)


def ensure_npm() -> None:
    if shutil.which("npm") is None:
        print("Erreur: npm est introuvable. Installe Node.js puis reessaie.")
        sys.exit(1)


def ensure_dependencies() -> None:
    node_modules = ROOT / "node_modules"
    if node_modules.exists():
        return
    print("Dependances absentes: installation en cours...")
    run(["npm", "install"])


def is_port_busy(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.4)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def stop_listener_on_port(port: int) -> bool:
    """Tente d'arreter le processus en ecoute sur le port. Retourne True si termine."""
    result = subprocess.run(
        ["lsof", "-t", f"-iTCP:{port}", "-sTCP:LISTEN"],
        capture_output=True,
        text=True,
        check=False,
    )
    pids = [line.strip() for line in result.stdout.splitlines() if line.strip()]

    if not pids:
        return False

    for pid_text in pids:
        try:
            os.kill(int(pid_text), signal.SIGTERM)
        except (ProcessLookupError, ValueError, PermissionError):
            continue

    for _ in range(20):
        if not is_port_busy(port):
            return True
        time.sleep(0.15)

    return not is_port_busy(port)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Lance toute l'application Apprenticeship Tracking"
    )
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Lance en mode developpement (npm run dev)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", "3000")),
        help="Port d'ecoute du serveur Node (defaut: PORT env ou 3000)",
    )
    args = parser.parse_args()

    ensure_npm()
    ensure_dependencies()

    if args.port <= 0 or args.port > 65535:
        print(f"Erreur: port invalide ({args.port}).")
        sys.exit(1)

    if is_port_busy(args.port):
        print(f"Port {args.port} deja utilise: arret du processus existant...")
        if not stop_listener_on_port(args.port):
            print(f"Impossible de liberer le port {args.port}. Verifie manuellement avec: lsof -i :{args.port}")
            sys.exit(1)
        print(f"Port {args.port} libere.")

    start_cmd = ["npm", "run", "dev"] if args.dev else ["npm", "start"]
    run_env = os.environ.copy()
    run_env["PORT"] = str(args.port)

    print(f"\nDemarrage de l'application sur http://localhost:{args.port}")
    print("Arret: Ctrl+C\n")
    run(start_cmd, env=run_env)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nArret demande par l'utilisateur.")
