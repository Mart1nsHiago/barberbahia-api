const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ── STORAGE DE CÓDIGOS (em produção, usar banco de dados) ──────
const verificationCodes = new Map();

// ── CONFIGURAÇÃO DO WHATSAPP ───────────────────────────────────
// Adicione suas credenciais no arquivo .env
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_ID}/messages`;

// — FUNÇÃO PARA ENVIAR CÓDIGO VIA WHATSAPP
async function sendWhatsAppCode(phoneNumber, name, code) {
  try {
    // Remove formatação do número
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

const payload = {
    messaging_product: 'whatsapp',
    to: fullPhone,
    type: 'template',
    template: {
      name: 'ticket_barbearia', // Usando o seu template que JÁ ESTÁ APROVADO!
      language: {
        code: 'pt_BR'
      },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: name || 'Cliente' }, // Para o {{1}} (Provavelmente o Nome)
            { type: 'text', text: String(code) }       // Para o {{2}} (O código de 4 dígitos)
          ]
        }
      ]
    }
  };

    const response = await fetch(WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao enviar código:', JSON.stringify(error, null, 2));
      return false;
    }

    console.log('Código enviado com sucesso para:', fullPhone);
    return true;
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    return false;
  }
}

// ── ENDPOINT: ENVIAR CÓDIGO ────────────────────────────────────
app.post('/api/send-code', async (req, res) => {
  const { phone, name } = req.body;

  // Validação básica
  if (!phone || !name) {
    return res.status(400).json({ error: 'Telefone e nome são obrigatórios' });
  }

  // Gerar código de 4 dígitos
  const code = crypto.randomInt(1000, 10000).toString();

  // Armazenar com timestamp (expira em 10 minutos)
  const expiresAt = Date.now() + 10 * 60 * 1000;
  verificationCodes.set(phone, { code, expiresAt, attempts: 0, name });

  // Enviar via WhatsApp (agora com os 3 parâmetros corretos!)
  const sent = await sendWhatsAppCode(phone, name, code);

  if (sent) {
    res.json({
      success: true,
      message: 'Código enviado com sucesso! Verifique seu WhatsApp.',
    });
  } else {
    // Falha na API do WhatsApp
    console.warn('Erro ao enviar via API do WhatsApp. Verifique as credenciais ou o console.');
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar o código via WhatsApp.',
      debug: { code }, // Em produção, remova essa linha de debug
    });
  }
});

// ── ENDPOINT: VERIFICAR CÓDIGO ─────────────────────────────────
app.post('/api/verify-code', (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: 'Telefone e código são obrigatórios' });
  }

  const stored = verificationCodes.get(phone);

  // Verificar se existe registro
  if (!stored) {
    return res.status(400).json({ error: 'Nenhum código foi enviado para este número' });
  }

  // Verificar expiração
  if (Date.now() > stored.expiresAt) {
    verificationCodes.delete(phone);
    return res.status(400).json({ error: 'Código expirou. Solicite um novo.' });
  }

  // Limite de tentativas
  if (stored.attempts >= 5) {
    verificationCodes.delete(phone);
    return res.status(400).json({ error: 'Muitas tentativas. Solicite um novo código.' });
  }

  // Verificar código
  if (code === stored.code) {
    verificationCodes.delete(phone);
    return res.json({
      success: true,
      message: 'Número verificado com sucesso!',
      phone,
      name: stored.name,
    });
  } else {
    stored.attempts += 1;
    return res.status(400).json({
      error: 'Código incorreto',
      attemptsRemaining: 5 - stored.attempts,
    });
  }
});

// ── HEALTH CHECK ───────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    whatsappConfigured: !!(WHATSAPP_PHONE_ID && WHATSAPP_ACCESS_TOKEN),
  });
});

// ── INICIAR SERVIDOR ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`⚠️  Configuração do WhatsApp: ${WHATSAPP_PHONE_ID && WHATSAPP_ACCESS_TOKEN ? '✅' : '❌'}`);
});
