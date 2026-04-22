import axios from 'axios';

export default async function handler(req, res) {
  // Log para debug no painel da Vercel
  console.log(`Método recebido: ${req.method}`);

  // 1. Lidar com requisições OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST');
    return res.status(200).end();
  }

  // 2. Trava de segurança para aceitar apenas POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: `Método ${req.method} não permitido. Use POST.` 
    });
  }

  const { 
    TENANT_ID, 
    CLIENT_ID, 
    CLIENT_SECRET, 
    ENV_URL 
  } = process.env;

  const dados = req.body;

  try {
    // 3. Obter Token de Acesso
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

    // 4. Enviar dados para o Dataverse
    // O plural de viagens geralmente é 'viagenses' no plural automático do Dataverse
    const entitySetName = "cr4a1_reembolsos_viagenses"; 

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
        // Garante que a data seja enviada no formato YYYY-MM-DD
        cr4a1_data: new Date().toISOString().split('T')[0]
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    );

    return res.status(201).json({
      success: true,
      data: dataverseResponse.data
    });

  } catch (error) {
    const errorDetail = error.response?.data || error.message;
    console.error('Erro na integração Dataverse:', JSON.stringify(errorDetail, null, 2));

    return res.status(500).json({ 
      success: false,
      message: error.response?.data?.error?.message || "Falha ao sincronizar",
      debug: errorDetail 
    });
  }
}