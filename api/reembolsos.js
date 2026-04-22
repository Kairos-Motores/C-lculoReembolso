import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { 
    TENANT_ID, 
    CLIENT_ID, 
    CLIENT_SECRET, 
    ENV_URL 
  } = process.env;

  const dados = req.body;

  try {
    // 1. Obter Token de Acesso via OAuth2 (Client Credentials Flow)
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: CLIENT_ID,
        scope: `${ENV_URL}/.default`,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenResponse.data.access_token;

    // 2. Enviar dados para o Dataverse
    // O nome da tabela no plural costuma ser o padrão da API (ex: cr4a1_reembolsos_viagenss)
    // Verifique no Dataverse o "Entity Set Name"
    const dataverseResponse = await axios.post(
      `${ENV_URL}/api/data/v9.2/cr4a1_reembolsos_viagenss`, 
      {
        cr4a1_rota: dados.rota,
        cr4a1_km_inicial: parseFloat(dados.kmInicio),
        cr4a1_km_final: parseFloat(dados.kmFim),
        cr4a1_km_percorrido: parseInt(dados.distanciaPercorrida),
        cr4a1_km_gps: parseFloat(dados.distanciaRealGps),
        cr4a1_valor_reembolso: parseFloat(dados.pagamento),
        cr4a1_combustivel: dados.combustivel ? parseFloat(dados.combustivel) : 0,
        cr4a1_data: new Date().toISOString().split('T')[0] // Formato YYYY-MM-DD
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    );

    return res.status(201).json(dataverseResponse.data);

  } catch (error) {
    console.error('Erro na integração:', error.response?.data || error.message);
    return res.status(500).json({ 
      error: 'Falha ao sincronizar com Dataverse',
      details: error.response?.data?.error?.message || error.message 
    });
  }
}