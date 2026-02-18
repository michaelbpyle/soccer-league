#!/bin/bash
# Deploy Soccer League to DashDaddy VM
# Usage: bash deploy.sh [dashdaddy-host]
# Default host: dashdaddy (via SSH config)

set -e

HOST="${1:-dashdaddy}"
SSH_USER="mbp03c"
REMOTE_DIR="/opt/soccer-league"
SERVICE_NAME="soccer-league"

echo "=== Soccer League Deployment to ${HOST} ==="

# Step 1: Copy project files to DashDaddy
echo "[1/5] Copying files to ${HOST}..."
scp -r package.json index.js database.js bot.js simulate.js register-commands.js "${HOST}:/tmp/soccer-league-deploy/"
scp -r views/ "${HOST}:/tmp/soccer-league-deploy/views/"

# Step 2: Set up project directory on server
echo "[2/5] Setting up project directory..."
ssh "${HOST}" "sudo mkdir -p ${REMOTE_DIR}/views ${REMOTE_DIR}/data && \
  sudo cp /tmp/soccer-league-deploy/*.js /tmp/soccer-league-deploy/package.json ${REMOTE_DIR}/ && \
  sudo cp -r /tmp/soccer-league-deploy/views/* ${REMOTE_DIR}/views/ && \
  sudo chown -R ${SSH_USER}:${SSH_USER} ${REMOTE_DIR}"

# Step 3: Copy .env file
echo "[3/5] Setting up environment..."
scp .env "${HOST}:/tmp/soccer-league-deploy/.env"
ssh "${HOST}" "sudo cp /tmp/soccer-league-deploy/.env ${REMOTE_DIR}/.env && \
  sudo chown ${SSH_USER}:${SSH_USER} ${REMOTE_DIR}/.env && \
  sudo chmod 600 ${REMOTE_DIR}/.env"

# Step 4: Install dependencies
echo "[4/5] Installing Node.js dependencies..."
ssh "${HOST}" "cd ${REMOTE_DIR} && npm install --production"

# Step 5: Install and start systemd service
echo "[5/5] Setting up systemd service..."
scp soccer-league.service "${HOST}:/tmp/soccer-league-deploy/"
ssh "${HOST}" "sudo cp /tmp/soccer-league-deploy/soccer-league.service /etc/systemd/system/ && \
  sudo systemctl daemon-reload && \
  sudo systemctl enable ${SERVICE_NAME} && \
  sudo systemctl restart ${SERVICE_NAME}"

# Cleanup
ssh "${HOST}" "rm -rf /tmp/soccer-league-deploy"

echo ""
echo "=== Deployment Complete ==="
echo "Web app: http://${HOST}:3000"
echo "Service: sudo systemctl status ${SERVICE_NAME}"
echo "Logs:    sudo journalctl -u ${SERVICE_NAME} -f"
