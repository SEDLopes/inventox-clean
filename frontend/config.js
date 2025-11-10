/**
 * InventoX - Configuration
 * Configurações globais da aplicação
 */

// Detectar ambiente (produção ou desenvolvimento)
const IS_PRODUCTION = (
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    !window.location.hostname.includes('.local')
);

// Configuração de debug
const DEBUG = !IS_PRODUCTION;

// Logger condicional
const logger = {
    log: (...args) => {
        if (!IS_PRODUCTION) {
            console.log(...args);
        }
    },
    error: (...args) => {
        // Erros sempre são logados
        console.error(...args);
    },
    warn: (...args) => {
        if (!IS_PRODUCTION) {
            console.warn(...args);
        }
    },
    debug: (...args) => {
        if (DEBUG) {
            console.debug(...args);
        }
    }
};

// Exportar para uso global
window.logger = logger;
window.DEBUG = DEBUG;
window.IS_PRODUCTION = IS_PRODUCTION;

