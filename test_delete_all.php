<?php
/**
 * Teste da API de Eliminar Todos os Artigos
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/api/db.php';

try {
    // Verificar se a sessão está ativa
    $sessionStatus = session_status();
    $sessionInfo = [
        'session_status' => $sessionStatus,
        'session_id' => session_id(),
        'user_id' => $_SESSION['user_id'] ?? 'not_set',
        'role' => $_SESSION['role'] ?? 'not_set',
        'username' => $_SESSION['username'] ?? 'not_set'
    ];

    // Testar conexão com a base de dados
    $db = getDB();
    $dbTest = $db->query("SELECT COUNT(*) as total FROM items")->fetch();
    
    // Verificar se o utilizador está autenticado
    $isAuthenticated = isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
    $isAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'admin';
    
    // Testar se o endpoint items.php está acessível
    $itemsEndpointTest = file_exists(__DIR__ . '/api/items.php');
    
    $response = [
        'success' => true,
        'message' => 'Teste da API de Eliminar Todos os Artigos',
        'timestamp' => date('Y-m-d H:i:s'),
        'tests' => [
            'session_info' => $sessionInfo,
            'database_connection' => [
                'status' => 'connected',
                'total_items' => $dbTest['total']
            ],
            'authentication' => [
                'is_authenticated' => $isAuthenticated,
                'is_admin' => $isAdmin,
                'can_delete_all' => $isAuthenticated && $isAdmin
            ],
            'endpoints' => [
                'items_php_exists' => $itemsEndpointTest,
                'items_php_path' => __DIR__ . '/api/items.php'
            ]
        ],
        'recommendations' => []
    ];
    
    if (!$isAuthenticated) {
        $response['recommendations'][] = 'Utilizador não está autenticado. Faça login primeiro.';
    }
    
    if (!$isAdmin) {
        $response['recommendations'][] = 'Utilizador não é administrador. Apenas admins podem eliminar todos os artigos.';
    }
    
    if ($dbTest['total'] == 0) {
        $response['recommendations'][] = 'Não há artigos para eliminar.';
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
