Run locally with a reverse proxy so the Matterport iframe is same-origin.

1. Install deps:

```bash
npm install
```

2. Start server:

```bash
npm start
```

3. Open:

`http://localhost:5173/index.html`

The iframe `src` should point to Matterport's official URL `https://my.matterport.com/show/?m=...&play=1`.

## CI/CD Deployment

Automatic deploys to production run on push to `main` via GitHub Actions (`.github/workflows/deploy.yml`). The workflow SSHes to the server, pulls the repo into `/opt/htmlBook`, installs deps, ensures a `systemd` service is running, and configures Nginx.

### One-time setup

1. Ensure your server is reachable via SSH and has ports 80/443 open.
2. In the repository settings → Secrets and variables → Actions, add:
   - `SSH_HOST`: server hostname or IP (e.g. `b3.realstage.space` or `1.2.3.4`)
   - `SSH_USER`: SSH user (e.g. `root`)
   - `SSH_KEY`: private key contents for that user (PEM format)
   - `SSH_PORT` (optional): port number if not `22`
   - `PROD_DOMAIN` (optional): domain to configure in Nginx and for TLS

Tip: create a dedicated deploy key on the server with `ssh-keygen -t ed25519 -C deploy` and paste the private key as `SSH_KEY` and the public key into the server's `~/.ssh/authorized_keys`.

### Manual deploy (fallback)

You can still deploy manually using the helper script:

```bash
./scripts/deploy_cloudzy.sh <user>@<server-ip> [yourdomain.com]
```


