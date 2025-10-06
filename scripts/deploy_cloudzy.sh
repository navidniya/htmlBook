#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy_cloudzy.sh <user>@<server-ip> [yourdomain.com]
TARGET=${1:-}
DOMAIN=${2:-}
if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 <user>@<server-ip> [domain]" >&2
  exit 1
fi

APP_DIR=/opt/htmlBook
SERVICE=htmlbook
PORT=5173

ssh -o StrictHostKeyChecking=accept-new "$TARGET" bash -s <<'REMOTE'
set -euo pipefail
sudo apt update
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi
sudo apt install -y nginx git

sudo mkdir -p /opt/htmlBook
sudo chown -R "$USER":"$USER" /opt/htmlBook
if [[ ! -d /opt/htmlBook/.git ]]; then
  git clone https://github.com/navidniya/htmlBook.git /opt/htmlBook
else
  cd /opt/htmlBook && git pull
fi
cd /opt/htmlBook
npm ci --omit=dev

sudo tee /etc/systemd/system/htmlbook.service >/dev/null <<UNIT
[Unit]
Description=Realty Scan Node server (htmlBook)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/htmlBook
Environment=PORT=5173
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
User=root
Group=root

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now htmlbook

if [[ ! -f /etc/nginx/sites-available/htmlbook ]]; then
  sudo tee /etc/nginx/sites-available/htmlbook >/dev/null <<'NGINX'
server {
  server_name _;
  location / {
    proxy_pass http://127.0.0.1:5173;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
NGINX
  sudo ln -sf /etc/nginx/sites-available/htmlbook /etc/nginx/sites-enabled/htmlbook
fi
sudo nginx -t && sudo systemctl reload nginx

REMOTE

if [[ -n "${DOMAIN:-}" ]]; then
  ssh "$TARGET" sudo sed -i "s/server_name _;/server_name $DOMAIN www.$DOMAIN;/" /etc/nginx/sites-available/htmlbook
  ssh "$TARGET" 'sudo nginx -t && sudo systemctl reload nginx'
  ssh "$TARGET" 'sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d '"$DOMAIN"' -d '"www.$DOMAIN"' --redirect --non-interactive --agree-tos -m admin@'"$DOMAIN"''
fi

echo "Deployment complete. Visit: http://${DOMAIN:-<server-ip>}"
