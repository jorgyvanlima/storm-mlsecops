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
        f"echo 'Suporte@MCC51' | sudo -S rm -f {target_dir}/.git/FETCH_HEAD {target_dir}/.git/index.lock || true",
        f"echo 'Suporte@MCC51' | sudo -S chown -R jorgyvan:jorgyvan {target_dir}",
        f"echo 'Suporte@MCC51' | sudo -S chmod -R 777 {target_dir}/.git",
        f"git config --global --add safe.directory '{target_dir}' || true",
        f"git config --global --add safe.directory '*' || true",
        f"cd {target_dir} && git fetch --all && git reset --hard origin/main",
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
