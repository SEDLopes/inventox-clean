<?php
/**
 * Script de Diagnóstico de Importação
 * Verifica quantos artigos realmente existem na base de dados
 * e compara com o que foi reportado na importação
 */

require_once __DIR__ . '/db.php';

// Headers CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Verificar autenticação
requireAuth();

try {
    $db = getDB();
    
    // Contar artigos na base de dados
    $totalItems = $db->query("SELECT COUNT(*) FROM items")->fetchColumn();
    
    // Verificar duplicados de barcode
    $duplicates = $db->query("
        SELECT barcode, COUNT(*) as count 
        FROM items 
        GROUP BY barcode 
        HAVING count > 1
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    // Verificar artigos sem barcode
    $noBarcode = $db->query("SELECT COUNT(*) FROM items WHERE barcode IS NULL OR barcode = ''")->fetchColumn();
    
    // Verificar artigos sem nome
    $noName = $db->query("SELECT COUNT(*) FROM items WHERE name IS NULL OR name = ''")->fetchColumn();
    
    // Pesquisar "tubo pvc" como exemplo (múltiplas variações)
    $searchTerms = ['%tubo%pvc%', '%tubo pvc%', '%TUBO%PVC%', '%tubo%', '%pvc%'];
    $allSearchResults = [];
    foreach ($searchTerms as $term) {
        $searchExample = $db->prepare("
            SELECT DISTINCT id, barcode, name, description
            FROM items 
            WHERE (LOWER(name) LIKE LOWER(:search) OR LOWER(description) LIKE LOWER(:search) OR barcode LIKE :search)
            LIMIT 20
        ");
        $searchExample->execute(['search' => $term]);
        $results = $searchExample->fetchAll(PDO::FETCH_ASSOC);
        $allSearchResults = array_merge($allSearchResults, $results);
    }
    // Remover duplicados por ID
    $uniqueResults = [];
    $seenIds = [];
    foreach ($allSearchResults as $result) {
        if (!in_array($result['id'], $seenIds)) {
            $uniqueResults[] = $result;
            $seenIds[] = $result['id'];
        }
    }
    $searchResults = array_slice($uniqueResults, 0, 20);
    
    // Estatísticas de importação recente (últimas 24h)
    $recentImports = $db->query("
        SELECT 
            COUNT(*) as total,
            COUNT(DISTINCT barcode) as unique_barcodes,
            MIN(created_at) as first_import,
            MAX(created_at) as last_import
        FROM items 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ")->fetch(PDO::FETCH_ASSOC);
    
    // Verificar se há artigos com barcodes muito similares (possíveis duplicados)
    $similarBarcodes = $db->query("
        SELECT barcode, COUNT(*) as count
        FROM items
        WHERE barcode IS NOT NULL AND barcode != ''
        GROUP BY barcode
        HAVING count > 1
        LIMIT 20
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    // Verificar últimos artigos inseridos
    $lastItems = $db->query("
        SELECT id, barcode, name, created_at 
        FROM items 
        ORDER BY created_at DESC 
        LIMIT 10
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    sendJsonResponse([
        'success' => true,
        'diagnosis' => [
            'total_items_in_database' => (int)$totalItems,
            'duplicate_barcodes' => count($duplicates),
            'duplicate_details' => $duplicates,
            'items_without_barcode' => (int)$noBarcode,
            'items_without_name' => (int)$noName,
            'recent_imports_24h' => $recentImports,
            'search_example_tubo_pvc' => [
                'found' => count($searchResults),
                'results' => $searchResults
            ],
            'similar_barcodes' => $similarBarcodes,
            'last_items_inserted' => $lastItems
        ],
        'recommendations' => [
            count($duplicates) > 0 ? '⚠️ Encontrados códigos de barras duplicados. Isso pode causar problemas na importação.' : '✅ Nenhum código de barras duplicado encontrado.',
            count($searchResults) === 0 ? '⚠️ Artigo "tubo pvc" não encontrado. Pode não ter sido importado ou o nome está diferente.' : '✅ Artigo "tubo pvc" encontrado.',
            $totalItems < 3000 ? '⚠️ Total de artigos parece baixo para uma importação de 4000+ linhas. Verifique se houve erros na importação.' : '✅ Total de artigos parece correto.'
        ],
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
} catch (Exception $e) {
    error_log("Diagnose Import Error: " . $e->getMessage());
    sendJsonResponse([
        'success' => false,
        'message' => 'Erro ao diagnosticar importação',
        'error' => $e->getMessage()
    ], 500);
}
?>
