# AgriTrade AI Backend Dockerfile

# Use Node.js 18 LTS Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for image processing (Sharp)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    jpeg-dev \
    cairo-dev \
    giflib-dev \
    pango-dev

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY backend/ ./backend/
COPY docs/ ./docs/

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S agritrade -u 1001

# Change ownership of app directory
RUN chown -R agritrade:nodejs /app
USER agritrade

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node backend/healthcheck.js

# Start the application
CMD ["node", "backend/src/index.js"]