#!/usr/bin/env bash
#
# Install Node.js (from the official tarball) and Bun on a Fedora or CentOS Stream container.
#
# Usage inside a container (runs as root):
#   curl -4 -fsSL https://matterbridge.io/scripts/install-fedora.sh | bash
#   curl -4 -fsSL https://matterbridge.io/scripts/install-fedora.sh | NODE_VERSION=24.10.0 TZ=Europe/Rome bash
#
# NODE_VERSION defaults to "lts" (newest Active/Maintenance LTS release). Use "latest" for the
# newest release of any line, or an explicit version like 24.10.0.
# TZ defaults to Europe/Brussels (CET/CEST). Use region zones like "Europe/Rome".
# LANG defaults to en_US.UTF-8; its glibc langpack (glibc-langpack-<lang>) is installed.
# Downloads use IPv4 to avoid failing IPv6 connections in Docker on macOS.
# New Bash shells retain TZ and LANG.
# info-fedora.sh is installed to INFO_SCRIPT (default /usr/local/bin/info-fedora.sh) and called
# from ~/.bashrc, so every interactive Bash shell prints the environment banner.
#
# The install runs once and records INSTALL_STAMP (default /var/lib/matterbridge-install.done);
# a later run with the stamp present skips straight to the container command. Delete the stamp
# file to force a reinstall. Any arguments after the script are exec'd once the install is done,
# which makes the script usable as a container entrypoint. Piped runs pass no arguments, so they
# install and exit as before.
#
# Run from the repository root: local script as entrypoint, interactive shell afterwards.
#   docker run -it --pull always --hostname fedora --name fedora --network host -v "${PWD}/docs/scripts:/scripts:ro" --entrypoint bash fedora:latest /scripts/install-fedora.sh bash
#   docker run -it --pull always --hostname centos --name centos --network host -v "${PWD}/docs/scripts:/scripts:ro" --entrypoint bash quay.io/centos/centos:latest /scripts/install-fedora.sh bash
#
# Restart that container later: the stamp is still there, so only the shell starts.
#   docker start -ai fedora
#   docker start -ai centos
#
# Same, script fetched from the network (the base image already has curl). The stamp check
# guards the fetch as well, so a restart skips it; "_" stands in for $0, which leaves the
# trailing arguments as "$@" for the final exec:
#   docker run -it --pull always --hostname fedora --name fedora --network host --entrypoint bash fedora:latest -c 'if [ ! -e /var/lib/matterbridge-install.done ]; then curl -4 -fsSL https://matterbridge.io/scripts/install-fedora.sh | bash || exit 1; fi; exec "$@"' _ bash
#   docker run -it --pull always --hostname centos --name centos --network host --entrypoint bash quay.io/centos/centos:latest -c 'if [ ! -e /var/lib/matterbridge-install.done ]; then curl -4 -fsSL https://matterbridge.io/scripts/install-fedora.sh | bash || exit 1; fi; exec "$@"' _ bash
#
# Re-enter the running container with an interactive Bash shell:
#   docker exec -it fedora bash
#   docker exec -it centos bash
#
# Drop the trailing command argument (and -it) to run the script and exit.
#

set -euo pipefail

NODE_VERSION="${NODE_VERSION:-lts}"
TZ="${TZ:-Europe/Brussels}"
LANG="${LANG:-en_US.UTF-8}"
INSTALL_STAMP="${INSTALL_STAMP:-/var/lib/matterbridge-install.done}"
INFO_SCRIPT="${INFO_SCRIPT:-/usr/local/bin/info-fedora.sh}"

export TZ

SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || { echo "This script needs root or sudo." >&2; exit 1; }
  SUDO="sudo"
fi

if [ -e "$INSTALL_STAMP" ]; then
  echo "==> Already installed ($INSTALL_STAMP), skipping the installation"
