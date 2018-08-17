# Build on a Node.js 8 Alpine
# FROM resin/raspberry-pi-alpine-node
FROM node:alpine

# Create working directory for app
WORKDIR /app

# Copy files
COPY . .

# Install node modules
RUN ["npm", "install"]

# Open port 3001
EXPOSE 3001

# To be executed on container startup
CMD ["npm", "start"]
