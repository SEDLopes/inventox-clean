# 🔧 Como Configurar Environment Variables no DigitalOcean

## 📋 **Variáveis para Bulk Editor:**

Copie e cole estas linhas no Bulk Editor do DigitalOcean:

```
DB_HOST=${inventox-db.HOSTNAME}
DB_NAME=${inventox-db.DATABASE}
DB_USER=${inventox-db.USERNAME}
DB_PASS=${inventox-db.PASSWORD}
DB_PORT=${inventox-db.PORT}
DEBUG_MODE=false
ENVIRONMENT=production
```

---

## 🚀 **Passo a Passo:**

### **1. Aceder ao DigitalOcean:**
- Ir para: [cloud.digitalocean.com](https://cloud.digitalocean.com)
- Fazer login na conta

### **2. Navegar para a App:**
- Clicar em **"Apps"** no menu lateral
- Selecionar **"inventox-clean"**

### **3. Aceder às Environment Variables:**
- Clicar em **"Settings"** (Configurações)
- No menu lateral, clicar em **"Environment Variables"**

### **4. Abrir Bulk Editor:**
- Clicar no botão **"Bulk Editor"** (no topo direito)

### **5. Colar as Variáveis:**
- **Copiar** todo o conteúdo do ficheiro `ENV_VARS_BULK.txt`
- **Colar** no editor que abriu
- Verificar que ficou assim:

```
DB_HOST=${inventox-db.HOSTNAME}
DB_NAME=${inventox-db.DATABASE}
DB_USER=${inventox-db.USERNAME}
DB_PASS=${inventox-db.PASSWORD}
DB_PORT=${inventox-db.PORT}
DEBUG_MODE=false
ENVIRONMENT=production
```

### **6. Salvar:**
- Clicar em **"Save"** ou **"Save Changes"**
- Aguardar confirmação

### **7. Redeploy (Importante!):**
- Voltar para a página principal da app
- Clicar em **"Actions"** → **"Force Rebuild and Deploy"**
- Aguardar o deploy completar (5-10 minutos)

---

## ✅ **Verificar Configuração:**

Após o redeploy, testar:

```
https://[seu-app].ondigitalocean.app/api/env_check.php
```

**Deve mostrar:**
```json
{
    "success": true,
    "variables": {
        "DB_HOST": {"value": "[SET]", "has_value": true},
        "DB_NAME": {"value": "[SET]", "has_value": true},
        ...
    }
}
```

**Importante:** Os valores devem ser **reais** (hostnames, nomes de BD, etc.), **NÃO** templates `${...}`.

---

## 🆘 **Se os Valores Ainda Forem Templates `${...}`:**

Se após o redeploy os valores ainda forem templates, significa que o DigitalOcean não está a fazer a substituição automática. Nesse caso:

### **Solução Manual:**

1. **Ir para:** Apps → inventox-clean → **Database** → inventox-db
2. **Copiar os valores reais:**
   - Hostname
   - Database name
   - Username
   - Password
   - Port

3. **Voltar para:** Settings → Environment Variables → Bulk Editor
4. **Substituir** as referências `${...}` pelos valores reais:

```
DB_HOST=inventox-db-do-user-12345678-0.b.db.ondigitalocean.com
DB_NAME=inventox
DB_USER=doadmin
DB_PASS=AVNS_xxxxxxxxxxxxx
DB_PORT=25060
DEBUG_MODE=false
ENVIRONMENT=production
```

5. **Salvar** e **Redeploy**

---

## 📝 **Resumo das Variáveis:**

| Variável | Descrição | Valor |
|----------|-----------|-------|
| `DB_HOST` | Hostname do MySQL | `${inventox-db.HOSTNAME}` |
| `DB_NAME` | Nome da base de dados | `${inventox-db.DATABASE}` |
| `DB_USER` | Utilizador MySQL | `${inventox-db.USERNAME}` |
| `DB_PASS` | Password MySQL | `${inventox-db.PASSWORD}` |
| `DB_PORT` | Porta MySQL | `${inventox-db.PORT}` |
| `DEBUG_MODE` | Modo debug | `false` |
| `ENVIRONMENT` | Ambiente | `production` |

---

**Pronto! Agora pode configurar as variáveis de ambiente! 🚀**

