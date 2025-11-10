# 🔍 Como Obter Valores Reais da Base de Dados - DigitalOcean

## ❌ **Problema:**
As variáveis estão configuradas como templates `${inventox-db.HOSTNAME}`, mas o DigitalOcean não está a substituí-las automaticamente pelos valores reais.

## ✅ **Solução: Configurar Manualmente com Valores Reais**

### **Passo 1: Obter Valores da Base de Dados**

1. **Ir para:** [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. **Apps → inventox-clean**
3. **Clicar em "Database"** (no menu lateral ou na lista de componentes)
4. **Clicar em "inventox-db"**

### **Passo 2: Copiar Valores**

Na página da base de dados, copie os seguintes valores:

#### **📋 Informações Necessárias:**

1. **Hostname:**
   - Procure por "Host" ou "Hostname"
   - Exemplo: `inventox-db-do-user-12345678-0.b.db.ondigitalocean.com`

2. **Database Name:**
   - Procure por "Database" ou "Database Name"
   - Exemplo: `inventox` ou `defaultdb`

3. **Username:**
   - Procure por "User" ou "Username"
   - Exemplo: `doadmin`

4. **Password:**
   - Procure por "Password" ou clique em "Show" para revelar
   - Exemplo: `AVNS_xxxxxxxxxxxxx`

5. **Port:**
   - Procure por "Port" ou "Port Number"
   - Exemplo: `25060` (porta padrão do DigitalOcean Managed Database)

### **Passo 3: Configurar Environment Variables**

1. **Voltar para:** Apps → inventox-clean → **Settings**
2. **Clicar em "Environment Variables"**
3. **Clicar em "Bulk Editor"**
4. **Substituir** as variáveis com os valores reais:

```
DB_HOST=inventox-db-do-user-12345678-0.b.db.ondigitalocean.com
DB_NAME=inventox
DB_USER=doadmin
DB_PASS=AVNS_xxxxxxxxxxxxx
DB_PORT=25060
DEBUG_MODE=false
ENVIRONMENT=production
```

**⚠️ IMPORTANTE:** Substitua os valores acima pelos valores reais da sua base de dados!

### **Passo 4: Salvar e Redeploy**

1. **Clicar em "Save"**
2. **Voltar para a página principal** da app
3. **Actions → Force Rebuild and Deploy**
4. **Aguardar** 5-10 minutos

### **Passo 5: Verificar**

Após o redeploy, testar:

```
https://[seu-app].ondigitalocean.app/api/env_check.php
```

**Deve mostrar valores reais**, não templates `${...}`.

---

## 🔍 **Alternativa: Verificar no Dashboard**

Se não encontrar os valores na página da base de dados:

1. **Ir para:** Databases → **inventox-db**
2. **Clicar em "Connection Details"** ou **"Connection Parameters"**
3. **Copiar os valores** de:
   - Host
   - Database
   - User
   - Password
   - Port

---

## 📝 **Exemplo Completo:**

Se os valores da sua base de dados forem:

- **Hostname:** `inventox-db-do-user-87654321-0.b.db.ondigitalocean.com`
- **Database:** `inventox`
- **Username:** `doadmin`
- **Password:** `AVNS_abc123xyz789`
- **Port:** `25060`

Então no Bulk Editor deve ficar:

```
DB_HOST=inventox-db-do-user-87654321-0.b.db.ondigitalocean.com
DB_NAME=inventox
DB_USER=doadmin
DB_PASS=AVNS_abc123xyz789
DB_PORT=25060
DEBUG_MODE=false
ENVIRONMENT=production
```

---

## ✅ **Resultado Esperado:**

Após configurar com valores reais:
- ✅ Conexão à base de dados funcionará
- ✅ Sistema poderá inicializar
- ✅ Login funcionará: admin / admin123

---

**Configure com os valores reais e o sistema funcionará! 🚀**

