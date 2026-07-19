# STORM - Sistema Inteligente de Alerta e Telemetria Climática (MLSecOps Hardened)

Este repositório contém a versão de produção **hardened** do projeto **STORM**, implementando os controles de cibersegurança e práticas recomendadas de **MLSecOps** descritas no TCC. O sistema monitora a telemetria climática em tempo real para Belém-PA e utiliza Inteligência Artificial para prever riscos de alagamento por bairros de forma segura e resiliente.

---

## 1. Arquitetura do Sistema e Compartimentação de Rede

A infraestrutura foi desenhada seguindo a estratégia de defesa em profundidade, isolando e segmentando os serviços críticos:

```mermaid
graph TD
    subgraph Host Network
        FE[Frontend Container - React/Nginx] <--> |Port 8081| Browser[Browser Cliente]
        BE[Backend Container - FastAPI] <--> |Port 8080| FE
    end

    subgraph storm_internal_network (internal: true)
        BE <--> DB[(PostgreSQL Database)]
        BE <--> Broker[Mosquitto MQTT Broker]
        Sim[IoT Simulator] --> |Publish storm/telemetry| Broker
        Broker --> BE
        AI[AI Trainer - KMeans] --> |Exporta Artefatos| Vol(Volume compartilhado: shared_model)
        Vol --> |Montado como Read-Only| BE
    end
```

### Controles de Rede:
*   **Segmentação Estrita**: Os containers interagem através da rede `storm_internal_network` configurada como `internal: true`. Isso impede tráfego externo direto para a base de dados (`db`) e broker MQTT (`broker`).
*   **Exposição Mínima de Portas**: Apenas o frontend (porta `8081`) e o backend (porta `8080`) expõem portas ao host. O banco de dados PostgreSQL está invisível na rede externa.

---

## 2. Controles de Segurança MLSecOps Implementados

### 2.1 Sanitização de Dados proativa contra Envenenamento (Data Poisoning)
No módulo `ai-service/generate_data.py`, as entradas climáticas passam por um sanitizador matemático estrito antes do treino:
*   **Temperatura**: Limites estritos entre $15^\circ\text{C}$ e $45^\circ\text{C}$.
*   **Umidade**: Limites estritos entre $0\%$ e $100\%$.
*   **Pressão Atmosférica**: Limites estritos entre $980\text{ hPa}$ e $1030\text{ hPa}$.
Qualquer amostra espúria fora desses limites físicos é imediatamente descartada para evitar desvios intencionais nos centroides do algoritmo de agrupamento K-Means.

### 2.2 Fail-Safe Inference Mode (Modo de Contingência por Regras)
Se os binários do modelo (`model.pkl` e `scaler.pkl`) no volume compartilhado estiverem corrompidos ou indisponíveis, o backend FastAPI ativa automaticamente o **Fail-Safe Inference Mode**:
*   O sistema substitui a predição da IA por uma árvore de decisão determinística de fallback baseada em limites pluviométricos reais acumulados.
*   Isso garante **alta disponibilidade operacional (resiliência)** e impede a paralisação do monitoramento de enchentes de Belém-PA.

### 2.3 Prevenção contra SQL Injection (SQLi)
As querys de inserção no banco de dados (`backend/main.py`) utilizam **querys parametrizadas** com o driver nativo `psycopg2`. Nenhuma string concatenada é enviada ao interpretador SQL, neutralizando riscos de injeção.

### 2.4 Privilégio Mínimo no Compartilhamento de Modelos
O volume `shared_model` é montado no container de inferência (`backend`) com a flag `:ro` (**Read-Only**). Mesmo que o container backend sofra um comprometimento no nível de execução, o atacante não conseguirá alterar os binários do modelo de Machine Learning no disco.

### 2.5 Hardening de Contêiner
O container do backend não executa como root (`USER stormuser`). O usuário criado possui IDs de sistema específicos (`10001`) sem privilégios de sudo.

---

## 3. Estrutura do Repositório

```
storm-mlsecop/
├── .github/
│   └── workflows/
│       └── mlsecops.yml          # Pipeline de auditoria do GitHub Actions
├── ai-service/
│   ├── data/
│   │   └── weather_belem.csv     # Dataset climático de treino (DVC-tracked)
│   ├── generate_data.py          # Gerador seguro de dados sintéticos
│   ├── train.py                  # Treinador KMeans & StandardScaler
│   ├── requirements.txt          # Dependências do treinamento
│   └── Dockerfile                # Imagem de treino
├── backend/
│   ├── main.py                   # API FastAPI com WebSockets, MQTT e Fallback
│   ├── requirements.txt          # Dependências do backend
│   ├── Dockerfile                # Container de produção (non-root)
│   └── tests/
│       └── test_inference.py     # Suite de testes unitários de segurança
├── broker/
│   ├── mosquitto.conf            # Configurações do Mosquitto
│   └── Dockerfile                # Container do broker MQTT
├── db/
│   └── init.sql                  # Schema e indexação inicial do banco
├── frontend/                     # Dashboard interativo React
├── iot-simulator/                # Simulador IoT ThingSpeak MQTT
├── docker-compose.yml            # Orquestração local segura
├── dvc.yaml                      # DAG de ciclo de vida de dados (DVC)
└── README.md                     # Documentação técnica e auditoria
```

---

## 4. Guia de Inicialização Rápida

### Requisitos:
*   Docker & Docker Compose v2+
*   Python 3.10+ (para testes locais)

### Passo 1: Configurar Credenciais Seguras
Gere uma chave segura no seu arquivo `.env` (que já está ignorado pelo Git):
```bash
echo "DB_SECURE_PASSWORD=$(openssl rand -hex 24)" > .env
```

### Passo 2: Construir e Iniciar a Stack Docker
Inicie toda a infraestrutura com um único comando:
```bash
docker-compose up --build -d
```
O Docker irá:
1. Executar o `ai-service` para gerar o dataset higienizado e treinar a primeira versão do modelo.
2. Armazenar os artefatos `model.pkl` e `scaler.pkl` no volume compartilhado.
3. Subir o PostgreSQL (`db`) e rodar o script `db/init.sql`.
4. Iniciar o backend FastAPI (`backend`) conectando ao broker e banco de dados.
5. Iniciar o simulador climático (`iot-simulator`).
6. Subir o frontend Web (`frontend`) em Nginx.

### Passo 3: Acessar a Interface
Abra no navegador:
*   Dashboard do STORM: [http://localhost:8081](http://localhost:8081)
*   Documentação Swagger API: [http://localhost:8080/docs](http://localhost:8080/docs)

---

## 5. Execução de Testes e Pipeline Local

### Rodando Testes Unitários de Segurança Locais:
1. Crie o ambiente virtual:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt pytest
   ```
2. Execute o Pytest:
   ```bash
   pytest backend/tests/
   ```

### Rodando o Pipeline DVC:
Se você alterar as regras de sanitização de dados ou o treinamento, reproduza a DAG usando o DVC local:
```bash
.venv/bin/dvc repro
```
dvc irá rodar sequencialmente a geração de dados e treinamento regenerando os binários no diretório local `shared/`.
