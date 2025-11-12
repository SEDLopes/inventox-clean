# 🚀 Guia de Deploy Limpo - InventoX

Este guia explica como preparar uma cópia limpa do sistema InventoX no DigitalOcean, preservando apenas a estrutura das tabelas e o utilizador admin.

## 📋 Pré-requisitos

- Acesso ao DigitalOcean App Platform
- Acesso à base de dados MySQL
- Credenciais de administrador
- Acesso SSH (opcional, para scripts)

## 🎯 Objetivo

Criar um template limpo do sistema com:
- ✅ Estrutura completa de todas as tabelas
- ✅ Utilizador admin preservado
- ✅ Sem dados de produção
- ✅ Pronto para novo deploy

---

## 📦 Método 1: Usando Script PHP (Recomendado)

### Passo 1: Acessar o Script

1. Acesse: `https://seu-app.ondigitalocean.app/scripts/clean_database.php`
2. Ou faça upload do arquivo `scripts/clean_database.php` para o servidor

### Passo 2: Executar Limpeza

1. **Token de Segurança**: `inventox-clean-db-2024`
2. **Confirmação**: Marque a checkbox de confirmação
3. Clique em **"LIMPAR BASE DE DADOS"**

### Passo 3: Verificar Resultado

O script irá:
- ✅ Eliminar todos os dados
- ✅ Preservar estrutura das tabelas
- ✅ Manter utilizador admin
- ✅ Mostrar resumo das operações

---

## 📦 Método 2: Usando Script SQL

### Passo 1: Exportar Estrutura

```bash
# Conectar à base de dados
mysql -h [DB_HOST] -u [DB_USER] -p [DB_NAME]

# Executar script
source scripts/export_schema_only.sql
```

### Passo 2: Verificar

```sql
-- Verificar se admin existe
SELECT * FROM users WHERE username = 'admin';

-- Verificar tabelas
SHOW TABLES;

-- Contar registos (deve ser 0 ou 1 para admin)
SELECT 
    'users' as tabela, COUNT(*) as registos FROM users
UNION ALL
SELECT 'items', COUNT(*) FROM items
UNION ALL
SELECT 'categories', COUNT(*) FROM categories
UNION ALL
SELECT 'inventory_sessions', COUNT(*) FROM inventory_sessions
UNION ALL
SELECT 'inventory_counts', COUNT(*) FROM inventory_counts;
```

---

## 📦 Método 3: Usando Script Shell (Backup + Restore)

### Passo 1: Fazer Backup da Estrutura

```bash
# Dar permissão de execução
chmod +x scripts/backup_database_structure.sh

# Executar backup
./scripts/backup_database_structure.sh
```

### Passo 2: Restaurar em Nova Base de Dados

```bash
# Criar nova base de dados
mysql -u root -p -e "CREATE DATABASE inventox_clean CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Restaurar estrutura
mysql -u root -p inventox_clean < backups/inventox_schema_with_admin_TIMESTAMP.sql
```

---

## 🔧 Configuração no DigitalOcean

### Opção A: Novo App a partir do Template

1. **Criar Novo App**:
   - Vá para DigitalOcean App Platform
   - Clique em "Create App"
   - Selecione o repositório `inventox-clean`

2. **Configurar Base de Dados**:
   - Crie uma nova base de dados MySQL
   - Execute o script `export_schema_only.sql`
   - Configure variáveis de ambiente

3. **Configurar Variáveis de Ambiente**:
   ```
   DB_HOST=[novo_host]
   DB_NAME=[novo_database]
   DB_USER=[novo_user]
   DB_PASS=[nova_password]
   DB_PORT=25060
   ```

4. **Deploy**:
   - O app será deployado automaticamente
   - A base de dados já estará limpa e pronta

### Opção B: Limpar App Existente

1. **Acessar Script de Limpeza**:
   ```
   https://seu-app.ondigitalocean.app/scripts/clean_database.php
   ```

2. **Executar Limpeza**:
   - Use token: `inventox-clean-db-2024`
   - Confirme a operação

3. **Verificar**:
   - Login com admin
   - Verificar que não há dados
   - Sistema pronto para uso

---

## ✅ Verificação Pós-Deploy

### 1. Verificar Utilizador Admin

```sql
SELECT username, email, role, is_active 
FROM users 
WHERE username = 'admin';
```

