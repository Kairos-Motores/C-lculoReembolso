import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Toaster, toast } from 'react-hot-toast';
import { useDistance } from './hooks/useDistance';
import './App.css';

function App() {
  // Estado de Autenticação
  const [user, setUser] = useState(() => {
    const salvo = localStorage.getItem('user_reembolso');
    return salvo ? JSON.parse(salvo) : null;
  });

  const [loginForm, setLoginForm] = useState({ usuario: '', senha: '' });
  const [viagens, setViagens] = useState([]);
  const [form, setForm] = useState({ rota: '', combustivel: '', kmInicio: '', kmFim: '' });
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroRota, setFiltroRota] = useState('');
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

  // Carregar dados específicos do nível de acesso
  useEffect(() => {
    if (user) {
      carregarDados();
    }
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
        toast.success(`Bem-vindo, ${dados.usuario}!`, { id: idToast });
      } else {
        toast.error(dados.message || "Credenciais inválidas", { id: idToast });
      }
    } catch (e) { 
      toast.error("Erro de conexão.", { id: idToast }); 
    } finally {
      setEnviando(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user_reembolso');
    setViagens([]);
  };

  const totalGeral = useMemo(() => 
    viagens.reduce((acc, v) => acc + parseFloat(v.pagamento), 0).toFixed(2)
  , [viagens]);

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
    if (!rota) return toast.error("Informe a rota!");

    let distanciaFinal = 0;
    if (!gpsAtivo && kmInicio && kmFim) {
      distanciaFinal = Math.ceil(parseFloat(kmFim) - parseFloat(kmInicio));
    } else if (gpsAtivo && distanciaReal > 0) {
      distanciaFinal = Math.ceil(distanciaReal);
    } else {
      return toast.error("Use o GPS ou preencha o KM!");
    }

    const valor = (distanciaFinal * TAXA).toFixed(2);
    const novaViagem = {
      ...form,
      distanciaPercorrida: distanciaFinal,
      distanciaRealGps: distanciaReal.toFixed(2),
      pagamento: valor,
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
      setForm({ rota: '', combustivel: '', kmInicio: '', kmFim: '' });
      if (gpsAtivo) { pararRastreio(); setGpsAtivo(false); }
      toast.success("Salvo!");
    } catch (e) { toast.error("Erro ao salvar."); }
    finally { setEnviando(false); }
  };

  // TELA DE LOGIN CORRIGIDA
  if (!user) {
    return (
      <div className="login-screen">
        <Toaster position="top-center" />
        <form className="login-card" onSubmit={handleLogin}>
          <div className="login-header">
            <h2>Calc Reembolso</h2>
            <p>Faça login para continuar</p>
          </div>
          
          <div className="login-inputs">
            <input 
              type="text" 
              placeholder="Usuário" 
              required 
              onChange={e => setLoginForm({...loginForm, usuario: e.target.value})} 
            />
            <input 
              type="password" 
              placeholder="Senha (Matrícula)" 
              required 
              onChange={e => setLoginForm({...loginForm, senha: e.target.value})} 
            />
          </div>

          <button className="btn-save" type="submit" disabled={enviando}>
            {enviando ? "Acessando..." : "Entrar"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <Toaster position="top-center" />
      <header className="header-nav">
        <h1>{user.acesso === 'Gestor' ? 'Painel Gestor' : 'Minhas Viagens'}</h1>
        <div style={{display: 'flex', gap: '10px'}}>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="theme-toggle">{isDarkMode ? '☀️' : '🌙'}</button>
          <button onClick={handleLogout} className="theme-toggle">🚪</button>
        </div>
      </header>

      <div className="stats-container">
        <div className="stat-card">
          <span className="label">Total {user.acesso === 'Gestor' ? 'Global' : 'Pessoal'}</span>
          <span className="value">R$ {totalGeral}</span>
        </div>
      </div>

      {user.acesso === 'Motorista' && (
        <div className="card">
          <h3>Nova Viagem</h3>
          <input className="full-width" type="text" placeholder="Nome da Rota" value={form.rota} onChange={e => setForm({...form, rota: e.target.value})} />
          {!gpsAtivo && (
            <div className="input-group-row">
              <input type="number" placeholder="KM Inicial" value={form.kmInicio} onChange={e => setForm({...form, kmInicio: e.target.value})} />
              <input type="number" placeholder="KM Final" value={form.kmFim} onChange={e => setForm({...form, kmFim: e.target.value})} />
            </div>
          )}
          <div className={`gps-section ${gpsAtivo ? 'active' : ''}`}>
            <button onClick={() => { if(!gpsAtivo) { rastrear(); setGpsAtivo(true); } else { pararRastreio(); setGpsAtivo(false); } }}>
              {gpsAtivo ? '🛑 Parar GPS' : '📍 Usar GPS'}
            </button>
            {gpsAtivo && <span className="gps-live">{distanciaReal.toFixed(2)} km</span>}
          </div>
          <button onClick={handleSalvar} disabled={enviando} className="btn-save">Salvar</button>
        </div>
      )}

      <div className="filters-section">
        <div className="filter-group">
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
            <option value="">Todos os Meses</option>
            {[...Array(12)].map((_, i) => (<option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>))}
          </select>
          <input type="text" placeholder={user.acesso === 'Gestor' ? "Buscar motorista ou rota..." : "Filtrar rota..."} onChange={e => setFiltroRota(e.target.value)} />
        </div>
      </div>

      <button onClick={() => {
        const ws = XLSX.utils.json_to_sheet(viagensFiltradas);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reembolsos");
        XLSX.writeFile(wb, `Relatorio_Reembolso_${new Date().getTime()}.xlsx`);
      }} className="btn-export">Exportar Seleção ({viagensFiltradas.length})</button>

      <div className="history">
        {viagensFiltradas.map(v => (
          <div key={v.id} className="history-item">
            <div className="info">
              <strong>{v.rota}</strong>
              <small>{v.data} | {v.distanciaPercorrida}km {user.acesso === 'Gestor' && `| Por: ${v.criadoPor}`}</small>
            </div>
            <div className="price"><strong>R$ {v.pagamento}</strong></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;