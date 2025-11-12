<?php
/**
 * Teste de Deploy - Versão 2
 * Verificar se as alterações da aba analytics foram aplicadas
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$response = [
    'success' => true,
    'message' => 'Deploy Test v2 - Analytics Disabled',
    'timestamp' => date('Y-m-d H:i:s'),
    'commit' => 'a02f5f4',
    'analytics_status' => 'DISABLED',
    'changes' => [
        'analytics_tab_button' => 'COMMENTED OUT',
        'analytics_tab_content' => 'REMOVED',
        'javascript_calls' => 'DISABLED',
        'expected_result' => 'NO ANALYTICS TAB VISIBLE'
    ]
];

echo json_encode($response, JSON_PRETTY_PRINT);
?>
