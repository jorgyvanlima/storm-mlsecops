# ai-service/train.py
import os
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import joblib

def train_model():
    # Base path of the script
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_file = os.path.join(base_dir, 'data', 'weather_belem.csv')
    
    print(f"[*] Carregando dados de treino de: {csv_file}")
    if not os.path.exists(csv_file):
        # Fallback to local or parent directory if structure varies
        alt_path = 'data/weather_belem.csv'
        if os.path.exists(alt_path):
            csv_file = alt_path
        else:
            raise FileNotFoundError(f"Dataset de treino não encontrado em: {csv_file}")
        
    df = pd.read_csv(csv_file)
    print(f"[+] Carregados {len(df)} registros.")
    
    # Seleção de features para o KMeans
    features = ['temperature', 'humidity', 'precipitation', 'pressure']
    X = df[features]
    
    # Escalonamento
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # KMeans com 3 clusters
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    kmeans.fit(X_scaled)
    
    # Mapear os clusters para Risco Baixo/Moderado/Alto com base na média de precipitação dos clusters
    # Isso serve para fins informativos e logísticos
    df['cluster'] = kmeans.labels_
    resumo_clusters = df.groupby('cluster')['precipitation'].mean().sort_values()
    mapa_risco = {
        resumo_clusters.index[0]: "Baixo",
        resumo_clusters.index[1]: "Moderado",
        resumo_clusters.index[2]: "Alto"
    }
    
    print("\nMapeamento de Clusters por Risco:")
    for cid, level in mapa_risco.items():
        print(f" -> Cluster {cid}: Risco {level} (Média de chuva: {resumo_clusters.loc[cid]:.2f} mm)")
    
    # Salvar artefatos
    output_dir = os.environ.get("MODEL_OUTPUT_DIR", "/shared")
    os.makedirs(output_dir, exist_ok=True)
    
    joblib.dump(kmeans, os.path.join(output_dir, 'model.pkl'))
    joblib.dump(scaler, os.path.join(output_dir, 'scaler.pkl'))
    print(f"[+] Artefatos de IA salvos com sucesso em: {output_dir}")

if __name__ == "__main__":
    train_model()
