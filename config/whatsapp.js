/** Central WhatsApp Cloud API configuration (all values come from .env). */
module.exports = {
  get apiUrl() { return process.env.WHATSAPP_API_URL; },
  get token() { return process.env.WHATSAPP_ACCESS_TOKEN; },
  get adminNumber() { return (process.env.WHATSAPP_ADMIN_NUMBER || '').replace(/\D/g, ''); },
  get templateName() { return process.env.WHATSAPP_TEMPLATE_NAME; },
  get templateLang() { return process.env.WHATSAPP_TEMPLATE_LANG || 'en'; },
  isConfigured() { return Boolean(this.apiUrl && this.token && this.adminNumber); },
};
