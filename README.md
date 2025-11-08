# InventoX - Sistema de Gestão de Inventário

Sistema completo de gestão de inventário com interface web responsiva e suporte para dispositivos móveis.

## 🚀 Características

- ✅ Gestão completa de inventário
- ✅ Digitalização de códigos de barras
- ✅ Importação de ficheiros XLSX
- ✅ Interface responsiva para mobile
- ✅ API REST completa
- ✅ Sessões de contagem
- ✅ Relatórios e exportação

## 📦 Estrutura do Projeto

```
InventoX/
├── frontend/          # Interface web
├── api/              # API PHP
├── electron/         # Aplicação Electron (desktop)
├── docs/             # Documentação
├── scripts/          # Scripts utilitários
├── uploads/          # Ficheiros enviados
└── Dockerfile        # Configuração Docker
```

## 🛠️ Instalação

### Desenvolvimento Local

1. **Requisitos:**
   - PHP 8.1+
   - MySQL 8.0+
   - Apache/Nginx

2. **Configuração:**
   ```bash
   # Copiar variáveis de ambiente
   cp .env.example .env
   
   # Configurar base de dados
   mysql -u root -p < db.sql
   ```

3. **Iniciar servidor:**
   ```bash
   php -S localhost:8080 -t .
   ```

### Aplicação Electron (Desktop)

```bash
# Instalar dependências
npm install

# Iniciar aplicação
npm start

# Build para produção
npm run build
```

### Deploy DigitalOcean

1. **Criar App Platform:**
   - Acessar DigitalOcean Dashboard
   - Criar novo App
   - Conectar repositório GitHub

2. **Configurar Database:**
   - Adicionar MySQL Database
   - Configurar variáveis de ambiente

3. **Deploy:**
   - O deploy é automático via GitHub
   - Usa Dockerfile para build

## 📚 Documentação

Consulte a pasta `docs/` para documentação completa:
- `docs/INSTALLATION.md` - Guia de instalação
- `docs/API_REFERENCE.md` - Referência da API
- `docs/MOBILE_GUIDE.md` - Guia mobile
- `docs/deployment/` - Guias de deploy

## 🔧 Tecnologias

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** PHP 8.1, MySQL 8.0
- **Desktop:** Electron
- **Deploy:** Docker, DigitalOcean App Platform

## 📝 Licença

MIT License - Ver `docs/LICENSE.md`

## 👤 Autor

Sandro Lopes