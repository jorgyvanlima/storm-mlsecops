# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
import paho.mqtt.client as mqtt
import joblib
import os
import logging
import json
import psycopg2
from datetime import datetime
import asyncio
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("STORM-MLSecOps")

app = FastAPI(title="STORM-MLSecOps API", version="2.0.0")

# Enable CORS for frontend compatibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "/shared/model.pkl"
SCALER_PATH = "/shared/scaler.pkl"

model = None
scaler = None
fail_safe_mode = False

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://storm_admin:storm_password@db:5432/storm_db")
MQTT_HOST = os.environ.get("MQTT_HOST", "broker")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_TOPIC_TELEMETRY = "storm/telemetry"
MQTT_TOPIC_CONFIG = "storm/simulator/config"

# In-memory log store for frontend visualization
system_logs = []

def add_log(msg: str, level: str = "INFO"):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted = f"[{timestamp}] [{level}] {msg}"
    logger.info(msg)
    system_logs.append(formatted)
    if len(system_logs) > 100:
        system_logs.pop(0)

# --- WebSocket connection manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting WebSocket message: {e}")

manager = ConnectionManager()

# --- Helper to connect to PostgreSQL with retries ---
def get_db_connection():
    retries = 10
    conn = None
    while retries > 0:
        try:
            conn = psycopg2.connect(DATABASE_URL)
            return conn
        except Exception as e:
            logger.warning(f"Database not ready. Retrying in 2 seconds... ({retries} left)")
            retries -= 1
            import time
            time.sleep(2)
    raise Exception("Could not connect to PostgreSQL database.")

