FROM node:18-alpine

# Install tini for proper signal handling
RUN apk add --no-cache tini

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY shutdown-namespaces.js ./

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Set security context
USER nodejs

# Default command with tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]