# 🔧 Configurar Variáveis de Ambiente - DigitalOcean

Guia para configurar as variáveis de ambiente da database no DigitalOcean App Platform.

## ❌ Problema

Ao tentar inicializar a database, você recebe:
```json
{
  "success": false,
  "error": "Variáveis de ambiente da database não configuradas",
  "env_check": {
    "DB_HOST": "NOT SET",
    "DB_NAME": "NOT SET",
    "DB_USER": "NOT SET",
    "DB_PASS": "NOT SET"
  }
}
```

## ✅ Solução

### Opção 1: Via DigitalOcean Dashboard (Recomendado)

1. **Acesse o Dashboard:**
   - Vá para [DigitalOcean Dashboard](https://cloud.digitalocean.com/)
   - Clique em **Apps** → Selecione seu app (`inventox`)

2. **Configurar Variáveis de Ambiente:**
   - Clique em **Settings** (Configurações)
   - Role até **App-Level Environment Variables**
   - Clique em **Edit**

3. **Adicionar Variáveis:**
   Adicione as seguintes variáveis (substitua pelos valores do seu database):

   ```
   DB_HOST = ${inventox-db.HOSTNAME}
   DB_NAME = ${inventox-db.DATABASE}
   DB_USER = ${inventox-db.USERNAME}
   DB_PASS = ${inventox-db.PASSWORD}
   DB_PORT = ${inventox-db.PORT}
   ```

   ⚠️ **IMPORTANTE:** Use a sintaxe `${inventox-db.HOSTNAME}` para referenciar o database conectado!

4. **Salvar e Redeploy:**
   - Clique em **Save**
   - O DigitalOcean fará redeploy automático

### Opção 2: Verificar Database Connection

1. **Verificar Database:**
   - No Dashboard, vá para **Resources**
   - Verifique se o database `inventox-db` está listado
   - Se não estiver, adicione-o:
     - Clique em **Add Resource** → **Database**
     - Selecione **MySQL 8**
     - Nome: `inventox-db`

2. **Obter Credenciais:**
   - Clique no database `inventox-db`
   - Vá para **Connection Details**
   - Copie as credenciais:
     - **Host**
     - **Database**
     - **Username**
     - **Password**
     - **Port**

3. **Configurar Manualmente (se necessário):**
   Se a sintaxe `${inventox-db.HOSTNAME}` não funcionar, use os valores diretos:

   ```
   DB_HOST = [HOST do database]
   DB_NAME = [DATABASE do database]
   DB_USER = [USERNAME do database]
   DB_PASS = [PASSWORD do database]
   DB_PORT = [PORT do database]
   ```

### Opção 3: Via .do/app.yaml (Já configurado)

O arquivo `.do/app.yaml` já está configurado corretamente:

```yaml
envs:
  - key: DB_HOST
    scope: RUN_TIME
    value: ${inventox-db.HOSTNAME}
  - key: DB_NAME
    scope: RUN_TIME
    value: ${inventox-db.DATABASE}
  - key: DB_USER
    scope: RUN_TIME
    value: ${inventox-db.USERNAME}
  - key: DB_PASS
    scope: RUN_TIME
    value: ${inventox-db.PASSWORD}
  - key: DB_PORT
    scope: RUN_TIME
    value: ${inventox-db.PORT}
```

**Se o .do/app.yaml não está sendo usado:**
- Verifique se o DigitalOcean está usando o arquivo `.do/app.yaml`
- Pode ser necessário configurar manualmente no Dashboard

## 🔍 Verificar Configuração

Após configurar, teste novamente:

1. **Verificar Health Check:**
   ```
   https://seu-app.ondigitalocean.app/api/health.php
   ```

   Deve mostrar:
   ```json
   {
     "status": "healthy",
     "services": {
       "database": "connected"  // ✅ Conectado!
     }
   }
   ```

2. **Inicializar Database:**
   ```
   https://seu-app.ondigitalocean.app/api/init_database.php?token=inventox2024
   ```

   Deve mostrar:
   ```json
   {
     "success": true,
     "message": "Database inicializado com sucesso!"
   }
   ```

## 🐛 Troubleshooting

### Variáveis ainda não aparecem

- **Redeploy:** Após adicionar variáveis, faça um redeploy manual
- **Verificar sintaxe:** Certifique-se que está usando `${inventox-db.HOSTNAME}` (com hífen)
- **Database conectado:** Verifique se o database está conectado ao app

### Database não conectado

1. Vá para **Resources** no Dashboard
2. Verifique se `inventox-db` está listado
3. Se não estiver:
   - **Add Resource** → **Database**
   - Selecione **MySQL 8**
   - Nome: `inventox-db`
   - Conecte ao app

### Valores incorretos

- Verifique as credenciais do database em **Connection Details**
- Certifique-se que está usando os valores corretos
- Teste a conexão manualmente se necessário

## ✅ Checklist

- [ ] Database criado e conectado ao app
- [ ] Variáveis de ambiente configuradas no Dashboard
- [ ] Redeploy realizado
- [ ] Health check mostra database conectado
- [ ] Database inicializado com sucesso

## 🎉 Pronto!

Após configurar as variáveis de ambiente, o sistema estará 100% funcional!
