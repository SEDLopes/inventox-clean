<?php
/**
 * Analytics Simple - Versão simplificada para debug
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
    // Log inicial
    error_log('=== ANALYTICS SIMPLE DEBUG ===');
    
    // Verificar autenticação
    requireAuth();
    error_log('Analytics Simple - Auth OK');
    
    // Verificar role
    $userRole = $_SESSION['role'] ?? 'unknown';
    error_log('Analytics Simple - User role: ' . $userRole);
    
    if ($userRole !== 'admin') {
        sendJsonResponse([
            'success' => false,
            'message' => 'Acesso restrito a administradores. Role atual: ' . $userRole
        ], 403);
    }
    
    // Dados mock simples
    $mockData = [
        'kpis' => [
            'totalScans' => 100,
            'accuracy' => 95.5,
            'productivity' => 25.3,
            'efficiency' => 87.2,
            'activeSessions' => 2,
            'changes' => [
                'totalScans' => 5.2,
                'accuracy' => -1.1,
                'productivity' => 8.7,
                'efficiency' => 2.3
            ]
        ],
        'trends' => [
            ['date' => '2024-01-01', 'scans' => 50, 'accuracy' => 95, 'efficiency' => 85],
            ['date' => '2024-01-02', 'scans' => 60, 'accuracy' => 97, 'efficiency' => 88]
        ],
        'heatmap' => [
            ['week' => 1, 'day' => 1, 'date' => '2024-01-01', 'scans' => 10, 'value' => 0.5],
            ['week' => 1, 'day' => 2, 'date' => '2024-01-02', 'scans' => 15, 'value' => 0.7]
        ],
        'categories' => [
            ['category_name' => 'Eletrônicos', 'scan_count' => 45],
            ['category_name' => 'Roupas', 'scan_count' => 30]
        ],
        'users' => [
            ['username' => 'admin', 'role' => 'admin', 'total_scans' => 75, 'accuracy' => 96.5],
            ['username' => 'operador1', 'role' => 'operador', 'total_scans' => 25, 'accuracy' => 94.2]
        ],
        'insights' => [
            'Produtividade aumentou 8.7% esta semana',
            'Precisão mantém-se acima de 95%'
        ],
        'recommendations' => [
            'Continue o excelente trabalho',
            'Considere treinar novos operadores'
        ]
    ];
    
    sendJsonResponse([
        'success' => true,
        'data' => $mockData,
        'debug' => [
            'user_role' => $userRole,
            'session_id' => session_id(),
            'timestamp' => date('Y-m-d H:i:s')
        ]
    ]);
    
} catch (Exception $e) {
    error_log('Analytics Simple Error: ' . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro: ' . $e->getMessage(),
        'debug' => [
            'error_line' => $e->getLine(),
            'error_file' => basename($e->getFile())
        ]
    ], 500);
}
?>
