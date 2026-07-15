FROM mcr.microsoft.com/playwright:v1.61.0-noble AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build
# The existing server bundle imports Vite's shared logging/static module at
# module load time, so its build dependencies remain part of the runtime tree.

FROM mcr.microsoft.com/playwright:v1.61.0-noble AS runtime

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 5000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
