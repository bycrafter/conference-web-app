# syntax=docker/dockerfile:1

##########################
# Stage 1: build         #
##########################
FROM node:22.23.1-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

ARG VITE_API_BASE_URL=/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

