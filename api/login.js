import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { usuario, senha } = req.body;
  const { TENANT_ID, CLIENT_ID, CLIENT_SECRET, ENV_URL } = process.env;

  try {
    // 1. Obter Token
    const tokenResponse = await axios.post(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, 
      new URLSearchParams({
        client_id: CLIENT_ID,
        scope: `${ENV_URL}/.default`,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials',
      }).toString()
    );
    const token = tokenResponse.data.access_token;

    // 2. Buscar usuário (Filtrando por login e senha)
    const table = "cr4a1_usuarios_apps"; // Nome da sua nova tabela no plural
    const filter = `$filter=cr4a1_usuario eq '${usuario}' and cr4a1_senha eq '${senha}'`;
    
    const response = await axios.get(`${ENV_URL}/api/data/v9.2/${table}?${filter}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });

    if (response.data.value.length > 0) {
      const user = response.data.value[0];
      return res.status(200).json({
        success: true,
        usuario: user.cr4a1_usuario,
        acesso: user.cr4a1_acesso // 'Gestor' ou 'Motorista'
      });
    } else {
      return res.status(401).json({ success: false, message: "Usuário ou senha incorretos" });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}