# syntax=docker/dockerfile:1

##########################
# Stage 1: build         #
##########################
FROM node:22.23.1-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

COPY . .

ARG VITE_API_BASE_URL=/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

##########################
# Stage 2: runtime       #
##########################
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
