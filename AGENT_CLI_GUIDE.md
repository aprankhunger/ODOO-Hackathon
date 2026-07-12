# Fleet Intelligence AI Agent - CLI Guide

## Overview

The Fleet Intelligence Platform includes a powerful command-line interface (CLI) agent that provides intelligent automation and control over your entire fleet infrastructure. This unique selling point (USP) enables natural language processing to understand and execute complex fleet management commands.

## Getting Started

### Installation

```bash
cd agent
pip install -r requirements.txt
```

### Launch the Agent

```bash
python main.py
```

This starts an interactive CLI session where you can issue fleet management commands.

## Core Commands

### Fleet Allocation

Optimize resource allocation using AI strategies:

```bash
$ python agent/main.py

> fleet allocate --strategy optimal
✓ Optimal allocation: 47 assignments
  - 23 vehicles assigned to Route A
  - 15 vehicles assigned to Route B
  - 9 vehicles assigned to Route C
```

### Fleet Status

Get real-time fleet status and analytics:

```bash
> fleet status --include-analytics
✓ Fleet Status Report
  Total Vehicles: 87
  Active: 75 (86%)
  Maintenance: 8 (9%)
  Available: 4 (5%)
  Average Utilization: 82%
```

### Maintenance Reports

Generate and analyze maintenance requirements:

```bash
> fleet report --type maintenance
✓ Maintenance Report Generated
  Vehicles Requiring Attention: 3
  - Vehicle #ID-001: Oil change due
  - Vehicle #ID-015: Brake inspection
  - Vehicle #ID-042: Tire rotation
  
  Predictive Alerts: 5 vehicles need servicing in next 30 days
```

### Asset Management

List and manage fleet assets:

```bash
> fleet asset list --status active
✓ Active Assets: 75
  ID      | Type      | Status    | Location
  ------- | --------- | --------- | -----------
  001     | Truck     | In Use    | Route A
  002     | Van       | In Use    | Route B
  003     | Car       | Idle      | Depot
  ...
```

### Performance Analysis

Analyze fleet performance over time periods:

```bash
> fleet analyze --period month
✓ Monthly Analysis
  Total Miles: 12,450
  Fuel Efficiency: 8.3 MPG
  Cost per Mile: $0.42
  Incidents: 2 (0.16%)
  Overall Score: 94/100 (Excellent)
```

### Maintenance Scheduling

Schedule maintenance for multiple vehicles:

```bash
> fleet maintenance schedule --vehicle-ids 1,2,3 --service oil-change
✓ Maintenance scheduled for 3 vehicles
  - Vehicle #1: 2024-07-18
  - Vehicle #2: 2024-07-19
  - Vehicle #3: 2024-07-20
```

### Data Export

Export fleet data in multiple formats:

```bash
> fleet export --format csv --output fleet_data.csv
✓ Fleet data exported: fleet_data.csv
  Records: 87 vehicles
  File size: 245 KB
```

### Cost Optimization

Get AI-powered cost reduction recommendations:

```bash
> fleet optimize --period quarter
✓ Optimization Recommendations
  Potential Savings: $8,450/quarter
  
  1. Route optimization: -$3,200
  2. Fuel efficiency improvements: -$2,100
  3. Maintenance consolidation: -$1,800
  4. Idle vehicle reduction: -$1,350
```

### Predictive Maintenance

Get AI predictions for maintenance needs:

```bash
> fleet predict --lookhead 90days
✓ 90-Day Maintenance Forecast
  
  Week 1-2: 3 vehicles require attention
  Week 3-4: 5 vehicles require attention
  Week 5-8: 2 vehicles require attention
  Week 9-12: 7 vehicles require attention
  
  Recommended Action: Schedule maintenance for 8 vehicles in next 30 days
```

## Advanced Usage

### Batch Operations

Execute multiple commands in sequence:

```bash
> fleet optimize
> fleet allocate --strategy optimal
> fleet report --type maintenance
> fleet export --format pdf
```

### Automated Scheduling

Run commands on a schedule:

```bash
# Daily report at 9 AM
> schedule daily 09:00 "fleet report --type daily"

# Weekly optimization every Monday
> schedule weekly monday 06:00 "fleet optimize"

# Monthly analysis on the 1st
> schedule monthly 1 08:00 "fleet analyze --period month"
```

### Custom Queries

Query fleet data with custom parameters:

```bash
> fleet query --where "status=active AND utilization>80%"
> fleet query --sort by fuel_consumption --order desc --limit 10
```

## Integration with Dashboard

The CLI agent seamlessly integrates with the web dashboard:

1. **Dashboard Display**: Commands executed via CLI update the dashboard in real-time
2. **Authentication**: Uses the same JWT authentication as the web interface
3. **Data Sync**: All fleet data modifications propagate to both CLI and web UI
4. **Logging**: All commands are logged in the Activity Log visible on the dashboard

## Environment Variables

Configure the agent with environment variables:

```bash
# Backend API URL
export FLEET_API_URL=http://localhost:8001

# Authentication token (or login when starting agent)
export FLEET_AUTH_TOKEN=your-jwt-token

# Agent configuration
export FLEET_AGENT_VERBOSE=true
export FLEET_AGENT_TIMEOUT=30
```

## Command Reference

| Command | Description | Example |
|---------|-------------|---------|
| `fleet allocate` | Optimize resource allocation | `fleet allocate --strategy optimal` |
| `fleet status` | Get fleet status | `fleet status --include-analytics` |
| `fleet report` | Generate reports | `fleet report --type maintenance` |
| `fleet asset list` | List fleet assets | `fleet asset list --status active` |
| `fleet analyze` | Analyze performance | `fleet analyze --period month` |
| `fleet maintenance` | Schedule maintenance | `fleet maintenance schedule --vehicle-ids 1,2,3` |
| `fleet export` | Export data | `fleet export --format csv` |
| `fleet optimize` | Get cost recommendations | `fleet optimize --period quarter` |
| `fleet predict` | Get predictions | `fleet predict --lookhead 90days` |
| `schedule` | Schedule recurring tasks | `schedule daily 09:00 "command"` |
| `help` | Show help | `help fleet allocate` |
| `exit` | Exit the agent | `exit` |

## Tips & Best Practices

1. **Use Analytics**: Always include `--include-analytics` for data-driven decisions
2. **Schedule Predictions**: Run `fleet predict` weekly to stay ahead of maintenance
3. **Export Weekly**: Generate weekly reports for stakeholder communication
4. **Monitor Costs**: Use `fleet optimize` monthly to identify savings opportunities
5. **Batch Operations**: Group related commands for efficiency

## Troubleshooting

**Connection Error**
```bash
# Ensure backend is running on correct port
export FLEET_API_URL=http://localhost:8001
```

**Authentication Failed**
```bash
# Re-login with credentials
> login admin@company.com
> [Enter password]
```

**Command Not Recognized**
```bash
# Get help on available commands
> help
> help fleet allocate
```

## Examples

### Daily Operations Script

```bash
# Get morning status
fleet status --include-analytics

# Check for maintenance needs
fleet report --type maintenance

# Optimize allocations for the day
fleet allocate --strategy optimal

# Export today's data
fleet export --format json --output daily_report.json
```

### Weekly Management

```bash
# Analyze previous week
fleet analyze --period week

# Get optimization recommendations
fleet optimize

# Schedule preventive maintenance
fleet maintenance schedule --vehicle-ids 1,2,3,4,5

# Generate stakeholder report
fleet export --format pdf --output weekly_report.pdf
```

---

**For more information about the Fleet Intelligence Platform, see the main README.md**
