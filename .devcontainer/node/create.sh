#!/usr/bin/env bash

set -euo pipefail

# Ensure required directories exist and are owned by the current user
workspace_paths=("$PWD/node_modules" "$PWD/apps/frontend/node_modules" "$PWD/.cache")
home_paths=("$HOME/Matterbridge" "$HOME/.matterbridge" "$HOME/.mattercert" "$HOME/.claude" "$HOME/.codex" "$HOME/.bash_history_volume")

sudo mkdir -p "${workspace_paths[@]}" "${home_paths[@]}" # Create directories if they don't exist
sudo chown -R "$(id -u):$(id -g)" "${workspace_paths[@]}" "${home_paths[@]}" # Transfer ownership to the current user

# Configure the shell prompt
prompt_config='PS1="\u:\w\$ "'
touch "$HOME/.bashrc"
if ! grep -Fqx "$prompt_config" "$HOME/.bashrc"; then
  printf '\n%s\n' "$prompt_config" >> "$HOME/.bashrc"
fi

# Persist bash history in the volume-backed directory
history_config='export HISTFILE="$HOME/.bash_history_volume/.bash_history"
export HISTSIZE=10000
export HISTFILESIZE=20000
export HISTCONTROL=ignoreboth
stty -ixon 2>/dev/null || true'
if ! grep -q 'HISTFILE.*bash_history_volume' "$HOME/.bashrc"; then
  printf '\n%s\n' "$history_config" >> "$HOME/.bashrc"
fi
