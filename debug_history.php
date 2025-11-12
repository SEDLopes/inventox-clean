<?php
/**
 * Debug do Stock History - Identificar erro 500
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/api/db.php';

try {
    $db = getDB();
    
    // Testar queries individuais primeiro
    echo json_encode([
        'step' => 'Testing individual queries',
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
    // Teste 1: Verificar tabelas
    $tables = [];
    $tables['stock_movements'] = $db->query("SHOW TABLES LIKE 'stock_movements'")->rowCount() > 0;
    $tables['inventory_counts'] = $db->query("SHOW TABLES LIKE 'inventory_counts'")->rowCount() > 0;
    
    // Teste 2: Query simples de stock_movements
    $stockQuery = "
        SELECT 
            sm.id,
            sm.item_id,
            i.barcode,
            i.name as item_name,
            sm.movement_type,
            sm.quantity,
            sm.reason,
            sm.created_at
        FROM stock_movements sm
        INNER JOIN items i ON sm.item_id = i.id
        LIMIT 5
    ";
    
    $stockResults = [];
    try {
        $stmt = $db->prepare($stockQuery);
        $stmt->execute();
        $stockResults = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $stockResults = ['error' => $e->getMessage()];
    }
    
    // Teste 3: Query simples de inventory_counts
    $countQuery = "
        SELECT 
            ic.id,
            ic.item_id,
            i.barcode,
            i.name as item_name,
            ic.counted_quantity,
            ic.expected_quantity,
            ic.difference,
            ic.counted_at
        FROM inventory_counts ic
        INNER JOIN items i ON ic.item_id = i.id
        LIMIT 5
    ";
    
    $countResults = [];
    try {
        $stmt = $db->prepare($countQuery);
        $stmt->execute();
        $countResults = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $countResults = ['error' => $e->getMessage()];
    }
    
    // Teste 4: Query UNION simples
    $unionQuery = "
        SELECT 'movement' as type, sm.id, sm.created_at
        FROM stock_movements sm
        LIMIT 2
        
        UNION ALL
        
        SELECT 'count' as type, ic.id, ic.counted_at as created_at
        FROM inventory_counts ic
        LIMIT 2
    ";
    
    $unionResults = [];
    try {
        $stmt = $db->prepare($unionQuery);
        $stmt->execute();
        $unionResults = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $unionResults = ['error' => $e->getMessage()];
    }
    
    $response = [
        'success' => true,
        'message' => 'Debug do Stock History',
        'timestamp' => date('Y-m-d H:i:s'),
        'tables' => $tables,
        'tests' => [
            'stock_movements' => [
                'count' => count($stockResults),
                'data' => $stockResults
            ],
            'inventory_counts' => [
                'count' => count($countResults),
                'data' => $countResults
            ],
            'union_test' => [
                'count' => count($unionResults),
                'data' => $unionResults
            ]
        ]
    ];
    
    echo json_encode($response, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Erro no debug: ' . $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s'),
        'trace' => $e->getTraceAsString()
    ], JSON_PRETTY_PRINT);
}
?>
