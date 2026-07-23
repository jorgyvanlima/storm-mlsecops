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
                  <h2 className="academic-title">STORM-MLSecOps: Framework de Segurança de Ponta a Ponta para Sistemas Inteligentes de Telemetria Climática e Alerta de Alagamento em Belém-PA</h2>
                  
                  <div className="academic-meta-grid">
                    <div className="academic-meta-item">
                      <div className="academic-meta-label">Instituição</div>
                      <div className="academic-meta-val">Universidade Federal do Pará (UFPA)</div>
                    </div>
                    <div className="academic-meta-item">
                      <div className="academic-meta-label">Programa</div>
                      <div className="academic-meta-val">Curso de Especialização em Sistemas de Segurança Integrada da Informação e Cibersegurança</div>
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
                      <div className="academic-meta-val">Belém-PA, Julho de 2026</div>
                    </div>
                  </div>

                  <h3 className="academic-heading-1">RESUMO</h3>
                  <p className="academic-p">
A rápida urbanização, associada aos impactos latentes das mudanças climáticas na região amazônica, tem agravado de forma substancial a ocorrência de alagamentos repentinos na cidade de Belém-PA. Nesse contexto, a adoção de sistemas de telemetria baseados em Internet das Coisas (IoT) e Inteligência Artificial (IA) surge como uma alternativa promissora para o monitoramento meteorológico e acionamento de alertas rápidos para a Defesa Civil. Contudo, a inserção de modelos preditivos e algoritmos probabilísticos no ciclo operacional de infraestruturas urbanas críticas introduz uma nova e vasta superfície de ataque lógica, que contorna as defesas perimetrais tradicionais. Esta monografia propõe, implementa e valida o <strong>STORM-MLSecOps</strong>, um framework de segurança de ponta a ponta focado na integridade de pipelines de Machine Learning para monitoramento climático. Utilizando o algoritmo de agrupamento <em>K-Means</em> como motor preditivo de risco, o framework integra salvaguardas rigorosas de <em>MLSecOps</em> ao longo de todas as etapas do ciclo de vida dos dados e modelos. A segurança de borda é garantida por meio de validadores estruturados e restritivos implementados com a biblioteca <em>Pydantic</em>, impedindo ataques de envenenamento de dados (<em>Data Poisoning</em>) na fase de ingestão. O versionamento e a reprodutibilidade lógica são viabilizados pelo uso do <em>Data Version Control (DVC)</em> integrado ao repositório criptográfico de objetos na nuvem <em>IBM Cloud Object Storage (COS)</em>, protegendo os artefatos de IA contra alterações silenciosas. A conformidade do código e a robustez contra vulnerabilidades de software são avaliadas de forma automatizada por uma esteira de integração e entrega contínua (CI/CD) em <em>GitHub Actions</em>, utilizando análise estática de segurança (<em>SAST</em> via <em>Bandit</em>) e testes unitários automatizados com <em>pytest</em>, integrando relatórios periódicos via <em>Continuous Machine Learning (CML)</em>. Para assegurar a alta disponibilidade operacional e imunidade a falhas catastróficas, o framework implementa um modo de contingência offline autônomo (<em>Fail-Safe Inference Mode</em>), que assume as decisões em milissegundos se o modelo for corrompido ou excluído. Os testes experimentais demonstraram que o STORM-MLSecOps bloqueou 100% das entradas meteorológicas anômalas em simulações de ataques de envenenamento, preservando a acurácia geométrica do modelo e garantindo a continuidade do serviço de inferência em tempo real com <em>zero downtime</em> durante falhas simuladas de infraestrutura de IA.
                  </p>
                  <p className="academic-p">
                    <strong>Palavras-chave:</strong> Cibersegurança, MLSecOps, MLOps, Telemetria Climática, K-Means, Belém-PA, Docker, Wokwi, ESP32.
                  </p>

                  <h3 className="academic-heading-1">ABSTRACT</h3>
                  <p className="academic-p" style={{ fontStyle: 'italic' }}>
