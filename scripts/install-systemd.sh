#!/usr/bin/env bash
set -euo pipefail

APP_NAME="floss-collection"
APP_USER="floss-collection"
APP_GROUP="floss-collection"
INSTALL_DIR="/opt/${APP_NAME}"
ENV_DIR="/etc/${APP_NAME}"
ENV_FILE="${ENV_DIR}/env"
SERVICE_NAME="${APP_NAME}.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

echo "==> Checking dependencies"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Installing Node.js and npm via dnf..."
  dnf install -y nodejs npm
fi

require_cmd node
require_cmd npm
require_cmd systemctl
require_cmd rsync

NODE_VERSION="$(node -p "process.versions.node.split('.')[0]")"
if [[ "${NODE_VERSION}" -lt 18 ]]; then
  echo "Node.js 18+ is required (found $(node --version))." >&2
  exit 1
fi

echo "==> Creating service user"
if ! id "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --home-dir "${INSTALL_DIR}" --shell /sbin/nologin "${APP_USER}"
fi

echo "==> Installing application to ${INSTALL_DIR}"
install -d -m 0755 "${INSTALL_DIR}"
rsync -a --delete \
  --exclude node_modules \
  --exclude client/node_modules \
  --exclude client/dist \
  --exclude data \
  --exclude .git \
  "${PROJECT_DIR}/" "${INSTALL_DIR}/"

echo "==> Installing npm dependencies and building UI"
cd "${INSTALL_DIR}"
npm install
npm run build

echo "==> Preparing data directory"
install -d -m 0750 "${INSTALL_DIR}/data"
chown -R "${APP_USER}:${APP_GROUP}" "${INSTALL_DIR}"

echo "==> Installing environment file"
install -d -m 0755 "${ENV_DIR}"
if [[ ! -f "${ENV_FILE}" ]]; then
  install -m 0644 "${INSTALL_DIR}/deploy/floss-collection.env.example" "${ENV_FILE}"
else
  echo "Keeping existing ${ENV_FILE}"
fi

echo "==> Installing systemd unit"
install -m 0644 "${INSTALL_DIR}/deploy/floss-collection.service" "/etc/systemd/system/${SERVICE_NAME}"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

echo
echo "Installation complete."
echo "  Service: systemctl status ${SERVICE_NAME}"
echo "  Logs:    journalctl -u ${SERVICE_NAME} -f"
echo "  Config:  ${ENV_FILE}"
echo "  URL:     http://$(hostname -f 2>/dev/null || hostname):$(grep -E '^PORT=' "${ENV_FILE}" | cut -d= -f2 || echo 3000)"
