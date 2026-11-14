# 🚀 Deploy Ownique on Vultr + a GoDaddy domain

## 1. Create the server (Vultr)
1. Sign in at vultr.com and claim your free hackathon credits.
2. **Deploy New Server** → Cloud Compute → **Ubuntu 24.04** → the cheapest plan with 2 GB RAM is plenty.
3. Copy the server's **IP address** and **root password**.

## 2. Connect and install Docker
From your laptop's terminal:
```
ssh root@YOUR_SERVER_IP
curl -fsSL https://get.docker.com | sh
apt install -y git nginx certbot python3-certbot-nginx
```

## 3. Get the code and your keys
```
git clone https://github.com/Prisharana090/ownique.git
cd ownique
nano .env.local      # paste the same keys as on your laptop, then Ctrl+O, Enter, Ctrl+X
```
Set `NEXT_PUBLIC_SITE_URL=https://yourdomain.com` in `.env.local`.

## 4. Build and run
```
docker build -t ownique --build-arg NEXT_PUBLIC_SITE_URL=https://yourdomain.com .
docker run -d --name ownique --restart always --env-file .env.local -p 3000:3000 ownique
```
Check: open `http://YOUR_SERVER_IP:3000`.

## 5. Point your GoDaddy Registry domain at Vultr
In your domain's DNS settings add:
| Type | Name | Value |
|---|---|---|
| A | @ | YOUR_SERVER_IP |
| A | www | YOUR_SERVER_IP |

## 6. Nginx + free HTTPS
```
cat > /etc/nginx/sites-available/ownique <<'CONF'
server {
  server_name yourdomain.com www.yourdomain.com;
  client_max_body_size 10M;
  location / { proxy_pass http://localhost:3000; proxy_set_header Host $host; }
}
CONF
ln -s /etc/nginx/sites-available/ownique /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
🎉 Your site is live at `https://yourdomain.com`.

## Update after new commits
```
cd ownique && git pull
docker build -t ownique --build-arg NEXT_PUBLIC_SITE_URL=https://yourdomain.com .
docker rm -f ownique && docker run -d --name ownique --restart always --env-file .env.local -p 3000:3000 ownique
```

> In MongoDB Atlas → Network Access, allow your Vultr server's IP.
