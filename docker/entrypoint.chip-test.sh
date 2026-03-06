#!/bin/sh

FLAG_FILE="/root/matterbridge/.initialized"

echo "Welcome to the Matterbridge chip-test docker image."
echo "Includes Ubuntu LTS, Node.Js 24 LTS, connectedhomeip repository with chip-tool, chip-cert and all needed for YAML and Python tests. The matterbridge instance inside the container is already paired in the chip-tool fabric to execute YAML tests and in the Python harness fabric to execute Python tests. In the container, the chip environment and Python environment are already active. Just open a shell inside the container with bash and run the tests. Matterbridge frontend is as usual on port 8283. No volumes or port mapping needed."
# echo "docker exec -it matterbridge-chip-test-local bash"
# echo "python3 src/python_testing/TC_DeviceBasicComposition.py"
# echo "python3 src/python_testing/TC_DeviceConformance.py --bool-arg allow_provisional:true"
# echo "python3 src/python_testing/TC_DefaultWarnings.py --bool-arg pixit_allow_default_vendor_id:true"

if [ ! -f "$FLAG_FILE" ]; then

  # Optional packages

  # Create the flag file to indicate initialization has been done
  touch "$FLAG_FILE"
fi

DISTRO=$(awk -F= '/^PRETTY_NAME=/{gsub(/"/, "", $2); print $2}' /etc/os-release)
CODENAME=$(awk -F= '/^VERSION_CODENAME=/{print $2}' /etc/os-release)
echo "🖥️ Distro: $DISTRO ($CODENAME)"
echo "🧱 Architecture: $(uname -m)"
echo "🧩 Kernel Version: $(uname -r)"
echo "👤 User: $(whoami)"
echo "🏷️ Hostname: $(hostname)"
echo "📅 Date: $(date)"
echo "🟢 Node.js version: $(node -v)"
echo "🟣 Npm version: $(npm -v)"
echo ""

# Start the main process
exec "$@"
