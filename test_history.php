<?php
/**
 * Teste do Histórico - Verificar se contagens aparecem
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/api/db.php';

try {
    $db = getDB();
    
    // Testar a query do histórico diretamente
    $query = "
        (SELECT 
            CONCAT('movement_', sm.id) as id,
            sm.item_id,
            i.barcode,
            i.name as item_name,
            sm.movement_type as type,
            sm.quantity,
            sm.reason as description,
            sm.user_id,
            u.username as user_name,
            sm.created_at,
            'movement' as source_type
        FROM stock_movements sm
        INNER JOIN items i ON sm.item_id = i.id
        LEFT JOIN users u ON sm.user_id = u.id
        WHERE 1=1)
        
        UNION ALL
        
        (SELECT 
            CONCAT('count_', ic.id) as id,
            ic.item_id,
            i.barcode,
            i.name as item_name,
            CASE 
                WHEN ic.difference > 0 THEN 'entrada'
                WHEN ic.difference < 0 THEN 'saida'
                ELSE 'contagem'
            END as type,
            ic.difference as quantity,
            CONCAT('Contagem de inventário - Contado: ', ic.counted_quantity, ', Esperado: ', ic.expected_quantity) as description,
            ic.user_id,
            u.username as user_name,
            ic.counted_at as created_at,
            'inventory_count' as source_type
        FROM inventory_counts ic
        INNER JOIN items i ON ic.item_id = i.id
        LEFT JOIN users u ON ic.user_id = u.id
        WHERE 1=1)
        
        ORDER BY created_at DESC
        LIMIT 20
    ";
    
    $stmt = $db->prepare($query);
    $stmt->execute();
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Estatísticas
    $stats = [
        'total_movements' => $db->query("SELECT COUNT(*) FROM stock_movements")->fetchColumn(),
        'total_counts' => $db->query("SELECT COUNT(*) FROM inventory_counts")->fetchColumn(),
        'counts_today' => $db->query("SELECT COUNT(*) FROM inventory_counts WHERE DATE(counted_at) = CURDATE()")->fetchColumn(),
        'movements_today' => $db->query("SELECT COUNT(*) FROM stock_movements WHERE DATE(created_at) = CURDATE()")->fetchColumn()
    ];
    
    // Verificar se há dados recentes
    $recentCounts = $db->query("
        SELECT COUNT(*) as count
        FROM inventory_counts 
        WHERE counted_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    ")->fetch();
    
    $response = [
        'success' => true,
        'message' => 'Teste do Histórico Unificado',
        'timestamp' => date('Y-m-d H:i:s'),
        'stats' => $stats,
        'recent_counts_last_hour' => $recentCounts['count'],
        'history_items' => count($history),
        'history' => $history,
        'diagnostics' => [
            'has_inventory_counts_table' => $db->query("SHOW TABLES LIKE 'inventory_counts'")->rowCount() > 0,
            'has_stock_movements_table' => $db->query("SHOW TABLES LIKE 'stock_movements'")->rowCount() > 0,
            'query_executed' => true
        ]
    ];
    
    echo json_encode($response, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Erro no teste: ' . $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT);
}
?>
