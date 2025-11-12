#!/bin/bash

# ============================================
# INVENTOX - BACKUP DATABASE STRUCTURE
# ============================================
# Este script faz backup apenas da estrutura
# da base de dados (sem dados)
# 
# Uso: ./backup_database_structure.sh
# ============================================

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configurações (ajustar conforme necessário)
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-root}"
DB_NAME="${DB_NAME:-inventox}"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/inventox_schema_${TIMESTAMP}.sql"

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}INVENTOX - BACKUP DATABASE STRUCTURE${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Verificar se mysqldump está disponível
if ! command -v mysqldump &> /dev/null; then
    echo -e "${RED}Erro: mysqldump não encontrado!${NC}"
    echo "Instale o MySQL client para usar este script."
    exit 1
fi

# Solicitar password se não estiver em variável de ambiente
if [ -z "$DB_PASS" ]; then
    echo -e "${YELLOW}Password da base de dados:${NC}"
    read -s DB_PASS
    echo ""
fi

echo -e "${YELLOW}Fazendo backup da estrutura...${NC}"
echo "Host: $DB_HOST"
echo "Database: $DB_NAME"
echo "Backup file: $BACKUP_FILE"
echo ""

# Fazer backup apenas da estrutura (sem dados)
mysqldump \
    -h "$DB_HOST" \
    -u "$DB_USER" \
    -p"$DB_PASS" \
    --no-data \
    --routines \
    --triggers \
    --single-transaction \
    "$DB_NAME" > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Backup criado com sucesso!${NC}"
    echo "Arquivo: $BACKUP_FILE"
    echo "Tamanho: $(du -h "$BACKUP_FILE" | cut -f1)"
    echo ""
    
    # Criar backup com admin user incluído
    ADMIN_BACKUP_FILE="${BACKUP_DIR}/inventox_schema_with_admin_${TIMESTAMP}.sql"
    
    # Adicionar dados do admin ao backup
    mysqldump \
        -h "$DB_HOST" \
        -u "$DB_USER" \
        -p"$DB_PASS" \
        --no-create-info \
        --where="username='admin'" \
        "$DB_NAME" users >> "$ADMIN_BACKUP_FILE" 2>/dev/null
    
    # Adicionar estrutura ao arquivo com admin
    cat "$BACKUP_FILE" > "$ADMIN_BACKUP_FILE"
    mysqldump \
        -h "$DB_HOST" \
        -u "$DB_USER" \
        -p"$DB_PASS" \
        --no-create-info \
        --where="username='admin'" \
        "$DB_NAME" users >> "$ADMIN_BACKUP_FILE" 2>/dev/null
    
    echo -e "${GREEN}✅ Backup com admin criado!${NC}"
    echo "Arquivo: $ADMIN_BACKUP_FILE"
    echo ""
    
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Backup concluído!${NC}"
    echo -e "${GREEN}========================================${NC}"
else
    echo -e "${RED}❌ Erro ao criar backup!${NC}"
    exit 1
fi
