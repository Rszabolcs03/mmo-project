#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

CURRENT_VERSION="$(node -p "require('./package.json').version")"

echo ""
echo "================================"
echo "   MMO Mac Release Builder"
echo "================================"
echo ""
echo "Current version: ${CURRENT_VERSION}"
read -r -p "Next version, for example 0.1.22: " NEW_VERSION
NEW_VERSION="$(echo "${NEW_VERSION}" | tr -d '[:space:]')"

if [[ ! "${NEW_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.+][0-9A-Za-z.-]+)?$ ]]; then
  echo "Version must look like 0.1.22 or 1.0.0."
  exit 1
fi

echo ""
echo "This will build Mac update ${CURRENT_VERSION} -> ${NEW_VERSION}."
read -r -p "Continue? Type y: " CONFIRM
if [[ "${CONFIRM}" != "y" ]]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "[1/4] Updating package version"
npm version "${NEW_VERSION}" --no-git-tag-version

echo ""
echo "[2/4] Installing dependencies if needed"
if [[ -d node_modules ]]; then
  echo "node_modules exists, skipping npm install."
else
  npm install
fi

echo ""
echo "[3/4] Building Mac app"
npm run electron:dist:mac

echo ""
echo "[4/4] Preparing Mac update files"
npm run update:prepare

echo ""
echo "Mac release ${NEW_VERSION} is ready."
echo "Manifest:"
echo "  updates/latest-mac.yml"
