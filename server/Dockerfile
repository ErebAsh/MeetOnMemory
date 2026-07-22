FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

# Copy the rest of the application code
COPY . .

# Expose port (adjust if your server runs on a different port)
EXPOSE 5000

CMD ["npm", "run", "server"]
