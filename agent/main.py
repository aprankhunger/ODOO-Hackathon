import asyncio
import os
import psutil
import subprocess
import time
import uuid
import platform
import json
import requests
import websockets
from datetime import datetime

# Windows-specific libraries: import conditionally so the agent
# also runs on macOS and Linux without crashing.
try:
    import winreg
    import wmi
    import win32evtlog
    IS_WINDOWS = True
except ImportError:
    winreg = None
    wmi = None
    win32evtlog = None
    IS_WINDOWS = False

# Set INTELLIASSET_BACKEND_URL to point the agent at a hosted backend,
# e.g. INTELLIASSET_BACKEND_URL=https://api.yourdomain.com python main.py
CENTRAL_BACKEND_URL = os.getenv("INTELLIASSET_BACKEND_URL", "http://localhost:8001")
CENTRAL_WS_URL = CENTRAL_BACKEND_URL.replace("https://", "wss://").replace("http://", "ws://")

# Cache for slow metrics
slow_metrics_cache = {
    "disk_health": [],
    "installed_software": [],
    "event_logs": [],
    "security_status": "Unknown",
    "antivirus_status": "Unknown"
}

def get_device_id():
    # Use MAC address as unique device ID
    return ':'.join(['{:02x}'.format((uuid.getnode() >> ele) & 0xff) 
                     for ele in range(0,8*6,8)][::-1])

DEVICE_ID = get_device_id()

def register_asset():
    try:
        payload = {
            "device_id": DEVICE_ID,
            "hostname": platform.node(),
            "os_name": f"{platform.system()} {platform.release()}"
        }
        res = requests.post(f"{CENTRAL_BACKEND_URL}/api/assets/register", json=payload)
        print(f"Registration: {res.json()}")
    except Exception as e:
        print(f"Failed to register asset: {e}")

def get_installed_software():
    if not IS_WINDOWS:
        return []
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
    return software[:20]

def get_wmi_metrics():
    if not IS_WINDOWS:
        slow_metrics_cache["security_status"] = "Unknown"
        slow_metrics_cache["antivirus_status"] = "Unknown"
        return
    try:
        c = wmi.WMI()
        disks = []
        for disk in c.Win32_DiskDrive():
            disks.append({
                "model": disk.Model,
                "status": disk.Status,
                "size_gb": round(int(disk.Size) / (1024**3), 2) if disk.Size else 0
            })
        slow_metrics_cache["disk_health"] = disks
    except Exception as e:
        pass

    try:
        c_sec = wmi.WMI(namespace=r"root\SecurityCenter2")
        avs = []
        for av in c_sec.AntivirusProduct():
            avs.append(av.displayName)
        slow_metrics_cache["antivirus_status"] = ", ".join(avs) if avs else "None Detected"
        slow_metrics_cache["security_status"] = "Protected" if avs else "At Risk"
    except Exception as e:
        pass

def get_event_logs():
    if not IS_WINDOWS:
        slow_metrics_cache["event_logs"] = []
        return
    logs = []
    try:
        server = 'localhost'
        logtype = 'System'
        hand = win32evtlog.OpenEventLog(server, logtype)
        flags = win32evtlog.EVENTLOG_BACKWARDS_READ | win32evtlog.EVENTLOG_SEQUENTIAL_READ
        events = win32evtlog.ReadEventLog(hand, flags, 0)
        
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
        pass
    slow_metrics_cache["event_logs"] = logs

async def update_slow_metrics_loop():
    while True:
        await asyncio.to_thread(get_wmi_metrics)
        slow_metrics_cache["installed_software"] = await asyncio.to_thread(get_installed_software)
        await asyncio.to_thread(get_event_logs)
        await asyncio.sleep(300)

def get_fast_metrics():
    cpu = psutil.cpu_percent(interval=None)
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    uptime_seconds = time.time() - psutil.boot_time()
    uptime_str = f"{int(uptime_seconds // 3600)}h {int((uptime_seconds % 3600) // 60)}m"

    battery = psutil.sensors_battery()
    batt_health = "N/A"
    if battery:
        batt_health = f"{battery.percent}% {'(Charging)' if battery.power_plugged else ''}"

    latency = "N/A"
    try:
        if IS_WINDOWS:
            ping_cmd = ['ping', '-n', '1', '-w', '1000', '8.8.8.8']
        else:
            ping_cmd = ['ping', '-c', '1', '-W', '1', '8.8.8.8']
        res = subprocess.run(ping_cmd, capture_output=True, text=True)
        if "time=" in res.stdout:
            latency = res.stdout.split("time=")[1].split("ms")[0].strip() + "ms"
    except Exception:
        pass

    procs = []
    cpu_count = psutil.cpu_count() or 1
    for p in psutil.process_iter(['pid', 'name', 'cpu_percent']):
        try:
            info = p.info
            if info['name'] == 'System Idle Process' or info['pid'] == 0:
                continue
            if info['cpu_percent'] is not None:
                info['cpu_percent'] = round(info['cpu_percent'] / cpu_count, 1)
                procs.append(info)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    procs = sorted(procs, key=lambda x: x['cpu_percent'], reverse=True)[:5]

    temp = "N/A"
    if hasattr(psutil, "sensors_temperatures"):
        temps = psutil.sensors_temperatures()
        if temps:
            temp = f"{list(temps.values())[0][0].current}°C"

    return {
        "timestamp": datetime.now().isoformat(),
        "device_id": DEVICE_ID,
        "hostname": platform.node(),
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

async def stream_telemetry():
    uri = f"{CENTRAL_WS_URL}/ws/ingest/{DEVICE_ID}"
    while True:
        try:
            print(f"Connecting to Central Backend at {uri}...")
            async with websockets.connect(uri) as websocket:
                print("Connected! Streaming telemetry...")
                while True:
                    data = get_fast_metrics()
                    await websocket.send(json.dumps(data))
                    await asyncio.sleep(2)
        except Exception as e:
            print(f"Connection lost, retrying in 5s... ({e})")
            await asyncio.sleep(5)

async def main():
    print(f"Starting IntelliAsset Agent (Device ID: {DEVICE_ID})")
    # Register with backend
    register_asset()
    
    # Init cpu percent
    psutil.cpu_percent(interval=None)
    
    # Start tasks
    asyncio.create_task(update_slow_metrics_loop())
    await stream_telemetry()

if __name__ == "__main__":
    asyncio.run(main())
