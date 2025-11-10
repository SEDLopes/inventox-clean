<?php
/**
 * InventoX - Rate Limiting
 * Sistema básico de rate limiting para proteger contra ataques
 */

// Configuração
$RATE_LIMIT_ENABLED = true;
$RATE_LIMIT_MAX_REQUESTS = 60; // Requisições por minuto
$RATE_LIMIT_WINDOW = 60; // Janela de tempo em segundos

function checkRateLimit($identifier = null) {
    global $RATE_LIMIT_ENABLED, $RATE_LIMIT_MAX_REQUESTS, $RATE_LIMIT_WINDOW;
    
    if (!$RATE_LIMIT_ENABLED) {
        return true;
    }
    
    // Usar IP do cliente como identificador
    if ($identifier === null) {
        $identifier = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        // Considerar proxy headers
        if (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $forwarded = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $identifier = trim($forwarded[0]);
        }
    }
    
    // Diretório para armazenar contadores (usar /tmp em produção)
    $rateLimitDir = sys_get_temp_dir() . '/inventox_rate_limit';
    if (!is_dir($rateLimitDir)) {
        @mkdir($rateLimitDir, 0755, true);
    }
    
    $rateLimitFile = $rateLimitDir . '/' . md5($identifier) . '.json';
    $currentTime = time();
    
    // Ler contador existente
    $data = [
        'count' => 0,
        'window_start' => $currentTime
    ];
    
    if (file_exists($rateLimitFile)) {
        $fileData = @json_decode(@file_get_contents($rateLimitFile), true);
        if ($fileData && is_array($fileData)) {
            $data = $fileData;
        }
    }
    
    // Verificar se a janela expirou
    if (($currentTime - $data['window_start']) > $RATE_LIMIT_WINDOW) {
        // Nova janela
        $data = [
            'count' => 1,
            'window_start' => $currentTime
        ];
    } else {
        // Incrementar contador
        $data['count']++;
    }
    
    // Verificar se excedeu o limite
    if ($data['count'] > $RATE_LIMIT_MAX_REQUESTS) {
        // Limpar arquivo antigo após 5 minutos
        if (($currentTime - $data['window_start']) > 300) {
            @unlink($rateLimitFile);
        }
        
        return false;
    }
    
    // Salvar contador
    @file_put_contents($rateLimitFile, json_encode($data));
    
    return true;
}

/**
 * Função helper para verificar rate limit e retornar erro se necessário
 */
function requireRateLimit() {
    if (!checkRateLimit()) {
        http_response_code(429);
        header('Content-Type: application/json');
        header('Retry-After: 60');
        echo json_encode([
            'success' => false,
            'message' => 'Muitas requisições. Por favor, aguarde um momento.',
            'retry_after' => 60
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

