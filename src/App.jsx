import React, { useState, useEffect } from 'react';
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

 // Adicione este useEffect dentro da função App()
useEffect(() => {
  const carregarDados = async () => {
    try {
      const response = await fetch('/api/get_reembolsos');
      const dadosSincronizados = await response.json();
      
      if (response.ok && Array.isArray(dadosSincronizados)) {
        setViagens(dadosSincronizados);
        localStorage.setItem('viagens_motorista', JSON.stringify(dadosSincronizados));
        toast.success("Dados sincronizados!", { icon: '🔄' });
      } else {
        throw new Error(dadosSincronizados.error || "Erro desconhecido");
      }
    } catch (error) {
      console.error("Erro na carga inicial:", error);
      toast.error("Trabalhando em modo Offline.");
    }
  };

  carregarDados();
}, []);

  const handleSalvar = async () => {
    const { kmInicio, kmFim, rota } = form;
    
    if (!kmInicio || !kmFim || !rota) {
      toast.error("Preencha todos os campos obrigatórios!");
      return;
    }

    const diff = parseFloat(kmFim) - parseFloat(kmInicio);
    if (diff <= 0) {
      toast.error("KM final deve ser maior que o inicial!");
      return;
    }

    const distanciaCalculada = Math.ceil(diff);
    const valorPagamento = (distanciaCalculada * TAXA).toFixed(2);

    const novaViagem = {
      id: Date.now(),
      data: new Date().toLocaleDateString('pt-BR'),
      rota,
      combustivel: form.combustivel,
      kmInicio: parseFloat(kmInicio),
      kmFim: parseFloat(kmFim),
      distanciaPercorrida: distanciaCalculada,
      distanciaRealGps: distanciaReal.toFixed(2),
      pagamento: valorPagamento
    };

    setEnviando(true);
    const idToast = toast.loading("Sincronizando com Dataverse...");

    try {
      // Chamada para a Serverless Function da Vercel
      const response = await fetch('/api/reembolsos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaViagem)
      });

      if (!response.ok) throw new Error();

      setViagens([novaViagem, ...viagens]);
      setForm({ rota: '', combustivel: '', kmInicio: '', kmFim: '' });
      toast.success("Salvo no Dataverse!", { id: idToast, icon: '✅' });
    } catch (error) {
      // Se falhar a rede, salvamos localmente para não perder o dado
      setViagens([novaViagem, ...viagens]);
      toast.error("Erro no Dataverse. Salvo apenas localmente.", { id: idToast });
    } finally {
      setEnviando(false);
    }
  };

  const exportar = () => {
    if (viagensFiltradas.length === 0) {
      toast.error("Não há dados para exportar.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(viagensFiltradas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reembolsos");
    XLSX.writeFile(wb, `Relatorio_${new Date().getTime()}.xlsx`);
    toast.success("Planilha gerada!", { icon: '📊' });
  };

  const viagensFiltradas = viagens.filter(v => {
    const mesViagem = v.data.split('/')[1]; 
    const bateMes = filtroMes === "" || mesViagem === filtroMes.padStart(2, '0');
    const bateRota = v.rota.toLowerCase().includes(filtroRota.toLowerCase());
    return bateMes && bateRota;
  });

  return (
    <div className="container">
      <Toaster position="top-center" />

      <header>
        <h1>Calc Reembolso</h1>
        <p>Valor por KM: <strong>R$ {TAXA.toFixed(2)}</strong></p>
      </header>

      <div className="card">
        <h3>Registrar Percurso</h3>
        <input className="full-width" type="text" placeholder="Nome da Rota" value={form.rota}
          onChange={e => setForm({...form, rota: e.target.value})} />
        
        <input className="full-width" type="number" inputMode="decimal" placeholder="Preço Combustível" 
          value={form.combustivel} onChange={e => setForm({...form, combustivel: e.target.value})} />

        <div className="input-group-row">
          <input type="number" inputMode="decimal" placeholder="KM Inicial" value={form.kmInicio}
            onChange={e => setForm({...form, kmInicio: e.target.value})} />
          <input type="number" inputMode="decimal" placeholder="KM Final" value={form.kmFim}
            onChange={e => setForm({...form, kmFim: e.target.value})} />
        </div>
        
        <div className="gps-box">
          <button onClick={() => { rastrear(); toast('GPS Ativado!', { icon: '📍' }); }} className="btn-gps">📡 Validar GPS</button>
          <span>GPS: <strong>{distanciaReal.toFixed(2)} km</strong></span>
        </div>

        <button onClick={handleSalvar} disabled={enviando} className="btn-save">
          {enviando ? "Enviando..." : "💾 Salvar e Sincronizar"}
        </button>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <select onChange={(e) => setFiltroMes(e.target.value)}>
            <option value="">Todos os Meses</option>
            {[...Array(12)].map((_, i) => (
              <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>
            ))}
          </select>
          <input type="text" placeholder="Buscar rota..." onChange={(e) => setFiltroRota(e.target.value)} />
        </div>
      </div>

      <div className="actions">
        <button onClick={exportar} className="btn-export">📊 Exportar ({viagensFiltradas.length})</button>
      </div>

      <div className="history">
        {viagensFiltradas.map(v => (
          <div key={v.id} className="history-item">
            <div className="info">
              <strong>{v.rota}</strong>
              <small>{v.data} | {v.kmInicio}km → {v.kmFim}km</small>
            </div>
            <div className="price">
              <span>{v.distanciaPercorrida}km</span>
              <strong>R$ {v.pagamento}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;