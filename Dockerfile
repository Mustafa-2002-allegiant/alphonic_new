# ─────────────────────────────────────────────────────────────
# Dockerfile: Node 16 + Native Build Tools + Playwright
# ─────────────────────────────────────────────────────────────
FROM node:16-bullseye

# 1) Install Python3 + 'python' shim, build tools, and headers for ffi-napi
RUN apt-get update && apt-get install -y \
      python3 \
      python-is-python3 \
      build-essential \
      libffi-dev \
      libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2) Copy package files and install all deps (including ffi-napi & vosk)
COPY package.json package-lock.json ./
RUN npm ci --unsafe-perm

# 3) Fetch Playwright browsers
RUN npx playwright install --with-deps

# 4) Copy the rest of your code
COPY . .

EXPOSE 8080
CMD ["npm", "start"]
