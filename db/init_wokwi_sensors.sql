-- Inicialização da tabela dedicada de telemetria Wokwi por bairro
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

CREATE INDEX IF NOT EXISTS idx_wokwi_bairro ON wokwi_bairros_telemetria(bairro_nome);
CREATE INDEX IF NOT EXISTS idx_wokwi_captura ON wokwi_bairros_telemetria(capturado_at DESC);
