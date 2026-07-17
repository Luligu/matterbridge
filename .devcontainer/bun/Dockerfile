FROM oven/bun:slim

ARG DEVCONTAINER_VARIANT

LABEL devcontainer.variant="${DEVCONTAINER_VARIANT}"

ENV BUN_INSTALL=/home/bun/.bun
ENV BUN_INSTALL_BIN=/home/bun/.bun/bin
ENV BUN_INSTALL_GLOBAL_DIR=/home/bun/.bun/install/global
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

USER root

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates git sudo \
  && echo 'bun ALL=(root) NOPASSWD:ALL' > /etc/sudoers.d/bun \
  && chmod 0440 /etc/sudoers.d/bun \
  && rm -rf /var/lib/apt/lists/*

USER bun
