import axios from 'axios';

export default async function handler(req, res) {
  // Garantir que apenas requisições POST sejam aceitas
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Método ${req.method} não permitido` });
  }

  const { 
    TENANT_ID, 
    CLIENT_ID, 
    CLIENT_SECRET, 
    ENV_URL 
  } = process.env;

  const dados = req.body;

  try {
    // 1. Obter Token de Acesso via OAuth2
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
    // NOTA: Verifique se o Entity Set Name termina com 's' ou 'es' no Power Apps
    // Geralmente para 'viagens', o plural vira 'viagenses' ou permanece 'viagenss'
    const entitySetName = "cr4a1_reembolsos_viagenss"; 

    const dataverseResponse = await axios.post(
      `${ENV_URL}/api/data/v9.2/${entitySetName}`, 
      {
        cr4a1_rota: dados.rota,
        cr4a1_km_inicial: parseFloat(dados.kmInicio),
        cr4a1_km_final: parseFloat(dados.kmFim),
        cr4a1_km_percorrido: parseInt(dados.distanciaPercorrida),
        cr4a1_km_gps: parseFloat(dados.distanciaRealGps),
        cr4a1_valor_reembolso: parseFloat(dados.pagamento),
        cr4a1_combustivel: dados.combustivel ? parseFloat(dados.combustivel) : 0,
        cr4a1_data: new Date().toISOString().split('T')[0]
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    return res.status(201).json(dataverseResponse.data);

  } catch (error) {
    // Log detalhado para o console da Vercel
    const errorData = error.response?.data || error.message;
    console.error('Erro detalhado Dataverse:', JSON.stringify(errorData, null, 2));

    // Retorna o erro real do Dataverse para o seu toast no React
    return res.status(500).json({ 
      error: 'Falha na sincronização',
      message: error.response?.data?.error?.message || "Erro interno no servidor",
      details: errorData 
    });
  }
}