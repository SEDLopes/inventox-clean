# ✅ Testes Locais - InventoX

**Data:** 2024-11-09  
**Status:** ✅ Ambiente Local Funcionando

---

## 🎉 Ambiente Local Iniciado com Sucesso!

### ✅ Status Atual

- ✅ **Docker** está em execução
- ✅ **Serviços iniciados:**
  - Web: http://localhost:8080
  - MySQL: Porta 3307 (host) / 3306 (container)
- ✅ **Base de dados inicializada** com todas as tabelas
- ✅ **Todas as tabelas criadas:**
  - users
  - categories
  - companies
  - warehouses
  - items
  - inventory_sessions
  - inventory_counts
  - stock_movements

---

## 🧪 Testes Realizados

### 1. **Health Check** ✅
```
http://localhost:8080/api/health.php
```
**Resultado:** ✅ Aplicação saudável

### 2. **Inicialização da Base de Dados** ✅
```
http://localhost:8080/api/init_database.php?token=inventox2024
```
**Resultado:** ✅ Base de dados inicializada com sucesso

### 3. **Verificação de Tabelas** ✅
**Resultado:** ✅ Todas as 8 tabelas criadas

---

## 🚀 Como Acessar

### Aplicação Web
```
http://localhost:8080/frontend/
```

### Login Padrão
- **Username:** `admin`
- **Password:** `admin123`

### API Health
```
http://localhost:8080/api/health.php
```

---

## 📋 Próximos Testes a Realizar

### Checklist de Funcionalidades

- [ ] **Login** - Fazer login e verificar se sessão é mantida
- [ ] **Criar Empresa** - Criar uma nova empresa
- [ ] **Criar Armazém** - Criar um novo armazém
- [ ] **Criar Artigo** - Criar um novo artigo
- [ ] **Criar Sessão** - Criar uma nova sessão de inventário
- [ ] **Criar Utilizador** - Criar um novo utilizador
- [ ] **Listar Registos** - Verificar se listagens funcionam
- [ ] **Editar Registos** - Editar registos existentes
- [ ] **Eliminar Registos** - Eliminar registos (se aplicável)

---

## 🔍 Comandos Úteis

### Ver Logs
```bash
docker-compose logs -f web
```

### Ver Status
```bash
docker-compose ps
```

### Parar Serviços
```bash
docker-compose down
```

### Reiniciar Serviços
```bash
docker-compose restart
```

### Acessar MySQL
```bash
docker-compose exec db mysql -u inventox -pinventox123 inventox
```

---

## 📝 Notas

- **Porta Web:** 8080 (para evitar conflito com outros serviços)
- **Porta MySQL:** 3307 (host) / 3306 (container)
- **Hot Reload:** Volumes montados para api e frontend (alterações refletem imediatamente)
- **Base de Dados:** Inicializada automaticamente pelo script

---

**Última Atualização:** 2024-11-09

