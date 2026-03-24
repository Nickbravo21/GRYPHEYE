### Stage 1 — build the React app
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --frozen-lockfile

COPY public ./public
COPY src    ./src

# Build for production (output goes to /app/build)
ENV REACT_APP_API_URL=/api
RUN npm run build

### Stage 2 — serve with nginx
FROM nginx:1.25-alpine

# Remove default nginx page
RUN rm -rf /usr/share/nginx/html/*

# Copy built React app
COPY --from=builder /app/build /usr/share/nginx/html

# Custom nginx config (proxy /api/* → backend)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
