# 🚀 Deploy no Render - Alternativa ao Railway

## 📋 **Por que Render?**

- ✅ **100% Gratuito** (com limitações)
- ✅ **Deploy direto** do GitHub
- ✅ **Suporte PHP** nativo
- ✅ **PostgreSQL gratuito** (500MB)
- ✅ **Mais estável** que Railway free tier

## 🛠️ **Passo a Passo**

### **1. Criar Conta no Render:**
- **Acesse**: https://render.com
- **Sign Up** com GitHub
- **Conectar conta GitHub**

### **2. Criar Web Service:**
- **Dashboard** → **New** → **Web Service**
- **Connect Repository** → `SEDLopes/inventox-system`
- **Settings**:
  - **Name**: `inventox-system`
  - **Environment**: `Docker`
  - **Plan**: `Free`

### **3. Criar PostgreSQL Database:**
- **Dashboard** → **New** → **PostgreSQL**
- **Name**: `inventox-db`
- **Plan**: `Free` (500MB)
- **Copiar** connection string

### **4. Configurar Variáveis de Ambiente:**
- **Web Service** → **Environment**
- **Add**:
  ```
  DATABASE_URL=postgresql://user:pass@host:port/db
  DB_HOST=host
  DB_PORT=5432
  DB_NAME=database_name
  DB_USER=username
  DB_PASS=password
  ```

### **5. Adaptar para PostgreSQL:**
- Render usa PostgreSQL, não MySQL
- Precisamos converter `db.sql` para PostgreSQL

## 🔧 **Configuração Dockerfile para Render**

```dockerfile
FROM php:8.2-apache

# Install dependencies
RUN apt-get update && apt-get install -y \
    libpq-dev \
    python3 \
    python3-pip \
    && docker-php-ext-install pdo pdo_pgsql

# Install Python packages
RUN pip3 install pandas sqlalchemy psycopg2-binary openpyxl python-dotenv

# Copy application
COPY . /var/www/html/
RUN chown -R www-data:www-data /var/www/html

# Enable Apache modules
RUN a2enmod rewrite

EXPOSE 80
CMD ["apache2-foreground"]
```

## 🎯 **URLs Finais**

- **Frontend**: `https://inventox-system.onrender.com/frontend/`
- **API**: `https://inventox-system.onrender.com/api/`

## ⚠️ **Limitações Free Tier**

- **Sleep após 15min** de inatividade
- **750 horas/mês** (suficiente para testes)
- **PostgreSQL 500MB** (vs MySQL ilimitado)

---

**Quer tentar Render como alternativa?**
