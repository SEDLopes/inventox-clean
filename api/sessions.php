<?php
/**
 * Sessions Redirect - Redireciona para session_count.php
 */

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Redirecionar para session_count.php mantendo query string
$queryString = $_SERVER['QUERY_STRING'] ? '?' . $_SERVER['QUERY_STRING'] : '';
$redirectUrl = '/api/session_count.php' . $queryString;

// Log do redirect para debug
error_log('sessions.php: Redirecting to ' . $redirectUrl);

// Redirect 301 (permanente)
header('Location: ' . $redirectUrl, true, 301);
exit();
?>
