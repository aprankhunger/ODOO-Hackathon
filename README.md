# IntelliAsset

A modern, Bauhaus-inspired asset management system with AI-powered automation and real-time analytics.

## Features

### Core System
- **Asset Management** - Manage all your assets with real-time tracking
- **Smart Allocations** - AI-optimized resource allocation for maximum efficiency
- **Advanced Analytics** - Comprehensive reporting and data-driven insights
- **Maintenance Tracking** - Schedule and track maintenance records for all assets
- **Team Collaboration** - Seamless coordination between admins, technicians, and dispatchers
- **Audit Logs** - Complete activity tracking and compliance records

### Unique Selling Point: AI Agent CLI

The system includes a powerful command-line interface (CLI) agent that enables complete asset automation through natural language commands.

#### Quick Start

Navigate to the `agent/` directory and run:

```bash
python agent/main.py
```

This launches an interactive AI agent that understands asset management commands.

#### Example Commands

```bash
# Allocate assets using AI optimization
> assets allocate --strategy optimal

# Generate maintenance reports
> assets report --type maintenance

# List active assets
> assets list --status active

# Analyze asset performance for a specific period
> assets analyze --period month

# Get real-time asset status
> assets status --include-analytics

# Schedule maintenance for assets
> assets maintenance schedule --asset-ids 1,2,3

# Export asset data
> assets export --format csv --output assets_data.csv
```

#### Agent Capabilities

- **Natural Language Processing** - Understand conversational asset commands
- **Real-time Decision Making** - Make allocation and routing decisions instantly
- **Report Generation** - Create comprehensive PDF/CSV reports
- **Predictive Maintenance** - Identify assets requiring attention
- **Cost Optimization** - Suggest optimal resource allocation strategies
- **Compliance Checking** - Validate operations against business rules

## Installation

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The backend API runs on `http://localhost:8001`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5174`

### Agent Setup

```bash
cd agent
pip install -r requirements.txt
python main.py
```

## Architecture

```
ODOO-Hackathon/
├── backend/           # FastAPI backend with auth and asset APIs
├── frontend/          # React + Vite frontend with Bauhaus design
├── agent/            # Python CLI agent with AI capabilities
└── README.md         # This file
```

## Design System

The application follows a **Bauhaus-inspired design philosophy**:

- **Colors**: Cream background (#F5F2EA), primary blue (#1E4FD8), yellow accent (#F2B305)
- **Typography**: Archivo for headings, Inter for body text
- **UI Elements**: Hard borders (no blur), flat shadows, geometric layouts
- **Animations**: Smooth scrolling effects, button interaction feedback, floating elements

## User Roles

### Admin
- Full access to all features
- Asset management and configuration
- Organization settings
- AI chatbot access
- Activity log viewing
- Reporting and analytics

### Technician
- Vehicle assignment view
- Maintenance logging
- Status updates
- Real-time notifications

## Key Pages

- **Home** - Landing page with feature overview and AI agent showcase
- **Dashboard** - Real-time asset overview and key metrics
- **Fleet Overview** - Detailed asset management (Admin only)
- **Allocations** - Resource allocation and optimization
- **Bookings** - Vehicle booking management
- **Maintenance** - Maintenance scheduling and tracking
- **Reports** - Analytics and performance reports
- **AI Chat** - Interactive chatbot for fleet queries (Admin only)

## Technology Stack

- **Frontend**: React 19 + Tailwind CSS + Framer Motion
- **Backend**: FastAPI + SQLAlchemy + PostgreSQL
- **Agent**: Python + Natural Language Processing
- **Authentication**: JWT-based session management
- **Icons**: Lucide React
- **Animations**: Tailwind CSS + CSS Keyframes

## Authentication

The system uses email/password authentication with JWT tokens:

1. User logs in with credentials
2. Backend validates and returns JWT token
3. Token stored in localStorage for session persistence
4. All API requests include Bearer token in Authorization header

## Development

### Environment Variables

Backend (`backend/.env`):
```
DATABASE_URL=postgresql://user:password@localhost/intelliasset_db
JWT_SECRET=your-secret-key
API_PORT=8001
```

Frontend (`frontend/.env`):
```
VITE_API_URL=http://localhost:8001
```

### Running Tests

```bash
cd backend
pytest

cd frontend
npm run test
```

### Building for Production

```bash
# Frontend
cd frontend
npm run build

# Backend
cd backend
pip install gunicorn
gunicorn main:app
```

## Contributors

**Designed & Built by**: Apran Khunger

## License

All rights reserved © 2024 IntelliAsset

---

For more information about the AI Agent capabilities, see `agent/README.md`
For API documentation, visit `http://localhost:8001/docs` (when backend is running)
