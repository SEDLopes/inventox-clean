<?php
/**
 * Migração: Remover UNIQUE KEY de inventory_counts
 * Permite múltiplas contagens do mesmo artigo na mesma sessão
 */

require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

// Verificar autenticação
requireAuth();

try {
    $db = getDB();
    
    // Verificar se a tabela existe
    $checkTable = $db->query("SHOW TABLES LIKE 'inventory_counts'");
    if ($checkTable->rowCount() == 0) {
        sendJsonResponse([
            'success' => false,
            'message' => 'Tabela inventory_counts não existe'
        ], 404);
    }
    
    // Verificar se a UNIQUE KEY existe
    $checkIndex = $db->query("SHOW INDEX FROM inventory_counts WHERE Key_name = 'unique_session_item'");
    $hasUniqueKey = $checkIndex->rowCount() > 0;
    
    if ($hasUniqueKey) {
        // Remover a UNIQUE KEY
        $db->exec("ALTER TABLE inventory_counts DROP INDEX unique_session_item");
        
        sendJsonResponse([
            'success' => true,
            'message' => 'UNIQUE KEY removida com sucesso. Agora é possível criar múltiplas contagens do mesmo artigo na mesma sessão.'
        ]);
    } else {
        sendJsonResponse([
            'success' => true,
            'message' => 'UNIQUE KEY já não existe. Migração não necessária.'
        ]);
    }
} catch (PDOException $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro ao executar migração: ' . $e->getMessage()
    ], 500);
} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro: ' . $e->getMessage()
    ], 500);
}
?>

