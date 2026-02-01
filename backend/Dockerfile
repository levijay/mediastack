FROM node:20-alpine

# Install build dependencies for better-sqlite3 and ffprobe for media info
RUN apk add --no-cache python3 make g++ ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create config directory
RUN mkdir -p /config

# Environment variables
ENV NODE_ENV=production
ENV PORT=5055
ENV DB_PATH=/config/mediastack.db
ENV JWT_SECRET=your-secret-key-change-in-production

EXPOSE 5055

CMD ["node", "dist/server.js"]