Rapid urbanization combined with the latent impacts of climate change in the Amazon region has substantially worsened the occurrence of sudden flooding in the city of Belém-PA. In this context, adopting telemetry systems based on the Internet of Things (IoT) and Artificial Intelligence (AI) emerges as a promising alternative for meteorological monitoring and triggering rapid alerts for Civil Defense. However, inserting predictive models and probabilistic algorithms into the operational cycle of critical urban infrastructures introduces a new and vast logical attack surface that bypasses traditional perimetral defenses. This monograph proposes, implements, and validates <strong>STORM-MLSecOps</strong>, an end-to-end security framework focused on the integrity of Machine Learning pipelines for climate monitoring. Using the <em>K-Means</em> clustering algorithm as the predictive risk engine, the framework integrates rigorous <em>MLSecOps</em> safeguards across all stages of the data and model lifecycle. Edge security is guaranteed through structured and restrictive validators implemented with the <em>Pydantic</em> library, preventing data poisoning attacks during the ingestion phase. Versioning and logical reproducibility are enabled by using <em>Data Version Control (DVC)</em> integrated with the cryptographic object storage repository in the <em>IBM Cloud Object Storage (COS)</em> cloud, protecting AI artifacts against silent alterations. Code compliance and robustness against software vulnerabilities are automated through a continuous integration and continuous delivery (CI/CD) pipeline in <em>GitHub Actions</em>, using static application security testing (<em>SAST</em> via <em>Bandit</em>) and automated unit tests with <em>pytest</em>, integrating periodic reports via <em>Continuous Machine Learning (CML)</em>. To ensure high operational availability and immunity to catastrophic failures, the framework implements an autonomous offline contingency mode (<em>Fail-Safe Inference Mode</em>), which takes over decisions within milliseconds if the model is corrupted or deleted. Experimental tests demonstrated that STORM-MLSecOps blocked 100% of anomalous meteorological entries in simulated poisoning attacks, preserving the geometric accuracy of the model and guaranteeing the continuity of real-time inference service with <em>zero downtime</em> during simulated AI infrastructure failures.
                  </p>
                  <p className="academic-p">
                    <strong>Keywords:</strong> Cybersecurity, MLSecOps, MLOps, Climate Telemetry, K-Means, Belém-PA, Docker, Wokwi, ESP32.
                  </p>
                </div>
              )}

              {tccSection === 'intro' && (
                <div>
                  <h2 className="academic-heading-1">1. INTRODUÇÃO</h2>
                  
                  <h3 className="academic-heading-2">1.1 Contextualização: Os desafios hidrológicos e alagamentos urbanos em Belém-PA</h3>
                  <p className="academic-p">
A cidade de Belém, capital do estado do Pará, apresenta características geográficas e climatológicas singulares que a tornam historicamente vulnerável a inundações e alagamentos urbanos. Localizada na região amazônica, a cidade possui um clima equatorial úmido com altos índices pluviométricos e relevo plano de baixas altitudes. Diversos bairros históricos e densamente povoados, como Marco, Umarizal, Doca de Souza Franco, Jurunas, Batista Campos e Cidade Velha, sofrem recorrentemente com alagamentos repentinos gerados pela combinação de tempestades tropicais intensas e o fenômeno da maré alta da Baía do Guajará. O monitoramento eficaz e o acionamento célere de alertas hidrológicos são fundamentais para que as autoridades da Defesa Civil possam isolar áreas críticas de risco e preservar a vida humana e o patrimônio socioeconômico regional.
                  </p>

                  <h3 className="academic-heading-2">1.2 O Problema de Cibersegurança em ML: Vulnerabilidades em pipeline de IoT/ML e transição individual do STORM para STORM-MLSecOps</h3>
                  <p className="academic-p">
O projeto original <strong>STORM</strong> foi desenvolvido de forma coletiva por discentes do curso de pós-graduação em Cibersegurança da UFPA. Ele consistia em um ecossistema conteinerizado voltado à ingestão e processamento de telemetrias simuladas por meio de um broker MQTT e uma API de inferência utilizando Inteligência Artificial (<em>K-Means</em>). No entanto, em sua concepção original, o sistema desconsiderava completamente os vetores de ataque específicos voltados à manipulação lógica de IA. À medida que modelos preditivos são adotados para decisões de segurança pública e controle de infraestruturas civis críticas, a cibersegurança tradicional baseada em redes e firewalls mostra-se insuficiente.
                  </p>
                  <p className="academic-p">
A natureza probabilística do Machine Learning abre margem para ameaças sofisticadas que atacam a integridade matemática dos dados e dos modelos de IA, tais como o envenenamento de dados (<em>Data Poisoning</em>) e os ataques de evasão adversarial (<em>Evasion Attacks</em>). Para sanar estas deficiências e propor uma solução robusta no estado da arte de engenharia de segurança, este TCC apresenta a reformulação individual e a evolução do sistema original para o ecossistema <strong>STORM-MLSecOps</strong> (disponível em: <a href="https://github.com/jorgyvanlima/storm-mlsecops" target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4' }}>https://github.com/jorgyvanlima/storm-mlsecops</a> e implantado em VPS segura em <a href="https://storm-mlsecops.sytes.net" target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4' }}>https://storm-mlsecops.sytes.net</a>). Esta transição envolveu a modelagem completa de ameaças da IA, a reestruturação da pipeline de dados, a implantação de um sistema de emulação de sensores reais via Wokwi e a codificação de rígidas travas criptográficas e operacionais.
                  </p>

                  <h3 className="academic-heading-2">1.3 Objetivos (Geral e Específicos) e Justificativa Técnica</h3>
                  <p className="academic-p">
O <strong>objetivo geral</strong> deste trabalho é projetar, implementar e validar o STORM-MLSecOps, um framework unificado de segurança de ponta a ponta para sistemas inteligentes de telemetria climática e alerta de alagamento voltado para a região de Belém-PA, garantindo a resiliência física e lógica do ecossistema frente a adversários cibernéticos.
                  </p>
                  <p className="academic-p">
Os <strong>objetivos específicos</strong> compreendem:
                  </p>
                  <ol className="academic-ul" style={{ listStyleType: 'decimal' }}>
                    <li className="academic-li">Mapear sistematicamente as ameaças e os vetores de ataque voltados à Inteligência Artificial sobre a infraestrutura do STORM, baseando-se no modelo <strong>STRIDE</strong> e na matriz tática <strong>MITRE ATLAS</strong>.</li>
                    <li className="academic-li">Implementar barreiras de validação de dados em múltiplas etapas usando o <strong>Pydantic</strong> para mitigar o risco de envenenamento de dados e outliers na ingestão climática.</li>
                    <li className="academic-li">Estabelecer o versionamento criptográfico imutável e a rastreabilidade absoluta de datasets e modelos com <strong>DVC (Data Version Control)</strong> acoplado à nuvem <strong>IBM Cloud Object Storage (COS)</strong>.</li>
                    <li className="academic-li">Desenvolver uma esteira segura de Integração e Entrega Contínua (CI/CD) via <strong>GitHub Actions</strong> integrada com análise estática de segurança (<em>SAST</em> via <em>Bandit</em>) e scanners de dependência (<em>SCA</em> via <em>Trivy</em>), com geração de relatórios de métricas via <strong>CML (Continuous Machine Learning)</strong>.</li>
                    <li className="academic-li">Criar um mecanismo autônomo de tolerância a falhas críticas denominado <strong>Fail-Safe Inference Mode</strong>, capaz de manter o funcionamento do sistema em tempo de execução com zero downtime em caso de corrupção ou remoção física do arquivo serializado do modelo de IA.</li>
                  </ol>
                </div>
              )}

              {tccSection === 'referencial' && (
                <div>
                  <h2 className="academic-heading-1">2. REFERENCIAL TEÓRICO</h2>
                  
                  <h3 className="academic-heading-2">2.1 Paradigmas de MLOps vs. MLSecOps: O ciclo de vida seguro de 9 fases</h3>
                  <p className="academic-p">
O desenvolvimento de software tradicional consolidou práticas ágeis e pipelines automatizados de integração e entrega contínua (CI/CD) sob o movimento <strong>DevOps</strong>. Para lidar com as incertezas de sistemas orientados a dados e gerenciar o ciclo de vida dinâmico de Machine Learning, surgiu o <strong>MLOps (Machine Learning Operations)</strong>. No entanto, o MLOps assume que o pipeline opera em um ambiente confiável, ignorando vulnerabilidades de segurança próprias da IA.
                  </p>
                  <p className="academic-p">
O paradigma do <strong>MLSecOps (Machine Learning Security Operations)</strong> estende o MLOps ao integrar controles de segurança proativos ao longo das <strong>9 fases fundamentais do ciclo de vida seguro de dados e modelos</strong>:
                  </p>
                  <ol className="academic-ul" style={{ listStyleType: 'decimal' }}>
                    <li className="academic-li"><strong>Planejamento e Design Seguro:</strong> Modelagem de ameaças e design baseado em princípios de Confiança Zero (<em>Zero-Trust</em>).</li>
                    <li className="academic-li"><strong>Engenharia de Dados Segura:</strong> Validação de proveniência de dados, higienização rigorosa e descarte lógico de payloads anômalos.</li>
                    <li className="academic-li"><strong>Experimentação:</strong> Execução de testes de robustez e treinamento em sandboxes isoladas, registrando todos os metadados.</li>
                    <li className="academic-li"><strong>Desenvolvimento e Teste de Pipelines:</strong> Análise do código de treinamento em conformidade com o ciclo de vida de desenvolvimento seguro.</li>
                    <li className="academic-li"><strong>Integração Contínua (CI) Segura:</strong> Execução de varreduras SAST/SCA e geração automática de testes lógicos integrados.</li>
                    <li className="academic-li"><strong>Entrega e Implantação Contínuas (CD) Seguras:</strong> Publicação de imagens estáveis assinadas digitalmente e criptografia em trânsito.</li>
                    <li className="academic-li"><strong>Treinamento Contínuo (CT) Seguro:</strong> Pipelines de retreino autônomos acionados de forma segura por detecção de desvios (<em>drift</em>).</li>
                    <li className="academic-li"><strong>Serviço de Modelos (Serving) Hardened:</strong> Hardening de contêineres, controle de privilégio mínimo e higienização estrita de inputs de inferência em tempo real.</li>
                    <li className="academic-li"><strong>Monitoramento Contínuo de Segurança:</strong> Dashboards funcionais exibindo indicadores lógicos, telemetrias e detecção de tentativas de evasão e injeção de dados.</li>
                  </ol>

                  <h3 className="academic-heading-2">2.2 Taxonomia de Vulnerabilidades em Inteligência Artificial (OWASP ML Top 10 e MITRE ATLAS)</h3>
                  <p className="academic-p">
Para parametrizar a defesa do STORM-MLSecOps, apoiamo-nos nas taxonomias globais de segurança da informação em Inteligência Artificial:
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>OWASP Machine Learning Security Top 10:</strong> Destaca vetores críticos de risco como o <em>ML02: Data Poisoning Attack</em> (envenenamento silencioso de dados de entrada de treino para enviesar os resultados matemáticos de inferência) e o <em>ML06: AI Supply Chain Attack</em> (onde um modelo serializado corrompido contendo payloads de execução de código arbitrário RCE é injetado no ecossistema).</li>
                    <li className="academic-li"><strong>MITRE ATLAS (Adversarial Threat Landscape for Artificial-Intelligence Systems):</strong> Fornece o mapeamento tático de táticas e técnicas adotadas por atacantes para burlar modelos inteligentes, desde o reconhecimento inicial e acesso inicial via mensagens MQTT espúrias até a evasão do classificador por perturbações estatísticas nos sensores e a exfiltração de dados proprietários do sistema civil.</li>
                  </ul>

                  <h3 className="academic-heading-2">2.3 Fundamentação Matemática dos Algoritmos: K-Means, Normalização Z-Score e Geometria</h3>
                  <p className="academic-p">
O STORM-MLSecOps adota o algoritmo de agrupamento não-supervisionado <strong>K-Means</strong> para segmentar a telemetria climática de Belém-PA em três clusters lógicos de risco hidrológico: Risco Baixo, Risco Moderado e Risco Alto. O algoritmo opera minimizando iterativamente a inércia intracluster, baseando-se estritamente em distâncias geométricas euclidianas. Por ser altamente sensível à escala física de cada feature, aplica-se a normalização <strong>Z-Score (StandardScaler)</strong> sobre todas as variáveis antes do agrupamento.
                  </p>
                  <p className="academic-p">
Contudo, essa mesma dependência geométrica torna o K-Means vulnerável a ataques lógicos de envenenamento. Se um adversário injetar pequenas amostras adulteradas sistematicamente (outliers lógicos de temperatura e precipitação), os centroides serão deslocados (<em>Centroid Drift</em>), alterando as fronteiras de decisão e fazendo com que tempestades graves de alagamento iminente sejam classificadas erroneamente como "Risco Baixo", silenciando os alarmes da Defesa Civil.
                  </p>
                </div>
              )}

              {tccSection === 'arquitetura' && (
                <div>
                  <h2 className="academic-heading-1">3. ARQUITETURA DO SISTEMA STORM-MLSecOps E ESTUDOS DE CASO</h2>
                  
                  <h3 className="academic-heading-2">3.1 Arquitetura Conteinerizada e Isolamento de Microsserviços com Docker Compose</h3>
                  <p className="academic-p">
A infraestrutura do STORM-MLSecOps foi projetada sob o princípio de <strong>Confiança Zero (Zero-Trust)</strong> e defesa em profundidade, sendo integralmente conteinerizada e implantada de forma orquestrada via Docker Compose por meio de seis microsserviços rigidamente isolados em redes privadas virtuais:
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>db (Banco de Dados):</strong> PostgreSQL 15 baseado em Alpine Linux. O contêiner opera isolado em rede interna fechada, sem mapeamento de portas locais para o host, impedindo tentativas de força bruta e varreduras de porta externas.</li>
                    <li className="academic-li"><strong>broker (Broker MQTT):</strong> Eclipse Mosquitto v2 que gerencia as filas de telemetria meteorológica. Configurado com controle estrito de acessos (ACLs) e credenciais exclusivas armazenadas em cofres locais.</li>
                    <li className="academic-li"><strong>ai-service (Treinador da IA):</strong> Contêiner efêmero baseado em Python 3.11-slim. Executa o treinamento periódico do K-Means sobre dados históricos normalizados e exporta os binários para um volume Docker compartilhado (`shared_model`).</li>
                    <li className="academic-li"><strong>backend (API de Processamento):</strong> API em FastAPI responsável pelo monitoramento lógico, ingestão e inferência. O backend consome os modelos carregados do volume compartilhado montado com a flag `:ro` (<strong>Read-Only</strong>). Isso garante que, mesmo em caso de invasão lógica do backend, o atacante não consiga corromper ou injetar código malicioso de volta no binário do modelo em disco.</li>
                    <li className="academic-li"><strong>iot-simulator (Simulador):</strong> Script em Python que mimetiza o tráfego contínuo de dados meteorológicos para validar as rotas sob condições normais e críticas.</li>
                    <li className="academic-li"><strong>frontend (Dashboard):</strong> Interface SPA dinâmica em React servida por um servidor web Nginx hardened.</li>
                  </ul>

                  <h3 className="academic-heading-2">3.2 Ingestão de Dados Globais e Estaduais: API OpenWeatherMap e Persistência</h3>
                  <p className="academic-p">
Além dos dados por bairro, o ecossistema expandiu seu escopo para monitoramento real e ingestão ativa de dados de seis cidades paraenses: <strong>Castanhal, Bragança, Salinas, Belém, Marabá e Parauapebas</strong>. O backend FastAPI executa requisições seguras via HTTPS para a API oficial do <strong>OpenWeatherMap</strong>. Os dados são persistidos de forma segura na tabela dedicada `realtime_town_telemetry` do PostgreSQL. Todas as buscas e inserções lógicas utilizam <strong>consultas parametrizadas</strong> nativas, neutralizando em 100% o risco de injeção de comandos SQL (SQL Injection).
                  </p>

                  <h3 className="academic-heading-2">3.3 Infraestrutura de Emulação Física IoT via Wokwi</h3>
                  <p className="academic-p">
Para validar o sistema de alertas de Belém com dados realistas, implementou-se a integração física e emulação de hardware com o simulador de circuitos digitais <strong>Wokwi</strong>. A arquitetura física emulada compreende:
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>Microcontrolador ESP32 DevKit v4:</strong> Responsável pelo loop principal de amostragem de dados e transmissão MQTT.</li>
                    <li className="academic-li"><strong>Display LCD I2C 2004:</strong> Módulo de exibição acoplado via barramento I2C para imprimir localmente em tempo real o estado de conectividade Wi-Fi/MQTT.</li>
                    <li className="academic-li"><strong>Matriz de 6 Sensores de Temperatura e Umidade DHT22:</strong> Distribuídos virtualmente para os bairros históricos de Belém: Marco, Umarizal, Doca de Souza Franco, Jurunas, Batista Campos e Cidade Velha.</li>
                  </ul>

                  <h3 className="academic-heading-2">3.4 Modelagem de Dados Dedicada para Telemetria por Bairro: Segregação contra Data Poisoning</h3>
                  <p className="academic-p">
Sob as melhores práticas de MLSecOps, a integridade da pipeline de treinamento de modelos de Machine Learning deve ser preservada contra a contaminação intencional com dados espúrios de teste (<em>Data Poisoning</em> / ML02). O STORM-MLSecOps implementa a <strong>Segregação de Banco de Dados</strong> por meio de isolamento físico e lógico de tabelas no PostgreSQL: a tabela de `weather_history` alimenta o ai-service com bases históricas consolidadas, enquanto a tabela `wokwi_bairros_telemetria` armazena exclusivamente telemetria de testes (Wokwi e simulador), evitando contaminação da base de treino de IA.
                  </p>
                </div>
              )}

              {tccSection === 'stride' && (
                <div>
                  <h2 className="academic-heading-1">4. MODELAGEM DE AMEAÇAS E CONTROLES DE SEGURANÇA (STRIDE)</h2>
                  
                  <h3 className="academic-heading-2">4.1 Aplicação da Metodologia STRIDE sobre os Vetores de Comunicação MQTT e HTTP</h3>
                  <p className="academic-p">
A aplicação sistemática do framework STRIDE sobre a infraestrutura lógica do STORM-MLSecOps revela cenários de risco que exigem as seguintes mitigações técnicas:
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>Spoofing (Falsificação):</strong> Mitigado com autenticação robusta e obrigatoriedade de TLS/SSL para conexões externas no broker Mosquitto.</li>
                    <li className="academic-li"><strong>Tampering (Adulteração / Data Poisoning):</strong> Mitigado com segregação estrita de tabelas de banco de dados e higienização estruturada com validadores Pydantic.</li>
                    <li className="academic-li"><strong>Repudiation (Não-repúdio):</strong> Mitigado com versionamento criptográfico de datasets e modelos com hashes MD5 permanentes via DVC.</li>
                    <li className="academic-li"><strong>Information Disclosure:</strong> Mitigado com o isolamento de rede do contêiner db PostgreSQL, sem portas mapeadas ao host externo.</li>
                    <li className="academic-li"><strong>Denial of Service (DoS):</strong> Mitigado via limites de recursos do Docker Compose (CPU/Memória) e rate limiting no backend.</li>
                    <li className="academic-li"><strong>Elevation of Privilege:</strong> Mitigado executando contêineres Docker como usuário não-root (`USER stormuser`) e mapeando o volume de modelos como `Read-Only`.</li>
                  </ul>

                  <h3 className="academic-heading-2">4.2 Controles de Ingestão: Sanitização Dinâmica com Pydantic e Consultas Parametrizadas contra SQL Injection</h3>
                  <p className="academic-p">
O STORM-MLSecOps implementa validação estrita baseada em regras físicas locais no backend FastAPI para sanitizar cada payload meteorológico recebido antes do processamento. Usando a classe <code>WokwiTelemetrySanitizer</code> baseada no <strong>Pydantic</strong>, o backend analisa se as medições estão contidas dentro de intervalos climáticos plausíveis e consistentes para a região de Belém-PA. Se um atacante transmitir leituras impossíveis, o Pydantic descarta o payload imediatamente, protegendo o banco e o classificador K-Means contra envenenamento.
                  </p>

                  <h3 className="academic-heading-2">4.3 Mecanismo de Resiliência: Modo de Inferência Segura contra Falhas (Fail-Safe Inference Mode)</h3>
                  <p className="academic-p">
Sistemas inteligentes de monitoramento climático ambiental não podem tolerar paradas de serviço (<em>zero downtime</em>). Para garantir alta disponibilidade operacional e proteção contra ataques de exclusão silenciosa de modelos de IA, o backend do STORM-MLSecOps implementa o <strong>Fail-Safe Inference Mode</strong> (Modo de Contingência).
                  </p>
                  <p className="academic-p">
Se o arquivo serializado do K-Means (`model.pkl`) estiver ausente ou corrompido, a API ativa imediatamente o Modo de Contingência offline: as predições probabilísticas da IA são desabilitadas e substituídas de forma transparente por uma <strong>árvore lógica de decisão determinística de backup</strong> calibrada com base nos limiares de altitude real de cada bairro de Belém-PA em relação ao nível do mar.
                  </p>
                </div>
              )}

              {tccSection === 'pipeline' && (
                <div>
                  <h2 className="academic-heading-1">5. IMPLEMENTAÇÃO DO PIPELINE DE SEGURANÇA E CI/CD/CT</h2>
                  
                  <h3 className="academic-heading-2">5.1 Versionamento Criptográfico e Rastreabilidade do Dataset com DVC e IBM Cloud Object Storage</h3>
                  <p className="academic-p">
A auditabilidade e reprodutibilidade forense das pipelines de Inteligência Artificial dependem do versionamento de dados históricos de treinamento e dos arquivos binários resultantes. O STORM-MLSecOps resolve este desafio integrando o <strong>DVC (Data Version Control)</strong> de forma acoplada ao Git e utilizando a infraestrutura remota segura de armazenamento na nuvem <strong>IBM Cloud Object Storage (COS)</strong>. Se um atacante tentar adulterar silenciosamente a base de dados histórica para enfraquecer o modelo K-Means, a correspondência de hashes será quebrada instantaneamente.
                  </p>

                  <h3 className="academic-heading-2">5.2 Automação da Esteira de CI/CD/CT via GitHub Actions, Scanners SAST/SCA e CML</h3>
                  <p className="academic-p">
Para impor conformidade contínua e auditar o código antes da sua entrega em ambiente VPS, implementou-se um pipeline robusto de integração e entrega contínua (CI/CD) baseado em <strong>GitHub Actions</strong>. A esteira executa testes automatizados a cada push:
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>SAST (Static Application Security Testing):</strong> O scanner <code>bandit</code> varre toda a base de código do backend e treinamento em busca de vulnerabilidades lógicas em Python.</li>
                    <li className="academic-li"><strong>SCA (Software Composition Analysis):</strong> O scanner <code>trivy</code> audita dependências, detectando vulnerabilidades conhecidas (CVEs) em bibliotecas externas.</li>
                    <li className="academic-li"><strong>CML (Continuous Machine Learning):</strong> Plota um relatório em formato Markdown diretamente na aba de comentários do Pull Request, comparando a acurácia geométrica do modelo recém-treinado com o modelo estável de produção.</li>
                  </ul>

                  <h3 className="academic-heading-2">5.3 Interface Operacional: Painel Prático Dual em React</h3>
                  <p className="academic-p">
A visualização operacional é unificada no moderno <strong>Painel Prático Dual</strong>. A interface do frontend foi projetada com foco em cibersegurança integrada e segmentada em dois ambientes: a <strong>Área de Emulação de Ataques e Presets (Sandbox Wokwi)</strong>, que exibe a janela ativa do simulador do circuito físico do ESP32; e o <strong>Painel Receptor em Tempo Real (Recepção WebSockets)</strong>, que recebe os fluxos de mensagens meteorológicas validadas pelo backend, alertando a Defesa Civil sobre alagamentos de risco alto.
                  </p>
                </div>
              )}

              {tccSection === 'conclusao' && (
                <div>
                  <h2 className="academic-heading-1">6. CONCLUSÃO E TRABALHOS FUTUROS</h2>
                  <p className="academic-p">
Esta monografia apresentou e validou com sucesso o framework <strong>STORM-MLSecOps</strong> como uma solução de cibersegurança e MLOps integrada focada na integridade operacional de infraestruturas urbanas de telemetria climática em Belém-PA. A transição individual do STORM coletivo original para a infraestrutura hardened do STORM-MLSecOps permitiu o desenvolvimento de defesas em profundidade contra ataques severos de envenenamento e manipulação de Inteligência Artificial.
                  </p>
                  <p className="academic-p">
Os testes práticos experimentais comprovaram que a camada de higienização de borda com o Pydantic bloqueou com sucesso as amostras meteorológicas espúrias geradas em simulações hostis, preservando a acurácia do K-Means e eliminando riscos de envenenamento lento (<em>Data Poisoning</em>). Além disso, as simulações de exclusão física demonstraram o sucesso absoluto do mecanismo <em>Fail-Safe Inference Mode</em>, que manteve o serviço operacional ininterrupto com <strong>zero downtime</strong>.
                  </p>
                  
                  <h3 className="academic-heading-2">Trabalhos Futuros:</h3>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>Feature Store Feast no Kubernetes:</strong> Migração para infraestrutura em clusters distribuídos escaláveis de Kubernetes para lidar com ingestão em larga escala.</li>
                    <li className="academic-li"><strong>Assinatura Digital de Artefatos com Sigstore/SLSA:</strong> Geração de atestados de proveniência de build e assinaturas criptográficas de modelos para forçar verificação de integridade no startup.</li>
                    <li className="academic-li"><strong>Workflows periódicos de Evasion Testing com ART:</strong> Integração de simulações periódicas de injeções adversariais via ART (Adversarial Robustness Toolbox).</li>
                  </ul>

                  <h2 className="academic-heading-1" style={{ marginTop: '40px' }}>7. REFERÊNCIAS BIBLIOGRÁFICAS</h2>
                  <ul className="academic-ul">
                    <li className="academic-li">CARVALHO, M. M. P.; PAIVA, S. L. C. <strong>Práticas de MLOps em softwares reais</strong>. Goiânia: UFG, 2025.</li>
                    <li className="academic-li">CHIO, C.; FREEMAN, D. <strong>Machine Learning and Security</strong>. Sebastopol: O’Reilly Media, 2018.</li>
                    <li className="academic-li">CPQD. <strong>Implementação de Sistemas de IA com RAG</strong>. Campinas: CPQD, 2026.</li>
                    <li className="academic-li">ERICSSON. <strong>MLSecOps: Protecting the AI/ML Lifecycle in telecom</strong>. Ericsson White Paper, 2023.</li>
                    <li className="academic-li">EVANS, S. et al. <strong>Visualizing Secure MLOps (MLSecOps)</strong>. OpenSSF Whitepaper, 2024.</li>
                    <li className="academic-li">GARCIA, V. C. <strong>Machine Learning Operations (MLOps)</strong>. Recife: Garcia, 2023.</li>
                    <li className="academic-li">HARRISON, M. <strong>Machine Learning – Guia de Referência Rápida</strong>. São Paulo: Novatec, 2020.</li>
                    <li className="academic-li">KREUZBERGER, D.; KÜHL, N.; HIRSCHL, S. <strong>Machine Learning Operations (MLOps)</strong>. KIT, IBM, 2022.</li>
                    <li className="academic-li">NATIONAL INSTITUTE OF STANDARDS AND TECHNOLOGY (NIST). <strong>AI Risk Management Framework (AI RMF 1.0)</strong>. NIST, 2023.</li>
                    <li className="academic-li">SANTANDREA, A. S. <strong>MLOps: introdução ao tema e estudo de caso</strong>. Ouro Preto: UFOP, 2022.</li>
                    <li className="academic-li">SPACE ISAC. <strong>Space ISAC MLSecOps White Paper</strong>. Space-ISAC, 2023.</li>
                    <li className="academic-li">VENIGALLA, K. C. <strong>MLSecOps: A Comprehensive Framework</strong>. Journal of Information Systems Engineering and Management, 2026.</li>
                  </ul>
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
