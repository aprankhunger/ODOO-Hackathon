# IntelliAsset AI Agent - Setup & Usage Guide

## Overview

The IntelliAsset AI Agent is a lightweight, background telemetry service that monitors your device's health and streams real-time metrics to the central IntelliAsset platform. It collects data such as CPU and RAM usage, disk health, installed software, and system event logs to provide complete visibility over your IT assets.

## Getting Started

### 1. Download the Agent Files

To get started, you only need to download the agent script and its requirements. You can download them directly to a new folder:

**On Windows (PowerShell):**
```powershell
mkdir intelliasset-agent
cd intelliasset-agent
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/aprankhunger/ODOO-Hackathon/main/agent/main.py" -OutFile "main.py"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/aprankhunger/ODOO-Hackathon/main/agent/requirements.txt" -OutFile "requirements.txt"
```

**On macOS/Linux:**
```bash
mkdir intelliasset-agent
cd intelliasset-agent
curl -O https://raw.githubusercontent.com/aprankhunger/ODOO-Hackathon/main/agent/main.py
curl -O https://raw.githubusercontent.com/aprankhunger/ODOO-Hackathon/main/agent/requirements.txt
```

### 2. Set Up the Environment

It is recommended to use a virtual environment for the agent dependencies:

**On Windows:**
```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

**On macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Launch the Agent

Run the agent script:

```bash
python main.py
```

On its first run, the agent will prompt you to log in with your IntelliAsset credentials (Email and Password). Once authenticated, it will automatically register the device and begin streaming telemetry data to the dashboard. 

Your session is securely saved in `~/.intelliasset/config.json`, so you won't need to sign in again on subsequent runs.

## Configuration & Environment Variables

You can configure the agent to run completely unattended or point it to a custom backend environment.

### Changing the Backend URL

By default, the agent connects to the production backend (`https://odoo-hackathon-r19v.onrender.com`). You can override this using the `--backend` flag:

```bash
python main.py --backend http://localhost:8000
```
*Note: The agent will remember this URL for future runs.*

### Unattended / Silent Installation

For deployment across multiple machines, you can provide credentials via environment variables so the agent doesn't prompt for input:

**Windows (Command Prompt):**
```cmd
set INTELLIASSET_EMAIL=admin@company.com
set INTELLIASSET_PASSWORD=your_password
set INTELLIASSET_BACKEND_URL=https://odoo-hackathon-r19v.onrender.com
python main.py
```

**macOS/Linux:**
```bash
export INTELLIASSET_EMAIL=admin@company.com
export INTELLIASSET_PASSWORD=your_password
export INTELLIASSET_BACKEND_URL=https://odoo-hackathon-r19v.onrender.com
python main.py
```

## How It Works

Once running, the agent performs the following tasks in the background:
1. **Device Registration:** Generates a unique Device ID based on your MAC address and registers the asset on the backend.
2. **Fast Metrics Streaming:** Every 2 seconds, it sends live data over a WebSocket connection (CPU, RAM, Disk usage, battery life, active processes, etc.).
3. **Deep System Audits:** Every 5 minutes, it scans for slow-changing metrics like installed software, Windows event logs, disk health, and antivirus status (primarily utilizing WMI on Windows).

## Troubleshooting

- **Authentication Failed:** Ensure your account exists on the IntelliAsset platform. If your token expired, delete the `~/.intelliasset/config.json` file to force a fresh login prompt.
- **Connection Lost:** The agent will automatically attempt to reconnect to the server every 5 seconds if the WebSocket connection is interrupted.
- **Missing Software/Event Logs:** Deep system metrics (like registry checks and WMI) are specifically tailored for Windows. On macOS/Linux, these metrics will safely report as empty or "Unknown" without crashing the agent.
