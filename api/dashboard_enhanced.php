<?php
/**
 * DASHBOARD ENHANCED API - Versão otimizada com dados reais
 * Substitui stats.php com melhor performance e dados mais completos
 */

require_once __DIR__ . '/db.php';

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Verificar autenticação
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendJsonResponse([
        'success' => false,
        'message' => 'Método não permitido'
    ], 405);
}

try {
    $db = getDB();
    
    // === ESTATÍSTICAS PRINCIPAIS ===
    $stats = [];
    
    // Cache de queries para melhor performance
    $queries = [
        'total_items' => "SELECT COUNT(*) FROM items",
        'total_categories' => "SELECT COUNT(*) FROM categories",
        'total_users' => "SELECT COUNT(*) FROM users",
        'active_sessions' => "SELECT COUNT(*) FROM inventory_sessions WHERE status = 'aberta'",
        'total_scans_today' => "SELECT COUNT(*) FROM inventory_counts WHERE DATE(counted_at) = CURDATE()",
        'total_scans_week' => "SELECT COUNT(*) FROM inventory_counts WHERE counted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
        'total_scans_month' => "SELECT COUNT(*) FROM inventory_counts WHERE counted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
        'accurate_scans_today' => "SELECT COUNT(*) FROM inventory_counts WHERE DATE(counted_at) = CURDATE() AND difference = 0",
        'discrepancies_today' => "SELECT COUNT(*) FROM inventory_counts WHERE DATE(counted_at) = CURDATE() AND difference != 0"
    ];
    
    // Executar queries em batch para melhor performance
    foreach ($queries as $key => $query) {
        try {
            $result = $db->query($query);
            $stats[$key] = (int)$result->fetchColumn();
        } catch (Exception $e) {
            error_log("Dashboard query error ($key): " . $e->getMessage());
            $stats[$key] = 0;
        }
    }
    
    // === CÁLCULOS DERIVADOS ===
    
    // Precisão de hoje
    $stats['accuracy_today'] = $stats['total_scans_today'] > 0 
        ? round(($stats['accurate_scans_today'] / $stats['total_scans_today']) * 100, 1) 
        : 0;
    
    // Eficiência (baseada em scans por hora)
    $currentHour = (int)date('H');
    $expectedScansPerHour = 10; // Meta: 10 scans por hora
    $expectedScansToday = $currentHour * $expectedScansPerHour;
    $stats['efficiency'] = $expectedScansToday > 0 
        ? min(100, round(($stats['total_scans_today'] / $expectedScansToday) * 100, 1))
        : 0;
    
    // Produtividade (scans por dia)
    $stats['productivity'] = round($stats['total_scans_today'] / max(1, $currentHour), 1);
    
    // === ARTIGOS COM STOCK BAIXO ===
    $lowStockItems = [];
    try {
        // Verificar se coluna min_quantity existe
        $checkColumn = $db->query("SHOW COLUMNS FROM items LIKE 'min_quantity'");
        if ($checkColumn->rowCount() > 0) {
            $lowStockQuery = $db->query("
                SELECT id, name, barcode, quantity, min_quantity 
                FROM items 
                WHERE quantity <= min_quantity 
                ORDER BY (quantity - min_quantity) ASC 
                LIMIT 10
            ");
            $lowStockItems = $lowStockQuery->fetchAll(PDO::FETCH_ASSOC);
            $stats['low_stock_items'] = count($lowStockItems);
        } else {
            // Fallback: considerar stock baixo como < 5
            $lowStockQuery = $db->query("
                SELECT id, name, barcode, quantity, 5 as min_quantity 
                FROM items 
                WHERE quantity < 5 
                ORDER BY quantity ASC 
                LIMIT 10
            ");
            $lowStockItems = $lowStockQuery->fetchAll(PDO::FETCH_ASSOC);
            $stats['low_stock_items'] = count($lowStockItems);
        }
    } catch (Exception $e) {
        error_log("Low stock query error: " . $e->getMessage());
        $stats['low_stock_items'] = 0;
    }
    
    // === SESSÕES RECENTES ===
    $recentSessions = [];
    try {
        $sessionsQuery = $db->query("
            SELECT 
                s.id,
                s.name,
                s.status,
                s.created_at,
                s.closed_at,
                u.username as created_by,
                COUNT(ic.id) as total_counts,
                SUM(CASE WHEN ic.difference = 0 THEN 1 ELSE 0 END) as accurate_counts
            FROM inventory_sessions s
            LEFT JOIN users u ON s.user_id = u.id
            LEFT JOIN inventory_counts ic ON s.id = ic.session_id
            GROUP BY s.id
            ORDER BY s.created_at DESC
            LIMIT 5
        ");
        $recentSessions = $sessionsQuery->fetchAll(PDO::FETCH_ASSOC);
        
        // Calcular precisão para cada sessão
        foreach ($recentSessions as &$session) {
            $session['accuracy'] = $session['total_counts'] > 0 
                ? round(($session['accurate_counts'] / $session['total_counts']) * 100, 1)
                : 0;
        }
    } catch (Exception $e) {
        error_log("Recent sessions query error: " . $e->getMessage());
    }
    
    // === ATIVIDADE RECENTE (ÚLTIMAS 24H) ===
    $recentActivity = [];
    try {
        $activityQuery = $db->query("
            SELECT 
                'count' as type,
                CONCAT('Contagem: ', i.name) as description,
                ic.counted_at as timestamp,
                u.username as user_name,
                CASE 
                    WHEN ic.difference > 0 THEN 'entrada'
                    WHEN ic.difference < 0 THEN 'saida'
                    ELSE 'correto'
                END as status
            FROM inventory_counts ic
            JOIN items i ON ic.item_id = i.id
            LEFT JOIN users u ON ic.user_id = u.id
            WHERE ic.counted_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY ic.counted_at DESC
            LIMIT 10
        ");
        $recentActivity = $activityQuery->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        error_log("Recent activity query error: " . $e->getMessage());
    }
    
    // === ESTATÍSTICAS POR CATEGORIA ===
    $categoryStats = [];
    try {
        $categoryQuery = $db->query("
            SELECT 
                c.name as category_name,
                COUNT(i.id) as total_items,
                COUNT(ic.id) as total_scans,
                AVG(CASE WHEN ic.difference = 0 THEN 100 ELSE 0 END) as accuracy
            FROM categories c
            LEFT JOIN items i ON c.id = i.category_id
            LEFT JOIN inventory_counts ic ON i.id = ic.item_id AND ic.counted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY c.id, c.name
            ORDER BY total_scans DESC
            LIMIT 5
        ");
        $categoryStats = $categoryQuery->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        error_log("Category stats query error: " . $e->getMessage());
    }
    
    // === ALERTAS INTELIGENTES ===
    $alerts = [];
    
    // Alerta: Sessões abertas há muito tempo
    if ($stats['active_sessions'] > 0) {
        try {
            $oldSessions = $db->query("
                SELECT COUNT(*) FROM inventory_sessions 
                WHERE status = 'aberta' AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ")->fetchColumn();
            
            if ($oldSessions > 0) {
                $alerts[] = [
                    'type' => 'warning',
                    'message' => "$oldSessions sessão(ões) aberta(s) há mais de 24 horas",
                    'action' => 'Considere fechar sessões antigas'
                ];
            }
        } catch (Exception $e) {
            error_log("Old sessions alert error: " . $e->getMessage());
        }
    }
    
    // Alerta: Baixa atividade
    if ($stats['total_scans_today'] < 10) {
        $alerts[] = [
            'type' => 'info',
            'message' => 'Baixa atividade de contagem hoje',
            'action' => 'Incentive mais contagens de inventário'
        ];
    }
    
    // Alerta: Muitas discrepâncias
    if ($stats['discrepancies_today'] > ($stats['total_scans_today'] * 0.2)) {
        $alerts[] = [
            'type' => 'warning',
            'message' => 'Alta taxa de discrepâncias hoje',
            'action' => 'Verifique processos de contagem'
        ];
    }
    
    // === VALOR TOTAL DO INVENTÁRIO ===
    $totalValue = 0;
    try {
        // Verificar se coluna price existe
        $checkPrice = $db->query("SHOW COLUMNS FROM items LIKE 'price'");
        if ($checkPrice->rowCount() > 0) {
            $valueQuery = $db->query("SELECT SUM(quantity * price) FROM items WHERE price IS NOT NULL");
            $totalValue = (float)$valueQuery->fetchColumn();
        }
    } catch (Exception $e) {
        error_log("Total value query error: " . $e->getMessage());
    }
    
    $stats['total_inventory_value'] = $totalValue;
    
    // === RESPOSTA FINAL ===
    sendJsonResponse([
        'success' => true,
        'stats' => $stats,
        'low_stock_items' => $lowStockItems,
        'recent_sessions' => $recentSessions,
        'recent_activity' => $recentActivity,
        'category_stats' => $categoryStats,
        'alerts' => $alerts,
        'metadata' => [
            'generated_at' => date('Y-m-d H:i:s'),
            'data_source' => 'real_database',
            'performance' => 'optimized'
        ]
    ]);
    
} catch (Exception $e) {
    error_log("Dashboard Enhanced Error: " . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro interno do servidor',
        'error' => $e->getMessage()
    ], 500);
}
?>
