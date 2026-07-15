FROM node:24-trixie-slim

ARG DEVCONTAINER_VARIANT

LABEL devcontainer.variant="${DEVCONTAINER_VARIANT}"

USER root

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git sudo \
  && echo 'node ALL=(root) NOPASSWD:ALL' > /etc/sudoers.d/node \
  && chmod 0440 /etc/sudoers.d/node \
  && rm -rf /var/lib/apt/lists/*

USER node
