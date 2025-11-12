<?php
/**
 * Analytics API - Fornece dados reais de análise da base de dados
 */

require_once 'db.php';

// Verificar autenticação e role de admin
requireAuth();
requireAdmin();

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
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            handleGetAnalytics();
            break;
        default:
            sendJsonResponse([
                'success' => false,
                'message' => 'Método não suportado'
            ], 405);
    }
} catch (Exception $e) {
    error_log('Analytics API Error: ' . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro interno do servidor'
    ], 500);
}

function handleGetAnalytics() {
    
    // Obter parâmetros
    $timeRange = isset($_GET['timeRange']) ? (int)$_GET['timeRange'] : 30;
    $period = isset($_GET['period']) ? $_GET['period'] : 'daily';
    
    // Validar timeRange
    if ($timeRange < 1 || $timeRange > 365) {
        $timeRange = 30;
    }
    
    try {
        // Calcular datas
        $endDate = new DateTime();
        $startDate = new DateTime();
        $startDate->sub(new DateInterval("P{$timeRange}D"));
        
        $startDateStr = $startDate->format('Y-m-d H:i:s');
        $endDateStr = $endDate->format('Y-m-d H:i:s');
        
        // 1. KPIs Principais
        $kpis = calculateKPIs($startDateStr, $endDateStr, $timeRange);
        
        // 2. Dados de Tendência
        $trends = calculateTrends($startDateStr, $endDateStr, $period);
        
        // 3. Dados do Mapa de Calor
        $heatmap = calculateHeatmap();
        
        // 4. Distribuição por Categoria
        $categories = calculateCategoryDistribution($startDateStr, $endDateStr);
        
        // 5. Ranking de Utilizadores
        $users = calculateUserRanking($startDateStr, $endDateStr);
        
        // 6. Insights e Recomendações
        $insights = generateInsights($kpis, $trends, $categories, $users);
        $recommendations = generateRecommendations($kpis, $trends, $categories, $users);
        
        sendJsonResponse([
            'success' => true,
            'data' => [
                'kpis' => $kpis,
                'trends' => $trends,
                'heatmap' => $heatmap,
                'categories' => $categories,
                'users' => $users,
                'insights' => $insights,
                'recommendations' => $recommendations,
                'metadata' => [
                    'timeRange' => $timeRange,
                    'period' => $period,
                    'startDate' => $startDateStr,
                    'endDate' => $endDateStr,
                    'generatedAt' => date('Y-m-d H:i:s')
                ]
            ]
        ]);
        
    } catch (Exception $e) {
        error_log('Analytics calculation error: ' . $e->getMessage());
        sendJsonResponse([
            'success' => false,
            'message' => 'Erro ao calcular análise'
        ], 500);
    }
}

