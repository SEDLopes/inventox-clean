<?php
/**
 * InventoX - CSRF Protection
 * Sistema básico de proteção CSRF
 */

// Iniciar sessão se não estiver ativa
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Gerar token CSRF
 */
function generateCSRFToken() {
    if (!isset($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Verificar token CSRF
 */
function verifyCSRFToken($token) {
    if (!isset($_SESSION['csrf_token'])) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Requer token CSRF para métodos POST, PUT, DELETE
 */
function requireCSRF() {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    
    // Apenas verificar para métodos que modificam dados
    if (!in_array($method, ['POST', 'PUT', 'DELETE', 'PATCH'])) {
        return true;
    }
    
    // Obter token do header ou POST
    $token = null;
    if (isset($_SERVER['HTTP_X_CSRF_TOKEN'])) {
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'];
    } elseif (isset($_POST['csrf_token'])) {
        $token = $_POST['csrf_token'];
    } elseif (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && $_SERVER['HTTP_X_REQUESTED_WITH'] === 'XMLHttpRequest') {
        // Para AJAX, tentar obter do header
        $headers = getallheaders();
        if (isset($headers['X-CSRF-Token'])) {
            $token = $headers['X-CSRF-Token'];
        }
    }
    
    if (!$token || !verifyCSRFToken($token)) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'message' => 'Token CSRF inválido ou ausente'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    return true;
}