else
  echo "==> Installing prerequisites"
  LANGPACK="glibc-langpack-${LANG%%_*}"
  LANGPACK="${LANGPACK%%.*}"
  $SUDO dnf install -y --setopt=install_weak_deps=False tzdata curl ca-certificates tar xz libatomic unzip iproute hostname procps-ng findutils less nano "$LANGPACK"

  echo "==> Setting timezone to $TZ"
  [ -f "/usr/share/zoneinfo/$TZ" ] || { echo "Unknown timezone: $TZ" >&2; exit 1; }
  $SUDO ln -fs "/usr/share/zoneinfo/$TZ" /etc/localtime
  printf '%s\n' "$TZ" | $SUDO tee /etc/timezone >/dev/null

  echo "==> Setting locale to $LANG"
  # The langpack installed above provides the locale definition; Node.js takes its default
  # Intl locale from the environment.
  printf 'LANG=%s\n' "$LANG" | $SUDO tee /etc/locale.conf >/dev/null

  # Read TZ and LANG from the persisted system settings in new Bash shells so later changes
  # remain effective.
  for SHELL_EXPORT in 'export TZ="$(cat /etc/timezone)"' 'export LANG="$(sed -n "s/^LANG=//p" /etc/locale.conf)"'; do
    if ! grep -Fqx "$SHELL_EXPORT" "$HOME/.bashrc" 2>/dev/null; then
      printf '\n%s\n' "$SHELL_EXPORT" >> "$HOME/.bashrc"
    fi
  done

  case "$NODE_VERSION" in
    lts | latest)
      curl -4 -fsSL https://nodejs.org/dist/index.json -o /tmp/node-index.json
      if [ "$NODE_VERSION" = "lts" ]; then
        # First entry whose "lts" field is a codename string rather than false.
        NODE_VERSION="$(sed -n '/"lts":"/{s/.*"version":"v\([^"]*\)".*/\1/p;q;}' /tmp/node-index.json)"
      else
        NODE_VERSION="$(sed -n '/"version":"v/{s/.*"version":"v\([^"]*\)".*/\1/p;q;}' /tmp/node-index.json)"
      fi
      rm -f /tmp/node-index.json
      [ -n "$NODE_VERSION" ] || { echo "Could not resolve the Node.js version." >&2; exit 1; }
      ;;
  esac

  ARCH="$(uname -m | sed 's/x86_64/x64/; s/aarch64/arm64/; s/armv7l/armv7l/')"

  echo "==> Installing Node.js v$NODE_VERSION ($ARCH)"
  curl -4 -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${ARCH}.tar.xz" -o /tmp/node.tar.xz
  $SUDO tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
  rm -f /tmp/node.tar.xz

  echo "==> Installing Bun"
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  curl -4 -fsSL https://bun.com/install | bash
  export PATH="$BUN_INSTALL/bin:$PATH"

  # Persist the install directory for interactive Bash shells, including custom BUN_INSTALL paths.
  # Single-quote the value so spaces and shell metacharacters remain literal.
  BUN_PROFILE_EXPORT="export BUN_INSTALL='$(printf '%s' "$BUN_INSTALL" | sed "s/'/'\\\\''/g")'"
  if ! grep -Fqx "$BUN_PROFILE_EXPORT" "$HOME/.bashrc" 2>/dev/null; then
    {
      printf '\n# Bun environment for Fedora interactive Bash shells\n%s\n' "$BUN_PROFILE_EXPORT"
      cat <<'EOF'
case ":$PATH:" in
  *":$BUN_INSTALL/bin:"*) ;;
  *) export PATH="$BUN_INSTALL/bin:$PATH" ;;
esac
EOF
    } >> "$HOME/.bashrc"
  fi

  echo "==> Installing the banner script"
  # Prefer the copy next to this script (mounted repository) and fall back to the published one.
  INFO_SOURCE="$(dirname "$0")/info-fedora.sh"
  if [ -f "$INFO_SOURCE" ]; then
    $SUDO cp "$INFO_SOURCE" "$INFO_SCRIPT"
  else
    $SUDO curl -4 -fsSL https://matterbridge.io/scripts/info-fedora.sh -o "$INFO_SCRIPT"
  fi
  $SUDO chmod +x "$INFO_SCRIPT"

  # Print the banner in interactive Bash shells only, so scp and other non-interactive
  # sessions keep a clean stdout.
  if ! grep -Fq "$INFO_SCRIPT" "$HOME/.bashrc" 2>/dev/null; then
    {
      printf '\n# Matterbridge container banner for interactive Bash shells\n'
      printf 'case $- in *i*) [ -x %s ] && %s ;; esac\n' "$INFO_SCRIPT" "$INFO_SCRIPT"
    } >> "$HOME/.bashrc"
  fi

  # Record the completed installation so a restarted container skips it.
  $SUDO mkdir -p "$(dirname "$INSTALL_STAMP")"
  $SUDO touch "$INSTALL_STAMP"

  echo "==> Versions"
  node -v
  npm -v
  bun --version

  echo
  echo "Open a new shell or run: source ~/.bashrc   (to get bun on PATH)"
fi

# Use the installed locale for the container command too: it is exported only here so the
# package tools above do not warn about a locale that does not exist yet.
export LANG

# Entrypoint mode: hand control to the container command when one was given.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
