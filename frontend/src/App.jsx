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
  ExternalLink
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
      // In production, Vite is served by Nginx on port 8080, and proxies to backend
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
            
            // Format dynamic logs for UI console based on telemetry contents
            const t = payload.data;
            addLogItem("LOG-IOT", `IoT Telemetria Recebida: Temp=${t.temperature}°C, Umid=${t.humidity}%, Chuva=${t.precipitation}mm, Pressão=${t.pressure}hPa`);
            addLogItem("LOG-DB", `Banco de Dados: Registro climático salvo em PostgreSQL.`);
            addLogItem("LOG-IA", `Inteligência Artificial: KMeans predisse nível climático: ${t.risk_level.toUpperCase()}`);
            
            // Check if any neighborhood is flooding
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

    // Fetch initial HTTP logs and history
    const fetchInitData = async () => {
      try {
        const resHistory = await fetch('/api/telemetry');
        if (resHistory.ok) {
          const dataHistory = await resHistory.json();
          setHistory(dataHistory);
          if (dataHistory.length > 0 && !telemetry) {
            setTelemetry(dataHistory[0]);
          }
        }
        
        const resLogs = await fetch('/api/logs');
        if (resLogs.ok) {
          const dataLogs = await resLogs.json();
          // Map backend strings to console format
          const formatted = dataLogs.map(line => {
            let type = "LOG-INFO";
            if (line.includes("Prediction") || line.includes("Predição")) type = "LOG-IA";
            if (line.includes("Stored") || line.includes("PostgreSQL")) type = "LOG-DB";
            if (line.includes("MQTT Message") || line.includes("MQTT")) type = "LOG-IOT";
            if (line.includes("WARNING") || line.includes("ALERT") || line.includes("Erro")) type = "LOG-ALERT";
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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Toggle View Button */}
            {view === 'tcc' ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setView('dashboard')} 
                  className="btn-launch-dashboard"
                >
                  <span>Acessar Painel Prático</span>
                  <ArrowRight size={18} />
                </button>
                <a 
                  href="/realtime.html" 
                  className="btn-launch-real"
                >
                  <span>Acessar Painel Real</span>
                  <ArrowRight size={18} />
                </a>
              </div>
            ) : (
              <>
                <a 
                  href="https://github.com/jorgyvanlima/storm-mlsecops"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="control-btn btn-github"
                  style={{ width: 'auto', padding: '10px 20px', textDecoration: 'none' }}
                >
                  <Github size={16} />
                  <span>GitHub</span>
                </a>
                <button 
                  onClick={() => setView('tcc')} 
                  className="control-btn"
                  style={{ width: 'auto', padding: '10px 20px', background: 'rgba(168, 85, 247, 0.15)', borderColor: 'rgba(168, 85, 247, 0.4)', color: '#fff' }}
                >
                  <BookOpen size={16} />
                  <span>Voltar para o TCC</span>
                </button>
              </>
            )}

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

        {/* Chaveamento de Visualização: TCC ou Dashboard */}
        {view === 'tcc' ? (
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
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px', lineHeight: '1.4' }}>
                  Clique no botão superior ou utilize o preset do simulador para testar a IA de detecção de alagamento em tempo real.
                </p>
              </div>
            </aside>

            {/* Painel de Conteúdo de Leitura do TCC */}
            <main className="tcc-content-pane">

              {tccSection === 'resumo' && (
                <div>
                  <h2 className="academic-title">STORM-MLSecOps: Framework de Segurança de Ponta a Ponta para Sistemas Inteligentes de Telemetria Climática e Alerta de Alagamento em Belém-PA (v3 - Edição Ampliada e Segura)</h2>
                  
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
O aumento exponencial no volume de dados climáticos gerados por dispositivos de Internet das Coisas (IoT) tem impulsionado a adoção de modelos de Aprendizado de Máquina (Machine Learning - ML) para predição e mitigação de desastres socioambientais, tais como alagamentos urbanos [819]. No entanto, a incorporação de inteligência artificial em sistemas de controle crítico expande significativamente a superfície de ataque, introduzindo vulnerabilidades específicas como envenenamento de dados (*data poisoning*), manipulação adversarial na inferência e ataques à cadeia de suprimentos de software [819, 862]. Este trabalho apresenta o <strong>STORM-MLSecOps (v3)</strong>, uma evolução profunda e individual do sistema STORM original (anteriormente projetado em grupo) para um ecossistema *hardened* baseado nos princípios de <strong>MLSecOps</strong> (Machine Learning Security Operations) [820, 850]. O sistema está estruturado em torno de <strong>dois modelos de estudo de caso complementares</strong>: um modelo simulado de telemetria climática que utiliza o algoritmo não supervisionado *K-Means* do *scikit-learn* para classificação de riscos de alagamento por bairros históricos de Belém-PA (Doca de Souza Franco, Cidade Velha, Jurunas, Umarizal, Batista Campos e Marco) [820, 840]; e um modelo prático real baseado na captura contínua e persistência de telemetria climática em tempo real para seis cidades do estado do Pará (Castanhal, Bragança, Salinas, Belém, Marabá e Parauapebas) via API segura (HTTPS) do OpenWeatherMap com persistência parametrizada em PostgreSQL [820, 841]. O framework de segurança foi desenhado com base em diretrizes internacionais do OWASP ML Security Top 10, OpenSSF e NIST AI Risk Management Framework, implementando validação de dados em múltiplas etapas via validadores *Pydantic*, versionamento criptográfico reprodutível de código, dados e modelos com DVC (*Data Version Control*) acoplado à VPS HostGator, automação de CI/CD via GitHub Actions e CML (*Continuous Machine Learning*), e um modo automático de contingência (*Fail-Safe Inference Mode*) para garantir a resiliência operacional do sistema sob falha catastrófica ou corrupção do modelo de IA [821, 824]. Os resultados analíticos demonstram que a aplicação sistemática de MLSecOps ao projeto STORM neutraliza vetores comuns de envenenamento e injeção adversarial na inferência, reduzindo drasticamente o tempo médio de detecção de ameaças e garantindo a integridade operacional exigida para um sistema de alerta de segurança integrada [281, 821].
                  </p>
                  <p className="academic-p">
                    <strong>Palavras-chave:</strong> Cibersegurança, MLSecOps, MLOps, Telemetria Climática, K-Means, Belém-PA, Docker.
                  </p>

                  <h3 className="academic-heading-1">ABSTRACT</h3>
                  <p className="academic-p" style={{ fontStyle: 'italic' }}>
The exponential growth of climate data generated by Internet of Things (IoT) devices has driven the adoption of Machine Learning (ML) models to predict and mitigate socio-environmental disasters, such as urban flooding [822]. However, integrating artificial intelligence into critical control systems expands the attack surface, introducing machine learning-specific vulnerabilities such as data poisoning, adversarial manipulation, and software supply chain attacks [822]. This work presents <strong>STORM-MLSecOps (v3)</strong>, an individual and highly secured evolution of the original STORM system (previously developed as a collaborative group project) into an autonomous, hardened ecosystem based on the principles of <strong>MLSecOps</strong> (Machine Learning Security Operations) [823, 851]. The system is structured around <strong>two complementary case studies</strong>: a simulated model using telemetric climate inputs to classify global flooding risks across historical neighborhoods of Belém-PA (Doca, Cidade Velha, Jurunas, Umarizal, Batista Campos, and Marco) utilizing the <em>scikit-learn K-Means</em> clustering algorithm [823, 840]; and a practical real-time model capturing active climate telemetry for six major cities in Pará (Castanhal, Bragança, Salinas, Belém, Marabá, and Parauapebas) via OpenWeatherMap secure HTTPS API with robust PostgreSQL persistence [823, 841]. The security framework is designed based on international guidelines from the OWASP ML Security Top 10, OpenSSF, and the NIST AI Risk Management Framework [824]. It implements multi-stage data validation (<em>Pydantic Sanitizers</em>), reproducible version control of datasets and models using DVC connected to VPS HostGator, automated CI/CD pipelines via GitHub Actions and CML, and an automatic contingency mode (<em>Fail-Safe Inference Mode</em>) to guarantee system resilience and high availability even under catastrophic model failure or corruption [824]. The analytical results demonstrate that applying MLSecOps to the original STORM project effectively neutralizes common vectors of data poisoning and adversarial injection in inference, ensuring the operational integrity required for an integrated security alert system [824].
                  </p>
                  <p className="academic-p">
                    <strong>Keywords:</strong> Cybersecurity, MLSecOps, MLOps, Climate Telemetry, K-Means, Belém-PA, Docker.
                  </p>
                </div>
              )}

              {tccSection === 'intro' && (
                <div>
                  <h2 className="academic-heading-1">1. INTRODUÇÃO</h2>
                  <h3 className="academic-heading-2">1.1. Contextualização e Justificativa</h3>
                  <p className="academic-p">
A tecnologia da informação e as infraestruturas de dados estão evoluindo de forma exponencial no contexto das cidades inteligentes, gerando volumes colossais de dados de sensores ambientais, residenciais e industriais (Big Data) [826, 853]. A Inteligência Artificial (IA) e o Aprendizado de Máquina (<em>Machine Learning</em> - ML) tornaram-se ferramentas essenciais para extrair conhecimento útil e realizar predições em tempo real [826, 853]. No entanto, à medida que os modelos de ML migram de protótipos experimentais isolados para ambientes de missão crítica em produção, surge a necessidade urgente de garantir sua operacionalização confiável, escalável e segura [826, 853].
                  </p>
                  <p className="academic-p">
Historicamente, o desenvolvimento de software tradicional lidou com silos operacionais por meio da cultura <strong>DevOps</strong>, otimizando o ciclo de vida do software com automação de pipelines de integração e entrega contínua (CI/CD) [827, 854]. Para responder às demandas dinâmicas de dados e de modelos de machine learning, surgiu o <strong>MLOps</strong>, estendendo os conceitos de DevOps para versionar código, dados e modelos, automatizando fluxos experimentais e implantando-os de forma previsível [827, 854]. Contudo, a simples replicação de DevOps e MLOps desconsidera a nova superfície de ataque introduzida pela natureza probabilística e orientada a dados do machine learning, gerando vulnerabilidades silenciosas e indetectáveis por firewalls tradicionais [827, 854].
                  </p>

                  <h3 className="academic-heading-2">1.2. O Problema das Enchentes em Belém-PA e o Projeto STORM Coletivo</h3>
                  <p className="academic-p">
Belém-PA é uma metrópole equatorial caracterizada por índices pluviométricos severos, marés fluviais elevadas e baixas altitudes em áreas consolidadas [571, 820]. Regiões urbanas críticas, como a Avenida Doca de Souza Franco, localizam-se abaixo do nível da maré cheia, sofrendo inundações recorrentes que causam perdas materiais e riscos de vida à população [571, 820].
                  </p>
                  <p className="academic-p">
Para mitigar esses desastres, o projeto original <strong>STORM</strong> foi desenvolvido de forma coletiva por discentes do curso de pós-graduação em Cibersegurança da UFPA [166, 820]. O sistema utiliza um ecossistema 100% conteinerizado em Docker, composto por sensores IoT simulados e reais, um broker MQTT para ingestão de telemetria, um serviço de IA com modelo de agrupamento <em>K-Means</em> treinado de forma isolada, uma API Backend em FastAPI para processamento em tempo real, persistência em banco de dados PostgreSQL, transmissão via WebSockets e um painel visual frontend intuitivo baseado no tema "Tempestade" [166-168, 840]. Contudo, como o foco inicial do projeto coletivo centrou-se na funcionalidade, a segurança lógica e a integridade matemática dos algoritmos de ML ficaram expostas a riscos severos [170, 834].
                  </p>

                  <h3 className="academic-heading-2">1.3. O Desafio de MLSecOps e Objetivos do STORM-MLSecOps</h3>
                  <p className="academic-p">
Ao integrar inteligência artificial a sistemas críticos de alerta socioambiental, os modelos de IA dependem da integridade do fluxo de dados para manter sua precisão preditiva [282]. Se o pipeline de ingestão carece de validação automatizada e as bibliotecas terceiras de ML contêm brechas de segurança, o sistema pode ser severamente corrompido, gerando predições catastróficas ou expondo dados sensíveis [282, 860]. Daí emerge o <strong>MLSecOps</strong> (Machine Learning Security Operations), integrando segurança proativa (<em>"shift-left"</em>) por design e automação de segurança em todas as fases do ciclo de vida da IA [285, 498].
                  </p>
                  <p className="academic-p">
Este TCC apresenta a reformulação individual e evolução do STORM para o repositório <strong>STORM-MLSecOps</strong> (https://github.com/jorgyvanlima/storm-mlsecops), elevando o nível de maturidade do projeto e introduzindo um ecossistema robusto de controles de segurança integrados ao pipeline de dados e IA [828, 856]. O objetivo geral deste trabalho é propor, implementar e avaliar a arquitetura do STORM-MLSecOps, integrando controles modernos de segurança ao ecossistema STORM de telemetria climática do Pará [829, 857]. Os objetivos específicos incluem:
                  </p>
                  <ol className="academic-ul" style={{ listStyleType: 'decimal' }}>
                    <li className="academic-li">Realizar a modelagem de ameaças utilizando o framework STRIDE adaptado para machine learning sobre a arquitetura conteinerizada do STORM [829].</li>
                    <li className="academic-li">Implementar salvaguardas técnicas contra <em>Data Poisoning</em> e <em>Evasion Attacks</em> na telemetria climática [829].</li>
                    <li className="academic-li">Desenvolver e contrapor <strong>dois estudos de caso práticos</strong>: um modelo simulado de agrupamento para bairros de Belém e um modelo real de coleta meteorológica para cidades do Pará (Castanhal, Bragança, Salinas, Belém, Marabá, Parauapebas) via API OpenWeatherMap [829].</li>
                    <li className="academic-li">Consolidar a reprodutibilidade e rastreabilidade por meio de versionamento de código, dados e modelos usando o DVC (<em>Data Version Control</em>) integrado à VPS HostGator [829].</li>
                    <li className="academic-li">Desenvolver e validar o mecanismo automático de fallback <em>Fail-Safe Inference Mode</em> para garantia de alta disponibilidade sob falha sistêmica do modelo preditivo [829].</li>
                  </ol>
                </div>
              )}

              {tccSection === 'referencial' && (
                <div>
                  <h2 className="academic-heading-1">2. REFERENCIAL TEÓRICO DE MLOps, MLSECOPS E SEGURANÇA EM ML</h2>
                  <h3 className="academic-heading-2">2.1. De DevOps para MLOps e a Transição para MLSecOps</h3>
                  <p className="academic-p">
No desenvolvimento tradicional, a fragmentação entre os times de desenvolvimento (Dev) e operações (Ops) acarretava atrasos e ineficiências na colocação de softwares em produção [830, 858]. A cultura <strong>DevOps</strong> resolveu esse problema ao introduzir colaboração ágil, monitoramento e pipelines automatizados de CI/CD, diminuindo o tempo de entrega das releases e elevando a qualidade geral do software [830, 858].
                  </p>
                  <p className="academic-p">
Quando os modelos de machine learning começaram a ser largamente adotados, percebeu-se que a simples aplicação de DevOps era insuficiente [831, 859]. O machine learning introduz o elemento de incerteza e comportamento dinâmico baseado em dados [831, 859]. Enquanto o software tradicional é determinístico (composto por regras de programação explícitas), os sistemas de ML são dinâmicos e probabilísticos, gerando o comportamento por meio de treinamento iterativo sobre grandes bases de dados [831, 859]. Surge então o <strong>MLOps</strong>, agregando novas práticas como orquestração de fluxos complexos baseados em DAGs (Grafos Acíclicos Dirigidos), gerenciamento de <em>Feature Stores</em>, controle de versão de dados e modelos (DVC), monitoramento de desvio de conceitos (<em>concept drift</em>) e retreino contínuo (CT - <em>Continuous Training</em>) [831, 859].
                  </p>
                  <p className="academic-p">
A evolução de MLOps para <strong>MLSecOps</strong> decorre do entendimento de que pipelines de MLOps automatizados herdam vulnerabilidades tradicionais e herdam riscos específicos de ML [832]. O MLSecOps define a segurança como uma responsabilidade compartilhada entre engenheiros de ML, cientistas de dados e analistas de segurança, integrando salvaguardas técnicas desde a concepção do pipeline climático até o monitoramento em produção [832].
                  </p>

                  <h3 className="academic-heading-2">2.2. O Ciclo de Vida do MLSecOps de 9 Fases</h3>
                  <p className="academic-p">
De acordo com os frameworks de referência definidos pela OpenSSF, pela Ericsson e pela Space-ISAC, a segurança da informação não pode ser considerada uma barreira aplicada apenas no final da esteira [832, 861]. O MLSecOps adota a estratégia de <em>shift-left</em>, integrando segurança cibernética ao longo de todas as 9 fases fundamentais do ciclo de vida de dados e modelos [832, 861]:
                  </p>
                  <ol className="academic-ul" style={{ listStyleType: 'decimal' }}>
                    <li className="academic-li"><strong>Planejamento e Design Seguro:</strong> Modelagem de ameaças (STRIDE/ATLAS) e estabelecimento da baseline de conformidade da aplicação de telemetria [833, 861].</li>
                    <li className="academic-li"><strong>Engenharia de Dados Segura:</strong> Controles de proveniência (<em>lineage</em>), limpeza rigorosa dos dados coletados de fontes externas e verificação contra envenenamento (<em>Data Poisoning</em>) [833, 861].</li>
                    <li className="academic-li"><strong>Experimentação:</strong> Execução de pesquisas em ambientes isolados seguros, documentação completa de metadados, seleção de modelos e testes de robustez adversarial [833, 861].</li>
                    <li className="academic-li"><strong>Desenvolvimento e Teste de Pipelines:</strong> Desenvolvimento sob ciclo de vida seguro (SDLC), aplicando testes de integração, SAST (com Bandit para scripts Python), DAST e fuzzing [833, 861].</li>
                    <li className="academic-li"><strong>Integração Contínua (CI):</strong> Builds automatizados e isolados de pacotes com scanners de vulnerabilidades em dependências e verificação de integridade [833, 861].</li>
                    <li className="academic-li"><strong>Entrega e Implantação Contínuas (CD):</strong> Deploy seguro de contêineres e imagens assinadas digitalmente, protegendo pacotes e modelos em trânsito e em repouso [833, 861].</li>
                    <li className="academic-li"><strong>Treinamento Contínuo (CT) Seguro:</strong> Pipeline automatizado de retreino acionado por detecção de drift ou novas coletas de dados, realizando validações criptográficas e de integridade antes do deploy de um modelo retreinado [833, 861].</li>
                    <li className="academic-li"><strong>Serviço de Modelos (Serving):</strong> Hardening de contêineres, controle rigoroso de acesso baseados em privilégios (Least Privilege), validação e sanitização de dados de inferência de tempo real para neutralizar ataques adversariais [833, 861].</li>
                    <li className="academic-li"><strong>Monitoramento Contínuo de Segurança:</strong> Dashboards funcionais exibindo indicadores de desempenho climáticos, desvios estatísticos de predição e alertas automatizados de segurança física e digital [833, 861].</li>
                  </ol>

                  <h3 className="academic-heading-2">2.3. Vetores de Ataque e Ameaças em Sistemas de ML (OWASP e JISEM)</h3>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>ML02: Data Poisoning (Envenenamento de Dados):</strong> Ocorre quando um ator malicioso altera ou introduz dados de treinamento falsificados na fase de ingestão ou engenharia de dados [862]. Em modelos de agrupamento como o <em>K-Means</em> usado no STORM, a inserção de métricas anômalas distorce severamente os centros dos clusters. Ataques direcionados de envenenamento de dados obtiveram sucesso em 73,8% dos casos ao contaminar apenas 3,2% do dataset de treinamento [289, 298].</li>
                    <li className="academic-li"><strong>ML01: Input Manipulation / Evasion Attack (Evasão Adversarial):</strong> Ataque focado na etapa de inferência em tempo real, onde o atacante introduz perturbações estatísticas nos dados de entrada para enganar o modelo, fazendo-o errar a predição [862, 297].</li>
                    <li className="academic-li"><strong>ML06: AI Supply Chain Attack (Ataque à Cadeia de Suprimentos):</strong> Envolve a incorporação de bibliotecas de terceiros corrompidas ou a desserialização de arquivos de modelos <code>.pkl</code> que contenham backdoors lógicos embarcados [862, 281].</li>
                    <li className="academic-li"><strong>ML08: Model Skewing (Distorção de Modelo):</strong> Ataque focado no desvio lento e incremental de limites de classificação em sistemas baseados em retreino automático [503, 504].</li>
                    <li className="academic-li"><strong>ML03: Model Inversion / Membership Inference:</strong> API rate limiting fraco permite que atacantes interroguem recursivamente o modelo até extrair a base de conhecimento [282, 291, 513].</li>
                  </ul>
                  
                  <h3 className="academic-heading-2">2.4. Bibliotecas de Machine Learning e Fundamentos Matemáticos/Lógicos em Python</h3>
                  <p className="academic-p">
O ecossistema Python estabeleceu-se como a linguagem padrão para ciência de dados e machine learning devido à sua robustez e flexibilidade de integração ("Python como cola") [835]. A base teórica apoia-se em conceitos fundamentais do NumPy, Pandas e Scikit-Learn [747, 835, 836].
                  </p>
                </div>
              )}

              {tccSection === 'arquitetura' && (
                <div>
                  <h2 className="academic-heading-1">3. ARQUITETURA DO SISTEMA STORM-MLSecOps E ESTUDOS DE CASO</h2>
                  <h3 className="academic-heading-2">3.1. Visão Geral da Arquitetura Conteinerizada (Docker Compose)</h3>
                  <p className="academic-p">
O STORM-MLSecOps é arquitetado como uma aplicação modular nativa na nuvem, sendo integralmente conteinerizado e implantado via Docker Compose através de seis serviços isolados que se comunicam de forma estrita em redes privadas virtuais [840, 863]:
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>db (Banco de Dados):</strong> Executa o PostgreSQL 15 baseado em Alpine Linux. Isolado de toda a rede externa [863].</li>
                    <li className="academic-li"><strong>broker (Broker MQTT):</strong> Hospeda o Eclipse Mosquitto v2, gerenciando a fila de tópicos de telemetria climática IoT [863].</li>
                    <li className="academic-li"><strong>ai-service (Treinador da IA):</strong> Contêiner efêmero baseado em Python 3.11-slim [863]. Gera dataset sintético, realiza a limpeza, normaliza com <code>StandardScaler</code> e executa o agrupamento <em>K-Means</em> [863].</li>
                    <li className="academic-li"><strong>backend (API de Processamento):</strong> Executa em FastAPI. Carrega os artefatos serializados, conecta-se ao Broker MQTT e ao PostgreSQL [863].</li>
                    <li className="academic-li"><strong>iot-simulator (Simulador IoT):</strong> Script que emula dados contínuos de sensores físicos climáticos a cada 8 segundos [863].</li>
                    <li className="academic-li"><strong>frontend (Dashboard Interativo):</strong> Interface SPA React compilada em Vite com servidor web Nginx e tema escuro "Tempestade" [863].</li>
                  </ul>

                  <h3 className="academic-heading-2">3.2. Estudo de Caso 1: Modelo Climático Simulado por Bairros (K-Means)</h3>
                  <p className="academic-p">
O primeiro estudo de caso consiste na classificação de riscos climáticos por bairros históricos de Belém-PA com base em dados de telemetria climática simulada [820, 840]. O K-Means particiona a distribuição em 3 clusters geométricos: Risco Baixo, Moderado e Alto [840, 863]. Implementam-se validadores estritos de sanidade matemática para impedir que outliers distorçam as fronteiras dos clusters [170, 840].
                  </p>

                  <h3 className="academic-heading-2">3.3. Estudo de Caso 2: Modelo Prático Real-Time de Cidades do Pará (OpenWeather API)</h3>
                  <p className="academic-p">
O segundo modelo consolida o monitoramento real em tempo real das condições atmosféricas de seis cidades: Castanhal, Bragança, Salinas, Belém, Marabá e Parauapebas [841].
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>Captura Ativa via HTTPS:</strong> Chamadas seguras diretas para a API internacional da OpenWeather [841].</li>
                    <li className="academic-li"><strong>Banco de Dados Dedicado e Prevenção SQLi:</strong> Os dados reais são gravados em tabela dedicada através de consultas parametrizadas via <code>psycopg2</code> [176, 841].</li>
                    <li className="academic-li"><strong>Higienização Estrita com Pydantic:</strong> Uso do <code>TelemetrySanitizer</code> para blindar o sistema contra possíveis sequestros lógicos da API de terceiros [841].</li>
                  </ul>
                </div>
              )}

              {tccSection === 'stride' && (
                <div>
                  <h2 className="academic-heading-1">4. MODELAGEM DE AMEAÇAS E CONTROLES DE SEGURANÇA (STRIDE)</h2>
                  <h3 className="academic-heading-2">4.1. Modelagem de Ameaças baseada em STRIDE</h3>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>Spoofing (Identidade):</strong> Sensores climáticos piratas. <em>Mitigação:</em> Autenticação criptográfica no Broker MQTT [842].</li>
                    <li className="academic-li"><strong>Tampering (Adulteração):</strong> Envenenamento do gerador de dados (Data Poisoning). <em>Mitigação:</em> Higienização matemática estrita; hashes no DVC na VPS HostGator [170, 842].</li>
                    <li className="academic-li"><strong>Repudiation (Não repúdio):</strong> <em>Mitigação:</em> Geração de logs estruturados com proveniência criptográfica rastreável [842, 846].</li>
                    <li className="academic-li"><strong>Information Disclosure (Vazamento):</strong> <em>Mitigação:</em> Isolamento de rede do contêiner db [169, 842].</li>
                    <li className="academic-li"><strong>Denial of Service (Indisponibilidade):</strong> <em>Mitigação:</em> Limites rígidos de CPU/Memória por contêiner e <em>Fail-Safe Inference Mode</em> [170, 842].</li>
                    <li className="academic-li"><strong>Elevation of Privilege:</strong> <em>Mitigação:</em> Contêineres não-root e volumes montados em <em>Read-Only</em> [177, 842].</li>
                  </ul>

                  <h3 className="academic-heading-2">4.2. Controles de Segurança Implementados no Pipeline de Dados e IA</h3>
                  <p className="academic-p">
O pipeline integra validadores Pydantic logo no primeiro contato, assegurando que o motor processe apenas distribuições válidas da Amazônia [170]. Consultas parametrizadas eliminam SQLi [176], e os artefatos serializados são protegidos com montagens Read-Only [177].
                  </p>

                  <h3 className="academic-heading-2">4.3. Mecanismo de Fallback e Resiliência (Fail-Safe Inference Mode)</h3>
                  <p className="academic-p">
O modo Fail-Safe funciona como o coração da disponibilidade. Na ausência de recursos de predição estocásticos (como quando a API de carregamento de tensores ou o objeto <code>.pkl</code> corrompe), o sistema converte graciosamente seu modo de operação, recorrendo a lógicas de alerta determinísticas calibradas para os bairros, contornando a indisponibilidade [170, 846].
                  </p>
                </div>
              )}

              {tccSection === 'pipeline' && (
                <div>
                  <h2 className="academic-heading-1">5. IMPLEMENTAÇÃO DO PIPELINE DE SEGURANÇA E CI/CD/CT</h2>
                  <h3 className="academic-heading-2">5.1. Versionamento Criptográfico e Reprodutibilidade com DVC</h3>
                  <p className="academic-p">
Diferente do versionamento de código estático feito pelo Git, o STORM-MLSecOps utiliza o <strong>DVC (Data Version Control)</strong> para gerenciar o versionamento de grandes datasets e modelos [172]. O DVC opera acoplado ao Git: enquanto o Git rastreia arquivos pequenos <code>.dvc</code>, o arquivo volumoso é versionado criptograficamente e salvo internamente na VPS HostGator [173, 598].
                  </p>

                  <h3 className="academic-heading-2">5.2. Integração e Entrega Contínuas Seguras via GitHub Actions e CML</h3>
                  <p className="academic-p">
Para automatizar a conformidade, o STORM-MLSecOps implementa uma esteira de integração contínua (CI) e entrega contínua (CD) usando o <strong>GitHub Actions</strong> associado ao <strong>CML (Continuous Machine Learning)</strong> [869]. O pipeline automatizado realiza verificações de SAST com o <code>bandit</code>, e o CML gera relatórios automáticos de auditoria estatística do modelo preditivo antes do deploy [116, 213, 870].
                  </p>

                  <h3 className="academic-heading-2">5.3. Monitoramento de Drift, Qualidade e Anomalias de Cibersegurança</h3>
                  <p className="academic-p">
O ciclo de vida operacional encerra-se no monitoramento contínuo [311, 433]. O sistema prevê o monitoramento de volumetria de telemetria e o desvio da distribuição das predições do K-Means para identificar anomalias de Concept Drift ou ataques proativos [543, 871].
                  </p>
                </div>
              )}

              {tccSection === 'conclusao' && (
                <div>
                  <h2 className="academic-heading-1">6. CONCLUSÃO E TRABALHOS FUTUROS</h2>
                  <p className="academic-p">
A evolução do projeto STORM original para a versão individual robusta do <strong>STORM-MLSecOps</strong> comprova empiricamente a viabilidade prática da integração de cibersegurança e MLOps para proteção de sistemas críticos de controle e mitigação de desastres naturais [872]. Através de controles modernos proativos — como higienização lógica na ingestão climática [116], versionamento reprodutível e criptográfico de datasets com DVC [116, 173], auditoria analítica estatística com o CML [213], análise estática de vulnerabilidades e o robusto <em>Fail-Safe Inference Mode</em> [116, 561] —, o STORM-MLSecOps eleva sensivelmente a resiliência e integridade operacional [872].
                  </p>
                  <p className="academic-p">
A implantação gradual e focada revelou-se a abordagem ideal para sistemas reais, permitindo obter excelentes retornos em curto prazo e evitando custos de infraestrutura exagerados antes da consolidação do sistema [873].
                  </p>
                  <p className="academic-p">
<strong>Trabalhos Futuros:</strong> Propõe-se a implementação de uma Feature Store descentralizada baseada no Feast [167, 192]; Autenticação e Assinatura Digital de Modelos com Sigstore [551, 559]; e a criação de workflows automatizados de <em>Red Teaming</em> executando injeções sistemáticas do tipo <em>Evasion Attack</em> com o Adversarial Robustness Toolbox (ART) para validar periodicamente a imunidade lógica do classificador em produção [560, 576].
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
        ) : (
          /* Dashboard Grid Layout (Projeto Prático) */
          <div className="dashboard-grid">
            
            {/* Sidebar Area: Simulator controls and Log Console */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Control Panel Card */}
              <div className={`glass-panel ${isStorming ? 'neon-border-red' : 'neon-border-purple'}`}>
                <h3 style={{ marginBottom: '16px', fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={18} style={{ color: '#a855f7' }} />
                  CONTROLE DO SIMULADOR
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
