# ✅ Correções de Schema da Base de Dados

**Data:** 2024-11-09  
**Status:** ✅ Concluído e Deployado

---

## 🔴 Problemas Identificados nos Logs

### 1. **Coluna `min_quantity` não encontrada em `items`**
**Erro:** `SQLSTATE[42S22]: Column not found: 1054 Unknown column 'min_quantity' in 'where clause'`  
**Arquivo:** `api/stats.php`  
**Causa:** Base de dados no servidor não tem a coluna `min_quantity` (pode ter `min_stock` ou não ter nenhuma)

### 2. **Coluna `code` não encontrada em `companies`**
**Erro:** `SQLSTATE[42S22]: Column not found: 1054 Unknown column 'code' in 'field list'`  
**Arquivo:** `api/companies.php`  
**Causa:** Base de dados no servidor não tem a coluna `code` em `companies`

### 3. **Erros 401 após login**
**Erro:** Múltiplos endpoints retornando 401 após login bem-sucedido  
**Causa:** `handleLogin` não estava enviando `credentials: 'include'` para enviar cookies de sessão

---

## ✅ Correções Implementadas

### 1. **Atualizado `api/init_database.php`** ✅
- ✅ Adicionado schema completo com todas as colunas corretas
- ✅ Adicionado coluna `code` em `companies`
- ✅ Adicionado coluna `tax_id` em `companies`
- ✅ Adicionado coluna `is_active` em `companies`
- ✅ Adicionado coluna `min_quantity` em `items` (não `min_stock`)
- ✅ Adicionado coluna `supplier` em `items`
- ✅ Adicionado colunas faltantes em `warehouses`
- ✅ Adicionado tabelas faltantes (`inventory_sessions`, `inventory_counts`, `stock_movements`)

### 2. **Criado `api/migrate_database.php`** ✅
- ✅ Script de migração para adicionar colunas faltantes
- ✅ Verifica se colunas existem antes de adicionar
- ✅ Renomeia `min_stock` para `min_quantity` se existir
- ✅ Adiciona índices se não existirem
- ✅ Protegido com token de segurança

### 3. **Adicionado verificação de colunas em `api/stats.php`** ✅
- ✅ Verifica se coluna `min_quantity` existe antes de usar
- ✅ Fallback para quando coluna não existe
- ✅ Evita erros quando base de dados não está atualizada

### 4. **Adicionado verificação de colunas em `api/companies.php`** ✅
- ✅ Verifica quais colunas existem antes de fazer SELECT
- ✅ Constrói SELECT dinamicamente com apenas colunas existentes
- ✅ Evita erros quando base de dados não está atualizada

### 5. **Corrigido `handleLogin` em `frontend/app.js`** ✅
- ✅ Adicionado `credentials: 'include'` para enviar cookies de sessão
- ✅ Resolve problemas de autenticação 401 após login

---

## 🚀 Como Aplicar as Correções

### Opção 1: Executar Script de Migração (Recomendado)
```bash
# Acessar o endpoint de migração
https://inventox-app-nzwnb.ondigitalocean.app/api/migrate_database.php?token=inventox2024
```

Este script:
- ✅ Verifica se colunas existem
- ✅ Adiciona apenas colunas faltantes
- ✅ Renomeia `min_stock` para `min_quantity` se necessário
- ✅ Não afeta dados existentes

### Opção 2: Re-inicializar Base de Dados (Se não houver dados importantes)
```bash
# Acessar o endpoint de inicialização
https://inventox-app-nzwnb.ondigitalocean.app/api/init_database.php?token=inventox2024
```

**⚠️ ATENÇÃO:** Isso recriará todas as tabelas. Use apenas se não houver dados importantes.

---

## 📋 Colunas Adicionadas pela Migração

### Tabela `companies`:
- ✅ `code` VARCHAR(50) UNIQUE
- ✅ `tax_id` VARCHAR(50)
- ✅ `is_active` BOOLEAN DEFAULT TRUE

### Tabela `items`:
- ✅ `min_quantity` INT DEFAULT 0 (renomeado de `min_stock` se existir)
- ✅ `supplier` VARCHAR(100)

### Tabela `warehouses`:
- ✅ `code` VARCHAR(50)
- ✅ `address` TEXT
- ✅ `is_active` BOOLEAN DEFAULT TRUE

---

## ✅ Arquivos Modificados

1. `api/init_database.php` - Schema atualizado
2. `api/migrate_database.php` - Script de migração criado
3. `api/stats.php` - Verificação de colunas adicionada
4. `api/companies.php` - Verificação de colunas adicionada
5. `frontend/app.js` - `credentials: 'include'` adicionado no login

---

## 🎯 Resultado Esperado

Após executar a migração:
- ✅ Erros de coluna não encontrada resolvidos
- ✅ Erros 401 após login resolvidos
- ✅ Sistema funcionando corretamente
- ✅ Dados existentes preservados

---

## 📊 Status

- ✅ **Schema atualizado** em `init_database.php`
- ✅ **Script de migração** criado
- ✅ **Verificações de colunas** adicionadas
- ✅ **Login corrigido** com `credentials: 'include'`
- ✅ **Deploy concluído** - Aguardando migração no servidor

---

**Próximo Passo:** Executar `migrate_database.php` no servidor para adicionar colunas faltantes.

**Última Atualização:** 2024-11-09

