import asyncio
import psutil
import subprocess
import time
import winreg
import wmi
import win32evtlog
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache for slow metrics
slow_metrics_cache = {
    "disk_health": [],
    "installed_software": [],
    "event_logs": [],
    "security_status": "Unknown",
    "antivirus_status": "Unknown"
}

def get_installed_software():
    software = []
    try:
        registry_paths = [
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
            (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall")
        ]
        for root_key, path in registry_paths:
            try:
                key = winreg.OpenKey(root_key, path)
                for i in range(0, winreg.QueryInfoKey(key)[0]):
                    try:
                        skey_name = winreg.EnumKey(key, i)
                        skey = winreg.OpenKey(key, skey_name)
                        try:
                            name, _ = winreg.QueryValueEx(skey, 'DisplayName')
                            version, _ = winreg.QueryValueEx(skey, 'DisplayVersion')
                            if name:
                                software.append({"name": name, "version": version})
                        except EnvironmentError:
                            continue
                        finally:
                            skey.Close()
                    except EnvironmentError:
                        continue
            except EnvironmentError:
                continue
    except Exception as e:
        print(f"Error getting software: {e}")
    # Return top 20 to avoid massive payload initially
    return software[:20]

def get_wmi_metrics():
    try:
        c = wmi.WMI()
        # Disk Health
        disks = []
        for disk in c.Win32_DiskDrive():
            disks.append({
                "model": disk.Model,
                "status": disk.Status,
                "size_gb": round(int(disk.Size) / (1024**3), 2) if disk.Size else 0
            })
        slow_metrics_cache["disk_health"] = disks
    except Exception as e:
        print(f"Error getting WMI disk: {e}")

    try:
        c_sec = wmi.WMI(namespace=r"root\SecurityCenter2")
        avs = []
        for av in c_sec.AntivirusProduct():
            avs.append(av.displayName)
        slow_metrics_cache["antivirus_status"] = ", ".join(avs) if avs else "None Detected"
        slow_metrics_cache["security_status"] = "Protected" if avs else "At Risk"
    except Exception as e:
        print(f"Error getting AV: {e}")

def get_event_logs():
    logs = []
    try:
        server = 'localhost'
        logtype = 'System'
        hand = win32evtlog.OpenEventLog(server, logtype)
        flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
        events = win32evtlog.ReadEventLog(hand, flags, 0)
        
        # Grab the last 5 error events for MVP
        for event in events:
            if event.EventType == win32evtlog.EVENTLOG_ERROR_TYPE:
                time_str = 'N/A'
                if hasattr(event, 'TimeGenerated') and event.TimeGenerated:
                    time_str = event.TimeGenerated.Format()
                logs.append({
                    "id": getattr(event, 'EventID', 'N/A'),
                    "source": getattr(event, 'SourceName', 'N/A'),
                    "time": time_str
                })
            if len(logs) >= 5:
                break
    except Exception as e:
        print(f"Error reading event logs: {e}")
    slow_metrics_cache["event_logs"] = logs

async def update_slow_metrics_loop():
    while True:
        print("Updating slow metrics (WMI, Registry, Event Logs)...")
        # Run synchronous blocking calls in a thread pool to avoid blocking asyncio loop
        await asyncio.to_thread(get_wmi_metrics)
        slow_metrics_cache["installed_software"] = await asyncio.to_thread(get_installed_software)
        await asyncio.to_thread(get_event_logs)
        await asyncio.sleep(300) # Update every 5 mins

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(update_slow_metrics_loop())
    psutil.cpu_percent(interval=None) # Initialize

def get_fast_metrics():
    # CPU & RAM
    cpu = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # Uptime
    uptime_seconds = time.time() - psutil.boot_time()
    uptime_str = f"{int(uptime_seconds // 3600)}h {int((uptime_seconds % 3600) // 60)}m"

    # Battery
    battery = psutil.sensors_battery()
    batt_health = "N/A"
    if battery:
        batt_health = f"{battery.percent}% {'(Charging)' if battery.power_plugged else ''}"

    # Ping
    latency = "N/A"
    try:
        res = subprocess.run(['ping', '-n', '1', '-w', '1000', '8.8.8.8'], capture_output=True, text=True)
        if "time=" in res.stdout:
            latency = res.stdout.split("time=")[1].split("ms")[0] + "ms"
    except Exception:
        pass

    # Top 5 Processes
    procs = []
    for p in psutil.process_iter(['pid', 'name', 'cpu_percent']):
        try:
            # Note: getting cpu_percent from process_iter without interval might be 0.0 initially
            # but will stabilize over loop iterations.
            procs.append(p.info)
        except psutil.NoSuchProcess:
            pass
    procs = sorted([p for p in procs if p['cpu_percent'] is not None], key=lambda x: x['cpu_percent'], reverse=True)[:5]

    # Temperature (Often fails on Windows without admin/WMI specific drivers)
    temp = "N/A"
    if hasattr(psutil, "sensors_temperatures"):
        temps = psutil.sensors_temperatures()
        if temps:
            temp = f"{list(temps.values())[0][0].current}°C"

    # Merge with slow metrics cache
    return {
        "timestamp": datetime.now().isoformat(),
        "device_id": "DEV-LOCAL-001",
        "cpu": cpu,
        "ram": ram.percent,
        "disk": disk.percent,
        "status": "Critical" if cpu > 85 or ram.percent > 90 else "Healthy",
        "uptime": uptime_str,
        "battery": batt_health,
        "network_latency": latency,
        "temperature": temp,
        "top_processes": procs,
        "disk_health": slow_metrics_cache["disk_health"],
        "antivirus": slow_metrics_cache["antivirus_status"],
        "security": slow_metrics_cache["security_status"],
        "recent_errors": slow_metrics_cache["event_logs"],
        "software": slow_metrics_cache["installed_software"]
    }

@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = get_fast_metrics()
            await websocket.send_json(data)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
