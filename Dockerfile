# Build the Vite SPA, then serve the static bundle with Nginx.
FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ARG VITE_DATA_BACKEND=online
ARG VITE_OFFLINE_API_URL=/api/offline
ENV VITE_DATA_BACKEND=$VITE_DATA_BACKEND
ENV VITE_OFFLINE_API_URL=$VITE_OFFLINE_API_URL
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
