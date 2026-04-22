import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const { TENANT_ID, CLIENT_ID, CLIENT_SECRET, ENV_URL } = process.env;

  try {
    // 1. Token de Acesso
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

    // 2. Buscar dados (usando o mesmo Entity Set Name do POST)
    // Usamos $orderby para trazer as mais recentes primeiro
    const entitySetName = "cr4a1_reembolsos_viagenses"; 
    const response = await axios.get(
      `${ENV_URL}/api/data/v9.2/${entitySetName}?$orderby=createdon desc`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json',
          'Prefer': 'odata.include-annotations="*"'
        }
      }
    );

    // 3. Mapear os nomes das colunas do Dataverse de volta para o formato do seu App
    const viagensMapeadas = response.data.value.map(v => ({
      id: v.cr4a1_reembolsos_viagensid, // ID único do Dataverse
      data: new Date(v.cr4a1_data).toLocaleDateString('pt-BR'),
      rota: v.cr4a1_rota,
      combustivel: v.cr4a1_combustivel,
      kmInicio: v.cr4a1_km_inicial,
      kmFim: v.cr4a1_km_final,
      distanciaPercorrida: v.cr4a1_km_percorrido,
      distanciaRealGps: v.cr4a1_km_gps,
      pagamento: v.cr4a1_valor_reembolso
    }));

    return res.status(200).json(viagensMapeadas);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}