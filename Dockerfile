# ─────────────────────────────────────────────────────────────────
# Simple Node + Playwright + Native Module Dockerfile
# ─────────────────────────────────────────────────────────────────
FROM node:18-bullseye

# 1) Install Python, build tools, and SSL/FFI headers for ffi-napi
RUN apt-get update && apt-get install -y \
      python3 \
      make \
      g++ \
      libffi-dev \
      libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# 2) Create app directory
WORKDIR /app

# 3) Copy package manifests and install dependencies & Playwright browsers
COPY package.json package-lock.json ./
RUN npm ci --unsafe-perm \
 && npx playwright install --with-deps

# 4) Copy the rest of your source
COPY . .

# 5) Expose your port and start
EXPOSE 8080
CMD ["npm", "start"]
