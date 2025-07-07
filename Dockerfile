FROM node:18

# Install build tools, Chromium libs, plus libffi & SSL headers
RUN apt-get update && \
    apt-get install -y \
      build-essential python3 make g++ \
      libffi-dev libssl-dev \
      fonts-liberation libasound2 libatk1.0-0 libatk-bridge2.0-0 \
      libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 \
      libnss3 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
      libxss1 libxtst6 libxshmfence1 libwayland-client0 libwayland-cursor0 \
    && ln -s /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json independently to leverage Docker cache
COPY package.json package-lock.json* ./

# Install all Node deps (including Playwright and your native modules)
RUN npm install

# Install Playwright’s browsers and extra OS libs
RUN npx playwright install --with-deps

# Copy the rest of the application code
COPY . .

EXPOSE 8080

CMD ["npm", "start"]
