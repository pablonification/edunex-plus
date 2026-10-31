#!/usr/bin/env bash
# Starts the lab's `mid` emulator, cold and read-only, on a free port (or the one given): see emu.sh.
exec bash "$(dirname "${BASH_SOURCE[0]}")/emu.sh" mid "$@"
