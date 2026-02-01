#!/bin/bash

# MediaStack v0.1 Quick Start Script

set -e

echo "================================"
echo "MediaStack v0.1 Quick Start"
echo "================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    
    # Generate JWT secret
    echo "Generating JWT secret..."
    JWT_SECRET=$(openssl rand -base64 32)
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
    
    echo "✓ .env file created"
    echo ""
fi

# Create directories
echo "Creating directories..."
mkdir -p /mnt/user/appdata/mediastack/config
mkdir -p /mnt/user/appdata/mediastack/logs
mkdir -p /mnt/user/data/media/movies
mkdir -p /mnt/user/data/media/tv

echo "✓ Directories created"
echo ""

# Set permissions
echo "Setting permissions..."
chown -R nobody:users /mnt/user/appdata/mediastack/
chmod -R 775 /mnt/user/appdata/mediastack/

echo "✓ Permissions set"
echo ""

# Start containers
echo "Starting MediaStack containers..."
docker-compose up -d

echo ""
echo "================================"
echo "MediaStack started successfully!"
echo "================================"
echo ""
echo "Access MediaStack at: http://$(hostname -I | awk '{print $1}'):6767"
echo ""
echo "First user to register becomes admin."
echo ""
echo "View logs with: docker-compose logs -f"
echo ""
