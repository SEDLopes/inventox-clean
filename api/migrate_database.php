<?php
/**
 * Script de Migração da Base de Dados
 * Adiciona colunas faltantes às tabelas existentes
 * 
 * ⚠️ ATENÇÃO: Este endpoint requer token de segurança
 * Use apenas uma vez para migrar a database
 */

// Token de segurança
$valid_tokens = ['inventox2024', 'inventox2', 'inventox'];
$provided_token = $_GET['token'] ?? $_POST['token'] ?? '';

if (!in_array($provided_token, $valid_tokens)) {
    http_response_code(403);
    die(json_encode(['error' => 'Token inválido. Use: ?token=inventox2024']));
}

header('Content-Type: application/json');

require_once __DIR__ . '/db.php';

try {
    $db = getDB();
    $results = [];
    
    // Verificar e adicionar coluna 'code' em companies
    try {
        $check = $db->query("SHOW COLUMNS FROM companies LIKE 'code'");
        if ($check->rowCount() == 0) {
            $db->exec("ALTER TABLE companies ADD COLUMN code VARCHAR(50) UNIQUE AFTER name");
            $results[] = "Adicionada coluna 'code' em companies";
        } else {
            $results[] = "Coluna 'code' já existe em companies";
        }
    } catch (Exception $e) {
        $results[] = "Erro ao verificar/adicionar 'code' em companies: " . $e->getMessage();
    }
    
    // Verificar e adicionar coluna 'tax_id' em companies
    try {
        $check = $db->query("SHOW COLUMNS FROM companies LIKE 'tax_id'");
        if ($check->rowCount() == 0) {
            $db->exec("ALTER TABLE companies ADD COLUMN tax_id VARCHAR(50) AFTER email");
            $results[] = "Adicionada coluna 'tax_id' em companies";
        } else {
            $results[] = "Coluna 'tax_id' já existe em companies";
        }
    } catch (Exception $e) {
        $results[] = "Erro ao verificar/adicionar 'tax_id' em companies: " . $e->getMessage();
    }
    
    // Verificar e adicionar coluna 'is_active' em companies
    try {
        $check = $db->query("SHOW COLUMNS FROM companies LIKE 'is_active'");
        if ($check->rowCount() == 0) {
            $db->exec("ALTER TABLE companies ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER tax_id");
            $results[] = "Adicionada coluna 'is_active' em companies";
        } else {
            $results[] = "Coluna 'is_active' já existe em companies";
        }
    } catch (Exception $e) {
        $results[] = "Erro ao verificar/adicionar 'is_active' em companies: " . $e->getMessage();
    }
    
    // Verificar e adicionar coluna 'min_quantity' em items (renomear de min_stock se existir)
    try {
        $check = $db->query("SHOW COLUMNS FROM items LIKE 'min_quantity'");
        if ($check->rowCount() == 0) {
            // Verificar se existe min_stock
            $checkStock = $db->query("SHOW COLUMNS FROM items LIKE 'min_stock'");
            if ($checkStock->rowCount() > 0) {
                $db->exec("ALTER TABLE items CHANGE COLUMN min_stock min_quantity INT DEFAULT 0");
                $results[] = "Renomeada coluna 'min_stock' para 'min_quantity' em items";
            } else {
                $db->exec("ALTER TABLE items ADD COLUMN min_quantity INT DEFAULT 0 AFTER quantity");
                $results[] = "Adicionada coluna 'min_quantity' em items";
            }
        } else {
            $results[] = "Coluna 'min_quantity' já existe em items";
        }
    } catch (Exception $e) {
        $results[] = "Erro ao verificar/adicionar 'min_quantity' em items: " . $e->getMessage();
    }
    
    // Verificar e adicionar coluna 'supplier' em items
    try {
        $check = $db->query("SHOW COLUMNS FROM items LIKE 'supplier'");
        if ($check->rowCount() == 0) {
            $db->exec("ALTER TABLE items ADD COLUMN supplier VARCHAR(100) AFTER location");
            $results[] = "Adicionada coluna 'supplier' em items";
        } else {
            $results[] = "Coluna 'supplier' já existe em items";
        }
    } catch (Exception $e) {
        $results[] = "Erro ao verificar/adicionar 'supplier' em items: " . $e->getMessage();
    }
    
    // Verificar e adicionar coluna 'code' em warehouses
    try {
        $check = $db->query("SHOW COLUMNS FROM warehouses LIKE 'code'");
        if ($check->rowCount() == 0) {
            $db->exec("ALTER TABLE warehouses ADD COLUMN code VARCHAR(50) AFTER name");
            $results[] = "Adicionada coluna 'code' em warehouses";
        } else {
            $results[] = "Coluna 'code' já existe em warehouses";
        }
    } catch (Exception $e) {
        $results[] = "Erro ao verificar/adicionar 'code' em warehouses: " . $e->getMessage();
    }
    
    // Verificar e adicionar coluna 'address' em warehouses
    try {
        $check = $db->query("SHOW COLUMNS FROM warehouses LIKE 'address'");
        if ($check->rowCount() == 0) {
            $db->exec("ALTER TABLE warehouses ADD COLUMN address TEXT AFTER code");
            $results[] = "Adicionada coluna 'address' em warehouses";
        } else {
            $results[] = "Coluna 'address' já existe em warehouses";
        }
    } catch (Exception $e) {
        $results[] = "Erro ao verificar/adicionar 'address' em warehouses: " . $e->getMessage();
    }
    
    // Verificar e adicionar coluna 'is_active' em warehouses
    try {
        $check = $db->query("SHOW COLUMNS FROM warehouses LIKE 'is_active'");
        if ($check->rowCount() == 0) {
            $db->exec("ALTER TABLE warehouses ADD COLUMN is_active BOOLEAN DEFAULT TRUE AFTER location");
            $results[] = "Adicionada coluna 'is_active' em warehouses";
        } else {
            $results[] = "Coluna 'is_active' já existe em warehouses";
        }
    } catch (Exception $e) {
        $results[] = "Erro ao verificar/adicionar 'is_active' em warehouses: " . $e->getMessage();
    }
    
    // Adicionar índices se não existirem
    try {
        $indexes = [
            "CREATE INDEX IF NOT EXISTS idx_code ON companies(code)",
            "CREATE INDEX IF NOT EXISTS idx_code ON warehouses(code)",
            "CREATE INDEX IF NOT EXISTS idx_category ON items(category_id)"
        ];
        
        foreach ($indexes as $indexSql) {
            try {
                $db->exec($indexSql);
                $results[] = "Índice criado/verificado";
            } catch (Exception $e) {
                // Índice pode já existir, ignorar
            }
        }
    } catch (Exception $e) {
        $results[] = "Erro ao criar índices: " . $e->getMessage();
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Migração concluída',
        'results' => $results
    ], JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
?>

