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

  const [form, setForm] = useState({ rota: '', combustivel: '', kmInicio: '', kmFim: '' });
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroRota, setFiltroRota] = useState('');
  const [enviando, setEnviando] = useState(false);
  
  const { distanciaReal, rastrear } = useDistance();
  const TAXA = 0.65;

  // Sincronização Inicial (Busca do Dataverse)
  useEffect(() => {
    const carregarDados = async () => {
      try {
        const response = await fetch('/api/get_reembolsos');
        const dadosSincronizados = await response.json();
        
        if (response.ok && Array.isArray(dadosSincronizados)) {
          setViagens(dadosSincronizados);
          localStorage.setItem('viagens_motorista', JSON.stringify(dadosSincronizados));
          toast.success("Dados sincronizados!", { icon: '🔄' });
        }
      } catch (error) {
        console.error("Carga falhou, operando offline.");
      }
    };
    carregarDados();
  }, []);

  // Persistência local contínua
  useEffect(() => {
    localStorage.setItem('viagens_motorista', JSON.stringify(viagens));
  }, [viagens]);

  // Filtro de Viagens
  const viagensFiltradas = useMemo(() => {
    return viagens.filter(v => {
      const partesData = v.data.split('/');
      const mesViagem = partesData[1]; 
      const bateMes = filtroMes === "" || mesViagem === filtroMes.padStart(2, '0');
      const bateRota = v.rota.toLowerCase().includes(filtroRota.toLowerCase());
      return bateMes && bateRota;
    });
  }, [viagens, filtroMes, filtroRota]);

  // Cálculo do Total Acumulado Dinâmico
  const totalPagamento = useMemo(() => {
    return viagensFiltradas.reduce((acc, v) => acc + parseFloat(v.pagamento), 0).toFixed(2);
  }, [viagensFiltradas]);

  const handleSalvar = async () => {
    const { rota, kmInicio, kmFim } = form;
    
    if (!rota) {
      toast.error("O nome da rota é obrigatório!");
      return;
    }

    let distanciaFinal = 0;

    // Lógica Flexível: Hodômetro Prioritário ou GPS como Backup
    if (kmInicio && kmFim) {
      const diff = parseFloat(kmFim) - parseFloat(kmInicio);
      if (diff <= 0) {
        toast.error("KM final deve ser maior que o inicial!");
        return;
      }
      distanciaFinal = Math.ceil(diff);
    } else if (distanciaReal > 0) {
      distanciaFinal = Math.ceil(distanciaReal);
      toast.success("Usando distância do GPS.");
    } else {
      toast.error("Preencha os KMs ou use o rastreio GPS!");
      return;
    }

    const valorPagamento = (distanciaFinal * TAXA).toFixed(2);

    const novaViagem = {
      id: Date.now(),
      data: new Date().toLocaleDateString('pt-BR'),
      rota,
      combustivel: form.combustivel || 0,
      kmInicio: kmInicio ? parseFloat(kmInicio) : 0,
      kmFim: kmFim ? parseFloat(kmFim) : 0,
      distanciaPercorrida: distanciaFinal,
      distanciaRealGps: distanciaReal.toFixed(2),
      pagamento: valorPagamento
    };

    setEnviando(true);
    const idToast = toast.loading("Sincronizando...");

    try {
      const response = await fetch('/api/reembolsos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaViagem)
      });

      if (!response.ok) throw new Error();

      setViagens([novaViagem, ...viagens]);
      setForm({ rota: '', combustivel: '', kmInicio: '', kmFim: '' });
      toast.success(`Salvo! R$ ${valorPagamento}`, { id: idToast, icon: '✅' });
    } catch (error) {
      setViagens([novaViagem, ...viagens]);
      toast.error("Erro no Dataverse. Salvo apenas localmente.", { id: idToast });
    } finally {
      setEnviando(false);
    }
  };

  const exportar = () => {
    if (viagensFiltradas.length === 0) {
      toast.error("Sem dados para exportar.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(viagensFiltradas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reembolsos");
    XLSX.writeFile(wb, `Reembolso_${new Date().getTime()}.xlsx`);
    toast.success("Planilha gerada!", { icon: '📊' });
  };

  return (
    <div className="container">
      <Toaster position="top-center" />

      <header>
        <h1>Calc Reembolso</h1>
        <div className="total-box">
          <span className="label">Total Acumulado</span>
          <span className="value">R$ {totalPagamento}</span>
        </div>
      </header>

      <div className="card">
        <h3>Nova Viagem</h3>
        <input className="full-width" type="text" placeholder="Nome da Rota" value={form.rota}
          onChange={e => setForm({...form, rota: e.target.value})} />
        
        <input className="full-width" type="number" inputMode="decimal" placeholder="Preço do Combustível" 
          value={form.combustivel} onChange={e => setForm({...form, combustivel: e.target.value})} />

        <div className="input-group-row">
          <input type="number" inputMode="decimal" placeholder="KM Inicial" value={form.kmInicio}
            onChange={e => setForm({...form, kmInicio: e.target.value})} />
          <input type="number" inputMode="decimal" placeholder="KM Final" value={form.kmFim}
            onChange={e => setForm({...form, kmFim: e.target.value})} />
        </div>
        
        <div className="gps-box">
          <button onClick={() => { rastrear(); toast('GPS Ativado!', { icon: '📍' }); }} className="btn-gps">📡 Ativar GPS</button>
          <span>GPS: <strong>{distanciaReal.toFixed(2)} km</strong></span>
        </div>

        <button onClick={handleSalvar} disabled={enviando} className="btn-save">
          {enviando ? "Enviando..." : "💾 Salvar e Sincronizar"}
        </button>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
            <option value="">Todos os Meses</option>
            {[...Array(12)].map((_, i) => (
              <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>
            ))}
          </select>
          <input type="text" placeholder="Buscar rota..." onChange={(e) => setFiltroRota(e.target.value)} />
        </div>
      </div>

      <div className="actions">
        <button onClick={exportar} className="btn-export">
          📊 Exportar Seleção <span className="badge">{viagensFiltradas.length}</span>
        </button>
      </div>

      <div className="history">
        {viagensFiltradas.map(v => (
          <div key={v.id} className="history-item">
            <div className="info">
              <strong>{v.rota}</strong>
              <small>{v.data} | {v.distanciaPercorrida}km (Arredondado)</small>
            </div>
            <div className="price">
              <strong>R$ {v.pagamento}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;