# --- Inicialização do Modelo preditivo com Fallback integrado ---
@app.on_event("startup")
def startup_event():
    global model, scaler, fail_safe_mode
    app.state.loop = asyncio.get_running_loop()
    add_log("Carregando artefatos de IA do volume compartilhado...", "STARTUP")
    
    # Initialize realtime_telemetry table
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS realtime_telemetry (
                id SERIAL PRIMARY KEY,
                city_name VARCHAR(100) NOT NULL,
                temperature NUMERIC(5,2) NOT NULL,
                humidity INT NOT NULL,
                pressure NUMERIC(6,2) NOT NULL,
                weather_description VARCHAR(255),
                precipitation_1h NUMERIC(5,2) DEFAULT 0.0,
                captured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_realtime_city ON realtime_telemetry(city_name);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_realtime_captured_at ON realtime_telemetry(captured_at DESC);")
        # Initialize wokwi_bairros_telemetria table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS wokwi_bairros_telemetria (
                id SERIAL PRIMARY KEY,
                bairro_nome VARCHAR(50) NOT NULL,
                temperatura NUMERIC(5,2) NOT NULL,
                umidade NUMERIC(5,2) NOT NULL,
                chuva_simulada NUMERIC(5,2) DEFAULT 0.0,
                pressao_simulada NUMERIC(6,2) DEFAULT 1013.25,
                nivel_risco_calculado VARCHAR(20) NOT NULL,
                enviado_por VARCHAR(50) DEFAULT 'Wokwi ESP32',
                capturado_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_wokwi_bairro ON wokwi_bairros_telemetria(bairro_nome);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_wokwi_captura ON wokwi_bairros_telemetria(capturado_at DESC);")
        conn.commit()
        cursor.close()
        conn.close()
        add_log("Tabelas 'realtime_telemetry' e 'wokwi_bairros_telemetria' inicializadas.", "DB")
    except Exception as e:
        logger.error(f"[-] Falha ao inicializar tabelas do banco: {e}")
        add_log(f"Falha ao inicializar tabelas do banco: {e}", "ERROR")


    
    # Retry model loading a few times in case the trainer is still writing
    retries = 15
    import time
    while retries > 0:
        try:
            if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
                model = joblib.load(MODEL_PATH)
                scaler = joblib.load(SCALER_PATH)
                logger.info("[+] KMeans e StandardScaler carregados com sucesso!")
                add_log("KMeans e StandardScaler carregados com sucesso!", "IA")
                fail_safe_mode = False
                break
            else:
                raise FileNotFoundError("Binários de IA ausentes.")
        except Exception as e:
            retries -= 1
            if retries > 0:
                logger.info("Model assets not ready yet. Retrying in 2 seconds...")
                time.sleep(2)
            else:
                fail_safe_mode = True
                logger.error(f"[!!!] Erro catastrófico ao carregar o modelo de IA: {e}")
                logger.warning("[!!!] ATIVANDO FAIL-SAFE INFERENCE MODE (MODO DE CONTINGÊNCIA POR REGRAS LOCAIS) [116]")
                add_log("ATIVANDO FAIL-SAFE INFERENCE MODE (MODO DE CONTINGÊNCIA POR REGRAS LOCAIS)", "WARN")

    # Start MQTT client
    try:
        mqtt_client = mqtt.Client()
        mqtt_client.on_connect = on_connect
        mqtt_client.on_message = on_message
        mqtt_client.connect(MQTT_HOST, MQTT_PORT, 60)
        mqtt_client.loop_start()
        app.state.mqtt = mqtt_client
        add_log("Serviço MQTT iniciado com sucesso.", "SYSTEM")
    except Exception as e:
        add_log(f"Falha ao conectar no Broker MQTT: {e}", "ERROR")

    # Iniciar loop de captura automática (30 em 30 min)
    from main_realtime import capture_realtime_weather
    async def auto_capture_loop():
        # Aguarda 10 segundos antes da primeira execução para garantir que tudo subiu
        await asyncio.sleep(10)
        while True:
            try:
                add_log("Iniciando captura automática da API OpenWeatherMap (30 min loop)...", "SYSTEM")
                await capture_realtime_weather()
                add_log("Captura automática concluída com sucesso.", "SYSTEM")
            except Exception as e:
                logger.error(f"Erro na captura automatica: {e}")
            
            # Pausa de 30 minutos (1800 segundos)
            await asyncio.sleep(1800)
            
    app.state.loop.create_task(auto_capture_loop())

@app.on_event("shutdown")
def shutdown_event():
    if hasattr(app.state, "mqtt"):
        app.state.mqtt.loop_stop()
        add_log("Serviço MQTT finalizado.", "SYSTEM")

# --- Validador de dados recebidos (Evita Injeções e Sanitiza) ---
class TelemetryData(BaseModel):
    temperature: float = Field(..., ge=15.0, le=45.0)
    humidity: float = Field(..., ge=0.0, le=100.0)
    precipitation: float = Field(..., ge=0.0)
    pressure: float = Field(..., ge=980.0, le=1030.0)

# Sanitizador de Ingestão de Telemetria do Wokwi contra Data Poisoning (ML02)
class WokwiTelemetrySanitizer(BaseModel):
    bairro: str = Field(..., max_length=50)
    temperature: float
    humidity: float
    precipitation: float = Field(default=0.0)
    pressure: float = Field(default=1013.25)

    @validator('temperature')
    def validate_temperature(cls, v):
        # Limites físicos da Amazônia equatorial contra envenenamento (ML02)
        if not (-5.0 <= v <= 55.0):
            raise ValueError(f"Temperatura {v}°C viola os limites físicos permitidos.")
        return v

    @validator('humidity')
    def validate_humidity(cls, v):
        if not (0.0 <= v <= 100.0):
            raise ValueError(f"Umidade {v}% está fora da faixa operacional de 0-100%.")
        return v


# Lógica determinística de contingência local para os bairros de Belém-PA [121]
def calculate_neighborhood_floods_failsafe(precipitation: float):
    # Altitude, limite de chuva e drenagem mapeados
    bairros = {
        "Doca de Souza Franco": {"altitude": 1.2, "threshold": 12.0, "drainage": 10},
        "Cidade Velha": {"altitude": 1.5, "threshold": 20.0, "drainage": 30},
        "Jurunas": {"altitude": 1.8, "threshold": 18.0, "drainage": 30},
        "Umarizal": {"altitude": 2.2, "threshold": 22.0, "drainage": 40},
        "Batista Campos": {"altitude": 3.5, "threshold": 32.0, "drainage": 60},
        "Marco": {"altitude": 4.2, "threshold": 36.0, "drainage": 70}
    }
    
    results = {}
    for name, spec in bairros.items():
        if precipitation >= spec["threshold"]:
            prob = min(95.0, 50.0 + (precipitation - spec["threshold"]) * (100 - spec["drainage"]) / 10.0)
            water_level = (precipitation - spec["threshold"]) * (1.0 - spec["drainage"]/100.0)
            status = "Alagamento Iminente"
        else:
            prob = max(5.0, (precipitation / spec["threshold"]) * 20.0)
            water_level = 0.0
            status = "Sem Risco"
            if prob >= 40.0:
                status = "Atenção"
            
        results[name] = {
            "probability": round(prob, 1),
            "water_level_meters": round(water_level, 2),
            "water_level": round(water_level, 2), # Frontend compatibility
            "critical_warning": precipitation >= spec["threshold"],
            "status": status, # Frontend compatibility
            "elevation": spec["altitude"] # Frontend compatibility
        }
    return results

# Exemplo de salvamento de forma parametrizada com Psycopg2 (Protege contra SQL Injection) [115]
def persist_telemetry(temp, hum, prec, press, risk, db_url):
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        # Query parametrizada imune a injeções de string %s [115]
        cur.execute(
            "INSERT INTO telemetry (temperature, humidity, precipitation, pressure, risk_level) VALUES (%s, %s, %s, %s, %s)",
            (temp, hum, prec, press, risk)
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"[-] Erro ao persistir dados no banco: {e}")

# --- Core processing of climate telemetry ---
async def process_telemetry_flow(temp: float, humidity: float, precipitation: float, pressure: float):
    global model, scaler, fail_safe_mode
    
    # 1. Infer risk level (AI or Local Fallback)
    risk_level = "Indefinido"
    if not fail_safe_mode and model is not None and scaler is not None:
        try:
            # Scaler expects features in the same order: temperature, humidity, precipitation, pressure
            input_features = np.array([[temp, humidity, precipitation, pressure]])
            scaled = scaler.transform(input_features)
            cluster = model.predict(scaled)[0]
            
            # Map KMeans clusters based on precipitation mean coordinate
            centers = scaler.inverse_transform(model.cluster_centers_)
            precip_means = centers[:, 2]
            sorted_clusters = np.argsort(precip_means)
            mapping = {
                sorted_clusters[0]: "Baixo",
                sorted_clusters[1]: "Moderado",
                sorted_clusters[2]: "Alto"
            }
            risk_level = mapping.get(cluster, "Indefinido")
            add_log(f"Predição da IA: Cluster {cluster} -> Risco {risk_level}", "IA")
        except Exception as e:
            add_log(f"Erro na inferência da IA, acionando contingência: {e}", "WARN")
            # Fallback rules
            if precipitation <= 2.0:
                risk_level = "Baixo"
            elif precipitation <= 15.0:
                risk_level = "Moderado"
            else:
                risk_level = "Alto"
    else:
        # Fallback local rules
        add_log("Calculando risco via motor de contingência (regras estáticas)", "WARN")
        if precipitation <= 2.0:
            risk_level = "Baixo"
        elif precipitation <= 15.0:
            risk_level = "Moderado"
        else:
            risk_level = "Alto"
            
    # 2. Calculate neighborhood floods (deterministic flood levels)
    neighborhoods_status = calculate_neighborhood_floods_failsafe(precipitation)
    
    # 3. Persist in database using secure query parameterization
    persist_telemetry(temp, humidity, precipitation, pressure, risk_level, DATABASE_URL)
    add_log(f"Registro climático salvo no PostgreSQL. Risco: {risk_level}", "DB")
    
    # 4. Broadcast message via WebSockets
    payload = {
        "temperature": temp,
        "humidity": humidity,
        "precipitation": precipitation,
        "pressure": pressure,
        "risk_level": risk_level,
        "neighborhoods_status": neighborhoods_status,
        "timestamp": datetime.now().isoformat()
    }
    await manager.broadcast({
        "type": "telemetry",
        "data": payload
    })

def log_security_incident(msg: str):
    add_log(msg, "WARN")
    logger.warning(msg)

async def process_wokwi_telemetry(payload_dict: dict, source: str = "Wokwi ESP32 Sensor"):
    try:
        # 1. Validar e sanitizar dados via Pydantic (Proteção ML02 - Data Poisoning)
        sanitized = WokwiTelemetrySanitizer(
            bairro=payload_dict.get("bairro", payload_dict.get("bairro_nome", payload_dict.get("neighborhood", "Desconhecido"))),
            temperature=float(payload_dict.get("temperature", payload_dict.get("temperatura", payload_dict.get("temp", 0.0)))),
            humidity=float(payload_dict.get("humidity", payload_dict.get("umidade", payload_dict.get("umid", 0.0)))),
            precipitation=float(payload_dict.get("precipitation", payload_dict.get("chuva_simulada", payload_dict.get("precip", 0.0)))),
            pressure=float(payload_dict.get("pressure", payload_dict.get("pressao_simulada", payload_dict.get("press", 1013.25))))
        )
        
        # 2. Executar a inferência preditiva via K-Means (com fallback local seguro se PKL indisponível)
        risk_level = "Indefinido"
        if not fail_safe_mode and model is not None and scaler is not None:
            try:
                input_features = np.array([[sanitized.temperature, sanitized.humidity, sanitized.precipitation, sanitized.pressure]])
                scaled = scaler.transform(input_features)
                cluster = model.predict(scaled)[0]
                centers = scaler.inverse_transform(model.cluster_centers_)
                precip_means = centers[:, 2]
                sorted_clusters = np.argsort(precip_means)
                mapping = {
                    sorted_clusters[0]: "Baixo",
                    sorted_clusters[1]: "Moderado",
                    sorted_clusters[2]: "Alto"
                }
                risk_level = mapping.get(cluster, "Indefinido")
            except Exception as e:
                logger.error(f"Erro na inferência da telemetria Wokwi: {e}")
                if sanitized.precipitation >= 15.0 or sanitized.humidity >= 88.0:
                    risk_level = "Alto"
                elif sanitized.precipitation >= 2.0 or sanitized.humidity >= 75.0:
                    risk_level = "Moderado"
                else:
                    risk_level = "Baixo"
        else:
            if sanitized.precipitation >= 15.0 or sanitized.humidity >= 88.0:
                risk_level = "Alto"
            elif sanitized.precipitation >= 2.0 or sanitized.humidity >= 75.0:
                risk_level = "Moderado"
            else:
                risk_level = "Baixo"

        # 3. Conexão parametrizada com o PostgreSQL para evitar SQL Injection (SQLi)
        conn = get_db_connection()
        cursor = conn.cursor()
        query = """
            INSERT INTO wokwi_bairros_telemetria 
            (bairro_nome, temperatura, umidade, chuva_simulada, pressao_simulada, nivel_risco_calculado, enviado_por) 
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, (
            sanitized.bairro,
            sanitized.temperature,
            sanitized.humidity,
            sanitized.precipitation,
            sanitized.pressure,
            risk_level,
            source
        ))
        conn.commit()
        cursor.close()
        conn.close()
        
        captured_at_str = datetime.now().isoformat()
        add_log(f"Wokwi Sensor Ingestão: Bairro {sanitized.bairro} ({sanitized.temperature}°C, {sanitized.humidity}%) -> Risco: {risk_level}", "IOT")

        # 4. Transmitir via WebSocket dinâmico para os painéis
        await manager.broadcast({
            "type": "wokwi_sensor_update",
            "data": {
                "bairro": sanitized.bairro,
                "temperature": sanitized.temperature,
                "humidity": sanitized.humidity,
                "precipitation": sanitized.precipitation,
                "pressure": sanitized.pressure,
                "risk_level": risk_level,
                "captured_at": captured_at_str,
                "source": source
            }
        })
        
        return {
            "status": "success",
            "sanitized": sanitized.dict(),
            "risk_level": risk_level,
            "captured_at": captured_at_str
        }

    except Exception as e:
        error_msg = f"ALERTA MLSecOps - Bloqueio na ingestão de telemetria Wokwi: {str(e)}"
        log_security_incident(error_msg)
        raise HTTPException(status_code=400, detail=error_msg)

# --- MQTT client event callbacks ---
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logger.info("Connected to MQTT Broker.")
        client.subscribe(MQTT_TOPIC_TELEMETRY)
        client.subscribe("storm/wokwi/telemetry")
        client.subscribe("wokwi/telemetry")
        logger.info(f"Subscribed to topics: {MQTT_TOPIC_TELEMETRY}, storm/wokwi/telemetry")
    else:
        logger.error(f"MQTT connection failed with code {rc}")

def on_message(client, userdata, msg):
    try:
        payload_str = msg.payload.decode('utf-8')
        logger.info(f"MQTT Message received on topic {msg.topic}: {payload_str}")
        
        # Ingestão Wokwi via MQTT
        if "wokwi" in msg.topic or (payload_str.startswith("{") and ("bairro" in payload_str or "bairro_nome" in payload_str)):
            data = json.loads(payload_str)
            loop = app.state.loop
            asyncio.run_coroutine_threadsafe(
                process_wokwi_telemetry(data, source="Wokwi ESP32 MQTT"),
                loop
            )
            return

        # Check formatting: JSON vs URL-encoded (ThingSpeak style)
        if payload_str.startswith("{"):
            data = json.loads(payload_str)
            temp = float(data.get("temperature", data.get("temp", 0.0)))
            humidity = float(data.get("humidity", data.get("umidade", 0.0)))
            precipitation = float(data.get("precipitation", data.get("precipitacao", data.get("chuva", 0.0))))
            pressure = float(data.get("pressure", data.get("pressao", 0.0)))
        else:
            # URL-encoded query string format
            params = {}
            for item in payload_str.split("&"):
                if "=" in item:
                    k, v = item.split("=")
                    params[k] = float(v)
            temp = params.get("field1", 0.0)
            humidity = params.get("field2", 0.0)
            precipitation = params.get("field3", 0.0)
            pressure = params.get("field4", 0.0)
            
        loop = app.state.loop
        asyncio.run_coroutine_threadsafe(
            process_telemetry_flow(temp, humidity, precipitation, pressure), 
            loop
        )
    except Exception as e:
        logger.error(f"Error processing MQTT message: {e}")


# --- REST Endpoints ---
@app.get("/status")
def read_status():
    return {
        "status": "online",
        "fail_safe_mode_active": fail_safe_mode,
        "model_loaded": (model is not None)
    }

@app.get("/api/logs")
async def get_logs():
    return system_logs

@app.get("/api/telemetry")
async def get_telemetry():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, timestamp, temperature, humidity, precipitation, pressure, risk_level FROM telemetry ORDER BY timestamp DESC LIMIT 50;")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        
        history = []
        for r in rows:
            prec = float(r[4])
            # Reconstruct neighborhood status on the fly to match frontend dynamic card expectations
            nb_status = calculate_neighborhood_floods_failsafe(prec)
            history.append({
                "id": r[0],
                "timestamp": r[1].isoformat(),
                "temperature": float(r[2]),
                "humidity": float(r[3]),
                "precipitation": prec,
                "pressure": float(r[5]),
                "risk_level": r[6],
                "neighborhoods_status": nb_status
            })
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/telemetry")
async def post_telemetry(payload: TelemetryData):
    await process_telemetry_flow(payload.temperature, payload.humidity, payload.precipitation, payload.pressure)
    return {"status": "success"}

# --- WOKWI SENSOR REST ENDPOINTS ---
@app.post("/api/wokwi/telemetry")
async def post_wokwi_telemetry(payload: dict):
    return await process_wokwi_telemetry(payload, source="Wokwi ESP32 REST API")

@app.get("/api/wokwi/telemetry")
async def get_wokwi_telemetry():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, bairro_nome, temperatura, umidade, chuva_simulada, pressao_simulada, nivel_risco_calculado, enviado_por, capturado_at 
            FROM wokwi_bairros_telemetria 
            ORDER BY capturado_at DESC LIMIT 50;
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        
        history = []
        for r in rows:
            history.append({
                "id": r[0],
                "bairro": r[1],
                "temperature": float(r[2]),
                "humidity": float(r[3]),
                "precipitation": float(r[4]),
                "pressure": float(r[5]),
                "risk_level": r[6],
                "enviado_por": r[7],
                "captured_at": r[8].isoformat()
            })
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/wokwi/bairros")
async def get_wokwi_bairros():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT ON (bairro_nome) 
                bairro_nome, temperatura, umidade, chuva_simulada, pressao_simulada, nivel_risco_calculado, capturado_at 
            FROM wokwi_bairros_telemetria 
            ORDER BY bairro_nome, capturado_at DESC;
        """)
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        
        bairros = {}
        for r in rows:
            bairros[r[0]] = {
                "bairro": r[0],
                "temperature": float(r[1]),
                "humidity": float(r[2]),
                "precipitation": float(r[3]),
                "pressure": float(r[4]),
                "risk_level": r[5],
                "captured_at": r[6].isoformat()
            }
        return bairros
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/simulator/config")
async def set_simulator_preset(payload: dict):
    preset = payload.get("preset")
    if preset not in ["dry", "moderate", "storm"]:
        raise HTTPException(status_code=400, detail="Invalid preset. Must be 'dry', 'moderate', or 'storm'.")
        
    if hasattr(app.state, "mqtt"):
        app.state.mqtt.publish(MQTT_TOPIC_CONFIG, preset)
        add_log(f"Comando de preset publicado via MQTT: {preset.upper()}", "SYSTEM")
        return {"status": "success", "preset": preset}
    else:
        raise HTTPException(status_code=503, detail="MQTT Broker not available")

