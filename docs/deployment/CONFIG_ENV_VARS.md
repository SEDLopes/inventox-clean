# 🔧 Configurar Variáveis de Ambiente - DigitalOcean

Guia para configurar as variáveis de ambiente da database no DigitalOcean App Platform.

## ✅ Database Configurado

- **Nome:** `db-mysql-fra1-70732`
- **Região:** FRA (Frankfurt)
- **Engine:** MySQL 8

## 🔧 Configuração no Dashboard

### Passo 1: Acessar DigitalOcean Dashboard
```
https://cloud.digitalocean.com/
```

### Passo 2: Ir para o App
- **Apps** → Selecione `inventox` → **Settings**

### Passo 3: Configurar Variáveis de Ambiente
- **App-Level Environment Variables** → **Edit**
- Adicionar as seguintes variáveis:

```
DB_HOST = ${db-mysql-fra1-70732.HOSTNAME}
DB_NAME = ${db-mysql-fra1-70732.DATABASE}
DB_USER = ${db-mysql-fra1-70732.USERNAME}
DB_PASS = ${db-mysql-fra1-70732.PASSWORD}
DB_PORT = ${db-mysql-fra1-70732.PORT}
```

⚠️ **IMPORTANTE:** Use exatamente `${db-mysql-fra1-70732.HOSTNAME}` (com hífens e pontos)!

### Passo 4: Salvar e Redeploy
- Clique em **Save**
- O DigitalOcean fará redeploy automático

## 🔍 Verificar Configuração

Após configurar, aguarde 2-3 minutos para o redeploy e teste:

### 1. Health Check
```
https://seu-app.ondigitalocean.app/api/health.php
```

**Resultado esperado:**
```json
{
  "status": "healthy",
  "services": {
    "database": "connected"  // ✅ Conectado!
  }
}
```

### 2. Inicializar Database
```
https://seu-app.ondigitalocean.app/api/init_database.php?token=inventox2024
```

**Resultado esperado:**
```json
{
  "success": true,
  "message": "Database inicializado com sucesso!",
  "tables_created": 8
}
```

## 🐛 Troubleshooting

### Se a sintaxe `${db-mysql-fra1-70732.HOSTNAME}` não funcionar

Use os valores diretos do database:

1. **Ir para o Database:**
   - **Resources** → `db-mysql-fra1-70732` → **Connection Details**

2. **Copiar credenciais:**
   - Host
   - Database
   - Username
   - Password
   - Port

3. **Configurar manualmente:**
   ```
   DB_HOST = [valor do Host]
   DB_NAME = [valor do Database]
   DB_USER = [valor do Username]
   DB_PASS = [valor do Password]
   DB_PORT = [valor do Port]
   ```

### Database não conectado ao App

1. Vá para **Resources** no Dashboard
2. Verifique se `db-mysql-fra1-70732` está listado
3. Se não estiver:
   - **Add Resource** → **Database**
   - Selecionar `db-mysql-fra1-70732`
   - Conectar ao app

## ✅ Checklist

- [ ] Database `db-mysql-fra1-70732` criado
- [ ] Database conectado ao app
- [ ] Variáveis de ambiente configuradas no Dashboard
- [ ] Redeploy realizado
- [ ] Health check mostra database conectado
- [ ] Database inicializado com sucesso

## 🎉 Pronto!

Após configurar as variáveis de ambiente, o sistema estará 100% funcional!