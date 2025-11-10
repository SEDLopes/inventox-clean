# 🚀 Guia de Deploy - InventoX

## Sistema Completo Pronto para Produção! ✅

O sistema InventoX está **100% funcional** com todas as correções e melhorias implementadas:

- ✅ Scanner de códigos funcionando perfeitamente
- ✅ Entrada manual operacional
- ✅ Movimentos de stock automáticos e reais
- ✅ Moeda CVE (Escudos Cabo-verdianos)
- ✅ Histórico com dados reais
- ✅ Importação XLSX/CSV corrigida
- ✅ Interface mobile otimizada
- ✅ Todos os erros corrigidos

---

## 🎯 Opções de Deploy

### **Opção 1: DigitalOcean App Platform (Recomendado)**

1. **Aceder ao DigitalOcean:**
   - Ir para [cloud.digitalocean.com](https://cloud.digitalocean.com)
   - Fazer login na conta

2. **Criar Nova App:**
   - Clicar em "Create" → "Apps"
   - Selecionar "GitHub" como fonte
   - Escolher repositório: `SEDLopes/inventox-app`
   - Branch: `main`

3. **Configuração Automática:**
   - O sistema detectará o `Dockerfile` automaticamente
   - Usar configuração do arquivo `.do/app.yaml`

4. **Base de Dados:**
   - Adicionar MySQL 8.0 database
   - Nome: `inventox-db`
   - Plano: Development (gratuito)

5. **Deploy:**
   - Clicar "Create Resources"
   - Aguardar build (5-10 minutos)

---

### **Opção 2: Railway (Alternativa)**

1. **Aceder ao Railway:**
   - Ir para [railway.app](https://railway.app)
   - Fazer login com GitHub

2. **Novo Projeto:**
   - "New Project" → "Deploy from GitHub repo"
   - Selecionar `SEDLopes/inventox-app`

3. **Configurar Variáveis:**
   ```
   DB_HOST=mysql.railway.internal
   DB_NAME=railway
   DB_USER=root
   DB_PASS=[gerado automaticamente]
   DB_PORT=3306
   DEBUG_MODE=false
   ENVIRONMENT=production
   ```

4. **Adicionar MySQL:**
   - "Add Service" → "Database" → "MySQL"
   - Conectar automaticamente

---

### **Opção 3: Heroku**

1. **Aceder ao Heroku:**
   - Ir para [dashboard.heroku.com](https://dashboard.heroku.com)
   - Fazer login

2. **Nova App:**
   - "New" → "Create new app"
   - Nome: `inventox-app-[seu-nome]`

3. **Deploy:**
   - "Deploy" → "GitHub"
   - Conectar repositório `SEDLopes/inventox-app`
   - Enable automatic deploys

4. **Add-ons:**
   - "Resources" → "Add-ons"
   - Adicionar "JawsDB MySQL" (gratuito)

---

## 🔧 Após o Deploy

### **1. Inicializar Base de Dados:**
```
https://[seu-dominio]/api/init_database.php?token=inventox2024
```

### **2. Testar Sistema:**
- Login: `admin` / `admin123`
- Testar scanner
- Testar importação
- Verificar dashboard

### **3. Configurar Domínio (Opcional):**
- Adicionar domínio personalizado
- Configurar SSL (automático na maioria das plataformas)

---

## 📊 Funcionalidades Testadas

### **✅ Scanner de Códigos:**
- Câmara funciona em mobile e desktop
- Detecção automática de códigos
- Entrada manual como fallback

### **✅ Gestão de Inventário:**
- Criação de sessões
- Contagens automáticas
- Movimentos de stock reais
- Histórico completo

### **✅ Importação:**
- Ficheiros XLSX/CSV
- Processamento Python
- Validação de dados

### **✅ Dashboard:**
- Estatísticas em tempo real
- Valores em CVE
- Interface responsiva

---

## 🌐 URLs de Exemplo

Após o deploy, o sistema estará disponível em:
- **DigitalOcean:** `https://inventox-app-[hash].ondigitalocean.app`
- **Railway:** `https://inventox-app-production.up.railway.app`
- **Heroku:** `https://inventox-app-[nome].herokuapp.com`

---

## 🆘 Suporte

Se houver problemas no deploy:

1. **Verificar logs** da plataforma
2. **Testar localmente** primeiro: `http://localhost:8080`
3. **Verificar variáveis** de ambiente
4. **Inicializar BD** com o token correto

---

## 🎉 Sistema Pronto!

O InventoX está **totalmente funcional** e pronto para uso em produção com todas as funcionalidades implementadas e testadas! 🇨🇻

**Escolha uma das opções acima e faça o deploy!** 🚀