# --- WebSocket Endpoint ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Load and send the latest database entry on connection
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT temperature, humidity, precipitation, pressure, risk_level, timestamp FROM telemetry ORDER BY timestamp DESC LIMIT 1;")
            row = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if row:
                prec = float(row[2])
                nb_status = calculate_neighborhood_floods_failsafe(prec)
                await websocket.send_json({
                    "type": "init",
                    "data": {
                        "temperature": float(row[0]),
                        "humidity": float(row[1]),
                        "precipitation": prec,
                        "pressure": float(row[3]),
                        "risk_level": row[4],
                        "neighborhoods_status": nb_status,
                        "timestamp": row[5].isoformat()
                    }
                })
        except Exception as db_err:
            logger.error(f"Error reading initial telemetry for WS: {db_err}")

        while True:
            # Maintain connection and listen for incoming messages (e.g. simulator control)
            data = await websocket.receive_text()
            try:
                cmd = json.loads(data)
                if cmd.get("action") == "change_preset":
                    preset = cmd.get("preset")
                    if preset in ["dry", "moderate", "storm"]:
                        if hasattr(app.state, "mqtt"):
                            app.state.mqtt.publish(MQTT_TOPIC_CONFIG, preset)
                            add_log(f"Comando de preset publicado via WS-MQTT: {preset.upper()}", "SYSTEM")
            except Exception as e:
                logger.error(f"Error handling WebSocket incoming message: {e}")
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket execution error: {e}")
        manager.disconnect(websocket)

# Register realtime router
from main_realtime import router_realtime
app.include_router(router_realtime)

