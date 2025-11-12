<?php
/**
 * SYSTEM MONITOR API - Monitoramento em tempo real do sistema
 * Fornece métricas de performance e saúde do sistema
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

// Verificar autenticação (apenas admin)
requireAuth();
requireAdmin();

try {
    $db = getDB();
    
    // === MÉTRICAS DE PERFORMANCE ===
    $performance = [];
    
    // Tempo de resposta da base de dados
    $start = microtime(true);
    $db->query("SELECT 1")->fetch();
    $performance['db_response_time'] = round((microtime(true) - $start) * 1000, 2);
    
    // Tamanho das tabelas principais
    $tables = ['items', 'inventory_counts', 'inventory_sessions', 'users', 'categories'];
    $performance['table_sizes'] = [];
    
    foreach ($tables as $table) {
        try {
            $result = $db->query("SELECT COUNT(*) FROM $table")->fetchColumn();
            $performance['table_sizes'][$table] = (int)$result;
        } catch (Exception $e) {
            $performance['table_sizes'][$table] = 0;
        }
    }
    
    // === ATIVIDADE RECENTE ===
    $activity = [
        'last_24h' => [],
        'last_hour' => [],
        'active_users' => []
    ];
    
    // Contagens nas últimas 24 horas
    $activity['last_24h']['counts'] = (int)$db->query("
        SELECT COUNT(*) FROM inventory_counts 
        WHERE counted_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ")->fetchColumn();
    
    // Contagens na última hora
    $activity['last_hour']['counts'] = (int)$db->query("
        SELECT COUNT(*) FROM inventory_counts 
        WHERE counted_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    ")->fetchColumn();
    
    // Usuários ativos (que fizeram contagens hoje)
    $activeUsers = $db->query("
        SELECT DISTINCT u.username, COUNT(ic.id) as count_today
        FROM users u
        JOIN inventory_counts ic ON u.id = ic.user_id
        WHERE DATE(ic.counted_at) = CURDATE()
        GROUP BY u.id, u.username
        ORDER BY count_today DESC
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    $activity['active_users'] = $activeUsers;
    
    // === ANÁLISE DE ERROS ===
    $errors = [
        'recent_errors' => [],
        'error_rate' => 0
    ];
    
    // Simular análise de logs de erro (em produção, ler arquivo de log real)
    $logFile = __DIR__ . '/../error.log';
    if (file_exists($logFile)) {
        $logContent = file_get_contents($logFile);
        $errorCount = substr_count($logContent, '[ERROR]');
        $errors['error_rate'] = $errorCount;
    }
    
    // === SAÚDE DO SISTEMA ===
    $health = [
        'status' => 'HEALTHY',
        'issues' => [],
        'recommendations' => []
    ];
    
    // Verificar problemas potenciais
    if ($performance['db_response_time'] > 100) {
        $health['issues'][] = 'Base de dados lenta (>' . $performance['db_response_time'] . 'ms)';
        $health['status'] = 'WARNING';
    }
    
    if ($activity['last_hour']['counts'] == 0 && date('H') > 8 && date('H') < 18) {
        $health['issues'][] = 'Nenhuma atividade na última hora durante horário comercial';
        $health['status'] = 'WARNING';
    }
    
    if (count($activeUsers) == 0) {
        $health['issues'][] = 'Nenhum utilizador ativo hoje';
        $health['status'] = 'WARNING';
    }
    
    // Recomendações baseadas na análise
    if ($performance['table_sizes']['inventory_counts'] > 10000) {
        $health['recommendations'][] = 'Considere arquivar contagens antigas para melhor performance';
    }
    
    if (count($activeUsers) < 2) {
        $health['recommendations'][] = 'Incentive mais utilizadores a usar o sistema';
    }
    
    // === ESTATÍSTICAS DE USO ===
    $usage = [];
    
    // Contagens por dia da semana
    $usage['by_weekday'] = $db->query("
        SELECT 
            DAYNAME(counted_at) as day_name,
            COUNT(*) as count
        FROM inventory_counts 
        WHERE counted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DAYOFWEEK(counted_at), DAYNAME(counted_at)
        ORDER BY DAYOFWEEK(counted_at)
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    // Contagens por hora do dia
    $usage['by_hour'] = $db->query("
        SELECT 
            HOUR(counted_at) as hour,
            COUNT(*) as count
        FROM inventory_counts 
        WHERE counted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY HOUR(counted_at)
        ORDER BY HOUR(counted_at)
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    // === ALERTAS INTELIGENTES ===
    $alerts = [];
    
    // Alerta: Performance degradada
    if ($performance['db_response_time'] > 200) {
        $alerts[] = [
            'level' => 'critical',
            'message' => 'Performance da base de dados crítica',
            'details' => 'Tempo de resposta: ' . $performance['db_response_time'] . 'ms'
        ];
    }
    
    // Alerta: Baixa atividade
    if ($activity['last_24h']['counts'] < 10) {
        $alerts[] = [
            'level' => 'warning',
            'message' => 'Baixa atividade nas últimas 24 horas',
            'details' => 'Apenas ' . $activity['last_24h']['counts'] . ' contagens registadas'
        ];
    }
    
    // Alerta: Sessões abertas há muito tempo
    $oldSessions = (int)$db->query("
        SELECT COUNT(*) FROM inventory_sessions 
        WHERE status = 'aberta' AND created_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)
    ")->fetchColumn();
    
    if ($oldSessions > 0) {
        $alerts[] = [
            'level' => 'info',
            'message' => 'Sessões abertas há mais de 48 horas',
            'details' => "$oldSessions sessão(ões) precisam ser fechadas"
        ];
    }
    
    // === RESPOSTA FINAL ===
    sendJsonResponse([
        'success' => true,
        'timestamp' => date('Y-m-d H:i:s'),
        'performance' => $performance,
        'activity' => $activity,
        'errors' => $errors,
        'health' => $health,
        'usage' => $usage,
        'alerts' => $alerts,
        'metadata' => [
            'server_time' => date('Y-m-d H:i:s'),
            'timezone' => date_default_timezone_get(),
            'php_version' => PHP_VERSION,
            'memory_usage' => round(memory_get_usage(true) / 1024 / 1024, 2) . ' MB'
        ]
    ]);
    
} catch (Exception $e) {
    error_log("System Monitor Error: " . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro no monitoramento do sistema',
        'error' => $e->getMessage()
    ], 500);
}
?>
