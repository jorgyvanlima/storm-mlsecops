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
  LogOut
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
      {/* Background lightning simulation layer */}
      <div className={`lightning-bg ${isStorming ? 'lightning-storm-active' : ''}`} />
      
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
              <button 
                onClick={() => setView('dashboard')} 
                className="btn-launch-dashboard"
              >
                <span>Acessar Painel Prático</span>
                <ArrowRight size={18} />
              </button>
            ) : (
              <button 
                onClick={() => setView('tcc')} 
                className="control-btn"
                style={{ width: 'auto', padding: '10px 20px', background: 'rgba(168, 85, 247, 0.15)', borderColor: 'rgba(168, 85, 247, 0.4)', color: '#fff' }}
              >
                <BookOpen size={16} />
                <span>Voltar para o TCC</span>
              </button>
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
                  <h2 className="academic-title">STORM-MLSecOps: Framework de Segurança de Ponta a Ponta para Sistemas Inteligentes de Telemetria Climática e Alerta de Alagamento em Belém-PA</h2>
                  
                  <div className="academic-meta-grid">
                    <div className="academic-meta-item">
                      <div className="academic-meta-label">Instituição</div>
                      <div className="academic-meta-val">Universidade Federal do Pará (UFPA)</div>
                    </div>
                    <div className="academic-meta-item">
                      <div className="academic-meta-label">Programa</div>
                      <div className="academic-meta-val">Especialização em Segurança da Informação e Cibersegurança</div>
                    </div>
                    <div className="academic-meta-item">
                      <div className="academic-meta-label">Autor</div>
                      <div className="academic-meta-val">Jorgyvan Braga Lima</div>
                    </div>
                    <div className="academic-meta-item">
                      <div className="academic-meta-label">Data de Defesa</div>
                      <div className="academic-meta-val">Julho de 2026</div>
                    </div>
                  </div>

                  <h3 className="academic-heading-1">Resumo</h3>
                  <p className="academic-p">
                    O aumento exponencial no volume de dados climáticos gerados por dispositivos de Internet das Coisas (IoT) tem impulsionado a adoção de modelos de Aprendizado de Máquina (Machine Learning - ML) para predição e mitigação de desastres socioambientais, tais como alagamentos urbanos. No entanto, a incorporação de inteligência artificial em sistemas de controle crítico expande a superfície de ataque, introduzindo vulnerabilidades específicas como envenenamento de dados (data poisoning), manipulação adversarial e ataques à cadeia de suprimentos de software.
                  </p>
                  <p className="academic-p">
                    Este trabalho apresenta o <strong>STORM-MLSecOps</strong>, uma evolução do sistema STORM original para um ecossistema individual e altamente seguro baseado nos princípios de <strong>MLSecOps</strong> (Machine Learning Security Operations). O STORM-MLSecOps é uma solução 100% conteinerizada voltada para a telemetria climática em tempo real no município de Belém-PA, utilizando um modelo de agrupamento <em>K-Means</em> para classificação de riscos de alagamento por bairros (Doca de Souza Franco, Cidade Velha, Jurunas, Umarizal, Batista Campos e Marco).
                  </p>
                  <p className="academic-p">
                    O framework de segurança foi desenhado com base em diretrizes internacionais do OWASP ML Security Top 10, OpenSSF (Open Source Security Foundation) e NIST AI Risk Management Framework, implementando validação de dados em múltiplas etapas, versionamento reprodutível de dados e modelos com DVC (Data Version Control), automação de CI/CD via GitHub Actions e CML (Continuous Machine Learning), auditoria criptográfica de artefatos com Sigstore, e um modo automático de contingência (<em>Fail-Safe Inference Mode</em>) para garantir a resiliência e alta disponibilidade do sistema mesmo sob falha catastrófica ou corrupção do modelo de IA. Os resultados demonstram que a aplicação de MLSecOps ao projeto original STORM neutraliza vetores comuns de envenenamento e injeção adversarial na inferência, garantindo a integridade operacional exigida para um sistema de alerta de segurança integrada.
                  </p>
                  <p className="academic-p">
                    <strong>Palavras-chave:</strong> Cibersegurança, MLSecOps, MLOps, Telemetria Climática, K-Means, Belém-PA, Docker.
                  </p>

                  <h3 className="academic-heading-1">Abstract</h3>
                  <p className="academic-p" style={{ fontStyle: 'italic' }}>
                    The exponential growth of climate data generated by Internet of Things (IoT) devices has driven the adoption of Machine Learning (ML) models to predict and mitigate socio-environmental disasters, such as urban flooding. However, integrating artificial intelligence into critical control systems expands the attack surface, introducing machine learning-specific vulnerabilities such as data poisoning, adversarial manipulation, and software supply chain attacks.
                  </p>
                  <p className="academic-p" style={{ fontStyle: 'italic' }}>
                    This work presents <strong>STORM-MLSecOps</strong>, an evolution of the original STORM system into an individual and highly secured ecosystem based on the principles of <strong>MLSecOps</strong> (Machine Learning Security Operations). STORM-MLSecOps is a 100% containerized solution for real-time climate telemetry in the city of Belém-PA, utilizing a <em>K-Means</em> clustering model to classify flooding risks across neighborhoods (Doca de Souza Franco, Cidade Velha, Jurunas, Umarizal, Batista Campos, and Marco).
                  </p>
                  <p className="academic-p" style={{ fontStyle: 'italic' }}>
                    The security framework is designed based on international guidelines from the OWASP ML Security Top 10, OpenSSF, and the NIST AI Risk Management Framework. It implements multi-stage data validation, reproducible version control of datasets and models using DVC (Data Version Control), automated CI/CD pipelines via GitHub Actions and CML (Continuous Machine Learning), cryptographic artifact signing with Sigstore, and an automatic contingency mode (<em>Fail-Safe Inference Mode</em>) to guarantee system resilience and high availability even under catastrophic model failure or corruption. The results demonstrate that applying MLSecOps to the original STORM project neutralizes common vectors of data poisoning and adversarial injection in inference, ensuring the operational integrity required for an integrated security alert system.
                  </p>
                  <p className="academic-p">
                    <strong>Keywords:</strong> Cybersecurity, MLSecOps, MLOps, Climate Telemetry, K-Means, Belém-PA, Docker.
                  </p>
                </div>
              )}

              {tccSection === 'intro' && (
                <div>
                  <h2 className="academic-heading-1">1. Introdução</h2>
                  <h3 className="academic-heading-2">1.1. Contextualização e Justificativa</h3>
                  <p className="academic-p">
                    A tecnologia da informação e as infraestruturas de dados estão evoluindo de forma exponencial, gerando volumes colossais de dados de sensores ambientais, residenciais e industriais. Nesse contexto de <em>Big Data</em>, a Inteligência Artificial (IA) e o Aprendizado de Máquina (<em>Machine Learning</em> - ML) tornaram-se ferramentas essenciais para extrair conhecimento e realizar predições rápidas em cenários práticos. No entanto, à medida que os modelos de ML passam da fase de protótipos experimentais isolados para ambientes críticos de produção, surge a necessidade urgente de garantir sua operacionalização confiável, escalável e segura.
                  </p>
                  <p className="academic-p">
                    Historicamente, o desenvolvimento de software tradicional lidou com silos operacionais por meio da cultura <strong>DevOps</strong>, otimizando o ciclo de vida do software com automação de pipelines de integração e entrega contínua (CI/CD). Para responder às demandas dinâmicas de dados e de modelos de machine learning, surgiu o <strong>MLOps</strong>, estendendo os conceitos de DevOps para versionar código, dados e modelos, automatizando fluxos experimentais e implantando de forma previsível. Contudo, a simples replicação de DevOps e MLOps desconsidera a nova superfície de ataque introduzida pela natureza probabilística e orientada a dados do machine learning.
                  </p>
                  <p className="academic-p">
                    A segurança cibernética tradicional foca no código-fonte, nos cabeçalhos HTTP e no perímetro da infraestrutura. Já os modelos de IA dependem da integridade do fluxo de dados para manter sua precisão. Um atacante pode injetar dados maliciosos para distorcer a tomada de decisão do modelo (<em>Data Poisoning</em>), extrair propriedade intelectual (<em>Model Theft/Extraction</em>) ou subverter as predições em produção (<em>Adversarial Evasion</em>). Esse descompasso impulsionou a consolidação do <strong>MLSecOps</strong> (Machine Learning Security Operations), integrando segurança proativa ("shift-left") por design e automação de segurança em todas as fases do ciclo de vida da IA.
                  </p>

                  <h3 className="academic-heading-2">1.2. O Problema das Enchentes em Belém-PA e o Projeto STORM</h3>
                  <p className="academic-p">
                    O município de Belém-PA, capital do estado do Pará, caracteriza-se por um clima equatorial úmido e solos de baixa altitude com proximidade a estuários fluviais, tornando várias de suas áreas urbanas severamente vulneráveis a alagamentos rápidos e marés altas de tempestade severas. O monitoramento em tempo real de índices climáticos, aliado a modelos inteligentes capazes de classificar dinamicamente o risco por bairro e alertar a defesa civil, constitui um recurso vital para mitigar riscos à integridade física dos cidadãos e das infraestruturas críticas da cidade.
                  </p>
                  <p className="academic-p">
                    O projeto original <strong>STORM</strong> foi desenvolvido de forma coletiva por discentes do curso de pós-graduação em Cibersegurança da UFPA. O sistema utiliza um ecossistema 100% conteinerizado em Docker, composto por sensores IoT simulados e reais, um broker MQTT para ingestão de telemetria, um serviço de IA com modelo de agrupamento <em>K-Means</em> treinado de forma isolada, uma API Backend em FastAPI para processamento em tempo real, persistência em banco de dados PostgreSQL, transmissão via WebSockets e um painel visual frontend intuitivo baseado no tema "Tempestade".
                  </p>
                  <p className="academic-p">
                    Este TCC apresenta a reformulação individual e evolução do STORM para o repositório <strong>STORM-MLSecOps</strong>, elevando o nível de maturidade do projeto e introduzindo um ecossistema robusto de controles de segurança integrados ao pipeline de dados e IA. O objetivo é demonstrar como o framework de MLSecOps pode proteger um sistema crítico de detecção de catástrofes naturais contra manipulações adversariais e falhas sistêmicas, tornando as predições confiáveis e rastreáveis sob a ótica da Engenharia de Segurança de Sistemas.
                  </p>

                  <h3 className="academic-heading-2">1.3. Objetivos</h3>
                  <p className="academic-p">
                    O objetivo geral deste trabalho é propor, implementar e avaliar a arquitetura do STORM-MLSecOps, integrando controles modernos de segurança ao ecossistema STORM de telemetria climática de Belém-PA. Os objetivos específicos incluem:
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li">Realizar a modelagem de ameaças utilizando o framework STRIDE adaptado para machine learning sobre a arquitetura conteinerizada do STORM.</li>
                    <li className="academic-li">Implementar salvaguardas técnicas contra <em>Data Poisoning</em> e <em>Injeção Adversarial</em> na telemetria IoT.</li>
                    <li className="academic-li">Consolidar a reprodutibilidade e rastreabilidade por meio de versionamento de código, dados e modelos usando o DVC (Data Version Control) integrado à IBM Cloud Object Storage (COS).</li>
                    <li className="academic-li">Criar um pipeline de CI/CD hardened via GitHub Actions e CML (Continuous Machine Learning) com scanners automatizados de dependências e vulnerabilidades de infraestrutura (Bandit, Grype, Trivy).</li>
                    <li className="academic-li">Desenvolver e validar o mecanismo automático de fallback <em>Fail-Safe Inference Mode</em> para garantia de alta disponibilidade sob falha sistêmica do modelo preditivo.</li>
                  </ul>
                </div>
              )}

              {tccSection === 'referencial' && (
                <div>
                  <h2 className="academic-heading-1">2. Referencial Teórico</h2>
                  <h3 className="academic-heading-2">2.1. De DevOps para MLOps e a Transição para MLSecOps</h3>
                  <p className="academic-p">
                    No desenvolvimento tradicional, a fragmentação entre os times de desenvolvimento (Dev) e operações (Ops) acarretava atrasos e ineficiências na colocação de softwares em produção. A cultura <strong>DevOps</strong> resolveu esse problema ao introduzir colaboração ágil, monitoramento e pipelines automatizados de CI/CD, diminuindo sensivelmente o tempo de entrega das releases e elevando a qualidade geral do software.
                  </p>
                  <p className="academic-p">
                    Quando os modelos de machine learning começaram a ser largamente adotados, percebeu-se que a simples aplicação de DevOps era insuficiente. O machine learning introduz o elemento de incerteza e comportamento dinâmico baseado em dados. Enquanto o software tradicional é determinístico (composto por regras de programação explícitas), os sistemas de ML são dinâmicos e probabilísticos, gerando o comportamento por meio de treinamento iterativo sobre grandes bases de dados. Surge então o <strong>MLOps</strong>, agregando novas práticas como orquestração de fluxos complexos baseados em DAGs (Grafos Acíclicos Dirigidos), gerenciamento de <em>Feature Stores</em>, controle de versão de dados e modelos (DVC), monitoramento de desvio de conceitos e retreino contínuo (CT - Continuous Training).
                  </p>
                  <p className="academic-p">
                    Contudo, à semelhança da evolução do DevOps tradicional para o <strong>DevSecOps</strong> — impulsionada pela percepção tardia de que a velocidade de entrega sem segurança gerava sistemas vulneráveis —, a comunidade de machine learning percebeu que o MLOps automatizava pipelines, mas também acelerava a propagação de vulnerabilidades cibernéticas. A integridade de um modelo de ML depende inteiramente dos seus dados de entrada. Se o pipeline de ingestão carece de validação automatizada e as bibliotecas terceiras de ML contêm brechas de segurança, o sistema pode ser severamente corrompido, gerando predições catastróficas ou expondo dados sensíveis. Daí emerge o <strong>MLSecOps</strong>.
                  </p>

                  <h3 className="academic-heading-2">2.2. O Ciclo de Vida do MLSecOps</h3>
                  <p className="academic-p">
                    De acordo com os de referências de cibersegurança e inteligência artificial, o MLSecOps adota a estratégia de "shift-left", integrando segurança cibernética integrada ao longo de todas as 9 fases fundamentais do ciclo de vida de dados e modelos:
                  </p>
                  <ol className="academic-ul" style={{ listStyleType: 'decimal' }}>
                    <li className="academic-li"><strong>Planejamento e Design Seguro:</strong> Definição de objetivos de segurança, threat modeling (STRIDE/ATLAS) e estabelecimento da baseline de conformidade.</li>
                    <li className="academic-li"><strong>Engenharia de Dados Segura:</strong> Controles de proveniência (lineage), limpeza rigorosa dos dados coletados de fontes externas e verificação contra envenenamento (Data Poisoning).</li>
                    <li className="academic-li"><strong>Experimentação:</strong> Execução de pesquisas em ambientes isolados, documentação completa de metadados, seleção de modelos e testes iniciais de robustez adversarial.</li>
                    <li className="academic-li"><strong>Desenvolvimento e Teste de Pipelines:</strong> Criação de fluxos de trabalho e compilação de código seguindo o ciclo de vida de desenvolvimento seguro (SDLC), aplicando testes de cobertura de teste, SAST, DAST e fuzzing.</li>
                    <li className="academic-li"><strong>Integração Contínua (CI):</strong> Builds automatizados e isolados de pacotes com scanners de vulnerabilidades em dependências e verificação de integridade.</li>
                    <li className="academic-li"><strong>Entrega e Implantação Contínuas (CD):</strong> Deploy seguro de contêineres e imagens assinadas digitalmente, protegendo pacotes e modelos em trânsito e em repouso.</li>
                    <li className="academic-li"><strong>Treinamento Contínuo (CT) Seguro:</strong> Pipeline automatizado de retreino acionado por detecção de drift ou novas coletas de dados, realizando validações criptográficas e de integridade antes do deploy de um modelo retreinado.</li>
                    <li className="academic-li"><strong>Serviço de Modelos (Serving):</strong> Hardening de contêineres, controle rigoroso de acesso baseados em privilégios (Least Privilege), validação e sanitização de dados de inferência de tempo real para neutralizar ataques adversariais.</li>
                    <li className="academic-li"><strong>Monitoramento Contínuo de Segurança:</strong> Dashboards funcionais exibindo indicadores de desempenho, desvios estatísticos de predição e alertas automatizados de ataques adversarial em tempo de execução.</li>
                  </ol>

                  <h3 className="academic-heading-2">2.3. Vetores de Ataque e Ameaças em Sistemas de ML (OWASP e JISEM)</h3>
                  <p className="academic-p">
                    Os ataques direcionados a sistemas inteligentes diferem sensivelmente dos exploits de injeção tradicionais (como SQL Injection ou Cross-Site Scripting). A literatura especializada consolidada pela OWASP (Top 10 ML Threats 2023) mapeia as seguintes vulnerabilidades críticas de sistemas de IA:
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>ML02: Data Poisoning (Envenenamento de Dados):</strong> Ocorre quando um ator malicioso altera ou introduz dados de treinamento falsificados na fase de ingestão ou engenharia de dados. Em modelos de agrupamento como o K-Means usado no STORM, a inserção de métricas anômalas distorce severamente os centros dos clusters, fazendo com que cenários reais de perigo de alagamento sejam classificados incorretamente como risco baixo.</li>
                    <li className="academic-li"><strong>ML01: Input Manipulation / Evasion Attack (Evasão Adversarial):</strong> Ataque focado na etapa de inferência em tempo real, onde o atacante introduz perturbações estatísticas nos dados de entrada para enganar o modelo, fazendo-o errar a predição. No STORM-MLSecOps, isto poderia ocorrer se um microcontrolador climáticos IoT sofresse uma invasão lógica e manipulasse pequenos coeficientes de precipitação e pressão de forma a ocultar uma enchente severa iminente no bairro da Doca.</li>
                    <li className="academic-li"><strong>ML06: AI Supply Chain Attack (Ataque à Cadeia de Suprimentos):</strong> Envolve a incorporação de bibliotecas de terceiros corrompidas ou a desserialização de arquivos de modelos `.pkl` que contenham backdoors lógicos embarcados. Ao carregar o arquivo pickle usando `joblib.load()` sem auditoria prévia, o backend pode sofrer execução remota de código (RCE) malicioso.</li>
                  </ul>
                </div>
              )}

              {tccSection === 'arquitetura' && (
                <div>
                  <h2 className="academic-heading-1">3. Arquitetura do Sistema STORM-MLSecOps</h2>
                  <h3 className="academic-heading-2">3.1. Visão Geral da Arquitetura Conteinerizada (Docker Compose)</h3>
                  <p className="academic-p">
                    O sistema STORM-MLSecOps é arquitetado de forma nativa na nuvem e implementado utilizando 6 contêineres Docker independentes e altamente isolados que se comunicam estritamente por meio de redes virtuais privadas virtuais do Docker:
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>db (Banco de Dados):</strong> Executa o PostgreSQL 15 baseado em Alpine Linux. Este contêiner é rigidamente isolado de toda a internet externa, sem mapeamento de portas locais para o host, eliminando a superfície de ataque externa.</li>
                    <li className="academic-li"><strong>broker (Broker MQTT):</strong> Hospeda o Eclipse Mosquitto v2, gerenciando a fila de tópicos de telemetria climática IoT (`storm/telemetry`). É configurado com autenticação robusta de credenciais.</li>
                    <li className="academic-li"><strong>ai-service (Treinador da IA):</strong> Contêiner efêmero baseado em Python 3.11-slim. Gera um dataset sintético calibrado com 1.000 amostras reproduzindo o clima equatorial úmido de Belém. Ele realiza a limpeza, normaliza com o `StandardScaler` e executa o algoritmo de clusterização K-Means do scikit-learn estruturado para 3 grupos de risco. Os artefatos resultantes (`model.pkl` e `scaler.pkl`) são exportados para um volume Docker compartilhado em modo Read-Only.</li>
                    <li className="academic-li"><strong>backend (API de Processamento):</strong> Executa em FastAPI. Carrega os artefatos serializados do volume compartilhado. A cada dado climático de telemetria recebido do IoT, ele realiza a inferência lógica usando o classificador normalizado para prever o risco global de alagamento, persiste na base de dados PostgreSQL e transmite via WebSockets instantaneamente para o frontend.</li>
                    <li className="academic-li"><strong>iot-simulator (Simulador IoT):</strong> Script em Python que emula dados contínuos de sensores físicos climáticos reais a cada 8 segundos.</li>
                    <li className="academic-li"><strong>frontend (Dashboard Interativo):</strong> Interface SPA desenvolvida em React e empacotada em Vite com ícones Lucide.</li>
                  </ul>

                  <h3 className="academic-heading-2">3.2. Lógica de Análise Climática por Bairros e Dados do Sistema</h3>
                  <p className="academic-p">
                    Diferente da inferência puramente global da IA baseada na telemetria, o backend do STORM-MLSecOps calcula a probabilidade hidrológica de inundação nos bairros urbanos de Belém-PA com base na altitude base e na precipitação pluviométrica acumulada:
                  </p>

                  <table className="academic-table">
                    <thead>
                      <tr>
                        <th>Bairro</th>
                        <th>Altitude Base (m)</th>
                        <th>Limiar de Alagamento (Precipitação)</th>
                        <th>Drenagem do Solo</th>
                        <th>Grau de Risco</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Doca de Souza Franco</strong></td>
                        <td>1.2 m</td>
                        <td>12.0 mm</td>
                        <td>10% (Baixa)</td>
                        <td>Crítico</td>
                      </tr>
                      <tr>
                        <td><strong>Cidade Velha</strong></td>
                        <td>1.5 m</td>
                        <td>20.0 mm</td>
                        <td>30% (Moderada)</td>
                        <td>Vulnerável</td>
                      </tr>
                      <tr>
                        <td><strong>Jurunas</strong></td>
                        <td>1.8 m</td>
                        <td>18.0 mm</td>
                        <td>30% (Moderada)</td>
                        <td>Médio</td>
                      </tr>
                      <tr>
                        <td><strong>Umarizal</strong></td>
                        <td>2.2 m</td>
                        <td>22.0 mm</td>
                        <td>40% (Moderada)</td>
                        <td>Médio</td>
                      </tr>
                      <tr>
                        <td><strong>Batista Campos</strong></td>
                        <td>3.5 m</td>
                        <td>32.0 mm</td>
                        <td>60% (Alta)</td>
                        <td>Seguro</td>
                      </tr>
                      <tr>
                        <td><strong>Marco</strong></td>
                        <td>4.2 m</td>
                        <td>36.0 mm</td>
                        <td>70% (Alta)</td>
                        <td>Seguro</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {tccSection === 'stride' && (
                <div>
                  <h2 className="academic-heading-1">4. Modelagem de Ameaças (STRIDE)</h2>
                  <h3 className="academic-heading-2">4.1. Modelagem de Ameaças baseada em STRIDE</h3>
                  <p className="academic-p">
                    A aplicação sistemática do STRIDE para o STORM-MLSecOps revela cenários que exigem controles específicos na modelagem física e lógica:
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>Spoofing (Identidade):</strong> Sensores IoT piratas enviando falsos picos de chuva. <em>Mitigação:</em> Autenticação e TLS no broker MQTT.</li>
                    <li className="academic-li"><strong>Tampering (Adulteração):</strong> Envenenamento de dados históricos de treino ou adulteração de arquivos de modelo. <em>Mitigação:</em> Versionamento criptográfico de datasets e modelos com hashes MD5/SHA256 no DVC.</li>
                    <li className="academic-li"><strong>Repudiation (Não repúdio):</strong> Falta de trilhas de auditoria das predições ou mudanças no modelo. <em>Mitigação:</em> Logs JSON estruturados de auditoria de metadados.</li>
                    <li className="academic-li"><strong>Information Disclosure (Vazamento):</strong> Exposição externa do PostgreSQL. <em>Mitigação:</em> Redes Docker internas com isolamento completo.</li>
                    <li className="academic-li"><strong>Denial of Service (Indisponibilidade):</strong> Injeção de perturbações adversariais pesadas para travar a inferência. <em>Mitigação:</em> Restrição física de limites de CPU e memória em contêineres e rate-limiting.</li>
                  </ul>

                  <h3 className="academic-heading-2">4.2. Controles de Segurança Implementados</h3>
                  <p className="academic-p">
                    Para neutralizar essas ameaças, o STORM-MLSecOps implementa as seguintes salvaguardas avançadas:
                  </p>
                  <ul className="academic-ul">
                    <li className="academic-li"><strong>Segurança e Integridade dos Dados de Treinamento:</strong> Higienização matemática de entradas climáticas (ex: temperatura de 15°C a 45°C, umidade de 0% a 100%). Valores de envenenamento deliberados são imediatamente descartados e alertados.</li>
                    <li className="academic-li"><strong>Segurança da Cadeia de Suprimentos:</strong> Travamento rígido das versões de dependências (scikit-learn, joblib, fastapi) em manifesto `requirements.txt`.</li>
                    <li className="academic-li"><strong>Segurança de Artefatos de IA:</strong> Os arquivos serializados do modelo (`model.pkl` e `scaler.pkl`) são montados em modo Read-Only no backend de inferência FastAPI, prevenindo substituições em tempo de execução.</li>
                    <li className="academic-li"><strong>Prevenção de Injeção SQL:</strong> Gravação no banco utilizando placeholders parametrizados do driver `psycopg2`.</li>
                  </ul>

                  <h3 className="academic-heading-2">4.3. Mecanismo de Fallback e Resiliência (Fail-Safe Inference Mode)</h3>
                  <p className="academic-p">
                    Caso os arquivos lógicos preditivos `.pkl` estejam ausentes, corrompidos ou danificados por falha física de armazenamento ou ataque deliberado de exclusão, o backend FastAPI entra no <strong>Fail-Safe Inference Mode</strong>. O backend permanece ativo e conectado ao Broker MQTT e ao PostgreSQL, mas passa a calcular o risco global de inundação baseando-se nas regras locais hidrológicas estáticas dos bairros de Belém. O incidente é registrado como aviso de severidade máxima nos logs e no dashboard para notificar a defesa civil e permitir que engenheiros reinstalem os artefatos de IA sem interromper a coleta e proteção da população.
                  </p>
                </div>
              )}

              {tccSection === 'pipeline' && (
                <div>
                  <h2 className="academic-heading-1">5. Implementação do Pipeline de Segurança e CI/CD/CT</h2>
                  <h3 className="academic-heading-2">5.1. Versionamento Criptográfico e Reprodutibilidade com DVC</h3>
                  <p className="academic-p">
                    O versionamento dos datasets e dos modelos de IA é gerenciado utilizando o <strong>DVC (Data Version Control)</strong> acoplado ao Git. O Git armazena pequenos metadados em arquivos de ponteiro `.dvc` (contendo o hash MD5 criptográfico do arquivo de dados ou modelo correspondente), enquanto os arquivos pesados de dados e binários do KMeans são versionados e sincronizados em uma infraestrutura de nuvem baseada na <strong>IBM Cloud Object Storage (COS)</strong>.
                  </p>
                  <p className="academic-p">
                    O pipeline experimental de machine learning é formalizado por meio de um arquivo declarativo `dvc.yaml` que orquestra as etapas de preprocessamento, treinamento e avaliação do classificador. Qualquer alteração em dados climáticos históricos ou hyperparâmetros do modelo resulte na invalidação de hashes e no recálculo automático de predições, garantindo reprodutibilidade completa e auditoria à prova de adulterações.
                  </p>

                  <h3 className="academic-heading-2">5.2. Integração e Entrega Contínuas Seguras via GitHub Actions e CML</h3>
                  <p className="academic-p">
                    O STORM-MLSecOps implementa uma esteira de integração contínua (CI) e entrega contínua (CD) usando o <strong>GitHub Actions</strong> associado ao <strong>CML (Continuous Machine Learning)</strong>. Sempre que o código é atualizado via `git push` ou um Pull Request é aberto, o pipeline automatizado:
                  </p>
                  <ol className="academic-ul" style={{ listStyleType: 'decimal' }}>
                    <li className="academic-li">Executa ferramentas de análise estática de vulnerabilidades (SAST) com o <code>bandit</code> na base de código python.</li>
                    <li className="academic-li">Executa a suite de testes unitários com o <code>pytest</code>, testando os limites lógicos do algoritmo climáticos e os casos de fallback da API.</li>
                    <li className="academic-li">O CML inicializa o treinamento do modelo KMeans, avalia suas métricas de precisão e escreve um relatório descritivo Markdown nos comentários do Pull Request, contendo gráficos de distribuição do desvio estatístico do classificador.</li>
                    <li className="academic-li">Após a aprovação, gera a release e empacota contêineres Docker estáveis com assinaturas de integridade e scanner de dependências integrados.</li>
                  </ol>

                  <h3 className="academic-heading-2">5.3. Monitoramento de Drift, Qualidade e Anomalias</h3>
                  <p className="academic-p">
                    O monitoramento pós-implantação utiliza agentes do Prometheus e painéis do Grafana para coletar métricas contínuas do tráfego climáticos, como a taxa de mensagens climáticas recebidas, a distribuição de predições do K-Means (detectando desvios estatísticos / Concept Drift) e ativações de contingência do Fail-Safe Mode.
                  </p>
                </div>
              )}

              {tccSection === 'conclusao' && (
                <div>
                  <h2 className="academic-heading-1">6. Conclusão e Trabalhos Futuros</h2>
                  <h3 className="academic-heading-2">Conclusão</h3>
                  <p className="academic-p">
                    A evolução do projeto STORM original para a versão individual robusta do <strong>STORM-MLSecOps</strong> comprova empiricamente a viabilidade prática da integração de cibersegurança e MLOps para proteção de sistemas críticos de controle e mitigação de desastres naturais. Através de controles de machine learning proativos — como higienização lógica na ingestão, versionamento reprodutível com DVC, auditoria analítica automatizada de builds com o CML, análise estática de vulnerabilidades e o Fail-Safe Inference Mode —, o STORM-MLSecOps eleva sensivelmente o nível de resiliência, integridade operacional e confiabilidade cibernética de alertas meteorológicos em Belém-PA.
                  </p>

                  <h3 className="academic-heading-2">Trabalhos Futuros</h3>
                  <ul className="academic-ul">
                    <li className="academic-li">Implementação de uma Feature Store descentralizada baseada no Feast com Kubernetes para o tráfego de dados climáticos pesados em larga escala.</li>
                    <li className="academic-li">Autenticação e Assinatura Digital de Modelos com Sigstore para assinar criptograficamente os modelos e verificar a integridade da desserialização no startup.</li>
                    <li className="academic-li">Criação de workflows periódicos simulando Evasion Attacks lógicos de forma programática utilizando o ART (Adversarial Robustness Toolbox) para auditar periodicamente o classificador KMeans.</li>
                  </ul>

                  <h3 className="academic-heading-1">Referências Bibliográficas</h3>
                  <ol className="academic-ul" style={{ listStyleType: 'decimal', fontSize: '0.85rem', color: '#94a3b8' }}>
                    <li className="academic-li">CARVALHO, Maurício Moraes Preto; PAIVA, Sofia Larissa da Costa. <em>Práticas de MLOps em softwares reais.</em> Goiânia: Instituto de Informática – Universidade Federal de Goiás (UFG), 2025.</li>
                    <li className="academic-li">CENTRO DE PESQUISA E DESENVOLVIMENTO EM TELECOMUNICAÇÕES (CPQD). <em>Implementação de Sistemas de IA com RAG: metodologia, implementação e acompanhamento de projetos de IA.</em> Campinas: CPQD, Projeto INSPIRE, 2026.</li>
                    <li className="academic-li">CRIVETI, Mihai; KREUZBERGER, Dominik; FORGO, Julianne; CZUBA, Przemek; MACHOWSKI, Yvette. <em>The MLOps guide.</em> IBM Open Innovation Community, 2024. Disponível em: <a href="https://ibm.github.io/MLOps/" target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4' }}>https://ibm.github.io/MLOps/</a>.</li>
                    <li className="academic-li">ERICSSON. <em>MLSecOps: Protecting the AI/ML Lifecycle in telecom.</em> Ericsson White Paper, 2024. Disponível em: <a href="https://www.ericsson.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4' }}>https://www.ericsson.com/</a>.</li>
                    <li className="academic-li">EVANS, Sarah; SHOROV, Andrey; SOYKAN, Elif Ustundag; SHAMMARY, Bahaulddin. <em>Visualizing Secure MLOps (MLSecOps): A Practical Guide for Building Robust AI/ML Pipeline Security.</em> Open Source Security Foundation (OpenSSF) Whitepaper, 2025. Disponível em: <a href="https://openssf.org/" target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4' }}>https://openssf.org/</a>.</li>
                    <li className="academic-li">GARCIA, Vinicius Cardoso. <em>Machine Learning Operations (MLOps): Um Guia para a Construção de Arquiteturas de Software Otimizadas.</em> Recife, 2023.</li>
                    <li className="academic-li">KREUZBERGER, Dominik; KÜHL, Niklas; HIRSCHL, Sebastian. <em>Machine Learning Operations (MLOps): Overview, Definition, and Architecture.</em> arXiv preprint arXiv:2205.02302, 2022. Disponível em: <a href="https://arxiv.org/abs/2205.02302" target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4' }}>https://arxiv.org/abs/2205.02302</a>.</li>
                    <li className="academic-li">LIMA, Jorgyvan Braga. <em>STORM: Sistema Inteligente de Telemetria Climática e Alerta de Alagamento para Belém-PA.</em> Repositório GitHub, 2026. Disponível em: <a href="https://github.com/jorgyvanlima/storm" target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4' }}>https://github.com/jorgyvanlima/storm</a>.</li>
                    <li className="academic-li">OLGA, Arthur Quintella de Mello; MONTEIRO, Gabriel Lopes; LEITE, Guilherme Peres; LIMA, Vinicius Gomes de. <em>MLOps - Transformando Teoria em Prática.</em> São Paulo: Insper, Relatório Final de Projeto Final de Engenharia (Trabalho de Conclusão de Curso), 2021.</li>
                    <li className="academic-li">RUN:AI. <em>Complete Guide to MLOps: Why is MLOps Important? Closing the Loop with Machine Learning Operations.</em> Run:ai, [s.d.]. Disponível em: <a href="https://www.run.ai/" target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4' }}>https://www.run.ai/</a>.</li>
                    <li className="academic-li">SANTANDREA, Alan Souza. <em>MLOps: introdução ao tema e estudo de caso.</em> Ouro Preto: Escola de Minas, Universidade Federal de Ouro Preto, Monografia de Graduação em Engenharia de Controle e Automação, 2022.</li>
                    <li className="academic-li">SPOLAOR, Max; MILLER, Trisha; ARCHULETA, Michelle; WILSON, Drew. <em>Machine Learning Security Operations (MLSecOps).</em> Space-ISAC White Paper, 2023.</li>
                    <li className="academic-li">VENIGALLA, Krishna Chaitanya. <em>MLSecOps: A Comprehensive Framework for Secure Machine Learning Operations.</em> Journal of Information Systems Engineering and Management, v. 11, n. 2s, p. 427-434, 2026.</li>
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
