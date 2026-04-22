import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Toaster, toast } from 'react-hot-toast';
import { useDistance } from './hooks/useDistance';
import './App.css';

function App() {
  const [viagens, setViagens] = useState(() => {
    const salvo = localStorage.getItem('viagens_motorista');
    return salvo ? JSON.parse(salvo) : [];
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const salvo = localStorage.getItem('tema_dark');
    return salvo ? JSON.parse(salvo) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [form, setForm] = useState({ rota: '', combustivel: '', kmInicio: '', kmFim: '' });
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroRota, setFiltroRota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [gpsAtivo, setGpsAtivo] = useState(false);
  
  const { distanciaReal, rastrear, pararRastreio } = useDistance();
  const TAXA = 0.65;

  // Tema AMOLED
  useEffect(() => {
    localStorage.setItem('tema_dark', JSON.stringify(isDarkMode));
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Sincronização Inicial
  useEffect(() => {
    const carregarDados = async () => {
      try {
        const response = await fetch('/api/get_reembolsos');
        const dadosSincronizados = await response.json();
        if (response.ok && Array.isArray(dadosSincronizados)) {
          setViagens(dadosSincronizados);
          localStorage.setItem('viagens_motorista', JSON.stringify(dadosSincronizados));
          toast.success("Dados sincronizados com Dataverse!", { icon: '🔄' });
        }
      } catch (e) { 
        toast.error("Trabalhando em modo Offline.");
      }
    };
    carregarDados();
  }, []);

  // Totais
  const totalGeral = useMemo(() => 
    viagens.reduce((acc, v) => acc + parseFloat(v.pagamento), 0).toFixed(2)
  , [viagens]);

  const totalMensal = useMemo(() => {
    const mesAtual = (new Date().getMonth() + 1).toString().padStart(2, '0');
    return viagens
      .filter(v => v.data.split('/')[1] === mesAtual)
      .reduce((acc, v) => acc + parseFloat(v.pagamento), 0).toFixed(2);
  }, [viagens]);

  const viagensFiltradas = useMemo(() => {
    return viagens.filter(v => {
      const partesData = v.data.split('/');
      const mesViagem = partesData[1]; 
      const bateMes = filtroMes === "" || mesViagem === filtroMes.padStart(2, '0');
      const bateRota = v.rota.toLowerCase().includes(filtroRota.toLowerCase());
      return bateMes && bateRota;
    });
  }, [viagens, filtroMes, filtroRota]);

  const handleSalvar = async () => {
    const { rota, kmInicio, kmFim } = form;
    if (!rota) return toast.error("O nome da rota é obrigatório!");

    let distanciaFinal = 0;
    if (!gpsAtivo && kmInicio && kmFim) {
      const diff = parseFloat(kmFim) - parseFloat(kmInicio);
      if (diff <= 0) return toast.error("KM final deve ser maior!");
      distanciaFinal = Math.ceil(diff);
    } else if (gpsAtivo && distanciaReal > 0) {
      distanciaFinal = Math.ceil(distanciaReal);
    } else {
      return toast.error("Preencha os KMs ou use o GPS!");
    }

    const valorPagamento = (distanciaFinal * TAXA).toFixed(2);
    const novaViagem = {
      id: Date.now(),
      data: new Date().toLocaleDateString('pt-BR'),
      rota,
      combustivel: form.combustivel || 0,
      kmInicio: gpsAtivo ? 0 : parseFloat(kmInicio),
      kmFim: gpsAtivo ? 0 : parseFloat(kmFim),
      distanciaPercorrida: distanciaFinal,
      distanciaRealGps: distanciaReal.toFixed(2),
      pagamento: valorPagamento
    };

    setEnviando(true);
    const idToast = toast.loading("Sincronizando com Dataverse...");

    try {
      const response = await fetch('/api/reembolsos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaViagem)
      });
      if (!response.ok) throw new Error();

      setViagens([novaViagem, ...viagens]);
      setForm({ rota: '', combustivel: '', kmInicio: '', kmFim: '' });
      if(gpsAtivo) { 
        pararRastreio(); 
        setGpsAtivo(false); 
      }
      
      toast.success(`Sincronizado! Reembolso: R$ ${valorPagamento}`, { id: idToast, icon: '✅' });
    } catch (error) {
      setViagens([novaViagem, ...viagens]);
      toast.error("Erro no Dataverse. Salvo apenas localmente.", { id: idToast });
    } finally { 
      setEnviando(false); 
    }
  };

  const exportar = () => {
    if (viagensFiltradas.length === 0) return toast.error("Sem dados para exportar.");
    const ws = XLSX.utils.json_to_sheet(viagensFiltradas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reembolsos");
    XLSX.writeFile(wb, `Relatorio_Reembolso_${new Date().getTime()}.xlsx`);
    toast.success(`Excel gerado com ${viagensFiltradas.length} registros!`, { icon: '📊' });
  };

  return (
    <div className="container">
      <Toaster position="top-center" reverseOrder={false} />
      
      <header>
        <div className="header-nav">
          <h1>Cálculo Reembolso</h1>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="theme-toggle">
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>

        <div className="stats-container">
          <div className="stat-card mens">
            <span className="label">Neste Mês</span>
            <span className="value">R$ {totalMensal}</span>
          </div>
          <div className="stat-card">
            <span className="label">Total Geral</span>
            <span className="value">R$ {totalGeral}</span>
          </div>
        </div>
      </header>

      <div className="card">
        <h3>Nova Viagem</h3>
        <input className="full-width" type="text" placeholder="Nome da Rota" value={form.rota}
          onChange={e => setForm({...form, rota: e.target.value})} />
        
        {!gpsAtivo && (
          <div className="input-group-row animate-in">
            <input type="number" inputMode="decimal" placeholder="KM Inicial" value={form.kmInicio}
              onChange={e => setForm({...form, kmInicio: e.target.value})} />
            <input type="number" inputMode="decimal" placeholder="KM Final" value={form.kmFim}
              onChange={e => setForm({...form, kmFim: e.target.value})} />
          </div>
        )}

        <div className={`gps-section ${gpsAtivo ? 'active' : ''}`}>
          <button onClick={() => {
            if(!gpsAtivo) { 
              rastrear(); 
              setGpsAtivo(true);
              toast('GPS Ativado!', { icon: '📍' });
            } else { 
              pararRastreio(); 
              setGpsAtivo(false);
              toast('GPS Desligado', { icon: '🛑' });
            }
          }} className={gpsAtivo ? 'btn-gps-stop' : 'btn-gps-start'}>
            {gpsAtivo ? '🛑 Parar GPS' : '📍 Usar GPS'}
          </button>
          {gpsAtivo && <span className="gps-live"><strong>{distanciaReal.toFixed(2)} km</strong></span>}
        </div>

        <button onClick={handleSalvar} disabled={enviando} className="btn-save">
          {enviando ? "Aguarde..." : "💾 Salvar Viagem"}
        </button>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
            <option value="">Todos os Meses</option>
            {[...Array(12)].map((_, i) => (
              <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>
            ))}
          </select>
          <input type="text" placeholder="Filtrar rota..." onChange={e => setFiltroRota(e.target.value)} />
        </div>
      </div>

      <button onClick={exportar} className="btn-export">
        📊 Exportar Seleção ({viagensFiltradas.length})
      </button>

      <div className="history">
        {viagensFiltradas.map(v => (
          <div key={v.id} className="history-item">
            <div className="info">
              <strong>{v.rota}</strong>
              <small>{v.data} | {v.distanciaPercorrida}km</small>
            </div>
            <div className="price"><strong>R$ {v.pagamento}</strong></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;