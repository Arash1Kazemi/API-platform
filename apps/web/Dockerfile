# Build from the repo root:  docker build -f apps/web/Dockerfile .
FROM node:22-slim
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY apps/web apps/web
# Next bakes the API address into its proxy rules at build time. "api" is the compose service name.
ENV API_URL=http://api:4000
RUN npm run build -w apps/web
ENV NODE_ENV=production
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["npm", "start"]
