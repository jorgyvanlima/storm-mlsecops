import React, { useState, useEffect, useRef } from 'react';
import { 
  Thermometer, 
  Droplets, 
  CloudRain, 
  Gauge, 
  Activity, 
  AlertTriangle, 
  CloudLightning, 
  ShieldCheck, 
  RefreshCw,
  BookOpen,
  ArrowRight,
  FileText,
  Cpu,
  LogOut,
  Github,
  ExternalLink,
  Radio,
  Database,
  Server
} from 'lucide-react';

function App() {
  const [view, setView] = useState('tcc'); // 'tcc' or 'dashboard'
  const [tccSection, setTccSection] = useState('resumo'); // 'resumo', 'intro', 'referencial', 'arquitetura', 'stride', 'pipeline', 'conclusao'
  const [telemetry, setTelemetry] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [preset, setPreset] = useState('dry'); // dry, moderate, storm
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const terminalEndRef = useRef(null);

  // Wokwi Emulation & Real-time Sensors State (Painel Sensores)
  const [selectedBairro, setSelectedBairro] = useState('Marco');
  const [wokwiTemp, setWokwiTemp] = useState(31.5);
  const [wokwiHum, setWokwiHum] = useState(78.0);
  const [wokwiStatusMsg, setWokwiStatusMsg] = useState('');
  const [wokwiHistory, setWokwiHistory] = useState([]);
  
  const [wokwiSensors, setWokwiSensors] = useState({
    "Marco": { temperature: 31.5, humidity: 78.0, precipitation: 0.0, pressure: 1013.25, risk_level: "Baixo", elevation: 4.2, captured_at: "Agora" },
    "Umarizal": { temperature: 29.8, humidity: 82.0, precipitation: 0.0, pressure: 1013.25, risk_level: "Moderado", elevation: 2.2, captured_at: "Agora" },
    "Doca": { temperature: 27.4, humidity: 89.0, precipitation: 12.5, pressure: 1009.50, risk_level: "Alto", elevation: 1.2, captured_at: "Agora" },
    "Jurunas": { temperature: 28.0, humidity: 85.0, precipitation: 5.0, pressure: 1011.00, risk_level: "Moderado", elevation: 1.8, captured_at: "Agora" },
    "Batista Campos": { temperature: 32.1, humidity: 71.0, precipitation: 0.0, pressure: 1013.25, risk_level: "Baixo", elevation: 3.5, captured_at: "Agora" },
    "Cidade Velha": { temperature: 26.5, humidity: 93.0, precipitation: 18.0, pressure: 1008.00, risk_level: "Alto", elevation: 1.5, captured_at: "Agora" }
  });

  const sendWokwiTelemetry = async (bairro, temp, hum) => {
    setWokwiStatusMsg("Enviando telemetria Wokwi...");
    try {
      const res = await fetch('/api/wokwi/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bairro: bairro,
          temperature: parseFloat(temp),
          humidity: parseFloat(hum),
          precipitation: (parseFloat(hum) >= 88.0 ? 18.5 : 0.0),
          pressure: 1013.25
        })
      });
      const data = await res.json();
      if (res.ok) {
        setWokwiStatusMsg(`✅ Leitura aprovada para ${bairro}! Risco: ${data.risk_level.toUpperCase()}`);
        addLogItem("LOG-IOT", `Disparo Wokwi [${bairro}]: Temp=${temp}°C, Umid=${hum}%`);
      } else {
        const errDetail = data.detail || 'Bloqueio de Ingestão Pydantic';
        setWokwiStatusMsg(`❌ BLOQUEIO MLSecOps (Data Poisoning ML02): ${errDetail}`);
        addLogItem("LOG-ALERT", `🛡️ BLOQUEIO DE SEGURANÇA (ML02): ${errDetail}`);
      }
    } catch (e) {
      setWokwiStatusMsg(`❌ Erro de envio: ${e.message}`);
    }
  };

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Connect WebSockets
  useEffect(() => {
    const connectWS = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host; 
      const wsUrl = `${protocol}//${host}/ws`;
      
      console.log(`Connecting to WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log("WebSocket connection established");
        addLogItem("LOG-INFO", "Conectado ao canal de dados em tempo real (WebSockets)");
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'init') {
            setTelemetry(payload.data);
          } else if (payload.type === 'telemetry') {
            setTelemetry(payload.data);
            setHistory(prev => [payload.data, ...prev.slice(0, 19)]);
            
            const t = payload.data;
            addLogItem("LOG-IOT", `IoT Telemetria Recebida: Temp=${t.temperature}°C, Umid=${t.humidity}%, Chuva=${t.precipitation}mm, Pressão=${t.pressure}hPa`);
            addLogItem("LOG-DB", `Banco de Dados: Registro climático salvo em PostgreSQL.`);
            addLogItem("LOG-IA", `Inteligência Artificial: KMeans predisse nível climático: ${t.risk_level.toUpperCase()}`);
            
            let flooding = [];
            if (t.neighborhoods_status) {
              Object.entries(t.neighborhoods_status).forEach(([name, statusObj]) => {
                if (statusObj.status === 'Alagamento Iminente') {
                  flooding.push(name);
                }
              });
            }
            if (flooding.length > 0) {
              addLogItem("LOG-ALERT", `ALERTA DE ALAGAMENTO! Risco crítico de transbordo nas seguintes regiões: ${flooding.join(', ')}`);
            }
          } else if (payload.type === 'wokwi_sensor_update') {
            const w = payload.data;
            setWokwiSensors(prev => ({
              ...prev,
              [w.bairro]: {
                ...prev[w.bairro],
                ...w,
                updated: true
              }
            }));
            setWokwiHistory(prev => [w, ...prev.slice(0, 29)]);
            addLogItem("LOG-IOT", `WOKWI ESP32 [${w.bairro}]: Temp=${w.temperature}°C, Umid=${w.humidity}% -> Risco: ${w.risk_level.toUpperCase()}`);
            addLogItem("LOG-DB", `PostgreSQL: Inserido em 'wokwi_bairros_telemetria' (%s SQLi Safe).`);
            addLogItem("LOG-IA", `Sanitizador Pydantic (ML02 OK): Ingestão aprovada para ${w.bairro}.`);
            if (w.risk_level === 'Alto' || w.humidity >= 88.0 || w.temperature >= 35.0) {
              addLogItem("LOG-ALERT", `⚡ ALERTA WOKWI! Limiar crítico atingido no bairro ${w.bairro}!`);
            }
          }
        } catch (e) {
          console.error("Error parsing WS data", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log("WebSocket connection closed. Retrying in 3s...");
        addLogItem("LOG-INFO", "Conexão com servidor perdida. Tentando reconectar...");
        setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
      };
    };

    connectWS();

    // Fetch initial HTTP logs, history, and Wokwi data
    const fetchInitData = async () => {
      try {
        const resHistory = await fetch('/api/telemetry');
        if (resHistory.ok) {
          const dataHistory = await resHistory.json();
          setHistory(dataHistory);
          if (dataHistory.length > 0 && !telemetry) {
            setTelemetry(dataHistory);
          }
        }
        
        const resWokwi = await fetch('/api/wokwi/bairros');
        if (resWokwi.ok) {
          const dataWokwi = await resWokwi.json();
          if (Object.keys(dataWokwi).length > 0) {
            setWokwiSensors(prev => ({ ...prev, ...dataWokwi }));
          }
        }

        const resWokwiHist = await fetch('/api/wokwi/telemetry');
        if (resWokwiHist.ok) {
          const dataHist = await resWokwiHist.json();
          setWokwiHistory(dataHist);
        }

        const resLogs = await fetch('/api/logs');
        if (resLogs.ok) {
          const dataLogs = await resLogs.json();
          const formatted = dataLogs.map(line => {
            let type = "LOG-INFO";
            if (line.includes("Prediction") || line.includes("Predição") || line.includes("Wokwi")) type = "LOG-IA";
            if (line.includes("Stored") || line.includes("PostgreSQL") || line.includes("wokwi_bairros")) type = "LOG-DB";
            if (line.includes("MQTT Message") || line.includes("MQTT") || line.includes("Sensor")) type = "LOG-IOT";
            if (line.includes("WARNING") || line.includes("ALERT") || line.includes("Erro") || line.includes("Bloqueio")) type = "LOG-ALERT";
            return { type, text: line };
          });
          setLogs(formatted);
        }
      } catch (e) {
        console.warn("Could not fetch HTTP initial endpoints. Waiting for WebSocket updates.");
      }
    };

    fetchInitData();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const addLogItem = (type, text) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { type, text: `[${timestamp}] ${text}` }].slice(-100));
  };

  // Trigger preset changes
  const changePreset = async (newPreset) => {
    setPreset(newPreset);
    addLogItem("LOG-INFO", `Enviando comando de clima: ${newPreset.toUpperCase()}`);
    
    // Send via WebSocket if open
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        action: 'change_preset',
        preset: newPreset
      }));
    } else {
      // Fallback to REST API
      try {
        await fetch('/api/simulator/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset: newPreset })
        });
      } catch (e) {
        console.error("Failed to change preset via REST API:", e);
      }
    }
  };

  const getLogClass = (type) => {
    switch (type) {
      case 'LOG-IOT': return 'terminal-line-iot';
      case 'LOG-DB': return 'terminal-line-db';
      case 'LOG-IA': return 'terminal-line-ia';
      case 'LOG-ALERT': return 'terminal-line-alert';
      default: return 'terminal-line-info';
    }
  };

  const getGlobalRisk = () => {
    if (!telemetry) return 'Carregando...';
    return telemetry.risk_level || 'Indefinido';
  };

  const getBadgeClass = (risk) => {
    const r = (risk || '').toLowerCase();
    if (r === 'baixo') return 'status-baixo';
    if (r === 'moderado') return 'status-moderado';
    if (r === 'alto') return 'status-alto';
    return 'status-baixo';
  };

  const isStorming = getGlobalRisk().toLowerCase() === 'alto';

  return (
    <>
      {/* Background lightning simulation layer (disabled to prevent screen flashing) */}
      {/* <div className={`lightning-bg ${isStorming ? 'lightning-storm-active' : ''}`} /> */}
      
      <div className="app-container">
        
        {/* Dynamic Storm-Themed Header */}
        <header className="app-header">
          <div className="header-title-container">
            <span className="header-logo">⚡</span>
            <div>
              <h1 className="storm-logo-text">STORM-MLSECOPS</h1>
              <p style={{ fontSize: '0.85rem', color: '#a0aec0', marginTop: '2px' }}>
                Framework de Cibersegurança e Telemetria Climática • Belém-PA
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Navegação entre os 3 Painéis e TCC */}
            <button 
              onClick={() => setView('tcc')} 
              className="control-btn"
              style={{
                width: 'auto',
                padding: '8px 16px',
                background: view === 'tcc' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255,255,255,0.05)',
                borderColor: view === 'tcc' ? '#a855f7' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontWeight: view === 'tcc' ? 'bold' : 'normal'
              }}
            >
              <BookOpen size={16} />
              <span>TCC</span>
            </button>

            <button 
              onClick={() => setView('dashboard')} 
              className="control-btn"
              style={{
                width: 'auto',
                padding: '8px 16px',
                background: view === 'dashboard' ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255,255,255,0.05)',
                borderColor: view === 'dashboard' ? '#a855f7' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontWeight: view === 'dashboard' ? 'bold' : 'normal'
              }}
            >
              <Cpu size={16} />
              <span>Painel Prático</span>
            </button>

            <button 
              onClick={() => setView('sensores')} 
              className="control-btn"
              style={{
                width: 'auto',
                padding: '8px 16px',
                background: view === 'sensores' ? 'rgba(6, 182, 212, 0.4)' : 'rgba(255,255,255,0.05)',
                borderColor: view === 'sensores' ? '#06b6d4' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontWeight: view === 'sensores' ? 'bold' : 'normal'
              }}
            >
              <Radio size={16} style={{ color: '#06b6d4' }} />
              <span>Painel Sensores (Wokwi)</span>
            </button>

            <a 
              href="/realtime.html" 
              className="control-btn"
              style={{
                width: 'auto',
                padding: '8px 16px',
                background: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgba(59, 130, 246, 0.5)',
                color: '#3b82f6',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Activity size={16} />
              <span>Painel Real</span>
              <ExternalLink size={14} />
            </a>

            {/* Connection Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: '#cbd5e1' }}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isConnected ? '#10b981' : '#ef4444',
                boxShadow: isConnected ? '0 0 10px #10b981' : '0 0 10px #ef4444'
              }} />
              <span>{isConnected ? 'Servidor Conectado' : 'Conectando...'}</span>
            </div>

            {/* Global IA Status */}
            {telemetry && (
              <span className={`status-badge ${getBadgeClass(telemetry.risk_level)}`}>
                {isStorming ? <CloudLightning size={16} /> : <ShieldCheck size={16} />}
                IA Status: {getGlobalRisk()}
              </span>
            )}
          </div>
        </header>

        {/* Chaveamento de Visualização: TCC, Painel Prático ou Painel Sensores */}
        {view === 'tcc' && (
          <div className="tcc-layout">
            
            {/* Sidebar de Navegação do TCC */}
            <aside className="tcc-sidebar">
              <div style={{ padding: '10px 8px', fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Sumário e Capítulos
              </div>
              <button 
                onClick={() => setTccSection('resumo')} 
                className={`tcc-nav-item ${tccSection === 'resumo' ? 'tcc-nav-item-active' : ''}`}
              >
                Capa & Resumo / Abstract
              </button>
              <button 
                onClick={() => setTccSection('intro')} 
                className={`tcc-nav-item ${tccSection === 'intro' ? 'tcc-nav-item-active' : ''}`}
              >
                1. Introdução
              </button>
              <button 
                onClick={() => setTccSection('referencial')} 
                className={`tcc-nav-item ${tccSection === 'referencial' ? 'tcc-nav-item-active' : ''}`}
              >
                2. Referencial Teórico
              </button>
              <button 
                onClick={() => setTccSection('arquitetura')} 
                className={`tcc-nav-item ${tccSection === 'arquitetura' ? 'tcc-nav-item-active' : ''}`}
              >
                3. Arquitetura do Sistema
              </button>
              <button 
                onClick={() => setTccSection('stride')} 
                className={`tcc-nav-item ${tccSection === 'stride' ? 'tcc-nav-item-active' : ''}`}
              >
                4. Ameaças & Controles (STRIDE)
              </button>
              <button 
                onClick={() => setTccSection('pipeline')} 
                className={`tcc-nav-item ${tccSection === 'pipeline' ? 'tcc-nav-item-active' : ''}`}
              >
                5. Pipeline de CI/CD & CT
              </button>
              <button 
                onClick={() => setTccSection('conclusao')} 
                className={`tcc-nav-item ${tccSection === 'conclusao' ? 'tcc-nav-item-active' : ''}`}
              >
                6. Conclusão & Referências
              </button>

              <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(6, 182, 212, 0.05)', borderRadius: '12px', border: '1px solid rgba(6, 182, 212, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#06b6d4', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  <Cpu size={16} />
                  <span>Demonstração Prática</span>
                </div>
              </div>
            </aside>

            {/* Painel de Conteúdo de Leitura do TCC */}
            <main className="tcc-content-pane">

              {tccSection === 'resumo' && (
                <div>
                  <h2 className="academic-title">STORM-MLSecOps: Framework de Segurança de Ponta a Ponta para Sistemas Inteligentes de Telemetria Climática e Alerta de Alagamento em Belém-PA (v4 - Edição Estendida com Emulação IoT)</h2>
                  
                  <div className="academic-meta-grid">
                    <div className="academic-meta-item">
                      <div className="academic-meta-label">Instituição</div>
                      <div className="academic-meta-val">Universidade Federal do Pará (UFPA)</div>
                    </div>
                    <div className="academic-meta-item">
                      <div className="academic-meta-label">Programa</div>
                      <div className="academic-meta-val">Especialização em Sistemas de Segurança Integrada da Informação e Cibersegurança</div>
                    </div>
                    <div className="academic-meta-item">
                      <div className="academic-meta-label">Autor</div>
                      <div className="academic-meta-val">Jorgyvan Braga Lima</div>
                    </div>
                    <div className="academic-meta-item">
                      <div className="academic-meta-label">Orientador</div>
                      <div className="academic-meta-val">Prof. Dr. André Riker</div>
                    </div>
                    <div className="academic-meta-item">
                      <div className="academic-meta-label">Data de Defesa</div>
                      <div className="academic-meta-val">Julho de 2026</div>
                    </div>
                  </div>

                  <h3 className="academic-heading-1">RESUMO</h3>
                  <p className="academic-p">
O aumento exponencial no volume de dados climáticos gerados por dispositivos de Internet das Coisas (IoT) tem impulsionado a adoção de modelos de Aprendizado de Máquina (Machine Learning - ML) para predição e mitigação de desastres socioambientais, tais como alagamentos urbanos. No entanto, a incorporação de inteligência artificial em sistemas de controle crítico expande a superfície de ataque, introduzindo vulnerabilidades específicas como envenenamento de dados (<em>data poisoning</em>), manipulação adversarial na inferência e ataques à cadeia de suprimentos de software.
                  </p>
                  <p className="academic-p">
Este trabalho apresenta o <strong>STORM-MLSecOps (v4)</strong>, uma evolução profunda e individual do sistema STORM original (anteriormente projetado em grupo) para um ecossistema <em>hardened</em> baseado nos princípios de <strong>MLSecOps</strong> (Machine Learning Security Operations). O sistema está estruturado em torno de <strong>dois modelos de estudo de caso complementares</strong>: um modelo simulado de telemetria climática que utiliza o algoritmo não supervisionado <em>K-Means</em> do <em>scikit-learn</em> para classificação de riscos de alagamento por bairros históricos de Belém-PA (Doca de Souza Franco, Cidade Velha, Jurunas, Umarizal, Batista Campos e Marco); e um modelo prático real baseado na captura contínua de dados climatológicos reais de seis cidades paraenses (Castanhal, Bragança, Salinas, Belém, Marabá e Parauapebas) via API segura do OpenWeatherMap com persistência parametrizada em PostgreSQL.
                  </p>
                  <p className="academic-p">
Como grande contribuição desta versão v4, o framework integra a <strong>Infraestrutura de Emulação Física IoT via Wokwi</strong>, conectando um microcontrolador ESP32 a uma matriz de seis sensores DHT22 dedicados, representando fisicamente a telemetria em tempo real dos bairros monitorados de Belém. Os dados gerados pelos sensores são recebidos e armazenados em um <strong>banco de dados estritamente dedicado e exclusivo para a telemetria por bairros</strong> (<code>wokwi_bairros_telemetria</code>), mantendo o princípio de isolamento e segregação de dados para evitar contaminações (<em>Data Poisoning</em> / ML02). O Painel Prático é redesenhado sob uma arquitetura dual: uma Área de Emuladores (com o código-fonte rodando em Wokwi e disponível para alterações manuais de temperatura e umidade) e uma Área de Monitoramento de Sensores por Bairro (receptor ativo conectado via WebSockets e sincronizado com o banco de dados).
                  </p>
                  <p className="academic-p">
O framework de segurança implementa validação de dados em múltiplas etapas via validadores <em>Pydantic</em>, versionamento criptográfico com DVC (<em>Data Version Control</em>) acoplado à nuvem <em>IBM Cloud Object Storage</em> (COS), automação de CI/CD via GitHub Actions e CML (<em>Continuous Machine Learning</em>), e o modo automático de contingência (<em>Fail-Safe Inference Mode</em>). Os resultados demonstram que a aplicação de MLSecOps ao projeto STORM neutraliza vetores de envenenamento, preservando a acurácia geométrica do modelo e garantindo a continuidade do serviço com <em>zero downtime</em> durante falhas simuladas de infraestrutura.
                  </p>
                  <p className="academic-p">
                    <strong>Palavras-chave:</strong> Cibersegurança, MLSecOps, MLOps, Telemetria Climática, Wokwi, ESP32, K-Means, Belém-PA, Docker.
                  </p>

                  <h3 className="academic-heading-1">ABSTRACT</h3>
                  <p className="academic-p" style={{ fontStyle: 'italic' }}>
The exponential growth of climate data generated by Internet of Things (IoT) devices has driven the adoption of Machine Learning (ML) models to predict and mitigate socio-environmental disasters, such as urban flooding. However, integrating artificial intelligence into critical control systems expands the attack surface, introducing machine learning-specific vulnerabilities such as data poisoning, adversarial manipulation, and software supply chain attacks.
                  </p>
                  <p className="academic-p" style={{ fontStyle: 'italic' }}>
This work presents <strong>STORM-MLSecOps (v4)</strong>, an individual and highly secured evolution of the original STORM project into an autonomous, hardened ecosystem based on the principles of <strong>MLSecOps</strong> (Machine Learning Security Operations). The system is structured around <strong>two complementary case studies</strong>: a simulated clustering model using <em>scikit-learn K-Means</em> to classify flooding risks across neighborhoods of Belém-PA (Doca, Cidade Velha, Jurunas, Umarizal, Batista Campos, and Marco); and a practical real-time model capturing active climate telemetry for six major cities in Pará via OpenWeatherMap secure HTTPS API with robust PostgreSQL persistence.
                  </p>
                  <p className="academic-p" style={{ fontStyle: 'italic' }}>
As a major contribution of this v4 edition, the framework integrates a <strong>Physical IoT Emulation Infrastructure via Wokwi</strong>, connecting an ESP32 microcontroller to a matrix of six dedicated DHT22 sensors, physically representing real-time telemetry from monitored neighborhoods of Belém. The metrics emitted by these sensors are received and persisted in a <strong>strictly dedicated database table</strong> (<code>wokwi_bairros_telemetria</code>), satisfying data segregation principles to prevent training-set contamination (<em>Data Poisoning</em> / ML02). The Practical Panel features a dual-view architecture: an Emulators Zone (running the emulation scripts on Wokwi, open for manual temperature and humidity adjustments) and a Neighborhood Sensor Receiver Zone (an active dashboard connected via WebSockets and synchronized with the database).
                  </p>
                  <p className="academic-p" style={{ fontStyle: 'italic' }}>
The security framework incorporates multi-stage data validation (<em>Pydantic Sanitizers</em>), cryptographic version control of datasets and models using DVC connected to <em>IBM Cloud Object Storage</em> (COS), automated CI/CD pipelines via GitHub Actions and CML, and an automatic contingency mode (<em>Fail-Safe Inference Mode</em>). Analytical results demonstrate that applying MLSecOps to the STORM project effectively neutralizes data poisoning, ensuring operational integrity and service availability with zero downtime.
                  </p>
                  <p className="academic-p">
                    <strong>Keywords:</strong> Cybersecurity, MLSecOps, MLOps, Climate Telemetry, Wokwi, ESP32, K-Means, Belém-PA, Docker.
                  </p>
                </div>
              )}

              {tccSection === 'intro' && (
                <div>
                  <h2 className="academic-heading-1">1. INTRODUÇÃO</h2>
                  <h3 className="academic-heading-2">1.1. Contextualização e Justificativa</h3>
                  <p className="academic-p">
A tecnologia da informação e as infraestruturas de dados estão evoluindo de forma exponencial no contexto das cidades inteligentes, gerando volumes colossais de dados de sensores ambientais, residenciais e industriais (Big Data). A Inteligência Artificial (IA) e o Aprendizado de Máquina (<strong>Machine Learning</strong> - ML) tornaram-se ferramentas essenciais para extrair conhecimento útil e realizar predições em tempo real. No entanto, à medida que os modelos de ML migram de protótipos experimentais isolados para ambientes de missão crítica em produção, surge a necessidade urgente de garantir sua operacionalização confiável, escalável e segura.
                  </p>
                  <p className="academic-p">
Historicamente, o desenvolvimento de software tradicional lidou com silos operacionais por meio da cultura <strong>DevOps</strong>, otimizando o ciclo de vida do software com automação de pipelines de integração e entrega contínua (CI/CD). Para responder às demandas dinâmicas de dados e de modelos de machine learning, surgiu o <strong>MLOps</strong>, estendendo os conceitos de DevOps para versionar código, dados e modelos, automatizando fluxos experimentais e implantando-os de forma previsível. Contudo, a simples replicação de DevOps e MLOps desconsidera a nova superfície de ataque introduzida pela natureza probabilística e orientada a dados do machine learning, gerando vulnerabilidades silenciosas e indetectáveis por firewalls tradicionais.
                  </p>

                  <h3 className="academic-heading-2">1.2. O Problema das Enchentes em Belém-PA e o Projeto STORM Coletivo</h3>
                  <p className="academic-p">
Belém-PA é uma metrópole equatorial caracterizada por índices pluviométricos severos, marés fluviais elevadas e baixas altitudes em áreas consolidadas. Regiões urbanas críticas, como a Avenida Doca de Souza Franco, localizam-se abaixo do nível da maré cheia, sofrendo inundações recorrentes que causam perdas materiais e riscos de vida à população.
                  </p>
                  <p className="academic-p">
Para mitigar esses desastres, o projeto original <strong>STORM</strong> foi desenvolvido de forma coletiva por discentes do curso de pós-graduação em Cibersegurança da UFPA. O sistema utiliza um ecossistema 100% conteinerizado em Docker, composto por sensores IoT simulados e reais, um broker MQTT para ingestão de telemetria, um serviço de IA com modelo de agrupamento <strong>K-Means</strong> treinado de forma isolada, uma API Backend em FastAPI para processamento em tempo real, persistência em banco de dados PostgreSQL, transmissão via WebSockets e um painel visual frontend intuitivo baseado no tema "Tempestade". Contudo, como o foco inicial do projeto coletivo centrou-se na funcionalidade, a segurança lógica e a integridade matemática dos algoritmos de ML ficaram expostas a riscos severos.
                  </p>

                  <h3 className="academic-heading-2">1.3. O Desafio de MLSecOps e Objetivos do STORM-MLSecOps</h3>
                  <p className="academic-p">
Ao integrar inteligência artificial a sistemas críticos de alerta socioambiental, os modelos de IA dependem da integridade do fluxo de dados para manter sua precisão preditiva. Se o pipeline de ingestão carece de validação automatizada e as bibliotecas terceiras de ML contêm brechas de segurança, o sistema pode ser severamente corrompido, gerando predições catastróficas ou expondo dados sensíveis. Daí emerge o <strong>MLSecOps</strong> (Machine Learning Security Operations), integrando segurança proativa (<strong>"shift-left"</strong>) por design e automação de segurança em todas as fases do ciclo de vida da IA.
                  </p>
                  <p className="academic-p">
Este TCC apresenta a reformulação individual e evolução do STORM para o repositório <strong>STORM-MLSecOps</strong> (https://github.com/jorgyvanlima/storm-mlsecops), elevando o nível de maturidade do projeto e introduzindo um ecossistema robusto de controles de segurança integrados ao pipeline de dados e IA. O objetivo geral deste trabalho é propor, implementar e avaliar a arquitetura do STORM-MLSecOps, integrando controles modernos de segurança ao ecossistema STORM de telemetria climática do Pará. Os objetivos específicos incluem:
                  </p>
                  <ol className="academic-ul" style={{ listStyleType: 'decimal' }}>
                    <li className="academic-li">Realizar a modelagem de ameaças utilizando o framework STRIDE adaptado para machine learning sobre a arquitetura conteinerizada do STORM.</li>
                    <li className="academic-li">Implementar salvaguardas técnicas contra <strong>Data Poisoning</strong> e <strong>Evasion Attacks</strong> na telemetria climática.</li>
                    <li className="academic-li">Desenvolver e contrapor <strong>dois estudos de caso práticos</strong>: um modelo simulado de agrupamento para bairros de Belém e um modelo real de coleta meteorológica para cidades do Pará (Castanhal, Bragança, Salinas, Belém, Marabá, Parauapebas) via API OpenWeatherMap.</li>
                    <li className="academic-li">Consolidar a reprodutibilidade e rastreabilidade por meio de versionamento de código, dados e modelos usando o DVC (<strong>Data Version Control</strong>) integrado à nuvem IBM Cloud Object Storage (COS) e VPS.</li>
                    <li className="academic-li">Desenvolver e validar o mecanismo automático de fallback <strong>Fail-Safe Inference Mode</strong> para garantia de alta disponibilidade sob falha sistêmica do modelo preditivo.</li>
                  </ol>
                </div>
              )}

              {tccSection === 'referencial' && (
                <div>
                  <h2 className="academic-heading-1">2. REFERENCIAL TEÓRICO DE MLOps, MLSECOPS E SEGURANÇA EM ML</h2>
                  <h3 className="academic-heading-2">2.1. De DevOps para MLOps e a Transição para MLSecOps</h3>
                  <p className="academic-p">
No desenvolvimento tradicional, a fragmentação entre os times de desenvolvimento (Dev) e operações (Ops) acarretava atrasos e ineficiências na colocação de softwares em produção. A cultura <strong>DevOps</strong> resolveu esse problema ao introduzir colaboração ágil, monitoramento e pipelines automatizados de CI/CD, diminuindo o tempo de entrega das releases e elevando a qualidade geral do software.
                  </p>
                  <p className="academic-p">
Quando os modelos de machine learning começaram a ser largamente adotados, percebeu-se que a simples aplicação de DevOps era insuficiente. O machine learning introduz o elemento de incerteza e comportamento dinâmico baseado em dados. Enquanto o software tradicional é determinístico (composto por regras de programação explícitas), os sistemas de ML são dinâmicos e probabilísticos, gerando o comportamento por meio de treinamento iterativo sobre grandes bases de dados. Surge então o <strong>MLOps</strong>, agregando novas práticas como orquestração de fluxos complexos baseados em DAGs (Grafos Acíclicos Dirigidos), gerenciamento de <strong>Feature Stores</strong>, controle de versão de dados e modelos (DVC), monitoramento de desvio de conceitos (<strong>concept drift</strong>) e retreino contínuo (CT - <strong>Continuous Training</strong>).
                  </p>
                  <p className="academic-p">
A evolução de MLOps para <strong>MLSecOps</strong> decorre do entendimento de que pipelines de MLOps automatizados herdam vulnerabilidades tradicionais e herdam riscos específicos de ML. O MLSecOps define a segurança como uma responsabilidade compartilhada entre engenheiros de ML, cientistas de dados e analistas de segurança, integrando salvaguardas técnicas desde a concepção do pipeline climático até o monitoramento em produção.
                  </p>

                  <h3 className="academic-heading-2">2.2. O Ciclo de Vida do MLSecOps de 9 Fases</h3>
                  <p className="academic-p">
De acordo com os frameworks de referência definidos pela OpenSSF, pela Ericsson e pela Space-ISAC, a segurança da informação não pode ser considerada uma barreira aplicada apenas no final da esteira. O MLSecOps adota a estratégia de <strong>shift-left</strong>, integrando segurança cibernética ao longo de todas as 9 fases fundamentais do ciclo de vida de dados e modelos:
                  </p>
                  <ol className="academic-ul" style={{ listStyleType: 'decimal' }}>
                    <li className="academic-li"><strong>Planejamento e Design Seguro:</strong> Modelagem de ameaças (STRIDE/ATLAS) e estabelecimento da baseline de conformidade da aplicação de telemetria.</li>
                    <li className="academic-li"><strong>Engenharia de Dados Segura:</strong> Controles de proveniência (<strong>lineage</strong>), limpeza rigorosa dos dados coletados de fontes externas e verificação contra envenenamento (<strong>Data Poisoning</strong>).</li>
                    <li className="academic-li"><strong>Experimentação:</strong> Execução de pesquisas em ambientes isolados seguros, documentação completa de metadados, seleção de modelos e testes de robustez adversarial.</li>
                    <li className="academic-li"><strong>Desenvolvimento e Teste de Pipelines:</strong> Desenvolvimento sob ciclo de vida seguro (SDLC), aplicando testes de integração, SAST (com Bandit para scripts Python), DAST e fuzzing.</li>
                    <li className="academic-li"><strong>Integração Contínua (CI):</strong> Builds automatizados e isolados de pacotes com scanners de vulnerabilidades em dependências e verificação de integridade.</li>
                    <li className="academic-li"><strong>Entrega e Implantação Contínuas (CD):</strong> Deploy seguro de contêineres e imagens assinadas digitalmente, protegendo pacotes e modelos em trânsito e em repouso.</li>
                    <li className="academic-li"><strong>Treinamento Contínuo (CT) Seguro:</strong> Pipeline automatizado de retreino acionado por detecção de drift ou novas coletas de dados, realizando validações criptográficas e de integridade antes do deploy de um modelo retreinado.</li>
                    <li className="academic-li"><strong>Serviço de Modelos (Serving):</strong> Hardening de contêineres, controle rigoroso de acesso baseados em privilégios (Least Privilege), validação e sanitização de dados de inferência de tempo real para neutralizar ataques adversariais.</li>
                    <li className="academic-li"><strong>Monitoramento Contínuo de Segurança:</strong> Dashboards funcionais exibindo indicadores de desempenho climáticos, desvios estatísticos de predição e alertas automatizados de segurança física e digital.</li>
                  </ol>

                  <h3 className="academic-heading-2">2.3. Vetores de Ataque e Ameaças em Sistemas de ML (OWASP e JISEM)</h3>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>ML02: Data Poisoning (Envenenamento de Dados):</strong> Ocorre quando um ator malicioso altera ou introduz dados de treinamento falsificados na fase de ingestão ou engenharia de dados. Em modelos de agrupamento como o <strong>K-Means</strong> usado no STORM, a inserção de métricas anômalas distorce severamente os centros dos clusters. Ataques direcionados de envenenamento de dados obtiveram sucesso em 73,8% dos casos ao contaminar apenas 3,2% do dataset de treinamento.</li>
                    <li className="academic-li"><strong>ML01: Input Manipulation / Evasion Attack (Evasão Adversarial):</strong> Ataque focado na etapa de inferência em tempo real, onde o atacante introduz perturbações estatísticas nos dados de entrada para enganar o modelo, fazendo-o errar a predição.</li>
                    <li className="academic-li"><strong>ML06: AI Supply Chain Attack (Ataque à Cadeia de Suprimentos):</strong> Envolve a incorporação de bibliotecas de terceiros corrompidas ou a desserialização de arquivos de modelos <code>.pkl</code> que contenham backdoors lógicos embarcados.</li>
                    <li className="academic-li"><strong>ML08: Model Skewing (Distorção de Modelo):</strong> Ataque focado no desvio lento e incremental de limites de classificação em sistemas baseados em retreino automático.</li>
                    <li className="academic-li"><strong>ML03: Model Inversion / Membership Inference:</strong> API rate limiting fraco permite que atacantes interroguem recursivamente o modelo até extrair a base de conhecimento.</li>
                  </ul>
                  
                  <h3 className="academic-heading-2">2.4. Bibliotecas de Machine Learning e Fundamentos Matemáticos/Lógicos em Python</h3>
                  <p className="academic-p">
O ecossistema Python estabeleceu-se como a linguagem padrão para ciência de dados e machine learning devido à sua robustez e flexibilidade de integração ("Python como cola"). A base teórica apoia-se em conceitos fundamentais do NumPy, Pandas e Scikit-Learn.
                  </p>
                </div>
              )}

              {tccSection === 'arquitetura' && (
                <div>
                  <h2 className="academic-heading-1">3. ARQUITETURA DO SISTEMA STORM-MLSecOps E ESTUDOS DE CASO</h2>
                  <h3 className="academic-heading-2">3.1. Visão Geral da Arquitetura Conteinerizada (Docker Compose)</h3>
                  <p className="academic-p">
O STORM-MLSecOps é arquitetado como uma aplicação modular nativa na nuvem, sendo integralmente conteinerizado e implantado via Docker Compose através de seis serviços isolados que se comunicam de forma estrita em redes privadas virtuais:
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>db (Banco de Dados):</strong> Executa o PostgreSQL 15 baseado em Alpine Linux. Isolado de toda a rede externa.</li>
                    <li className="academic-li"><strong>broker (Broker MQTT):</strong> Hospeda o Eclipse Mosquitto v2, gerenciando a fila de tópicos de telemetria climática IoT.</li>
                    <li className="academic-li"><strong>ai-service (Treinador da IA):</strong> Contêiner efêmero baseado em Python 3.11-slim. Gera dataset sintético, realiza a limpeza, normaliza com <code>StandardScaler</code> e executa o agrupamento <strong>K-Means</strong>.</li>
                    <li className="academic-li"><strong>backend (API de Processamento):</strong> Executa em FastAPI. Carrega os artefatos serializados, conecta-se ao Broker MQTT e ao PostgreSQL.</li>
                    <li className="academic-li"><strong>iot-simulator (Simulador IoT):</strong> Script que emula dados contínuos de sensores físicos climáticos a cada 8 segundos.</li>
                    <li className="academic-li"><strong>frontend (Dashboard Interativo):</strong> Interface SPA React compilada em Vite com servidor web Nginx e tema escuro "Tempestade".</li>
                  </ul>

                  <h3 className="academic-heading-2">3.2. Estudo de Caso 1: Modelo Climático Simulado por Bairros (K-Means)</h3>
                  <p className="academic-p">
O primeiro estudo de caso consiste na classificação de riscos climáticos por bairros históricos de Belém-PA com base em dados de telemetria climática simulada. O K-Means particiona a distribuição em 3 clusters geométricos: Risco Baixo, Moderado e Alto. Implementam-se validadores estritos de sanidade matemática para impedir que outliers distorçam as fronteiras dos clusters.
                  </p>

                  <h3 className="academic-heading-2">3.3. Estudo de Caso 2: Modelo Prático Real-Time de Cidades do Pará (OpenWeather API)</h3>
                  <p className="academic-p">
O segundo modelo consolida o monitoramento real em tempo real das condições atmosféricas de seis cidades: Castanhal, Bragança, Salinas, Belém, Marabá e Parauapebas.
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>Captura Ativa via HTTPS:</strong> Chamadas seguras diretas para a API internacional da OpenWeather.</li>
                    <li className="academic-li"><strong>Banco de Dados Dedicado e Prevenção SQLi:</strong> Os dados reais são gravados em tabela dedicada através de consultas parametrizadas via <code>psycopg2</code>.</li>
                    <li className="academic-li"><strong>Higienização Estrita com Pydantic:</strong> Uso do <code>TelemetrySanitizer</code> para blindar o sistema contra possíveis sequestros lógicos da API de terceiros.</li>
                  </ul>

                  <h3 className="academic-heading-2">3.4. Infraestrutura de Emulação de Hardware IoT via Wokwi e Conexão de Sensores por Bairro</h3>
                  <p className="academic-p">
Para fundamentar a integridade lógica da borda física do ecossistema STORM-MLSecOps, foi projetado um ambiente de emulação física de hardware utilizando o simulador de circuitos digitais <strong>Wokwi</strong>. Esse ambiente simula com alto grau de fidelidade o comportamento operacional de um microcontrolador <strong>ESP32 DevKit v4</strong> (firmware MicroPython <code>v1.28.0</code>) conectado a sensores meteorológicos de campo distribuídos em Belém-PA.
                  </p>
                  <p className="academic-p">
A arquitetura de hardware simulada no Wokwi é descrita e estruturada de forma declarativa pelo arquivo <code>diagram.json.txt</code>, compreendendo as seguintes conexões físicas:
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>Painel de Exibição Local (I2C Display):</strong> Display LCD de modelo 2004 (4 linhas, 20 colunas) conectado via barramento I2C físico do ESP32 (VCC ao 5V, GND ao GND.1, SDA ao GPIO 21 e SCL ao GPIO 22).</li>
                    <li className="academic-li"><strong>Matriz Distribuída de Sensores de Bairro:</strong> Seis sensores de temperatura e umidade <strong>DHT22</strong> dedicados, mapeando de forma física os 6 bairros lógicos monitorados pelo sistema:
                      <ul style={{ paddingLeft: '20px', marginTop: '6px' }}>
                        <li><strong>Marco:</strong> Sensor DHT22 conectado ao pino <code>GPIO 15</code>.</li>
                        <li><strong>Umarizal:</strong> Sensor DHT22 conectado ao pino <code>GPIO 2</code>.</li>
                        <li><strong>Doca de Souza Franco:</strong> Sensor DHT22 conectado ao pino <code>GPIO 4</code>.</li>
                        <li><strong>Jurunas:</strong> Sensor DHT22 conectado ao pino <code>GPIO 16</code>.</li>
                        <li><strong>Batista Campos:</strong> Sensor DHT22 conectado ao pino <code>GPIO 17</code>.</li>
                        <li><strong>Cidade Velha:</strong> Sensor DHT22 conectado ao pino <code>GPIO 18</code>.</li>
                      </ul>
                    </li>
                  </ul>
                  <p className="academic-p">
A rotina de processamento local do ESP32 é regida pelo script MicroPython <code>main.py.txt</code>, operando em laço fechado contínuo (<em>while True</em>). O firmware inicializa o Wi-Fi emulado (<code>Wokwi-GUEST</code>) e estabelece conexão soquete TCP criptografada com o Broker MQTT centralizado do STORM na porta padrão de telemetria <code>1883</code>.
                  </p>

                  <h3 className="academic-heading-2">3.5. Modelo de Dados Dedicado para Telemetria por Bairro (<code>wokwi_bairros_telemetria</code>)</h3>
                  <p className="academic-p">
Em um ecossistema seguro de MLSecOps, a <strong>segregação física e lógica de dados</strong> é uma diretriz de segurança obrigatória para neutralizar riscos de poluição ou contaminação intencional de dados de treinamento (<em>Data Poisoning</em> / ML02). Misturar dados brutos contínuos gerados por emulações e prototipações físicas com o dataset de treino principal da inteligência artificial pode deslocar os centroides geométricos e invalidar o modelo preditivo K-Means.
                  </p>
                  <p className="academic-p">
Para solucionar essa fraqueza de design, o STORM-MLSecOps v4 estabelece um banco de dados relacional (PostgreSQL) estritamente segregado, inicializado pelo script estrutural <code>init_wokwi_sensors.sql</code>. A telemetria originada diretamente da emulação física Wokwi por bairros é persistida exclusivamente em uma tabela dedicada denominada <code>wokwi_bairros_telemetria</code>:
                  </p>
                  <div style={{ background: 'rgba(15, 23, 42, 0.9)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.3)', margin: '16px 0', fontFamily: 'monospace', fontSize: '0.82rem', color: '#38bdf8', overflowX: 'auto' }}>
                    <pre style={{ margin: 0 }}>{`-- Criar tabela exclusiva para recebimento dos sensores por bairro do Wokwi
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

-- Indexação para otimização de consultas e detecção rápida de desvios estatísticos
CREATE INDEX IF NOT EXISTS idx_wokwi_bairro ON wokwi_bairros_telemetria(bairro_nome);
CREATE INDEX IF NOT EXISTS idx_wokwi_captura ON wokwi_bairros_telemetria(capturado_at);`}</pre>
                  </div>
                  <p className="academic-p">
Essa modelagem de dados dedicada blinda os pipelines de MLOps de duas formas:
                  </p>
                  <ol className="academic-ul" style={{ listStyleType: 'decimal' }}>
                    <li className="academic-li"><strong>Segregação Operacional:</strong> O backend FastAPI intercepta os payloads MQTT do Wokwi, realiza a inferência individual para estimar o <code>nivel_risco_calculado</code> com base no cluster do K-Means e grava o registro unicamente na tabela <code>wokwi_bairros_telemetria</code>.</li>
                    <li className="academic-li"><strong>Imunidade de Dados do Dataset de Treino:</strong> Como a tabela de emulação física é isolada da tabela de histórico principal do <code>ai-service</code>, qualquer tentativa de injeção excessiva de outliers nos sliders manuais do Wokwi fica restrita à tabela de monitoramento operacional prático, não afetando o recálculo e treinamento do modelo de machine learning principal (neutralizando de forma absoluta o vetor de ataque <em>Data Poisoning</em> / ML02).</li>
                  </ol>
                </div>
              )}

              {tccSection === 'stride' && (
                <div>
                  <h2 className="academic-heading-1">4. MODELAGEM DE AMEAÇAS E CONTROLES DE SEGURANÇA (STRIDE)</h2>
                  <h3 className="academic-heading-2">4.1. Modelagem de Ameaças baseada em STRIDE</h3>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>Spoofing (Identidade):</strong> Sensores climáticos piratas. <strong>Mitigação:</strong> Autenticação criptográfica no Broker MQTT.</li>
                    <li className="academic-li"><strong>Tampering (Adulteração):</strong> Envenenamento do gerador de dados (Data Poisoning). <strong>Mitigação:</strong> Higienização matemática estrita; hashes no DVC na VPS HostGator.</li>
                    <li className="academic-li"><strong>Repudiation (Não repúdio):</strong> <strong>Mitigação:</strong> Geração de logs estruturados com proveniência criptográfica rastreável.</li>
                    <li className="academic-li"><strong>Information Disclosure (Vazamento):</strong> <strong>Mitigação:</strong> Isolamento de rede do contêiner db.</li>
                    <li className="academic-li"><strong>Denial of Service (Indisponibilidade):</strong> <strong>Mitigação:</strong> Limites rígidos de CPU/Memória por contêiner e <strong>Fail-Safe Inference Mode</strong>.</li>
                    <li className="academic-li"><strong>Elevation of Privilege:</strong> <strong>Mitigação:</strong> Contêineres não-root e volumes montados em <em>Read-Only</em>.</li>
                  </ul>

                  <h3 className="academic-heading-2">4.2. Controles de Segurança Implementados no Pipeline de Dados e IA</h3>
                  <p className="academic-p">
Para mitigar os riscos cibernéticos que cercam as leituras de sensores físicos do simulador, o backend FastAPI implementa controles estritos de cibersegurança:
                  </p>
                  <ol className="academic-ul" style={{ listStyleType: 'decimal' }}>
                    <li className="academic-li"><strong>Sanitização Pydantic na Ingestão do Wokwi (<code>WokwiTelemetrySanitizer</code>):</strong> Antes de persistir as telemetrias do microcontrolador na tabela <code>wokwi_bairros_telemetria</code>, o backend FastAPI submete as leituras climáticas a um validador de sanidade matemática estruturado no Pydantic. Se os limites de temperatura (-5°C a 55°C) ou umidade (0% a 100%) forem violados por manipulações espúrias dos sliders do Wokwi, a mensagem é imediatamente rejeitada nos blocos try-except com logs de segurança de severidade de alerta gerados no terminal.</li>
                    <li className="academic-li"><strong>SQL Parameterization com psycopg2:</strong> Toda inserção na tabela dedicada de sensores utiliza consultas estritamente parametrizadas com placeholders <code>%s</code> do PostgreSQL, mitigando tentativas de injeção de SQL (SQLi) originadas de tópicos de dados maliciosos.</li>
                  </ol>

                  <h3 className="academic-heading-2">4.3. Mecanismo de Fallback e Resiliência (Fail-Safe Inference Mode)</h3>
                  <p className="academic-p">
O modo Fail-Safe funciona como o coração da disponibilidade. Na ausência de recursos de predição estocásticos (como quando a API de carregamento de tensores ou o objeto <code>.pkl</code> corrompe), o sistema converte graciosamente seu modo de operação, recorrendo a lógicas de alerta determinísticas calibradas para os bairros, contornando a indisponibilidade.
                  </p>
                </div>
              )}

              {tccSection === 'pipeline' && (
                <div>
                  <h2 className="academic-heading-1">5. IMPLEMENTAÇÃO DO PIPELINE DE SEGURANÇA E CI/CD/CT</h2>
                  <h3 className="academic-heading-2">5.1. Versionamento Criptográfico e Reprodutibilidade com DVC</h3>
                  <p className="academic-p">
Diferente do versionamento de código estático feito pelo Git, o STORM-MLSecOps utiliza o <strong>DVC (Data Version Control)</strong> para gerenciar o versionamento de grandes datasets e modelos. O DVC opera acoplado ao Git: enquanto o Git rastreia arquivos pequenos <code>.dvc</code>, o arquivo volumoso é versionado criptograficamente e salvo internamente na VPS HostGator.
                  </p>

                  <h3 className="academic-heading-2">5.2. Integração e Entrega Contínuas Seguras via GitHub Actions e CML</h3>
                  <p className="academic-p">
Para automatizar a conformidade, o STORM-MLSecOps implementa uma esteira de integração contínua (CI) e entrega contínua (CD) usando o <strong>GitHub Actions</strong> associado ao <strong>CML (Continuous Machine Learning)</strong>. O pipeline automatizado realiza verificações de SAST com o <code>bandit</code>, e o CML gera relatórios automáticos de auditoria estatística do modelo preditivo antes do deploy.
                  </p>

                  <h3 className="academic-heading-2">5.3. Painel Prático Dual: Emuladores e Recepção de Dados de Sensores</h3>
                  <p className="academic-p">
O monitoramento operacional em tempo real do ecossistema STORM-MLSecOps v4 é concentrado no redesenhado <strong>Painel Prático</strong> (Dashboard do sistema). A interface foi projetada sob uma arquitetura visualmente segmentada e de alta fidelidade técnica em React, dividindo as funcionalidades em duas frentes de controle complementares:
                  </p>
                  <ol className="academic-ul" style={{ listStyleType: 'decimal' }}>
                    <li className="academic-li"><strong>Área de Emuladores (Wokwi Sandbox):</strong>
                      <p style={{ marginTop: '4px' }}>Uma seção dedicada que exibe o link do simulador físico oficial Wokwi e as diretrizes técnicas para os operadores executarem a emulação de circuito digital do ESP32. Disponibiliza de forma integrada os códigos de hardware (<code>diagram.json.txt</code>), o firmware MicroPython (<code>main.py.txt</code>) e os scripts de driver (<code>esp32_i2c_lcd.py.txt</code>).</p>
                    </li>
                    <li className="academic-li"><strong>Área de Recepção de Dados de Sensores por Bairro:</strong>
                      <p style={{ marginTop: '4px' }}>Um console dinâmico e interativo conectado de forma contínua à API backend FastAPI por meio de canais bidirecionais de WebSockets seguros (<code>wss://</code>). À medida que o ESP32 do Wokwi publica as mensagens de telemetria climática de cada bairro na fila do Mosquitto Broker, o backend processa os dados climáticos, armazena-os na tabela dedicada <code>wokwi_bairros_telemetria</code>, calcula os riscos locais por meio do K-Means e transmite instantaneamente as informações em formato JSON para o painel React.</p>
                    </li>
                  </ol>
                  <p className="academic-p">
Essa arquitetura integrada e dual garante que a comissão examinadora ou os operadores de cibersegurança visualizem perfeitamente todo o ciclo do IoT: desde a alteração manual do sensor físico na plataforma Wokwi até a recepção, validação, persistência segura em banco de dados e classificação visual automatizada por Inteligência Artificial no dashboard de controle.
                  </p>
                </div>
              )}

              {tccSection === 'conclusao' && (
                <div>
                  <h2 className="academic-heading-1">6. CONCLUSÃO E TRABALHOS FUTUROS</h2>
                  <p className="academic-p">
A evolução do projeto STORM original para a versão individual robusta do <strong>STORM-MLSecOps (v4)</strong> comprova empiricamente a viabilidade prática da integração de cibersegurança e MLOps para proteção de sistemas críticos de controle e mitigação de desastres naturais. Através de controles modernos proativos — como higienização lógica na ingestão climática, versionamento reprodutível e criptográfico de datasets com DVC, auditoria analítica estatística com o CML, análise estática de vulnerabilidades e o robusto <strong>Fail-Safe Inference Mode</strong> —, o STORM-MLSecOps eleva sensivelmente a resiliência e integridade operacional.
                  </p>
                  <p className="academic-p">
A implantação gradual e focada revelou-se a abordagem ideal para sistemas reais, permitindo obter excelentes retornos em curto prazo e evitando custos de infraestrutura exagerados antes da consolidação do sistema.
                  </p>
                  <p className="academic-p">
<strong>Trabalhos Futuros:</strong> Propõe-se a implementação de uma Feature Store descentralizada baseada no Feast; Autenticação e Assinatura Digital de Modelos com Sigstore; e a criação de workflows automatizados de <em>Red Teaming</em> executando injeções sistemáticas do tipo <strong>Evasion Attack</strong> com o Adversarial Robustness Toolbox (ART) para validar periodicamente a imunidade lógica do classificador em produção.
                  </p>

                  <h2 className="academic-heading-1" style={{ marginTop: '30px' }}>7. REFERÊNCIAS BIBLIOGRÁFICAS</h2>
                  <ol className="academic-ul" style={{ listStyleType: 'decimal' }}>
                    <li className="academic-li">CARVALHO, Maurício Moraes Preto; PAIVA, Sofia Larissa da Costa. <strong>Práticas de MLOps em softwares reais</strong>. Goiânia: UFG, 2025.</li>
                    <li className="academic-li">CPQD. <strong>Implementação de Sistemas de IA com RAG</strong>. Campinas: CPQD, Projeto INSPIRE, 2026.</li>
                    <li className="academic-li">ERICSSON. <strong>MLSecOps: Protecting the AI/ML Lifecycle in telecom</strong>. Ericsson White Paper, 2024.</li>
                    <li className="academic-li">EVANS, Sarah et al. <strong>Visualizing Secure MLOps (MLSecOps)</strong>. Open Source Security Foundation (OpenSSF) Whitepaper, 2025.</li>
                    <li className="academic-li">GARCIA, Vinicius Cardoso. <strong>Machine Learning Operations (MLOps)</strong>. Recife: Garcia, 2023.</li>
                    <li className="academic-li">HARRISON, Matt. <strong>Machine Learning – Guia de Referência Rápida</strong>. São Paulo: Novatec Editora, 2020.</li>
                    <li className="academic-li">KLEIN, Bernd. <strong>Machine Learning with Python Tutorial</strong>. Bodenseo, 2021.</li>
                    <li className="academic-li">KREUZBERGER, Dominik; KÜHL, Niklas; HIRSCHL, Sebastian. <strong>Machine Learning Operations (MLOps)</strong>. arXiv preprint arXiv:2205.02302v3, 2022.</li>
                    <li className="academic-li">MCKINNEY, Wes. <strong>Python for Data Analysis</strong>. Boston: O'Reilly Media, 2022.</li>
                    <li className="academic-li">MÜLLER, Andreas C.; GUIDO, Sarah. <strong>Introduction to Machine Learning with Python</strong>. Boston: O'Reilly Media, 2017.</li>
                    <li className="academic-li">OLGA, Arthur Quintella de Mello et al. <strong>MLOps - Transformando Teoria em Prática</strong>. São Paulo: Insper, 2021.</li>
                    <li className="academic-li">RUN:AI. <strong>Complete Guide to MLOps</strong>. Run:ai, 2023.</li>
                    <li className="academic-li">SANTANDREA, Alan Souza. <strong>MLOps</strong>: introdução ao tema e estudo de caso. Ouro Preto: UFOP, 2022.</li>
                    <li className="academic-li">SPOLAOR, Max et al. <strong>Machine Learning Security Operations (MLSecOps)</strong>. Space-ISAC White Paper, 2023.</li>
                    <li className="academic-li">VENIGALLA, Krishna Chaitanya. <strong>MLSecOps</strong>: A Comprehensive Framework for Secure Machine Learning Operations. Journal of Information Systems Engineering and Management, 2026.</li>
                  </ol>
                </div>
              )}

            </main>
          </div>
        )}

        {/* 1. PAINEL PRÁTICO (Simulador / TCC com presets) */}
        {view === 'dashboard' && (
          <div className="dashboard-grid">
            
            {/* Sidebar Area: Simulator controls and Log Console */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Control Panel Card */}
              <div className={`glass-panel ${isStorming ? 'neon-border-red' : 'neon-border-purple'}`}>
                <h3 style={{ marginBottom: '16px', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} style={{ color: '#a855f7' }} />
                  CONTROLE DO SIMULADOR CLIMÁTICO
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#a0aec0', marginBottom: '20px' }}>
                  Simule diferentes intensidades de clima na nuvem para treinar e disparar os alertas visuais da IA:
                </p>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <button 
                    className={`control-btn ${preset === 'dry' ? 'control-btn-active btn-dry' : ''}`}
                    onClick={() => changePreset('dry')}
                  >
                    ☀️ Dia Limpo / Seco
                  </button>
                  <button 
                    className={`control-btn ${preset === 'moderate' ? 'control-btn-active btn-moderate' : ''}`}
                    onClick={() => changePreset('moderate')}
                  >
                    🌧️ Chuva Moderada
                  </button>
                  <button 
                    className={`control-btn ${preset === 'storm' ? 'control-btn-active btn-storm' : ''}`}
                    onClick={() => changePreset('storm')}
                  >
                    ⚡ Tempestade Extrema
                  </button>
                </div>
                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <a 
                    href="https://github.com/jorgyvanlima/storm-mlsecops"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="control-btn btn-github"
                    style={{ textDecoration: 'none' }}
                  >
                    <Github size={16} />
                    <span>Código Fonte no GitHub</span>
                    <ExternalLink size={14} style={{ opacity: 0.6, marginLeft: 'auto' }} />
                  </a>
                </div>
              </div>

              {/* Live Terminal Log Card */}
              <div className="glass-panel" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ marginBottom: '12px', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RefreshCw size={16} className={isConnected ? 'animate-spin' : ''} style={{ color: '#06b6d4' }} />
                  CONSOLE DE EVENTOS (PIPELINE)
                </h3>
                <div className="terminal-view" style={{ flexGrow: 1 }}>
                  {logs.length === 0 ? (
                    <div style={{ color: '#718096', fontStyle: 'italic' }}>Aguardando pacotes de dados...</div>
                  ) : (
                    logs.map((log, idx) => (
                      <div key={idx} className={`terminal-line ${getLogClass(log.type)}`}>
                        {log.text}
                      </div>
                    ))
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            </aside>

            {/* Main Dashboard: Weather Stats & Neighborhood warning cards */}
            <main className="main-content">
              
              {/* Weather Gauges Grid */}
              <div className="stats-grid">
                
                {/* Temp Gauge */}
                <div className="glass-panel glass-panel-hover telemetry-card">
                  <div className="icon-wrapper icon-temp">
                    <Thermometer size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#a0aec0', textTransform: 'uppercase' }}>Temperatura</div>
                    <div className="widget-value">{telemetry ? `${telemetry.temperature}°C` : '--'}</div>
                  </div>
                </div>

                {/* Humidity Gauge */}
                <div className="glass-panel glass-panel-hover telemetry-card">
                  <div className="icon-wrapper icon-humidity">
                    <Droplets size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#a0aec0', textTransform: 'uppercase' }}>Umidade</div>
                    <div className="widget-value">{telemetry ? `${telemetry.humidity}%` : '--'}</div>
                  </div>
                </div>

                {/* Precipitation Gauge */}
                <div className="glass-panel glass-panel-hover telemetry-card">
                  <div className="icon-wrapper icon-precip">
                    <CloudRain size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#a0aec0', textTransform: 'uppercase' }}>Precipitação</div>
                    <div className="widget-value">{telemetry ? `${telemetry.precipitation} mm` : '--'}</div>
                  </div>
                </div>

                {/* Pressure Gauge */}
                <div className="glass-panel glass-panel-hover telemetry-card">
                  <div className="icon-wrapper icon-pressure">
                    <Gauge size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#a0aec0', textTransform: 'uppercase' }}>Pressão</div>
                    <div className="widget-value">{telemetry ? `${telemetry.pressure} hPa` : '--'}</div>
                  </div>
                </div>

              </div>

              {/* Neighborhood Flood Hazards Grid */}
              <div className="glass-panel" style={{ flexGrow: 1 }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <AlertTriangle size={20} style={{ color: isStorming ? '#ef4444' : '#fbbf24' }} />
                  MAPA DE RISCO DE ALAGAMENTO (BAIRROS DE BELÉM)
                </h2>

                <div className="neighborhoods-grid">
                  {telemetry && telemetry.neighborhoods_status ? (
                    Object.entries(telemetry.neighborhoods_status).map(([name, statusObj]) => {
                      const isCrit = statusObj.status === 'Alagamento Iminente';
                      const isAtt = statusObj.status === 'Atenção';
                      
                      let fillPercent = Math.min(100, (statusObj.water_level / 1.0) * 100);
                      if (statusObj.status === 'Sem Risco' && fillPercent === 0) fillPercent = 5;

                      return (
                        <div 
                          key={name} 
                          className={`glass-panel neighborhood-card ${isCrit ? 'neon-border-red' : ''}`}
                          style={{
                            border: isCrit ? '1px solid rgba(239,68,68,0.4)' : (isAtt ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.05)')
                          }}
                        >
                          <div 
                            className={`water-wave ${isCrit ? 'water-wave-active' : ''}`}
                            style={{ 
                              height: `${fillPercent}%`,
                              background: isCrit 
                                ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.25) 0%, rgba(239, 68, 68, 0.45) 100%)' 
                                : (isAtt 
                                    ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.45) 100%)' 
                                    : 'linear-gradient(180deg, rgba(6, 182, 212, 0.15) 0%, rgba(6, 182, 212, 0.35) 100%)'),
                              borderTopColor: isCrit ? '#ef4444' : (isAtt ? '#f59e0b' : '#06b6d4')
                            }} 
                          />

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                            <div>
                              <h4 style={{ fontSize: '1.05rem', fontWeight: 'bold' }}>{name}</h4>
                              <p style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '2px' }}>
                                Altitude: {statusObj.elevation}m
                              </p>
                            </div>
                            <span style={{ fontSize: '1.2rem' }}>
                              {isCrit ? '🚨' : (isAtt ? '⚠️' : '🟢')}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', marginTop: 'auto' }}>
                            <div>
                              <div style={{ fontSize: '0.75rem', color: '#a0aec0', textTransform: 'uppercase' }}>Acúmulo</div>
                              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', fontFamily: 'Orbitron' }}>
                                {statusObj.water_level}m
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '0.75rem', color: '#a0aec0', textTransform: 'uppercase' }}>Probabilidade</div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: isCrit ? '#ef4444' : (isAtt ? '#f59e0b' : '#10b981') }}>
                                {statusObj.probability}%
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#718096', fontStyle: 'italic' }}>
                      Aguardando telemetria inicial...
                    </div>
                  )}
                </div>
              </div>

            </main>
            
          </div>
        )}

        {/* 2. NOVO: PAINEL SENSORES (Telemetria Wokwi em Tempo Real de Projeto em Produção) */}
        {view === 'sensores' && (
          <div className="main-content" style={{ gap: '24px' }}>
            
            {/* Banner de Integração Wokwi */}
            <div className="glass-panel" style={{ border: '1px solid rgba(6, 182, 212, 0.4)', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(124, 58, 237, 0.1) 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Radio size={24} style={{ color: '#06b6d4' }} className="animate-pulse" />
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#38bdf8' }}>
                      PAINEL SENSORES: TELEMETRIA WOKWI EM PRODUÇÃO
                    </h2>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '6px', maxWidth: '850px', lineHeight: '1.5' }}>
                    Este painel exibe <strong>exclusivamente as emissões reais recebidas dos sensores físicos/emulados ESP32</strong> do projeto Wokwi ativo em produção (<a href="https://wokwi.com/projects/467174921171535873" target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'underline' }}>projetos/467174921171535873</a>). Cada leitura é higienizada contra Data Poisoning (ML02) e gravada na tabela dedicada <code>wokwi_bairros_telemetria</code> no PostgreSQL.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <a 
                    href="https://wokwi.com/projects/467174921171535873"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="control-btn"
                    style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', color: '#fff', border: 'none', fontWeight: 'bold', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <span>Abrir Projeto Wokwi</span>
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            </div>

            {/* Grid dos 6 Bairros de Belém - Leituras dos Sensores Wokwi */}
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#06b6d4' }}>
                  <Server size={20} style={{ color: '#06b6d4' }} />
                  LEITURAS EM TEMPO REAL DOS SENSORES DHT22 POR BAIRRO (BELÉM-PA)
                </h3>
                <span style={{ fontSize: '0.8rem', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', padding: '4px 12px', borderRadius: '12px', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                  Banco de Dados: wokwi_bairros_telemetria
                </span>
              </div>

              <div className="neighborhoods-grid">
                {Object.entries(wokwiSensors).map(([bairroName, data]) => {
                  const temp = data.temperature;
                  const hum = data.humidity;
                  const isCrit = data.risk_level === 'Alto' || hum >= 88.0 || temp >= 35.0;
                  const isAtt = data.risk_level === 'Moderado' || hum >= 75.0;

                  return (
                    <div 
                      key={bairroName}
                      className={`glass-panel neighborhood-card ${isCrit ? 'neon-border-red' : ''}`}
                      style={{
                        border: isCrit ? '1px solid rgba(239,68,68,0.6)' : (isAtt ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(6,182,212,0.3)'),
                        background: isCrit ? 'rgba(239, 68, 68, 0.08)' : (isAtt ? 'rgba(245, 158, 11, 0.05)' : 'rgba(13, 15, 30, 0.65)'),
                        height: 'auto',
                        padding: '18px'
                      }}
                    >
                      {/* Status Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                        <div>
                          <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: isCrit ? '#fca5a5' : '#fff' }}>
                            {bairroName}
                          </h4>
                          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                            Sensor DHT22 (Wokwi ESP32)
                          </p>
                        </div>
                        <span style={{ fontSize: '1.4rem' }}>
                          {isCrit ? '⚡🚨' : (isAtt ? '⚠️' : '🟢')}
                        </span>
                      </div>

                      {/* Temp & Humidity Display */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '16px 0' }}>
                        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Temperatura</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '2px' }}>{temp}°C</div>
                        </div>
                        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Umidade Ar</div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#34d399', marginTop: '2px' }}>{hum}%</div>
                        </div>
                      </div>

                      {/* Footer Status */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                          Risco Preditivo: <strong style={{ color: isCrit ? '#ef4444' : (isAtt ? '#f59e0b' : '#10b981') }}>{data.risk_level || 'Baixo'}</strong>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {data.captured_at ? String(data.captured_at).substring(11, 19) : 'Ao vivo'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Testador Interativo de Ingestão e Tabela de Histórico Wokwi */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
              
              {/* Emissor de Teste Interativo Wokwi */}
              <div className="glass-panel" style={{ borderColor: 'rgba(6, 182, 212, 0.3)' }}>
                <h3 style={{ marginBottom: '14px', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#06b6d4' }}>
                  <Radio size={18} />
                  TESTADOR INTERATIVO DE INGESTÃO WOKWI (VALIDE BLOQUEIOS DE DATA POISONING ML02)
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '16px' }}>
                  Dispare leituras manuais para os bairros ou teste valores fora dos limites autorizados (-5°C a 55°C / 0% a 100%) para verificar o bloqueio do <strong>Sanitizador Pydantic</strong>:
                </p>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Bairro:</label>
                    <select 
                      value={selectedBairro}
                      onChange={(e) => setSelectedBairro(e.target.value)}
                      style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: '8px', marginTop: '4px', fontSize: '0.85rem', minWidth: '160px' }}
                    >
                      <option value="Marco">Marco (4.2m)</option>
                      <option value="Umarizal">Umarizal (2.2m)</option>
                      <option value="Doca">Doca de Souza Franco (1.2m)</option>
                      <option value="Jurunas">Jurunas (1.8m)</option>
                      <option value="Batista Campos">Batista Campos (3.5m)</option>
                      <option value="Cidade Velha">Cidade Velha (1.5m)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Temperatura (°C):</label>
                    <input 
                      type="number" 
                      value={wokwiTemp} 
                      onChange={(e) => setWokwiTemp(e.target.value)}
                      style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: '8px', marginTop: '4px', fontSize: '0.85rem', width: '120px' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Umidade (%):</label>
                    <input 
                      type="number" 
                      value={wokwiHum} 
                      onChange={(e) => setWokwiHum(e.target.value)}
                      style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', borderRadius: '8px', marginTop: '4px', fontSize: '0.85rem', width: '120px' }}
                    />
                  </div>

                  <button 
                    onClick={() => sendWokwiTelemetry(selectedBairro, wokwiTemp, wokwiHum)}
                    className="control-btn"
                    style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', color: '#fff', border: 'none', fontWeight: 'bold', padding: '9px 18px' }}
                  >
                    ⚡ Disparar Telemetria Wokwi
                  </button>
                </div>

                {wokwiStatusMsg && (
                  <div style={{ fontSize: '0.8rem', marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: wokwiStatusMsg.includes('BLOQUEIO') || wokwiStatusMsg.includes('Erro') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', border: wokwiStatusMsg.includes('BLOQUEIO') || wokwiStatusMsg.includes('Erro') ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)', color: wokwiStatusMsg.includes('BLOQUEIO') || wokwiStatusMsg.includes('Erro') ? '#fca5a5' : '#6ee7b7' }}>
                    {wokwiStatusMsg}
                  </div>
                )}
              </div>

              {/* Tabela de Histórico PostgreSQL: wokwi_bairros_telemetria */}
              <div className="glass-panel">
                <h3 style={{ marginBottom: '14px', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: '#a855f7' }}>
                  <Database size={18} />
                  HISTÓRICO RECENTE DE INGESTÃO (POSTGRESQL - TABELA WOKWI_BAIRROS_TELEMETRIA)
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', textAlign: 'left', fontSize: '0.85rem', color: '#cbd5e1', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'rgba(15, 23, 42, 0.8)', color: '#06b6d4', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                        <th style={{ padding: '10px 12px' }}>ID</th>
                        <th style={{ padding: '10px 12px' }}>Bairro</th>
                        <th style={{ padding: '10px 12px' }}>Temp (°C)</th>
                        <th style={{ padding: '10px 12px' }}>Umidade (%)</th>
                        <th style={{ padding: '10px 12px' }}>Risco Calculado</th>
                        <th style={{ padding: '10px 12px' }}>Origem</th>
                        <th style={{ padding: '10px 12px' }}>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wokwiHistory.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>
                            Nenhum registro de telemetria Wokwi capturado ainda.
                          </td>
                        </tr>
                      ) : (
                        wokwiHistory.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>#{item.id || idx + 1}</td>
                            <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{item.bairro}</td>
                            <td style={{ padding: '10px 12px', color: '#38bdf8' }}>{item.temperature}°C</td>
                            <td style={{ padding: '10px 12px', color: '#34d399' }}>{item.humidity}%</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold', background: item.risk_level === 'Alto' ? 'rgba(239,68,68,0.2)' : (item.risk_level === 'Moderado' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'), color: item.risk_level === 'Alto' ? '#ef4444' : (item.risk_level === 'Moderado' ? '#f59e0b' : '#10b981') }}>
                                {item.risk_level}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '0.75rem' }}>{item.enviado_por || item.source || 'Wokwi ESP32'}</td>
                            <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.75rem' }}>{item.captured_at ? String(item.captured_at).replace('T', ' ').substring(0, 19) : '--'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Footer */}
        <footer style={{ marginTop: '48px', padding: '24px 0', textAlign: 'center', fontSize: '0.8rem', color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div>STORM-MLSecOps • Framework de Cibersegurança Integrada baseada em Agrupamento KMeans (sklearn)</div>
          <div style={{ marginTop: '4px' }}>Trabalho de Conclusão de Curso (TCC) • Universidade Federal do Pará (UFPA)</div>
        </footer>

      </div>
    </>
  );
}

export default App;
