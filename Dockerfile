# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Build arguments for environment variables
ARG VITE_SERVER_URL
ARG VITE_USER_1_NAME
ARG VITE_USER_1_API_KEY
ARG VITE_USER_2_NAME
ARG VITE_USER_2_API_KEY
ARG VITE_USER_3_NAME
ARG VITE_USER_3_API_KEY
ARG VITE_USER_4_NAME
ARG VITE_USER_4_API_KEY
ARG VITE_USER_5_NAME
ARG VITE_USER_5_API_KEY

# Set environment variables for build
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_USER_1_NAME=$VITE_USER_1_NAME
ENV VITE_USER_1_API_KEY=$VITE_USER_1_API_KEY
ENV VITE_USER_2_NAME=$VITE_USER_2_NAME
ENV VITE_USER_2_API_KEY=$VITE_USER_2_API_KEY
ENV VITE_USER_3_NAME=$VITE_USER_3_NAME
ENV VITE_USER_3_API_KEY=$VITE_USER_3_API_KEY
ENV VITE_USER_4_NAME=$VITE_USER_4_NAME
ENV VITE_USER_4_API_KEY=$VITE_USER_4_API_KEY
ENV VITE_USER_5_NAME=$VITE_USER_5_NAME
ENV VITE_USER_5_API_KEY=$VITE_USER_5_API_KEY

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
