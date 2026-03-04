# Use the official Bun image to run the application
FROM oven/bun:latest

# Copy the package.json and bun.lock into the container
COPY package.json bun.lock ./

# Install the dependencies
# Install the dependencies
RUN bun install --frozen-lockfile

# Copy the rest of the application into the container
COPY . .

# Run the application
CMD ["bun", "app.js"]