FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=pwuser:pwuser src ./src
COPY --chown=pwuser:pwuser public ./public
# The demo deliberately imports the camera worker's proven capture/masking code.
COPY --chown=pwuser:pwuser camera-worker/src ./camera-worker/src

RUN mkdir -p /app/.runtime && chown pwuser:pwuser /app/.runtime
USER pwuser

EXPOSE 3000
CMD ["node", "src/server.js"]
