<?php
/**
 * InventoX - Protect Debug Endpoints
 * Proteger endpoints de debug/teste em produção
 * 
 * Adicione este require no início de todos os arquivos de debug/teste:
 * require_once __DIR__ . '/protect_debug_endpoints.php';
 */

// Verificar se está em produção (ajustar conforme necessário)
$isProduction = (
    !empty($_SERVER['HTTPS']) || 
    !empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https' ||
    (isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'production')
);

// Em produção, requerer autenticação admin
if ($isProduction) {
    require_once __DIR__ . '/db.php';
    
    // Verificar autenticação
    requireAuth();
    
    // Verificar se é admin
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Acesso negado. Apenas administradores podem acessar endpoints de debug em produção.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

// Em desenvolvimento, permitir acesso livre (ou adicionar verificação adicional se necessário)

