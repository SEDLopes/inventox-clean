# 🏪 InventoX - Sistema de Inventário

Sistema completo de gestão de inventário com scanner de códigos de barras.

## ✨ Funcionalidades

- 📱 **Scanner de Códigos**: Câmara mobile e desktop
- ⌨️ **Entrada Manual**: Fallback para códigos não legíveis  
- 📊 **Dashboard**: Estatísticas em tempo real
- 💰 **Moeda CVE**: Escudos Cabo-verdianos
- 📈 **Histórico**: Movimentos de stock automáticos
- 📁 **Importação**: Ficheiros XLSX/CSV
- 🏢 **Multi-empresa**: Gestão de empresas e armazéns
- 👥 **Utilizadores**: Sistema de permissões

## 🚀 Deploy Rápido

### DigitalOcean App Platform

1. Fork este repositório
2. Ir para [cloud.digitalocean.com](https://cloud.digitalocean.com)
3. Create → Apps → GitHub → Selecionar repositório
4. Adicionar MySQL database
5. Deploy!

### Após Deploy

Inicializar base de dados:
```
https://[seu-app].ondigitalocean.app/api/init_database.php?token=inventox2024
```

## 🔐 Login Padrão

- **Username:** admin
- **Password:** admin123

## 🛠️ Desenvolvimento Local

```bash
docker-compose up -d
```

Aceder: http://localhost:8080/frontend/

---

**Sistema 100% funcional e testado! 🇨🇻**
