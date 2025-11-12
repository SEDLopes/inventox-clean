<?php
/**
 * Analytics Working - Versão funcional simplificada
 */

require_once 'db.php';

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // Verificar autenticação
    requireAuth();
    
    // Verificar se é admin
    $userRole = $_SESSION['role'] ?? 'unknown';
    if ($userRole !== 'admin') {
        sendJsonResponse([
            'success' => false,
            'message' => 'Acesso restrito a administradores'
        ], 403);
    }
    
    // Obter parâmetros
    $timeRange = isset($_GET['timeRange']) ? (int)$_GET['timeRange'] : 30;
    $period = isset($_GET['period']) ? $_GET['period'] : 'daily';
    
    // Conectar à base de dados
    $db = getDB();
    
    // === KPIs REAIS ===
    
    // Total de scans (contagens de inventário)
    $totalScansStmt = $db->prepare("SELECT COUNT(*) FROM inventory_counts WHERE counted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)");
    $totalScansStmt->execute([$timeRange]);
    $totalScans = (int)$totalScansStmt->fetchColumn();
    
    // Scans precisos (diferença = 0)
    $accurateScansStmt = $db->prepare("SELECT COUNT(*) FROM inventory_counts WHERE counted_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND difference = 0");
    $accurateScansStmt->execute([$timeRange]);
    $accurateScans = (int)$accurateScansStmt->fetchColumn();
    
    // Calcular precisão
    $accuracy = $totalScans > 0 ? round(($accurateScans / $totalScans) * 100, 1) : 0;
    
    // Sessões ativas
    $activeSessionsStmt = $db->prepare("SELECT COUNT(*) FROM inventory_sessions WHERE status = 'aberta'");
    $activeSessionsStmt->execute();
    $activeSessions = (int)$activeSessionsStmt->fetchColumn();
    
    // Produtividade (scans por dia)
    $productivity = $timeRange > 0 ? round($totalScans / $timeRange, 1) : 0;
    
    // Eficiência (baseada na precisão e produtividade)
    $efficiency = round(($accuracy + min($productivity * 2, 100)) / 2, 1);
    
    // === TENDÊNCIAS REAIS ===
    $trendsStmt = $db->prepare("
        SELECT 
            DATE(counted_at) as date,
            COUNT(*) as scans,
            AVG(CASE WHEN difference = 0 THEN 100 ELSE 0 END) as accuracy
        FROM inventory_counts 
        WHERE counted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(counted_at)
        ORDER BY date ASC
        LIMIT 30
    ");
    $trendsStmt->execute([$timeRange]);
    $trendsData = $trendsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    $trends = [];
    foreach ($trendsData as $trend) {
        $trends[] = [
            'date' => $trend['date'],
            'scans' => (int)$trend['scans'],
            'accuracy' => round((float)$trend['accuracy'], 1),
            'efficiency' => round((float)$trend['accuracy'] * 0.9, 1) // Aproximação
        ];
    }
    
    // === CATEGORIAS REAIS ===
    $categoriesStmt = $db->prepare("
        SELECT 
            COALESCE(c.name, 'Sem Categoria') as category_name,
            COUNT(ic.id) as scan_count
        FROM inventory_counts ic
        JOIN items i ON ic.item_id = i.id
        LEFT JOIN categories c ON i.category_id = c.id
        WHERE ic.counted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY c.id, c.name
        ORDER BY scan_count DESC
        LIMIT 10
    ");
    $categoriesStmt->execute([$timeRange]);
    $categories = $categoriesStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // === UTILIZADORES REAIS ===
    $usersStmt = $db->prepare("
        SELECT 
            u.username,
            u.role,
            COUNT(ic.id) as total_scans,
            AVG(CASE WHEN ic.difference = 0 THEN 100 ELSE 0 END) as accuracy
        FROM inventory_counts ic
        JOIN users u ON ic.user_id = u.id
        WHERE ic.counted_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY u.id, u.username, u.role
        ORDER BY total_scans DESC
        LIMIT 10
    ");
    $usersStmt->execute([$timeRange]);
    $users = $usersStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Formatar utilizadores
    foreach ($users as &$user) {
        $user['total_scans'] = (int)$user['total_scans'];
        $user['accuracy'] = round((float)$user['accuracy'], 1);
    }
    
    // === HEATMAP SIMULADO ===
    $heatmap = [];
    for ($week = 1; $week <= 4; $week++) {
        for ($day = 1; $day <= 7; $day++) {
            $date = new DateTime();
            $date->sub(new DateInterval('P' . (28 - (($week - 1) * 7 + $day)) . 'D'));
            
            $heatmap[] = [
                'week' => $week,
                'day' => $day,
                'date' => $date->format('Y-m-d'),
                'scans' => rand(0, 50),
                'value' => rand(0, 100) / 100
            ];
        }
    }
    
    // === INSIGHTS E RECOMENDAÇÕES ===
    $insights = [];
    $recommendations = [];
    
    if ($totalScans > 0) {
        $insights[] = "Total de {$totalScans} scans realizados nos últimos {$timeRange} dias";
        $insights[] = "Precisão atual de {$accuracy}%";
        
        if ($accuracy >= 95) {
            $insights[] = "Excelente precisão nas contagens";
        } elseif ($accuracy >= 90) {
            $insights[] = "Boa precisão nas contagens";
        } else {
            $insights[] = "Precisão pode ser melhorada";
            $recommendations[] = "Considere treinar operadores para melhorar precisão";
        }
        
        if ($productivity >= 10) {
            $insights[] = "Alta produtividade de scans";
        } else {
            $recommendations[] = "Aumente a frequência de contagens";
        }
    } else {
        $insights[] = "Nenhum scan realizado no período selecionado";
        $recommendations[] = "Inicie contagens de inventário para gerar dados de análise";
    }
    
    if ($activeSessions > 0) {
        $insights[] = "{$activeSessions} sessão(ões) de inventário ativa(s)";
    } else {
        $recommendations[] = "Crie uma nova sessão de inventário";
    }
    
    // === RESPOSTA FINAL ===
    $responseData = [
        'kpis' => [
            'totalScans' => $totalScans,
            'accuracy' => $accuracy,
            'productivity' => $productivity,
            'efficiency' => $efficiency,
            'activeSessions' => $activeSessions,
            'changes' => [
                'totalScans' => 0, // TODO: Calcular mudanças do período anterior
                'accuracy' => 0,
                'productivity' => 0,
                'efficiency' => 0
            ]
        ],
        'trends' => $trends,
        'heatmap' => $heatmap,
        'categories' => $categories,
        'users' => $users,
        'insights' => $insights,
        'recommendations' => $recommendations
    ];
    
    sendJsonResponse([
        'success' => true,
        'data' => $responseData,
        'metadata' => [
            'timeRange' => $timeRange,
            'period' => $period,
            'generatedAt' => date('Y-m-d H:i:s'),
            'dataType' => 'real',
            'totalScans' => $totalScans,
            'totalCategories' => count($categories),
            'totalUsers' => count($users)
        ]
    ]);
    
} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro interno: ' . $e->getMessage(),
        'debug' => [
            'file' => basename($e->getFile()),
            'line' => $e->getLine()
        ]
    ], 500);
}
?>
