import axios from "axios";

// Exemplo de lógica para buscar o Token (Node.js/Vercel Function)
const response = await axios.post(
  `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
  new URLSearchParams({
    client_id: process.env.CLIENT_ID,
    scope: `${process.env.ENV_URL}/.default`,
    client_secret: process.env.CLIENT_SECRET,
    grant_type: 'client_credentials',
  })
);
return response.data.access_token;