function calculateKPIs($startDate, $endDate, $timeRange) {
    $db = getDB();
    
    // Total de scans (contagens de inventário)
    $stmt = $db->prepare("
        SELECT COUNT(*) as total_scans,
               SUM(CASE WHEN difference = 0 THEN 1 ELSE 0 END) as accurate_scans
        FROM inventory_counts 
        WHERE counted_at BETWEEN ? AND ?
    ");
    $stmt->execute([$startDate, $endDate]);
    $scanData = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $totalScans = (int)$scanData['total_scans'];
    $accurateScans = (int)$scanData['accurate_scans'];
    $accuracy = $totalScans > 0 ? round(($accurateScans / $totalScans) * 100, 1) : 0;
    
    // Sessões ativas
    $stmt = $db->prepare("SELECT COUNT(*) as active_sessions FROM inventory_sessions WHERE status = 'aberta'");
    $stmt->execute();
    $activeSessions = (int)$stmt->fetchColumn();
    
    // Produtividade (scans por dia)
    $productivity = $timeRange > 0 ? round($totalScans / $timeRange, 1) : 0;
    
    // Eficiência (baseada na precisão e produtividade)
    $efficiency = round(($accuracy + min($productivity * 2, 100)) / 2, 1);
    
    // Calcular mudanças comparando com período anterior
    $previousStartDate = date('Y-m-d H:i:s', strtotime($startDate) - ($timeRange * 24 * 60 * 60));
    $previousEndDate = $startDate;
    
    $stmt = $db->prepare("
        SELECT COUNT(*) as prev_total_scans,
               SUM(CASE WHEN difference = 0 THEN 1 ELSE 0 END) as prev_accurate_scans
        FROM inventory_counts 
        WHERE counted_at BETWEEN ? AND ?
    ");
    $stmt->execute([$previousStartDate, $previousEndDate]);
    $prevData = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $prevTotalScans = (int)$prevData['prev_total_scans'];
    $prevAccurateScans = (int)$prevData['prev_accurate_scans'];
    $prevAccuracy = $prevTotalScans > 0 ? round(($prevAccurateScans / $prevTotalScans) * 100, 1) : 0;
    $prevProductivity = $timeRange > 0 ? round($prevTotalScans / $timeRange, 1) : 0;
    $prevEfficiency = round(($prevAccuracy + min($prevProductivity * 2, 100)) / 2, 1);
    
    // Calcular percentagens de mudança
    $scansChange = $prevTotalScans > 0 ? round((($totalScans - $prevTotalScans) / $prevTotalScans) * 100, 1) : 0;
    $productivityChange = $prevProductivity > 0 ? round((($productivity - $prevProductivity) / $prevProductivity) * 100, 1) : 0;
    $accuracyChange = $prevAccuracy > 0 ? round((($accuracy - $prevAccuracy) / $prevAccuracy) * 100, 1) : 0;
    $efficiencyChange = $prevEfficiency > 0 ? round((($efficiency - $prevEfficiency) / $prevEfficiency) * 100, 1) : 0;
    
    return [
        'totalScans' => $totalScans,
        'productivity' => $productivity,
        'accuracy' => $accuracy,
        'efficiency' => $efficiency,
        'activeSessions' => $activeSessions,
        'changes' => [
            'scans' => $scansChange,
            'productivity' => $productivityChange,
            'accuracy' => $accuracyChange,
            'efficiency' => $efficiencyChange
        ]
    ];
}

function calculateTrends($startDate, $endDate, $period) {
    $db = getDB();
    
    $trends = [];
    $dateFormat = '';
    $interval = '';
    
    switch ($period) {
        case 'weekly':
            $dateFormat = '%Y-%u'; // Ano-semana
            $interval = 'WEEK';
            break;
        case 'monthly':
            $dateFormat = '%Y-%m'; // Ano-mês
            $interval = 'MONTH';
            break;
        default: // daily
            $dateFormat = '%Y-%m-%d'; // Ano-mês-dia
            $interval = 'DAY';
    }
    
    $stmt = $db->prepare("
        SELECT 
            DATE_FORMAT(created_at, ?) as period_key,
            DATE(counted_at) as date,
            COUNT(*) as scans,
            SUM(CASE WHEN difference = 0 THEN 1 ELSE 0 END) as accurate_scans,
            AVG(CASE WHEN difference = 0 THEN 100 ELSE 0 END) as accuracy
        FROM inventory_counts 
        WHERE counted_at BETWEEN ? AND ?
        GROUP BY period_key, DATE(counted_at)
        ORDER BY date ASC
    ");
    
    $stmt->execute([$dateFormat, $startDate, $endDate]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($results as $row) {
        $trends[] = [
            'date' => $row['date'],
            'scans' => (int)$row['scans'],
            'accuracy' => round((float)$row['accuracy'], 1),
            'efficiency' => round(((float)$row['accuracy'] + min((int)$row['scans'] * 2, 100)) / 2, 1)
        ];
    }
    
    return $trends;
}

function calculateHeatmap() {
    global $db;
    
    // Últimas 7 semanas (49 dias)
    $endDate = new DateTime();
    $startDate = new DateTime();
    $startDate->sub(new DateInterval('P49D'));
    
    $stmt = $db->prepare("
        SELECT 
            DATE(counted_at) as date,
            COUNT(*) as scans
        FROM inventory_counts 
        WHERE counted_at BETWEEN ? AND ?
        GROUP BY DATE(counted_at)
        ORDER BY date ASC
    ");
    
    $stmt->execute([$startDate->format('Y-m-d'), $endDate->format('Y-m-d')]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Criar array associativo para fácil lookup
    $scansByDate = [];
    foreach ($results as $row) {
        $scansByDate[$row['date']] = (int)$row['scans'];
    }
    
    // Encontrar valor máximo para normalização
    $maxScans = max(array_values($scansByDate)) ?: 1;
    
    $heatmap = [];
    $currentDate = clone $startDate;
    
    for ($week = 0; $week < 7; $week++) {
        for ($day = 0; $day < 7; $day++) {
            $dateStr = $currentDate->format('Y-m-d');
            $scans = $scansByDate[$dateStr] ?? 0;
            $intensity = min(4, floor(($scans / $maxScans) * 4)); // 0-4 scale
            
            $heatmap[] = [
                'week' => $week,
                'day' => $day,
                'date' => $dateStr,
                'scans' => $scans,
                'value' => $intensity
            ];
            
            $currentDate->add(new DateInterval('P1D'));
        }
    }
    
    return $heatmap;
}

function calculateCategoryDistribution($startDate, $endDate) {
    $db = getDB();
    
    $stmt = $db->prepare("
        SELECT 
            c.name as category_name,
            COUNT(ic.id) as scan_count
        FROM inventory_counts ic
        JOIN items i ON ic.item_id = i.id
        LEFT JOIN categories c ON i.category_id = c.id
        WHERE ic.created_at BETWEEN ? AND ?
        GROUP BY c.id, c.name
        ORDER BY scan_count DESC
        LIMIT 10
    ");
    
    $stmt->execute([$startDate, $endDate]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $totalScans = array_sum(array_column($results, 'scan_count'));
    
    $categories = [];
    foreach ($results as $row) {
        $count = (int)$row['scan_count'];
        $percentage = $totalScans > 0 ? round(($count / $totalScans) * 100, 1) : 0;
        
        $categories[] = [
            'name' => $row['category_name'] ?: 'Sem Categoria',
            'count' => $count,
            'percentage' => $percentage
        ];
    }
    
    return $categories;
}

function calculateUserRanking($startDate, $endDate) {
    $db = getDB();
    
    $stmt = $db->prepare("
        SELECT 
            u.username,
            u.role,
            COUNT(ic.id) as total_scans,
            SUM(CASE WHEN ic.difference = 0 THEN 1 ELSE 0 END) as accurate_scans,
            AVG(CASE WHEN ic.difference = 0 THEN 100 ELSE 0 END) as accuracy,
            COUNT(ic.id) / ? as scans_per_day
        FROM inventory_counts ic
        JOIN users u ON ic.user_id = u.id
        WHERE ic.created_at BETWEEN ? AND ?
        GROUP BY u.id, u.username, u.role
        HAVING total_scans > 0
        ORDER BY total_scans DESC
        LIMIT 10
    ");
    
    // Calcular número de dias para scans_per_day
    $days = max(1, (strtotime($endDate) - strtotime($startDate)) / (24 * 60 * 60));
    
    $stmt->execute([$days, $startDate, $endDate]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $users = [];
    foreach ($results as $row) {
        $totalScans = (int)$row['total_scans'];
        $accuracy = round((float)$row['accuracy'], 1);
        $speed = round((float)$row['scans_per_day'], 1);
        
        $users[] = [
            'name' => $row['username'],
            'role' => ucfirst($row['role']),
            'scans' => $totalScans,
            'accuracy' => $accuracy,
            'speed' => $speed,
            'efficiency' => round(($accuracy + min($speed * 10, 100)) / 2, 1)
        ];
    }
    
    return $users;
}

function generateInsights($kpis, $trends, $categories, $users) {
    $insights = [];
    
    // Insight 1: Análise de produtividade
    if ($kpis['productivity'] > 20) {
        $insights[] = [
            'type' => 'productivity',
            'title' => 'Alta Produtividade',
            'message' => "Excelente! A equipe está a realizar {$kpis['productivity']} scans por dia em média.",
            'color' => 'green',
            'icon' => '🎯'
        ];
    } elseif ($kpis['productivity'] < 5) {
        $insights[] = [
            'type' => 'productivity',
            'title' => 'Produtividade Baixa',
            'message' => "Apenas {$kpis['productivity']} scans por dia. Considere verificar os processos.",
            'color' => 'yellow',
            'icon' => '⚠️'
        ];
    }
    
    // Insight 2: Análise de precisão
    if ($kpis['accuracy'] > 90) {
        $insights[] = [
            'type' => 'accuracy',
            'title' => 'Precisão Excelente',
            'message' => "Parabéns! {$kpis['accuracy']}% de precisão nos scans.",
            'color' => 'green',
            'icon' => '🎯'
        ];
    } elseif ($kpis['accuracy'] < 80) {
        $insights[] = [
            'type' => 'accuracy',
            'title' => 'Precisão Necessita Atenção',
            'message' => "Precisão de {$kpis['accuracy']}% está abaixo do ideal. Revisar processos.",
            'color' => 'yellow',
            'icon' => '⚠️'
        ];
    }
    
    // Insight 3: Análise de tendência
    if (count($trends) >= 2) {
        $recentTrend = end($trends);
        $previousTrend = $trends[count($trends) - 2];
        
        if ($recentTrend['scans'] > $previousTrend['scans']) {
            $insights[] = [
                'type' => 'trend',
                'title' => 'Tendência Positiva',
                'message' => "Atividade aumentou de {$previousTrend['scans']} para {$recentTrend['scans']} scans.",
                'color' => 'green',
                'icon' => '📈'
            ];
        }
    }
    
    return $insights;
}

function generateRecommendations($kpis, $trends, $categories, $users) {
    $recommendations = [];
    
    // Recomendação 1: Baseada na eficiência
    if ($kpis['efficiency'] < 70) {
        $recommendations[] = [
            'type' => 'optimization',
            'title' => 'Otimização Sugerida',
            'message' => "Eficiência de {$kpis['efficiency']}% pode ser melhorada com formação adicional.",
            'color' => 'purple',
            'icon' => '🚀',
            'actions' => ['Aplicar', 'Mais info']
        ];
    }
    
    // Recomendação 2: Baseada nos utilizadores
    if (count($users) > 1) {
        $topUser = $users[0];
        $recommendations[] = [
            'type' => 'training',
            'title' => 'Partilha de Boas Práticas',
            'message' => "{$topUser['name']} tem excelente performance. Considere sessões de partilha.",
            'color' => 'indigo',
            'icon' => '🎓',
            'actions' => ['Agendar', 'Ver detalhes']
        ];
    }
    
    // Recomendação 3: Baseada nas categorias
    if (!empty($categories)) {
        $topCategory = $categories[0];
        if ($topCategory['percentage'] > 50) {
            $recommendations[] = [
                'type' => 'system',
                'title' => 'Foco em Categoria Principal',
                'message' => "Categoria '{$topCategory['name']}' representa {$topCategory['percentage']}% dos scans. Considere otimizações específicas.",
                'color' => 'teal',
                'icon' => '🔧',
                'actions' => ['Analisar', 'Otimizar']
            ];
        }
    }
    
    return $recommendations;
}

?>
