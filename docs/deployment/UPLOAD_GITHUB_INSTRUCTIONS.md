# 🚀 Upload para GitHub - Instruções Finais

## 📋 **Passo a Passo para Upload**

### **1. Criar Repositório no GitHub (se ainda não criou):**
- Acesse: https://github.com/new
- **Nome**: `inventox-system`
- **Descrição**: `Sistema de Gestão de Inventário com Scanner Mobile`
- **Público**
- **NÃO** adicionar README
- **Criar repositório**

### **2. Fazer Upload do Código:**

**Execute no seu terminal:**

```bash
cd "/Users/SandroLopes/Documents/CURSOR AI/InventoX"

# Push para GitHub (vai pedir username e password/token)
git push -u origin main
```

**Quando pedir credenciais:**
- **Username**: `SEDLopes`
- **Password**: Use um **Personal Access Token** (não a password normal)

### **3. Criar Personal Access Token (se necessário):**

1. **Acesse**: https://github.com/settings/tokens
2. **Generate new token** → **Classic**
3. **Scopes**: Marque `repo` (acesso completo aos repositórios)
4. **Generate token**
5. **Copie o token** (só aparece uma vez!)
6. **Use este token** como password no git push

### **4. Verificar Upload:**

Após o push, acesse: https://github.com/SEDLopes/inventox-system

Deve ver todos os arquivos do projeto!

---

## 🚂 **Próximo Passo: Conectar ao Railway**

### **1. Acesse Railway:**
- https://railway.app/dashboard
- **New Project** → **Deploy from GitHub repo**
- **Conecte sua conta GitHub** (se necessário)
- **Selecione**: `SEDLopes/inventox-system`
- **Deploy**

### **2. Adicionar MySQL:**
- **+ New** → **Database** → **Add MySQL**
- **Aguardar inicialização**

### **3. Inicializar Base de Dados:**
```bash
railway connect mysql
```
**Depois copiar e colar o conteúdo de `db_init_railway.sql`**

---

## 🎯 **URLs Finais (após deploy):**

- **Frontend**: `https://inventox-system-production.up.railway.app/frontend/`
- **API**: `https://inventox-system-production.up.railway.app/api/`
- **Health**: `https://inventox-system-production.up.railway.app/api/health.php`

---

## ✅ **Checklist:**

- [ ] Repositório GitHub criado
- [ ] Código enviado para GitHub
- [ ] Projeto Railway criado
- [ ] MySQL adicionado no Railway
- [ ] Base de dados inicializada
- [ ] Sistema testado

---

**🚀 EXECUTE O PUSH E DEPOIS CONECTE AO RAILWAY!**
