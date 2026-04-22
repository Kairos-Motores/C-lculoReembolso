import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const { TENANT_ID, CLIENT_ID, CLIENT_SECRET, ENV_URL } = process.env;

  try {
    // 1. Token
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

    // 2. Buscar dados 
    // DICA: Tente remover o $orderby temporariamente se continuar dando erro 500
    const entitySetName = "cr4a1_reembolsos_viagenses"; 
    const response = await axios.get(
      `${ENV_URL}/api/data/v9.2/${entitySetName}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    // 3. Mapear (Verifique se os nomes das colunas cr4a1_... estão corretos)
    const viagensMapeadas = response.data.value.map(v => ({
      id: v.cr4a1_reembolsos_viagensid, 
      data: v.cr4a1_data ? new Date(v.cr4a1_data).toLocaleDateString('pt-BR') : 'Sem data',
      rota: v.cr4a1_rota || 'Rota não informada',
      combustivel: v.cr4a1_combustivel || 0,
      kmInicio: v.cr4a1_km_inicial || 0,
      kmFim: v.cr4a1_km_final || 0,
      distanciaPercorrida: v.cr4a1_km_percorrido || 0,
      distanciaRealGps: v.cr4a1_km_gps || 0,
      pagamento: v.cr4a1_valor_reembolso || 0
    }));

    return res.status(200).json(viagensMapeadas);

  } catch (error) {
    console.error("ERRO GET DATAVERSE:", error.response?.data || error.message);
    return res.status(500).json({ 
      error: "Falha ao buscar dados", 
      details: error.response?.data || error.message 
    });
  }
}