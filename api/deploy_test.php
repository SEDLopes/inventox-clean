<?php
/**
 * Teste de Deploy - InventoX
 * Verificar se as correções estão ativas em produção
 */

header('Content-Type: application/json');

$deployInfo = [
    'timestamp' => date('Y-m-d H:i:s'),
    'version' => '2025-01-11-fix-operador',
    'fixes' => [
        'tailwind_cdn' => 'Removido CDN, usando CSS local',
        'operador_role' => 'Normalização de roles implementada',
        'users_php' => 'Logs detalhados adicionados'
    ],
    'files_check' => [
        'users.php' => file_exists(__DIR__ . '/users.php') ? 'EXISTS' : 'MISSING',
        'index.html' => file_exists(__DIR__ . '/../frontend/index.html') ? 'EXISTS' : 'MISSING',
        'styles.css' => file_exists(__DIR__ . '/../frontend/dist/styles.css') ? 'EXISTS' : 'MISSING'
    ]
];

// Verificar se a função de normalização existe em users.php
if (file_exists(__DIR__ . '/users.php')) {
    $usersContent = file_get_contents(__DIR__ . '/users.php');
    $deployInfo['users_php_checks'] = [
        'has_normalization' => strpos($usersContent, 'strtolower($role)') !== false,
        'has_error_log' => strpos($usersContent, 'error_log(\'handleCreateUser') !== false,
        'has_operador_check' => strpos($usersContent, 'operador') !== false
    ];
}

echo json_encode($deployInfo, JSON_PRETTY_PRINT);
?>
