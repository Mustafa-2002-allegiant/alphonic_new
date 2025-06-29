FROM node:18

# Install build dependencies for ffi-napi/vosk
RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    ln -s /usr/bin/python3 /usr/bin/python

# Set working directory
WORKDIR /app

# Copy everything
COPY . .

# Install dependencies (vosk + ffi-napi will build now)
RUN npm install

# Run your app
CMD node index.js