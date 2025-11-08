# 🔧 Correção Direta no DigitalOcean Dashboard

## ❌ **Problema:**
O PHP não está sendo executado - arquivos fazem download em vez de processar.

## ✅ **Solução: Configurar diretamente no Dashboard**

### **1. Acessar Configuração do Componente:**
1. **DigitalOcean Dashboard** → **Sua App** → **Settings**
2. **Components** → **inventox-web** (ou nome do seu componente)
3. **Edit** (botão)

### **2. Configurar Run Command:**
**Na seção "Run Command":**
- **Remover** qualquer comando existente
- **Adicionar**: `heroku-php-apache2`
- **OU** (se não funcionar): `vendor/bin/heroku-php-apache2`

### **3. Configurar Build Command:**
**Na seção "Build Command":**
- **Deixar vazio** (não precisa de build command)

### **4. Verificar Environment Variables:**
**Settings** → **App-Level Environment Variables**
**Deve ter:**
```
DB_HOST = ${inventox-db.HOSTNAME}
DB_NAME = ${inventox-db.DATABASE}
DB_USER = ${inventox-db.USERNAME}
DB_PASS = ${inventox-db.PASSWORD}
DB_PORT = ${inventox-db.PORT}
```

### **5. Salvar e Redeploy:**
- **Save**
- **Deploy** (vai fazer redeploy automático)
- **Aguardar** 2-3 minutos

## 🧪 **Após redeploy, testar:**
- https://inventox-v2yj4.ondigitalocean.app/api/health.php
- **Deve retornar JSON**, não fazer download!

## 🔄 **Se ainda não funcionar:**

### **Alternativa 1: Usar Nginx em vez de Apache**
**Run Command**: `heroku-php-nginx`

### **Alternativa 2: Forçar processamento PHP via .htaccess**
**Criar arquivo `.htaccess` na raiz** com:
```apache
AddType application/x-httpd-php .php
<FilesMatch "\.php$">
    SetHandler application/x-httpd-php
</FilesMatch>
```

### **Alternativa 3: Verificar se o buildpack está correto**
**Settings** → **Components** → **Edit**
**Verificar** se está usando:
- **Buildpack**: `heroku/php` ✅
- **NÃO** usar buildpack customizado

## 📋 **Checklist:**
- ✅ Run Command configurado: `heroku-php-apache2`
- ✅ Build Command vazio
- ✅ Environment Variables configuradas
- ✅ Redeploy completado
- ✅ Teste health.php retorna JSON
