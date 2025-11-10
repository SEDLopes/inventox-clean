# 🗄️ Inicializar Base de Dados - InventoX

## ✅ **Status Atual:**

- ✅ **Conexão à base de dados:** Funcionando!
- ✅ **DNS resolvido:** OK
- ✅ **Credenciais:** Corretas
- ❌ **Base de dados 'inventox':** Não existe

---

## 🚀 **Solução: Inicializar Base de Dados**

### **Opção 1: Inicialização Automática (Recomendado)**

Aceder ao endpoint de inicialização:

```
https://[seu-app].ondigitalocean.app/api/init_database.php?token=inventox2024
```

**O que faz:**
- Cria a base de dados `inventox` (se não existir)
- Cria todas as tabelas necessárias
- Insere utilizador admin padrão
- Configura estrutura inicial

**Resultado esperado:**
```json
{
    "success": true,
    "message": "Database inicializada com sucesso!"
}
```

---

### **Opção 2: Criar Base de Dados Manualmente**

Se a inicialização automática não funcionar:

#### **Passo 1: Criar Base de Dados no DigitalOcean**

1. **Ir para:** [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. **Databases → inventox-db**
3. **Clicar em "Databases"** ou **"Create Database"**
4. **Nome:** `inventox`
5. **Create**

#### **Passo 2: Verificar Nome da Base de Dados**

1. **Databases → inventox-db → Connection Details**
2. **Verificar o nome da base de dados padrão**
3. Pode ser `defaultdb` em vez de `inventox`

#### **Passo 3: Atualizar Environment Variable**

Se a base de dados padrão for `defaultdb`:

1. **Apps → inventox-clean → Settings → Environment Variables**
2. **Atualizar `DB_NAME`** para `defaultdb`
3. **Save**
4. **Redeploy**

---

## 🔍 **Verificar Nome da Base de Dados**

### **Método 1: DigitalOcean Dashboard**

1. **Databases → inventox-db**
2. **Connection Details** ou **Overview**
3. **Procurar por "Database"** ou **"Database Name"**
4. **Copiar o nome exato**

### **Método 2: Testar Conexão**

Aceder ao endpoint de teste:

```
https://[seu-app].ondigitalocean.app/api/test_db_connection.php
```

O diagnóstico mostrará o nome da base de dados configurado.

---

## 📋 **Passo a Passo Completo:**

### **1. Verificar Nome da Base de Dados**

1. **Databases → inventox-db → Connection Details**
2. **Copiar o nome da base de dados**
3. Pode ser:
   - `inventox`
   - `defaultdb`
   - Outro nome

### **2. Atualizar Environment Variable (Se Necessário)**

Se o nome não for `inventox`:

1. **Apps → inventox-clean → Settings → Environment Variables**
2. **Bulk Editor**
3. **Atualizar `DB_NAME`** com o nome correto:
   ```
   DB_NAME=defaultdb
   ```
   (ou o nome que encontrar)
4. **Save**

### **3. Inicializar Base de Dados**

Aceder ao endpoint:

```
https://[seu-app].ondigitalocean.app/api/init_database.php?token=inventox2024
```

### **4. Verificar Inicialização**

Testar conexão novamente:

```
https://[seu-app].ondigitalocean.app/api/test_db_connection.php
```

**Deve mostrar:**
```json
{
    "success": true,
    "message": "Conexão à base de dados bem-sucedida!",
    "diagnostics": {
        "connection": "OK",
        "query_test": "OK"
    }
}
```

---

## 🎯 **Solução Rápida:**

### **Se a base de dados padrão for `defaultdb`:**

1. **Apps → inventox-clean → Settings → Environment Variables**
2. **Bulk Editor**
3. **Alterar:**
   ```
   DB_NAME=defaultdb
   ```
4. **Save**
5. **Redeploy**
6. **Inicializar:**
   ```
   https://[seu-app].ondigitalocean.app/api/init_database.php?token=inventox2024
   ```

---

## ✅ **Após Inicialização:**

1. **Testar Login:**
   ```
   https://[seu-app].ondigitalocean.app/frontend/
   ```
   - **Username:** `admin`
   - **Password:** `admin123`

2. **Verificar Funcionalidades:**
   - Dashboard
   - Scanner
   - Importação
   - Gestão

---

**Inicialize a base de dados e o sistema estará pronto! 🚀**

