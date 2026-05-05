FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# nginx image auto-processes /etc/nginx/templates/*.template with envsubst on start
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
# Default: backend K8s service name — override via BACKEND_URL env var in K8s
ENV BACKEND_URL=http://ubdac-server:3001
EXPOSE 80