**Resultado Esperado**:
- username: `admin`
- email: `admin@inventox.local`
- role: `admin`
- is_active: `1`

### 2. Verificar Estrutura

```sql
SHOW TABLES;
```

**Tabelas Esperadas**:
- users
- items
- categories
- companies
- warehouses
- inventory_sessions
- inventory_counts
- stock_movements

### 3. Verificar Dados

```sql
-- Deve retornar apenas 1 (admin)
SELECT COUNT(*) FROM users;

-- Deve retornar 0 (sem dados)
SELECT COUNT(*) FROM items;
SELECT COUNT(*) FROM categories;
SELECT COUNT(*) FROM inventory_sessions;
SELECT COUNT(*) FROM inventory_counts;
```

### 4. Testar Login

1. Acesse: `https://seu-app.ondigitalocean.app/frontend/`
2. Login: `admin`
3. Password: `admin123` (alterar após primeiro login!)
4. Deve fazer login com sucesso

---

## 🔐 Segurança

### ⚠️ IMPORTANTE: Alterar Password do Admin

Após o deploy limpo, **ALTERE IMEDIATAMENTE** a password do admin:

1. Faça login como admin
2. Vá para a aba "Utilizadores"
3. Edite o utilizador admin
4. Defina uma password forte
5. Guarde a password em local seguro

### 🔒 Proteger Script de Limpeza

O script `clean_database.php` deve ser protegido em produção:

1. **Remover após uso** (recomendado):
   ```bash
   rm scripts/clean_database.php
   ```

2. **Ou proteger com autenticação**:
   - Adicionar verificação de admin
   - Usar token mais complexo
   - Restringir acesso por IP

---

## 📊 Estrutura de Tabelas Preservada

### Tabelas Principais

| Tabela | Descrição | Dados Limpos |
|--------|-----------|--------------|
| `users` | Utilizadores | ✅ Admin preservado |
| `items` | Artigos | ✅ Todos eliminados |
| `categories` | Categorias | ✅ Todas eliminadas |
| `companies` | Empresas | ✅ Todas eliminadas |
| `warehouses` | Armazéns | ✅ Todos eliminados |
| `inventory_sessions` | Sessões | ✅ Todas eliminadas |
| `inventory_counts` | Contagens | ✅ Todas eliminadas |
| `stock_movements` | Movimentos | ✅ Todos eliminados |

### Índices e Constraints

- ✅ Todos os índices preservados
- ✅ Foreign keys preservadas
- ✅ Auto_increment resetado
- ✅ Constraints mantidas

---

## 🚨 Troubleshooting

### Problema: Admin não existe após limpeza

**Solução**:
```sql
-- Inserir admin manualmente
INSERT INTO users (username, email, password_hash, role, is_active) 
VALUES (
    'admin', 
    'admin@inventox.local', 
    '$2y$10$mShlEzkOp7DNZupiaXsSn.MlQzaoOlqJauhrqlA.vakpY7Zpd7rLa', 
    'admin', 
    TRUE
);
```

### Problema: Erro de Foreign Key

**Solução**:
```sql
SET FOREIGN_KEY_CHECKS = 0;
-- Executar limpeza
SET FOREIGN_KEY_CHECKS = 1;
```

### Problema: Script não acessível

**Solução**:
1. Verificar permissões do arquivo
2. Verificar configuração do servidor web
3. Usar método SQL direto

---

## 📝 Checklist de Deploy Limpo

- [ ] Backup da base de dados atual (opcional)
- [ ] Executar script de limpeza
- [ ] Verificar que admin existe
- [ ] Verificar que todas as tabelas existem
- [ ] Verificar que não há dados (exceto admin)
- [ ] Testar login com admin
- [ ] Alterar password do admin
- [ ] Remover/proteger script de limpeza
- [ ] Documentar credenciais do novo ambiente
- [ ] Testar funcionalidades básicas

---

## 🔄 Restaurar de Backup (se necessário)

Se precisar restaurar dados após limpeza:

```bash
# Restaurar de backup completo
mysql -u root -p inventox < backup_completo.sql

# Ou restaurar apenas estrutura
mysql -u root -p inventox < export_schema_only.sql
```

---

## 📞 Suporte

Se encontrar problemas:
1. Verificar logs do servidor
2. Verificar logs da base de dados
3. Consultar documentação técnica
4. Contactar suporte técnico

---

**Última atualização**: 2024-11-12
**Versão**: 1.0
