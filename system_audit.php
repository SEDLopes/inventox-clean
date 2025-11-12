<?php
/**
 * AUDITORIA COMPLETA DO SISTEMA INVENTOX
 * Análise profunda de todos os componentes críticos
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/api/db.php';

function auditSystem() {
    $audit = [
        'timestamp' => date('Y-m-d H:i:s'),
        'system_health' => 'ANALYZING',
        'critical_issues' => [],
        'warnings' => [],
        'recommendations' => [],
        'performance_metrics' => [],
        'database_analysis' => [],
        'api_endpoints' => [],
        'frontend_issues' => []
    ];
    
    try {
        $db = getDB();
        
        // === 1. DATABASE ANALYSIS ===
        $audit['database_analysis'] = auditDatabase($db);
        
        // === 2. API ENDPOINTS ANALYSIS ===
        $audit['api_endpoints'] = auditAPIEndpoints();
        
        // === 3. DATA CONSISTENCY ANALYSIS ===
        $audit['data_consistency'] = auditDataConsistency($db);
        
        // === 4. PERFORMANCE ANALYSIS ===
        $audit['performance_metrics'] = auditPerformance($db);
        
        // === 5. SECURITY ANALYSIS ===
        $audit['security_analysis'] = auditSecurity();
        
        // === 6. DETERMINE SYSTEM HEALTH ===
        $audit['system_health'] = determineSystemHealth($audit);
        
        return $audit;
        
    } catch (Exception $e) {
        $audit['system_health'] = 'CRITICAL_ERROR';
        $audit['critical_issues'][] = 'Database connection failed: ' . $e->getMessage();
        return $audit;
    }
}

function auditDatabase($db) {
    $analysis = [
        'tables' => [],
        'indexes' => [],
        'data_integrity' => [],
        'performance_issues' => []
    ];
    
    // Check critical tables
    $criticalTables = [
        'users', 'items', 'categories', 'companies', 'warehouses',
        'inventory_sessions', 'inventory_counts', 'stock_movements'
    ];
    
    foreach ($criticalTables as $table) {
        $exists = $db->query("SHOW TABLES LIKE '$table'")->rowCount() > 0;
        $analysis['tables'][$table] = [
            'exists' => $exists,
            'row_count' => $exists ? $db->query("SELECT COUNT(*) FROM $table")->fetchColumn() : 0
        ];
        
        if ($exists) {
            // Check for missing indexes
            $indexes = $db->query("SHOW INDEX FROM $table")->fetchAll(PDO::FETCH_ASSOC);
            $analysis['indexes'][$table] = count($indexes);
        }
    }
    
    // Data integrity checks
    if ($analysis['tables']['inventory_counts']['exists']) {
        // Check for orphaned inventory_counts
        $orphanedCounts = $db->query("
            SELECT COUNT(*) FROM inventory_counts ic 
            LEFT JOIN items i ON ic.item_id = i.id 
            WHERE i.id IS NULL
        ")->fetchColumn();
        
        if ($orphanedCounts > 0) {
            $analysis['data_integrity'][] = "Found $orphanedCounts orphaned inventory_counts records";
        }
        
        // Check for invalid differences
        $invalidDiffs = $db->query("
            SELECT COUNT(*) FROM inventory_counts 
            WHERE (counted_quantity - expected_quantity) != difference
        ")->fetchColumn();
        
        if ($invalidDiffs > 0) {
            $analysis['data_integrity'][] = "Found $invalidDiffs records with incorrect difference calculations";
        }
    }
    
    return $analysis;
}

function auditAPIEndpoints() {
    $endpoints = [
        'stats.php' => 'Dashboard statistics',
        'stock_history.php' => 'Movement history',
        'session_count.php' => 'Inventory sessions',
        'items.php' => 'Items management',
        'users.php' => 'User management',
        'login.php' => 'Authentication',
        'analytics.php' => 'Advanced analytics'
    ];
    
    $analysis = [];
    
    foreach ($endpoints as $endpoint => $description) {
        $filePath = __DIR__ . '/api/' . $endpoint;
        $analysis[$endpoint] = [
            'exists' => file_exists($filePath),
            'size' => file_exists($filePath) ? filesize($filePath) : 0,
            'description' => $description,
            'has_cors' => false,
            'has_auth' => false
        ];
        
        if (file_exists($filePath)) {
            $content = file_get_contents($filePath);
            $analysis[$endpoint]['has_cors'] = strpos($content, 'Access-Control-Allow-Origin') !== false;
            $analysis[$endpoint]['has_auth'] = strpos($content, 'requireAuth') !== false;
        }
    }
    
    return $analysis;
}

function auditDataConsistency($db) {
    $issues = [];
    
    // Check for sessions without counts
    $emptySessions = $db->query("
        SELECT COUNT(*) FROM inventory_sessions s
        LEFT JOIN inventory_counts ic ON s.id = ic.session_id
        WHERE ic.session_id IS NULL AND s.status = 'aberta'
    ")->fetchColumn();
    
    if ($emptySessions > 0) {
        $issues[] = "Found $emptySessions open sessions with no inventory counts";
    }
    
    // Check for items without categories
    $uncategorizedItems = $db->query("
        SELECT COUNT(*) FROM items 
        WHERE category_id IS NULL OR category_id NOT IN (SELECT id FROM categories)
    ")->fetchColumn();
    
    if ($uncategorizedItems > 0) {
        $issues[] = "Found $uncategorizedItems items without valid categories";
    }
    
    // Check for duplicate barcodes
    $duplicateBarcodes = $db->query("
        SELECT barcode, COUNT(*) as count 
        FROM items 
        GROUP BY barcode 
        HAVING COUNT(*) > 1
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    if (!empty($duplicateBarcodes)) {
        $issues[] = "Found " . count($duplicateBarcodes) . " duplicate barcodes";
    }
    
    return $issues;
}

function auditPerformance($db) {
    $metrics = [];
    
    // Query performance test
    $start = microtime(true);
    $db->query("SELECT COUNT(*) FROM items")->fetchColumn();
    $metrics['items_count_time'] = round((microtime(true) - $start) * 1000, 2);
    
    $start = microtime(true);
    $db->query("SELECT COUNT(*) FROM inventory_counts")->fetchColumn();
    $metrics['counts_query_time'] = round((microtime(true) - $start) * 1000, 2);
    
    // Check for slow queries (> 100ms indicates potential issues)
    $metrics['performance_status'] = 'GOOD';
    if ($metrics['items_count_time'] > 100 || $metrics['counts_query_time'] > 100) {
        $metrics['performance_status'] = 'SLOW';
    }
    
    return $metrics;
}

function auditSecurity() {
    $issues = [];
    
    // Check for debug files in production
    $debugFiles = ['debug_history.php', 'test_history.php', 'check_logs.php'];
    foreach ($debugFiles as $file) {
        if (file_exists(__DIR__ . '/' . $file)) {
            $issues[] = "Debug file '$file' found in production";
        }
    }
    
    // Check for exposed sensitive files
    $sensitiveFiles = ['.env', 'config.php', 'database.php'];
    foreach ($sensitiveFiles as $file) {
        if (file_exists(__DIR__ . '/' . $file)) {
            $issues[] = "Sensitive file '$file' may be exposed";
        }
    }
    
    return $issues;
}

function determineSystemHealth($audit) {
    $criticalIssues = count($audit['critical_issues']);
    $warnings = count($audit['warnings']);
    $dbIssues = count($audit['data_consistency']);
    
    if ($criticalIssues > 0) {
        return 'CRITICAL';
    } elseif ($dbIssues > 3 || $warnings > 5) {
        return 'WARNING';
    } elseif ($audit['performance_metrics']['performance_status'] === 'SLOW') {
        return 'DEGRADED';
    } else {
        return 'HEALTHY';
    }
}

// Execute audit
$auditResult = auditSystem();

// Add specific recommendations based on findings
if ($auditResult['system_health'] !== 'HEALTHY') {
    $auditResult['recommendations'][] = 'Implement database optimization';
    $auditResult['recommendations'][] = 'Add proper error logging';
    $auditResult['recommendations'][] = 'Implement API response caching';
    $auditResult['recommendations'][] = 'Add database connection pooling';
}

echo json_encode($auditResult, JSON_PRETTY_PRINT);
?>
