import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Toaster, toast } from 'react-hot-toast';
import { useDistance } from './hooks/useDistance';
import './App.css';

// Função auxiliar para calcular o período de pagamento (21 até 20)
const getPeriodoCompetencia = (dateStr) => {
  const [d, m, y] = dateStr.split('/').map(Number);
  // Se dia >= 21, pertence ao mês atual (m). Se <= 20, pertence ao anterior (m-1).
  if (d >= 21) return { month: m, year: y };
  let prevM = m - 1;
  let prevY = y;
  if (prevM === 0) { prevM = 12; prevY = y - 1; }
  return { month: prevM, year: prevY };
};

function App() {
  const [user, setUser] = useState(() => {
    const salvo = localStorage.getItem('user_reembolso');
    return salvo ? JSON.parse(salvo) : null;
  });

  const [loginForm, setLoginForm] = useState({ usuario: '', senha: '' });
  const [viagens, setViagens] = useState([]);
  const [form, setForm] = useState({
    rota: '', combustivel: '', kmInicio: '', kmFim: '',
    pedagio: '', outrosGastos: '', outrosDescricao: ''
  });
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroRota, setFiltroRota] = useState('');
  const [filtroMotorista, setFiltroMotorista] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [gpsAtivo, setGpsAtivo] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const salvo = localStorage.getItem('tema_dark');
    return salvo ? JSON.parse(salvo) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const { distanciaReal, rastrear, pararRastreio } = useDistance();
  const TAXA = 0.65;

  useEffect(() => {
    localStorage.setItem('tema_dark', JSON.stringify(isDarkMode));
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (user) carregarDados();
  }, [user]);

  const carregarDados = async () => {
    try {
      const response = await fetch(`/api/get_reembolsos?acesso=${user.acesso}&usuario=${user.usuario}`);
      const dados = await response.json();
      if (response.ok) setViagens(dados);
    } catch (e) { toast.error("Modo offline."); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setEnviando(true);
    const idToast = toast.loading("Autenticando...");
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const dados = await response.json();
      if (response.ok) {
        setUser(dados);
        localStorage.setItem('user_reembolso', JSON.stringify(dados));
        toast.success(`Bem-vindo!`, { id: idToast });
      } else {
        toast.error(dados.message || "Credenciais inválidas", { id: idToast });
      }
    } catch (e) {
      toast.error("Erro de conexão.", { id: idToast });
    } finally { setEnviando(false); }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user_reembolso');
    setViagens([]);
  };

  const listaMotoristas = useMemo(() => {
    return [...new Set(viagens.map(v => v.criadoPor))].filter(Boolean);
  }, [viagens]);

  const viagensFiltradas = useMemo(() => {
    return viagens.filter(v => {
      const { month } = getPeriodoCompetencia(v.data);
      const bateMes = filtroMes === "" || month.toString().padStart(2, '0') === filtroMes.padStart(2, '0');
      const bateRota = v.rota.toLowerCase().includes(filtroRota.toLowerCase());
      const bateMotorista = filtroMotorista === "" || v.criadoPor === filtroMotorista;
      return bateMes && bateRota && bateMotorista;
    });
  }, [viagens, filtroMes, filtroRota, filtroMotorista]);

  const totalGeral = useMemo(() =>
    viagensFiltradas.reduce((acc, v) => acc + parseFloat(v.pagamento), 0).toFixed(2)
    , [viagensFiltradas]);

  const totalMensal = useMemo(() => {
    const hoje = new Date();
    // Força o mês atual como string de 2 dígitos
    const mesAtual = (hoje.getMonth() + 1).toString().padStart(2, '0');
    const anoAtual = hoje.getFullYear();

    return viagensFiltradas
      .filter(v => {
        if (!v.data) return false;
        const { month, year } = getPeriodoCompetencia(v.data);
        // Compara tanto o mês quanto o ano para evitar erros na virada de ano
        return month.toString().padStart(2, '0') === mesAtual && year === anoAtual;
      })
      .reduce((acc, v) => acc + parseFloat(v.pagamento || 0), 0)
      .toFixed(2);
  }, [viagensFiltradas]);

  console.log("Viagens filtradas:", viagensFiltradas)

  const handleSalvar = async () => {
    const { rota, kmInicio, kmFim, pedagio, outrosGastos, outrosDescricao } = form;
    if (!rota) return toast.error("Informe a rota!");
    if (parseFloat(outrosGastos || 0) > 0 && !outrosDescricao.trim()) {
      return toast.error("Descreva o motivo dos outros gastos!");
    }

    let distanciaFinal = 0;
    if (!gpsAtivo && kmInicio && kmFim) {
      distanciaFinal = Math.ceil(parseFloat(kmFim) - parseFloat(kmInicio));
    } else if (gpsAtivo && distanciaReal > 0) {
      distanciaFinal = Math.ceil(distanciaReal);
    } else {
      return toast.error("Use o GPS ou preencha o KM!");
    }

    const valorTotal = (distanciaFinal * TAXA + parseFloat(pedagio || 0) + parseFloat(outrosGastos || 0)).toFixed(2);

    const novaViagem = {
      ...form,
      distanciaPercorrida: distanciaFinal,
      distanciaRealGps: distanciaReal.toFixed(2),
      pagamento: valorTotal,
      criadoPor: user.usuario,
      data: new Date().toLocaleDateString('pt-BR')
    };

    setEnviando(true);
    try {
      await fetch('/api/reembolsos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novaViagem)
      });
      setViagens([novaViagem, ...viagens]);
      setForm({ rota: '', combustivel: '', kmInicio: '', kmFim: '', pedagio: '', outrosGastos: '', outrosDescricao: '' });
      if (gpsAtivo) { pararRastreio(); setGpsAtivo(false); }
      toast.success(`Salvo! Total R$ ${valorTotal}`);
    } catch (e) { toast.error("Erro ao salvar."); }
    finally { setEnviando(false); }
  };

  if (!user) {
    return (
      <div className="login-screen">
        <Toaster position="top-center" />
        <form className="login-card" onSubmit={handleLogin}>
          <div className="login-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ textAlign: 'left' }}>
                <h2>Calc Reembolso</h2>
                <p>Faça login para continuar</p>
              </div>
              <button type="button" onClick={() => setIsDarkMode(!isDarkMode)} className="theme-toggle" style={{ width: '38px', height: '38px', fontSize: '1rem' }}>
                {isDarkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
          <div className="login-inputs">
            <input type="text" placeholder="Usuário" required onChange={e => setLoginForm({ ...loginForm, usuario: e.target.value })} />
            <input type="password" placeholder="Senha (Matrícula)" required onChange={e => setLoginForm({ ...loginForm, senha: e.target.value })} />
          </div>
          <button className="btn-save" type="submit" disabled={enviando}>{enviando ? "Acessando..." : "Entrar"}</button>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <Toaster position="top-center" />
      <header className="header-nav">
        <h1>{user.acesso === 'Gestor' ? 'Painel Gestor' : 'Minhas Viagens'}</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="theme-toggle">{isDarkMode ? '☀️' : '🌙'}</button>
          <button onClick={handleLogout} className="theme-toggle">🚪</button>
        </div>
      </header>

      <div className="stats-container">
        <div className="stat-card mens">
          <span className="label">Total Mensal</span>
          <span className="value">R$ {totalMensal}</span>
        </div>
        <div className="stat-card">
          <span className="label">{user.acesso === 'Gestor' ? 'Total Geral' : 'Total Acumulado'}</span>
          <span className="value">R$ {totalGeral}</span>
        </div>
      </div>

      {/* Informativo de Lógica */}
      <div className="card" style={{ marginBottom: '15px', padding: '10px', backgroundColor: 'var(--card-bg)', borderLeft: '4px solid var(--primary)' }}>
        <small style={{ color: 'var(--text-secondary)' }}>
          ℹ️ <b>Regra de Pagamento:</b> O mês de competência considera o período do <b>dia 21 do mês anterior ao dia 20 do mês atual</b>.
        </small>
      </div>

      {user.acesso === 'Motorista' && (
        <div className="card">
          <h3>Nova Viagem</h3>
          <input className="full-width" type="text" placeholder="Nome da Rota" value={form.rota} onChange={e => setForm({ ...form, rota: e.target.value })} />
          <div className="input-group-row">
            <input type="number" inputMode="decimal" placeholder="Pedágio (R$)" value={form.pedagio} onChange={e => setForm({ ...form, pedagio: e.target.value })} />
            <input type="number" inputMode="decimal" placeholder="Outros (R$)" value={form.outrosGastos} onChange={e => setForm({ ...form, outrosGastos: e.target.value })} />
          </div>
          {parseFloat(form.outrosGastos) > 0 && (
            <input className="full-width animate-in" type="text" placeholder="Descrição do gasto extra" value={form.outrosDescricao} onChange={e => setForm({ ...form, outrosDescricao: e.target.value })} />
          )}
          {!gpsAtivo && (
            <div className="input-group-row animate-in">
              <input type="number" placeholder="KM Inicial" value={form.kmInicio} onChange={e => setForm({ ...form, kmInicio: e.target.value })} />
              <input type="number" placeholder="KM Final" value={form.kmFim} onChange={e => setForm({ ...form, kmFim: e.target.value })} />
            </div>
          )}
          <div className={`gps-section ${gpsAtivo ? 'active' : ''}`}>
            <button type="button" className={gpsAtivo ? 'btn-gps-stop' : 'btn-gps-start'} onClick={() => { if (!gpsAtivo) { rastrear(); setGpsAtivo(true); } else { pararRastreio(); setGpsAtivo(false); } }}>
              {gpsAtivo ? '🛑 Parar GPS' : '📍 Usar GPS'}
            </button>
            {gpsAtivo && <span className="gps-live"><strong>{distanciaReal.toFixed(2)} km</strong></span>}
          </div>
          <button onClick={handleSalvar} disabled={enviando} className="btn-save">💾 Salvar Viagem</button>
        </div>
      )}

      <div className="filters-section">
        <div className="filter-group" style={{ display: 'grid', gridTemplateColumns: user.acesso === 'Gestor' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '8px' }}>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
            <option value="">Todos os Meses</option>
            {[...Array(12)].map((_, i) => (<option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>))}
          </select>
          {user.acesso === 'Gestor' && (
            <select value={filtroMotorista} onChange={e => setFiltroMotorista(e.target.value)}>
              <option value="">Todos Motoristas</option>
              {listaMotoristas.map(m => (<option key={m} value={m}>{m}</option>))}
            </select>
          )}
          <input type="text" placeholder="Filtrar..." onChange={e => setFiltroRota(e.target.value)} />
        </div>
      </div>

      <button onClick={() => {
        const ws = XLSX.utils.json_to_sheet(viagensFiltradas);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reembolsos");
        XLSX.writeFile(wb, `Relatorio_${new Date().getTime()}.xlsx`);
      }} className="btn-export">📊 Exportar ({viagensFiltradas.length})</button>

      <div className="history">
        {viagensFiltradas.map(v => {
          const { month, year } = getPeriodoCompetencia(v.data);
          return (
            <div key={v.id} className="history-item">
              <div className="info">
                <strong>{v.rota}</strong>
                <small>
                  {v.data} | Comp: {month.toString().padStart(2, '0')}/{year} | {v.distanciaPercorrida}km
                  {user.acesso === 'Gestor' && ` | Por: ${v.criadoPor}`}
                </small>
                {(parseFloat(v.pedagio || 0) > 0 || parseFloat(v.outrosGastos || 0) > 0) && (
                  <small style={{ display: 'block', color: 'var(--secondary)' }}>
                    Extras: R$ {(parseFloat(v.pedagio || 0) + parseFloat(v.outrosGastos || 0)).toFixed(2)}
                    {v.outrosDescricao && ` (${v.outrosDescricao})`}
                  </small>
                )}
              </div>
              <div className="price"><strong>R$ {v.pagamento}</strong></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;