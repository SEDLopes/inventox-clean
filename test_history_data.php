<?php
/**
 * Teste Direto - Verificar Dados do Histórico
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/api/db.php';

try {
    // Verificar autenticação
    requireAuth();
    
    $db = getDB();
    
    // Teste 1: Verificar se há dados na tabela inventory_counts
    $totalCounts = $db->query("SELECT COUNT(*) FROM inventory_counts")->fetchColumn();
    
    // Teste 2: Buscar últimas 10 contagens
    $recentCounts = $db->query("
        SELECT 
            ic.id,
            ic.item_id,
            i.barcode,
            i.name as item_name,
            ic.counted_quantity,
            ic.expected_quantity,
            ic.difference,
            ic.counted_at,
            u.username as user_name,
            s.name as session_name
        FROM inventory_counts ic
        INNER JOIN items i ON ic.item_id = i.id
        LEFT JOIN users u ON ic.user_id = u.id
        LEFT JOIN inventory_sessions s ON ic.session_id = s.id
        ORDER BY ic.counted_at DESC
        LIMIT 10
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    // Teste 3: Verificar se há movimentos de stock
    $hasStockMovements = $db->query("SHOW TABLES LIKE 'stock_movements'")->rowCount() > 0;
    $totalMovements = 0;
    $recentMovements = [];
    
    if ($hasStockMovements) {
        $totalMovements = $db->query("SELECT COUNT(*) FROM stock_movements")->fetchColumn();
        $recentMovements = $db->query("
            SELECT 
                sm.id,
                sm.item_id,
                i.barcode,
                i.name as item_name,
                sm.movement_type,
                sm.quantity,
                sm.reason,
                sm.created_at,
                u.username as user_name
            FROM stock_movements sm
            INNER JOIN items i ON sm.item_id = i.id
            LEFT JOIN users u ON sm.user_id = u.id
            ORDER BY sm.created_at DESC
            LIMIT 10
        ")->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // Teste 4: Verificar filtros de data (últimos 7 dias)
    $countsLast7Days = $db->query("
        SELECT COUNT(*) FROM inventory_counts 
        WHERE counted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    ")->fetchColumn();
    
    // Teste 5: Verificar contagens de hoje
    $countsToday = $db->query("
        SELECT COUNT(*) FROM inventory_counts 
        WHERE DATE(counted_at) = CURDATE()
    ")->fetchColumn();
    
    $response = [
        'success' => true,
        'timestamp' => date('Y-m-d H:i:s'),
        'data_summary' => [
            'total_inventory_counts' => (int)$totalCounts,
            'counts_last_7_days' => (int)$countsLast7Days,
            'counts_today' => (int)$countsToday,
            'has_stock_movements_table' => $hasStockMovements,
            'total_stock_movements' => (int)$totalMovements
        ],
        'recent_counts' => $recentCounts,
        'recent_movements' => $recentMovements,
        'diagnosis' => []
    ];
    
    // Diagnóstico
    if ($totalCounts == 0) {
        $response['diagnosis'][] = '⚠️ Nenhuma contagem encontrada na base de dados';
    } else {
        $response['diagnosis'][] = '✅ ' . $totalCounts . ' contagens encontradas na BD';
    }
    
    if ($countsLast7Days == 0 && $totalCounts > 0) {
        $response['diagnosis'][] = '⚠️ Nenhuma contagem nos últimos 7 dias (dados podem ser antigos)';
    }
    
    if (count($recentCounts) > 0) {
        $response['diagnosis'][] = '✅ Dados recentes encontrados e processados corretamente';
    }
    
    echo json_encode($response, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Erro no teste: ' . $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT);
}
?>
