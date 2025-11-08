# 🚀 Quick Start - InventoX

Guia rápido para começar a usar o InventoX.

## 📦 Instalação Local

### Desenvolvimento Web

```bash
# Iniciar servidor PHP local
php -S localhost:8080 -t .
```

Acesse: `http://localhost:8080/frontend/`

### Aplicação Electron (Desktop)

```bash
# Instalar dependências (já feito)
npm install

# Iniciar aplicação
npm start

# Build para produção
npm run build:win    # Windows
npm run build:mac     # macOS
npm run build:linux   # Linux
```

## 🌐 Deploy DigitalOcean

1. **Acesse:** [DigitalOcean Dashboard](https://cloud.digitalocean.com/)
2. **Crie App Platform:**
   - Apps → Create App
   - GitHub → Selecionar `SEDLopes/inventox-app`
   - Branch: `main`
3. **Adicione Database:**
   - Add Database → MySQL 8
   - Nome: `inventox-db`
4. **Deploy automático:**
   - O DigitalOcean detectará `Dockerfile` e `.do/app.yaml`
   - Deploy será automático
5. **Inicializar Database:**
   ```
   https://seu-app.ondigitalocean.app/api/init_database.php?token=inventox2024
   ```

## 📚 Documentação Completa

- **Deploy:** `docs/deployment/DIGITALOCEAN_DEPLOY_FINAL.md`
- **API:** `docs/API_REFERENCE.md`
- **Instalação:** `docs/INSTALLATION.md`
- **Mobile:** `docs/MOBILE_GUIDE.md`

## ✅ Checklist

- [ ] Dependências instaladas (`npm install`)
- [ ] Servidor local funcionando
- [ ] Electron testado (`npm start`)
- [ ] Deploy DigitalOcean configurado
- [ ] Database inicializado

## 🎉 Pronto!

Sistema pronto para desenvolvimento e deploy!
