# ai-service/generate_data.py
import csv
import random
import os

def generate_synthetic_data(filepath, n_samples=1000):
    print(f"[*] Gerando {n_samples} amostras climáticas para Belém-PA...")
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    with open(filepath, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['temperature', 'humidity', 'precipitation', 'pressure', 'class'])
        
        for _ in range(n_samples):
            # Presets calibrados para o clima de Belém
            clima = random.choices(['seco', 'chuva_moderada', 'tempestade'], weights=[0.6, 0.3, 0.1])[0]
            
            if clima == 'seco':
                temp = random.uniform(28.0, 36.0)
                hum = random.uniform(70.0, 85.0)
                prec = random.uniform(0.0, 2.0)
                press = random.uniform(1010.0, 1014.0)
                target_class = 0 # Risco Baixo
            elif clima == 'chuva_moderada':
                temp = random.uniform(25.0, 30.0)
                hum = random.uniform(85.0, 95.0)
                prec = random.uniform(2.0, 15.0)
                press = random.uniform(1008.0, 1011.0)
                target_class = 1 # Risco Moderado
            else: # Tempestade
                temp = random.uniform(22.0, 26.0)
                hum = random.uniform(95.0, 100.0)
                prec = random.uniform(15.0, 60.0)
                press = random.uniform(1004.0, 1008.0)
                target_class = 2 # Risco Alto

            # --- CONTROLE MLSECOPS: Sanitização proativa contra envenenamento ---
            # Bloqueia fisicamente dados absurdos que distorceriam o K-Means
            if not (15.0 <= temp <= 45.0): continue
            if not (0.0 <= hum <= 100.0): continue
            if prec < 0.0: continue
            if not (980.0 <= press <= 1030.0): continue
            
            writer.writerow([round(temp, 2), round(hum, 1), round(prec, 2), round(press, 1), target_class])
            
    print(f"[+] Dataset higienizado gerado com sucesso em: {filepath}")

if __name__ == "__main__":
    generate_synthetic_data('data/weather_belem.csv')
