FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

# Copy the rest of the application code
COPY . .

# Expose Vite's default port
EXPOSE 5173

# Expose Vite via the --host flag
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
