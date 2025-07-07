# ─────────────────────────────────────────────────────────────
# Dockerfile: Node 16 base + native build + Playwright
# ─────────────────────────────────────────────────────────────
FROM node:16-bullseye

# 1) Install Python3 & build tools for native modules
RUN apt-get update && apt-get install -y \
      python3 \
      python-is-python3 \
      build-essential \
      libffi-dev \
      libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# 2) Set working directory
WORKDIR /app

# 3) Copy everything (including index.js!)
COPY . .

# 4) Install Node dependencies (including ffi-napi, vosk) and Playwright
RUN npm ci --unsafe-perm \
 && npx playwright install --with-deps

# 5) Expose your port & start the app
EXPOSE 8080
CMD ["npm", "start"]
