-- db/init_realtime.sql

-- Tabela para armazenar telemetria das cidades em tempo real
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

-- Índices para otimização das consultas de monitoramento contínuo
CREATE INDEX IF NOT EXISTS idx_realtime_city ON realtime_telemetry(city_name);
CREATE INDEX IF NOT EXISTS idx_realtime_captured_at ON realtime_telemetry(captured_at DESC);
