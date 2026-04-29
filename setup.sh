#!/bin/bash

echo "🚀 Setting up Emotion Learn Lounge..."
echo ""

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend && npm install && cd ..

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend && npm install && cd ..

echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env and configure your environment variables"
echo "2. Run 'npm run dev' to start both frontend and backend"
echo ""
