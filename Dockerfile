# AgriTrade AI Backend Dockerfile
# Multi-stage build for optimized production image

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies for building native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    jpeg-dev \
    cairo-dev \
    giflib-dev \
    pango-dev \
    vips-dev

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY backend/ ./backend/
COPY docs/ ./docs/
COPY tsconfig.json ./
COPY jest.config.js ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install system dependencies for runtime
RUN apk add --no-cache \
    jpeg \
    cairo \
    giflib \
    pango \
    vips \
    tini

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S agritrade -u 1001 -G nodejs

# Copy built application from builder stage
COPY --from=builder --chown=agritrade:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=agritrade:nodejs /app/docs ./docs
COPY --chown=agritrade:nodejs logs/ ./logs/

# Create necessary directories
RUN mkdir -p ./uploads ./logs && \
    chown -R agritrade:nodejs ./uploads ./logs

# Switch to non-root user
USER agritrade

# Expose port
EXPOSE 3000

# Health check
HELTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "backend/dist/index.js"]