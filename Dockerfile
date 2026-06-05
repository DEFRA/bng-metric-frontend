ARG PARENT_VERSION=3.0.5-node24.14.1
ARG PORT=3000
ARG PORT_DEBUG=9229

FROM defradigital/node-development:${PARENT_VERSION} AS development
ARG PARENT_VERSION
LABEL uk.gov.defra.ffc.parent-image=defradigital/node-development:${PARENT_VERSION}

ENV TZ="Europe/London"

ARG PORT
ARG PORT_DEBUG
ENV PORT=${PORT}
EXPOSE ${PORT} ${PORT_DEBUG}

USER root
RUN corepack enable
USER node

COPY --chown=node:node --chmod=755 package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# Strip our postinstall hook (dev-only husky/gitleaks setup) before install —
# scripts/ is not in this image, and the hooks are not needed inside the container.
RUN pnpm pkg delete scripts.postinstall && pnpm install --frozen-lockfile
COPY --chown=node:node --chmod=755 . .
RUN pnpm run build:frontend

CMD [ "pnpm", "run", "docker:dev" ]

FROM development AS production_build

ENV NODE_ENV=production

RUN pnpm run build:frontend

FROM defradigital/node:${PARENT_VERSION} AS production
ARG PARENT_VERSION
LABEL uk.gov.defra.ffc.parent-image=defradigital/node:${PARENT_VERSION}

ENV TZ="Europe/London"

# Add curl to template.
# CDP PLATFORM HEALTHCHECK REQUIREMENT
USER root
RUN apk add --no-cache curl
RUN corepack enable
USER node

COPY --from=production_build /home/node/package.json /home/node/pnpm-lock.yaml /home/node/pnpm-workspace.yaml /home/node/.npmrc ./
COPY --from=production_build /home/node/src ./src/
COPY --from=production_build /home/node/.public/ ./.public/

# Strip our postinstall hook (dev-only husky/gitleaks setup) before install —
# scripts/ is not shipped in the production image, and the hooks are not needed at runtime.
RUN pnpm pkg delete scripts.postinstall && pnpm install --frozen-lockfile --prod

ARG PORT
ENV PORT=${PORT}
EXPOSE ${PORT}

CMD [ "node", "src" ]
