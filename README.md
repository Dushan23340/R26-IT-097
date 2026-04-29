# Emotion Learn Lounge

A full-stack application for emotion-based learning with clean frontend/backend separation.

## 📁 Project Structure

```
emotion-learn-lounge/
├── frontend/               # React + TanStack Router frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities and API clients
│   │   └── routes/        # Application pages
│   ├── package.json
│   └── vite.config.ts
│
├── backend/               # Express.js backend API
│   ├── config/           # Database configuration
│   ├── models/           # Mongoose database models
│   ├── routes/           # API endpoints
│   ├── services/         # Business logic
│   ├── utils/            # Helper functions
│   ├── index.ts          # Server entry point
│   └── package.json
│
├── .env                  # Environment variables (not committed)
├── .env.example          # Environment variable template
├── package.json          # Root workspace configuration
└── setup.sh              # Quick setup script
```

## 🚀 Quick Start

### 1. Installation

```bash
# Option 1: Use setup script (recommended)
./setup.sh

# Option 2: Manual installation
npm run install:all
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration:
# - MongoDB connection string
# - JWT secret key
# - Email service credentials (optional)
```

### 3. Run Development Servers

```bash
# Start both frontend and backend
npm run dev

# Or run separately:
npm run dev:frontend    # Frontend only
npm run dev:backend     # Backend only
```

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend & backend |
| `npm run dev:frontend` | Start frontend only |
| `npm run dev:backend` | Start backend only |
| `npm run build` | Build both applications |
| `npm run install:all` | Install all dependencies |

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI library
- **TanStack Router** - File-based routing
- **TanStack Query** - Data fetching
- **Vite** - Build tool
- **TailwindCSS** - Styling
- **shadcn/ui** - Component library

### Backend
- **Express.js** - Web framework
- **MongoDB + Mongoose** - Database
- **TypeScript** - Type safety
- **JWT** - Authentication
- **Bcrypt** - Password hashing
- **Nodemailer** - Email service

## 🔐 Environment Variables

Required variables in `.env`:

```env
MONGODB_URI=mongodb://localhost:27017/emotion-learn-lounge
JWT_SECRET=your-super-secret-key-here
PORT=3000

# Optional - Email Service (for OTP verification)
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
```

## 📖 Features

- ✅ User authentication (signup/login)
- ✅ Email OTP verification
- ✅ Role-based access (student/teacher)
- ✅ Secure password hashing
- ✅ JWT token authentication
- ✅ Protected routes
- ✅ Responsive UI

## 📝 Development Notes

- Frontend runs on: `http://localhost:5173`
- Backend API runs on: `http://localhost:3000`
- MongoDB should be running before starting backend

## 🤝 Contributing

1. Clone the repository
2. Run `./setup.sh` to install dependencies
3. Configure your `.env` file
4. Start development with `npm run dev`
