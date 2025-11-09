# 🚀 Setup Local SEM Docker - InventoX

**Data:** 2024-11-09  
**Objetivo:** Configurar ambiente local sem Docker (usando PHP e MySQL nativos)

---

## 📋 Pré-requisitos

1. **PHP 8.1+** instalado
2. **MySQL 8.0+** instalado e em execução
3. **Apache** ou servidor web PHP (ou usar `php -S`)

---

## 🚀 Passos para Configurar

### 1. **Criar ficheiro `.env`**

Criar ficheiro `.env` na raiz do projeto:

```env
# Database Configuration
DB_HOST=localhost
DB_NAME=inventox
DB_USER=root
DB_PASS=your_mysql_password
DB_PORT=3306

# Application Configuration
DEBUG_MODE=true
ENVIRONMENT=development
```

### 2. **Criar Base de Dados**

```bash
mysql -u root -p
```

No MySQL:
```sql
CREATE DATABASE IF NOT EXISTS inventox CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE inventox;
SOURCE db.sql;
```

Ou executar diretamente:
```bash
mysql -u root -p inventox < db.sql
```

### 3. **Iniciar Servidor PHP**

```bash
cd "/Users/SandroLopes/Documents/CURSOR AI/InventoX"
php -S localhost:8080 -t .
```

### 4. **Acessar Aplicação**

Abrir no navegador:
```
http://localhost:8080/frontend/
```

Ou inicializar base de dados:
```
http://localhost:8080/api/init_database.php?token=inventox2024
```

---

## 🧪 Testes

### Login Padrão
- **Username:** `admin`
- **Password:** `admin123`

### Checklist de Funcionalidades
- [ ] Login funciona
- [ ] Criar empresa funciona
- [ ] Criar armazém funciona
- [ ] Criar artigo funciona
- [ ] Criar sessão funciona
- [ ] Criar utilizador funciona

---

## 🔍 Verificar Logs

### Logs do PHP
Os erros do PHP aparecerão no terminal onde o servidor está em execução.

### Verificar Base de Dados
```bash
mysql -u root -p inventox
SHOW TABLES;
```

---

**Última Atualização:** 2024-11-09

