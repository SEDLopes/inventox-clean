# 🌊 Deploy InventoX no DigitalOcean

## 🎯 **Método Recomendado: App Platform**

### **📋 Passo a Passo:**

#### **1. Preparar Repositório GitHub (se ainda não fez)**
```bash
# No seu terminal:
cd "/Users/SandroLopes/Documents/CURSOR AI/InventoX"
git add .
git commit -m "Preparar para DigitalOcean deploy"
git push origin main
```

#### **2. Criar App no DigitalOcean**
1. **Acesse**: https://cloud.digitalocean.com/
2. **Apps** → **Create App**
3. **GitHub** → Conectar repositório `inventox`
4. **Branch**: `main`
5. **Auto Deploy**: ✅ Ativado

#### **3. Configurar Serviços**

**Web Service:**
- **Name**: `inventox-web`
- **Source**: GitHub repo
- **Build Command**: (deixar vazio)
- **Run Command**: `apache2-foreground`
- **Port**: `80`
- **Instance**: Basic ($4/mês)

**Database:**
- **Add Resource** → **Database**
- **MySQL 8**
- **Basic ($15/mês)**
- **Name**: `inventox-db`

#### **4. Configurar Variáveis de Ambiente**
```
DB_HOST=${inventox-db.HOSTNAME}
DB_NAME=${inventox-db.DATABASE}
DB_USER=${inventox-db.USERNAME}
DB_PASS=${inventox-db.PASSWORD}
DB_PORT=${inventox-db.PORT}
```

#### **5. Deploy e Configurar BD**
1. **Create App** → Aguardar deploy
2. **Console** → Conectar à base de dados
3. **Executar**: `mysql -h HOST -u USER -p`
4. **Importar**: Colar conteúdo de `db_init_railway.sql`

## 💰 **Custos Estimados**
- **Web App**: $4/mês (Basic)
- **MySQL DB**: $15/mês (Basic)
- **Total**: ~$19/mês
- **Créditos**: $200 gratuitos (10+ meses grátis!)

## 🚀 **URLs Finais**
- **App**: `https://inventox-web-xxxxx.ondigitalocean.app`
- **API**: `https://inventox-web-xxxxx.ondigitalocean.app/api/`

## ⚡ **Vantagens**
- ✅ **Deploy automático** via GitHub
- ✅ **SSL gratuito**
- ✅ **Scaling automático**
- ✅ **Backups incluídos**
- ✅ **Monitoramento**

---

## 🔧 **Alternativa: Droplet Manual**

Se preferir controle total:

1. **Create Droplet**
   - **Ubuntu 22.04**
   - **Basic $4/mês**
   - **SSH Key**

2. **Instalar LAMP Stack**
```bash
sudo apt update
sudo apt install apache2 mysql-server php php-mysql
```

3. **Upload via SCP/SFTP**
```bash
scp -r frontend/ api/ root@IP:/var/www/html/
```

**Qual método prefere? App Platform (automático) ou Droplet (manual)?**
