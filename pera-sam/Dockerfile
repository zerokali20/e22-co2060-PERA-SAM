# Use Node.js for building
FROM node:20-slim AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Use Nginx to serve the build
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Copy a default nginx config if needed, but let's stick to basics
EXPOSE 8080
# Update nginx to listen on 8080 if needed, or just use 80 and map it
CMD ["nginx", "-g", "daemon off;"]
