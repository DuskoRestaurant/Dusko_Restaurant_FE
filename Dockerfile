FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG APP=management
ARG VITE_API_BASE_URL
ARG VITE_STAFF_APP_URL
ARG VITE_MANAGEMENT_APP_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL VITE_STAFF_APP_URL=$VITE_STAFF_APP_URL VITE_MANAGEMENT_APP_URL=$VITE_MANAGEMENT_APP_URL
RUN if [ "$APP" = "management" ]; then npm run build && cp -r dist /output; elif [ "$APP" = "staff" ]; then npx vite build staff-app --config staff-app/vite.config.js && cp -r staff-app/dist /output; elif [ "$APP" = "customer" ]; then npx vite build customer-web --config customer-web/vite.config.js && cp -r customer-web/dist /output; else exit 1; fi
FROM nginx:stable-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /output /usr/share/nginx/html
EXPOSE 80
