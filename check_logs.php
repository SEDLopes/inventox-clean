<?php
/**
 * Verificar Logs do Sistema - Contagens iPhone
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/api/db.php';

try {
    $db = getDB();
    
    // Verificar últimas contagens de inventário
    $recentCounts = $db->query("
        SELECT 
            ic.id,
            ic.session_id,
            ic.item_id,
            ic.counted_quantity,
            ic.expected_quantity,
            ic.difference,
            ic.counted_at,
            i.name as item_name,
            i.barcode,
            u.username,
            s.status as session_status
        FROM inventory_counts ic
        LEFT JOIN items i ON ic.item_id = i.id
        LEFT JOIN users u ON ic.user_id = u.id
        LEFT JOIN inventory_sessions s ON ic.session_id = s.id
        ORDER BY ic.counted_at DESC
        LIMIT 10
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    // Verificar últimas sessões
    $recentSessions = $db->query("
        SELECT 
            id,
            name,
            status,
            created_at,
            closed_at,
            user_id,
            (SELECT username FROM users WHERE id = inventory_sessions.user_id) as username,
            (SELECT COUNT(*) FROM inventory_counts WHERE session_id = inventory_sessions.id) as count_total
        FROM inventory_sessions
        ORDER BY created_at DESC
        LIMIT 5
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    // Verificar últimos movimentos de stock
    $recentMovements = $db->query("
        SELECT 
            sm.id,
            sm.item_id,
            sm.movement_type,
            sm.quantity,
            sm.reason,
            sm.created_at,
            i.name as item_name,
            i.barcode,
            u.username
        FROM stock_movements sm
        LEFT JOIN items i ON sm.item_id = i.id
        LEFT JOIN users u ON sm.user_id = u.id
        ORDER BY sm.created_at DESC
        LIMIT 10
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    // Estatísticas gerais
    $stats = [
        'total_items' => $db->query("SELECT COUNT(*) FROM items")->fetchColumn(),
        'total_counts' => $db->query("SELECT COUNT(*) FROM inventory_counts")->fetchColumn(),
        'total_sessions' => $db->query("SELECT COUNT(*) FROM inventory_sessions")->fetchColumn(),
        'active_sessions' => $db->query("SELECT COUNT(*) FROM inventory_sessions WHERE status = 'aberta'")->fetchColumn(),
        'total_movements' => $db->query("SELECT COUNT(*) FROM stock_movements")->fetchColumn(),
        'counts_today' => $db->query("SELECT COUNT(*) FROM inventory_counts WHERE DATE(counted_at) = CURDATE()")->fetchColumn(),
        'counts_last_hour' => $db->query("SELECT COUNT(*) FROM inventory_counts WHERE counted_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)")->fetchColumn()
    ];
    
    // Verificar se há contagens recentes (últimas 2 horas)
    $recentCountsCheck = $db->query("
        SELECT COUNT(*) as count
        FROM inventory_counts 
        WHERE counted_at >= DATE_SUB(NOW(), INTERVAL 2 HOUR)
    ")->fetch();
    
    $response = [
        'success' => true,
        'message' => 'Logs do Sistema - Contagens iPhone',
        'timestamp' => date('Y-m-d H:i:s'),
        'stats' => $stats,
        'recent_activity' => [
            'counts_last_2_hours' => $recentCountsCheck['count'],
            'latest_counts' => $recentCounts,
            'latest_sessions' => $recentSessions,
            'latest_movements' => $recentMovements
        ],
        'diagnostics' => [
            'has_recent_counts' => $recentCountsCheck['count'] > 0,
            'has_active_sessions' => $stats['active_sessions'] > 0,
            'database_responsive' => true
        ]
    ];
    
    echo json_encode($response, JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao verificar logs: ' . $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT);
}
?>
