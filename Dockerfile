# ─────────────────────────────────────────────────────────────────
# Dockerfile: Node 18 + Native Build Tools + Playwright Support
# ─────────────────────────────────────────────────────────────────
FROM node:18-bullseye

# 1) Install Python3 & make 'python' point to 'python3', plus build tools & headers
RUN apt-get update && apt-get install -y \
      python3 \
      python-is-python3 \
      build-essential \
      make \
      g++ \
      libffi-dev \
      libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# 2) Set working directory
WORKDIR /app

# 3) Copy package manifests and install Node deps (including native modules)
COPY package.json package-lock.json ./
RUN npm ci --unsafe-perm

# 4) Install Playwright’s browsers and their OS dependencies
RUN npx playwright install --with-deps

# 5) Copy the rest of your source code
COPY . .

# 6) Expose port and launch
EXPOSE 8080
CMD ["npm", "start"]
