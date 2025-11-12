# 📦 Scripts de Gestão - InventoX

Scripts utilitários para gestão e manutenção do sistema InventoX.

## 📋 Scripts Disponíveis

### 1. `clean_database.php`
**Limpar Base de Dados - Preserva Estrutura e Admin**

- Remove todos os dados de produção
- Preserva estrutura de todas as tabelas
- Mantém utilizador admin
- Ideal para preparar template limpo

**Uso**:
```
https://seu-app.ondigitalocean.app/scripts/clean_database.php
Token: inventox-clean-db-2024
```

**⚠️ ATENÇÃO**: Apaga TODOS os dados exceto admin!

---

### 2. `init_clean_database.php`
**Inicializar Base de Dados Limpa**

- Inicializa base de dados completamente limpa
- Cria utilizador admin se não existir
- Garante estrutura correta
- Ideal para novos deploys

**Uso**:
```
https://seu-app.ondigitalocean.app/scripts/init_clean_database.php?token=inventox-init-2024
```

**Resultado**:
- Base de dados limpa
- Admin criado (username: admin, password: admin123)
- Pronto para uso

---

### 3. `export_schema_only.sql`
**Exportar Apenas Estrutura (SQL)**

- Script SQL puro
- Cria todas as tabelas
- Insere apenas admin
- Sem dados de produção

**Uso**:
```bash
mysql -u root -p database < export_schema_only.sql
```

---

### 4. `backup_database_structure.sh`
**Backup da Estrutura (Shell Script)**

- Faz backup apenas da estrutura
- Inclui utilizador admin
- Gera arquivos SQL

**Uso**:
```bash
chmod +x backup_database_structure.sh
./backup_database_structure.sh
```

**Variáveis de Ambiente**:
```bash
export DB_HOST=localhost
export DB_USER=root
export DB_NAME=inventox
export DB_PASS=sua_password
```

---

## 🔐 Segurança

### Tokens de Segurança

- `clean_database.php`: `inventox-clean-db-2024`
- `init_clean_database.php`: `inventox-init-2024`

### ⚠️ Recomendações

1. **Remover scripts após uso** em produção
2. **Alterar tokens** antes de usar
3. **Proteger acesso** por IP ou autenticação
4. **Fazer backup** antes de limpar dados

---

## 📊 Fluxo de Deploy Limpo

### Para Novo App no DigitalOcean:

1. **Criar Novo App**:
   - DigitalOcean → Create App
   - Selecionar repositório `inventox-clean`

2. **Criar Base de Dados**:
   - Adicionar MySQL Database
   - Anotar credenciais

3. **Inicializar Base de Dados**:
   ```
   https://novo-app.ondigitalocean.app/scripts/init_clean_database.php?token=inventox-init-2024
   ```

4. **Verificar**:
   - Login: admin / admin123
   - Alterar password
   - Sistema pronto!

---

## 🔄 Limpar App Existente

1. **Acessar Script**:
   ```
   https://app-existente.ondigitalocean.app/scripts/clean_database.php
   ```

2. **Executar**:
   - Token: `inventox-clean-db-2024`
   - Confirmar operação

3. **Resultado**:
   - Todos os dados eliminados
   - Admin preservado
   - Estrutura intacta

---

## 📝 Notas Importantes

- ⚠️ **Sempre altere a password do admin** após deploy
- ⚠️ **Faça backup** antes de limpar dados importantes
- ⚠️ **Teste em desenvolvimento** antes de usar em produção
- ✅ **Scripts são idempotentes** (podem ser executados múltiplas vezes)

---

## 🆘 Troubleshooting

### Erro: Token inválido
- Verificar token correto
- Verificar se está a passar via GET ou POST

### Erro: Admin não encontrado
- Executar `init_clean_database.php` primeiro
- Ou inserir admin manualmente via SQL

### Erro: Foreign Key
- Scripts já tratam isso automaticamente
- Se persistir, verificar ordem de eliminação

---

**Última atualização**: 2024-11-12
