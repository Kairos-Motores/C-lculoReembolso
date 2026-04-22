import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { TENANT_ID, CLIENT_ID, CLIENT_SECRET, ENV_URL } = process.env;
  const dados = req.body;

  try {
    // 1. Obter Token
    const tokenResponse = await axios.post(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: CLIENT_ID,
        scope: `${ENV_URL}/.default`,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials',
      }).toString()
    );

    const token = tokenResponse.data.access_token;

    /**
     * IMPORTANTE: No Dataverse, o plural de "viagens" costuma ser "viagenses" 
     * se o sistema seguiu a regra de plural automática.
     * Tente 'cr4a1_reembolsos_viagenses'. Se der 404, tente 'cr4a1_reembolsos_viagens'.
     */
    const entitySetName = "cr4a1_reembolsos_viagenses"; 

    // 2. Enviar para Dataverse
    const response = await axios.post(
      `${ENV_URL}/api/data/v9.2/${entitySetName}`,
      {
        "cr4a1_rota": dados.rota,
        "cr4a1_km_inicial": parseFloat(dados.kmInicio),
        "cr4a1_km_final": parseFloat(dados.kmFim),
        "cr4a1_km_percorrido": parseInt(dados.distanciaPercorrida),
        "cr4a1_km_gps": parseFloat(dados.distanciaRealGps),
        "cr4a1_valor_reembolso": parseFloat(dados.pagamento),
        "cr4a1_combustivel": dados.combustivel ? parseFloat(dados.combustivel) : 0,
        "cr4a1_data": new Date().toISOString().split('T')[0]
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      }
    );

    return res.status(201).json(response.data);

  } catch (error) {
    const errorDetail = error.response?.data || error.message;
    console.error("ERRO NO DATAVERSE:", JSON.stringify(errorDetail, null, 2));
    
    return res.status(500).json({ 
      success: false, 
      message: errorDetail?.error?.message || "Erro de conexão",
      debug: errorDetail 
    });
  }
}