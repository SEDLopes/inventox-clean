#!/bin/bash
# Script para testar aplicação localmente

echo "🧪 InventoX - Testes Locais"
echo "=========================="
echo ""

# Verificar se MySQL está em execução
if mysql -u root -e "SELECT 1;" &>/dev/null; then
    echo "✅ MySQL está em execução"
    
    # Verificar se base de dados existe
    if mysql -u root -e "USE inventox;" &>/dev/null; then
        echo "✅ Base de dados 'inventox' existe"
        
        # Verificar tabelas
        TABLE_COUNT=$(mysql -u root inventox -e "SHOW TABLES;" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$TABLE_COUNT" -gt 1 ]; then
            echo "✅ Base de dados tem $((TABLE_COUNT - 1)) tabelas"
            mysql -u root inventox -e "SHOW TABLES;" 2>/dev/null
        else
            echo "⚠️  Base de dados vazia. Inicializando..."
            mysql -u root inventox < db.sql 2>&1 | grep -v "^Warning" | head -10
            echo "✅ Base de dados inicializada"
        fi
    else
        echo "⚠️  Base de dados 'inventox' não existe. Criando..."
        mysql -u root -e "CREATE DATABASE inventox CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null
        mysql -u root inventox < db.sql 2>&1 | grep -v "^Warning" | head -10
        echo "✅ Base de dados criada e inicializada"
    fi
else
    echo "❌ MySQL não está em execução ou não está acessível"
    echo "Por favor, inicie MySQL e tente novamente"
    exit 1
fi

echo ""
echo "📋 Próximos passos:"
echo "1. Iniciar servidor PHP: php -S localhost:8080 -t ."
echo "2. Acessar: http://localhost:8080/frontend/"
echo "3. Login: admin / admin123"
echo ""

