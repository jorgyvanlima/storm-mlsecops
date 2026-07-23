import paramiko

host = 'storm-mlsecops.sytes.net'
port = 22022
user = 'jorgyvan'
password = 'Suporte@MCC51'
target_dir = '/home/jorgyvan/storm-mlsecops'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    print("Connecting to VPS...")
    client.connect(host, port=port, username=user, password=password, timeout=10)
    
    commands = [
        f"cd {target_dir} && git reset --hard && git pull origin main",
        f"cd {target_dir} && docker compose -f docker-compose.prod.yml build storm-backend frontend || docker-compose -f docker-compose.prod.yml build storm-backend frontend",
        f"cd {target_dir} && docker compose -f docker-compose.prod.yml up -d storm-backend frontend || docker-compose -f docker-compose.prod.yml up -d storm-backend frontend",
    ]
    
    for cmd in commands:
        print(f"Running: {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        
        exit_status = stdout.channel.recv_exit_status()
        out = stdout.read().decode().strip()
        err = stderr.read().decode().strip()
        
        if out: print(f"OUT: {out}")
        if err: print(f"ERR: {err}")
        print(f"Exit Status: {exit_status}\n---")
        
except Exception as e:
    print(f"Error: {e}")
finally:
    client.close()
