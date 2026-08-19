# Stage 1: Build
FROM node:20-alpine AS build

WORKDIR /app

ARG REACT_APP_API_URL=""
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Source maps are not needed in the served bundle and would let anyone reconstruct the original
# TypeScript from the production build.
ENV GENERATE_SOURCEMAP=false
RUN npm run build

# Stage 2: Serve
FROM nginx:1.31-alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
