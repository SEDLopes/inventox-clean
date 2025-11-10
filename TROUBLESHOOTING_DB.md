# 🔧 Troubleshooting - Erro de Conexão à Base de Dados

## ❌ **Erro:**
```
SQLSTATE[HY000] [2002] php_network_getaddresses: getaddrinfo for 
inventox-db-do-user-12345678-0.b.db.ondigitalocean.com failed: 
Name or service not known
```

## 🔍 **Causas Possíveis:**

### **1. Base de Dados em Rede Privada (Mais Comum)**

O DigitalOcean Managed Database pode estar configurado para aceitar apenas conexões de:
- **Trusted Sources** (IPs específicos)
- **VPC** (Virtual Private Cloud)
- **Same App** (mesma aplicação)

### **2. Hostname Incorreto**

O hostname pode estar incorreto ou desatualizado.

### **3. Firewall/Security Groups**

A base de dados pode ter regras de firewall bloqueando conexões.

---

## ✅ **Soluções:**

### **Solução 1: Verificar Configuração da Base de Dados**

1. **Ir para:** [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. **Databases → inventox-db**
3. **Clicar em "Settings"** ou **"Trusted Sources"**

#### **Opção A: Adicionar App como Trusted Source**

1. **Settings → Trusted Sources**
2. **Add Trusted Source**
3. **Selecionar:** "App Platform" → "inventox-clean"
4. **Save**

#### **Opção B: Configurar VPC**

1. **Settings → Network**
2. **Selecionar VPC** (se disponível)
3. **Garantir que a App está na mesma VPC**

### **Solução 2: Verificar Hostname Correto**

1. **Databases → inventox-db**
2. **Clicar em "Connection Details"** ou **"Overview"**
3. **Copiar o hostname EXATO** (pode ser diferente do que configurou)
4. **Verificar se o hostname está correto** nas Environment Variables

### **Solução 3: Usar Hostname Privado (Se Disponível)**

Se a base de dados tiver um hostname privado:

1. **Databases → inventox-db → Connection Details**
2. **Procurar por "Private Network Hostname"**
3. **Usar esse hostname** em vez do público
4. **Atualizar `DB_HOST`** nas Environment Variables

### **Solução 4: Verificar Firewall**

1. **Databases → inventox-clean → Settings**
2. **Verificar "Firewall Rules"**
3. **Garantir que permite conexões** da App Platform

---

## 🔍 **Diagnóstico Avançado:**

### **1. Testar Conexão Manualmente**

Criar um endpoint de teste (temporário):

```
https://[seu-app].ondigitalocean.app/api/test_db_connection.php
```

### **2. Verificar Logs**

1. **Apps → inventox-clean → Runtime Logs**
2. **Procurar por erros** de conexão
3. **Verificar mensagens** específicas

### **3. Verificar Network Settings**

1. **Apps → inventox-clean → Settings**
2. **Verificar "Network"** ou **"VPC"**
3. **Garantir que está na mesma rede** que a base de dados

---

## 📋 **Checklist de Verificação:**

- [ ] Base de dados está **ativa** e **running**
- [ ] App está adicionada como **Trusted Source**
- [ ] Hostname está **correto** nas Environment Variables
- [ ] Porta está **correta** (geralmente `25060` para DigitalOcean)
- [ ] Username e Password estão **corretos**
- [ ] App e Database estão na **mesma VPC** (se aplicável)
- [ ] Firewall permite conexões da **App Platform**

---

## 🚀 **Solução Rápida (Recomendada):**

### **Passo 1: Adicionar App como Trusted Source**

1. **Databases → inventox-db**
2. **Settings → Trusted Sources**
3. **Add Trusted Source**
4. **Selecionar:** "App Platform" → "inventox-clean"
5. **Save**

### **Passo 2: Verificar Hostname**

1. **Databases → inventox-db → Connection Details**
2. **Copiar hostname EXATO**
3. **Apps → inventox-clean → Settings → Environment Variables**
4. **Atualizar `DB_HOST`** com o hostname correto
5. **Save**

### **Passo 3: Redeploy**

1. **Apps → inventox-clean**
2. **Actions → Force Rebuild and Deploy**
3. **Aguardar** 5-10 minutos

### **Passo 4: Testar Novamente**

```
https://[seu-app].ondigitalocean.app/api/init_database.php?token=inventox2024
```

---

## 🆘 **Se Ainda Não Funcionar:**

1. **Verificar se a base de dados está acessível** de fora:
   - Tentar conectar com cliente MySQL (MySQL Workbench, DBeaver, etc.)
   - Se não conseguir, pode ser problema de firewall

2. **Criar nova base de dados** com configurações públicas:
   - Databases → Create Database
   - **Selecionar:** "Public" ou "Allow all IPs" (para teste)

3. **Contactar suporte DigitalOcean** se o problema persistir

---

**Siga estes passos e o problema deve ser resolvido! 🔧**

