import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const { acesso, usuario } = req.query;
  const { TENANT_ID, CLIENT_ID, CLIENT_SECRET, ENV_URL } = process.env;

  try {
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

    // Lógica de Hierarquia: Motorista vê apenas o dele, Gestor vê tudo
    let filter = "";
    if (acesso === 'Motorista') {
      filter = `?$filter=cr4a1_criado_por eq '${usuario}'`;
    }

    const entitySetName = "cr4a1_reembolsos_viagenses";
    const response = await axios.get(
      `${ENV_URL}/api/data/v9.2/${entitySetName}${filter}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );

    const viagensMapeadas = response.data.value.map(v => ({
      id: v.cr4a1_reembolsos_viagensid,
      data: v.cr4a1_data ? new Date(v.cr4a1_data).toLocaleDateString('pt-BR') : 'Sem data',
      rota: v.cr4a1_rota || 'Rota não informada',
      combustivel: v.cr4a1_combustivel || 0,
      kmInicio: v.cr4a1_km_inicial || 0,
      kmFim: v.cr4a1_km_final || 0,
      distanciaPercorrida: v.cr4a1_km_percorrido || 0,
      distanciaRealGps: v.cr4a1_km_gps || 0,
      pagamento: v.cr4a1_valor_reembolso || 0,
      pedagio: v.cr4a1_pedagio || 0, // Novo Campo
      outrosGastos: v.cr4a1_outros_gastos || 0, // Novo Campo
      outrosDescricao: v.cr4a1_outros_descricao || "", // Novo Campo
      criadoPor: v.cr4a1_criado_por || 'N/A'
    }));

    return res.status(200).json(viagensMapeadas);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}