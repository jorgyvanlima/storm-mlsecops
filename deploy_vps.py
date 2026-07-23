import os
import paramiko

host = os.environ.get('VPS_HOST', 'storm-mlsecops.sytes.net')
port = int(os.environ.get('VPS_PORT', 22022))
user = os.environ.get('VPS_USER', 'jorgyvan')
password = os.environ.get('VPS_PASSWORD', 'Suporte@MCC51')
target_dir = '/home/jorgyvan/storm-mlsecops'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print("Connecting to VPS...")
    client.connect(host, port=port, username=user, password=password, timeout=45)
    
    commands = [
        f"if [ ! -d '{target_dir}/.git' ]; then rm -rf '{target_dir}' && git clone https://github.com/jorgyvanlima/storm-mlsecops.git '{target_dir}'; fi",
        f"git config --global --add safe.directory '{target_dir}' || true",
        f"cd {target_dir} && git fetch origin main && git reset --hard origin/main",
        f"cd {target_dir} && docker compose -f docker-compose.prod.yml build storm-backend frontend",
        f"cd {target_dir} && docker compose -f docker-compose.prod.yml up -d storm-backend frontend",
    ]
    
    for cmd in commands:
        print(f"Running: {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)
        if "sudo" in cmd:
            stdin.write("Suporte@MCC51\n")
            stdin.flush()
        
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode().strip()
        
        if out: print(f"OUT: {out}")
        print(f"Exit Status: {exit_status}\n---")
        
except Exception as e:
    print(f"Error: {e}")
finally:
    client.close()
