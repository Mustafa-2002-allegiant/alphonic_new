# ─────────────────────────────────────────────────────────────
# Dockerfile
# ─────────────────────────────────────────────────────────────

# 1) Base image with Node 18
FROM node:18

# 2) Install your existing build-deps + OS libs for Chromium
RUN apt-get update && \
    apt-get install -y \
      python3 make g++ \
      fonts-liberation libasound2 libatk1.0-0 libatk-bridge2.0-0 \
      libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 \
      libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
      libxss1 libxtst6 libxshmfence1 libwayland-client0 libwayland-cursor0 \
    && ln -s /usr/bin/python3 /usr/bin/python

# 3) Set working directory
WORKDIR /app

# 4) Copy only package files first (speeds up rebuilds)
COPY package.json package-lock.json* ./

# 5) Install EVERYTHING (including devDeps so playwright is installed)
RUN npm install

# 6) Download Playwright’s browsers + OS dependencies
RUN npx playwright install --with-deps

# 7) Copy the rest of your source code
COPY . .

# 8) Expose your port
EXPOSE 8080

# 9) Start your app
CMD ["npm", "start"]
