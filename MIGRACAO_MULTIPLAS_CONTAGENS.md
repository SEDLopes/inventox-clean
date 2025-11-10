# 🔄 Migração: Múltiplas Contagens do Mesmo Artigo

## 📋 **O Que Mudou:**

### **Antes:**
- ❌ Cada scan do mesmo artigo **atualizava** a contagem existente
- ❌ Só podia haver **uma contagem** por artigo por sessão
- ❌ UNIQUE KEY `unique_session_item` impedia múltiplas contagens

### **Agora:**
- ✅ Cada scan cria um **novo registo** de contagem
- ✅ Pode haver **múltiplas contagens** do mesmo artigo na mesma sessão
- ✅ Botão **"Editar"** para editar uma contagem existente
- ✅ UNIQUE KEY removida para permitir múltiplas contagens

---

## 🔧 **Migração Necessária:**

Se a sua base de dados já existe e tem a UNIQUE KEY, precisa executar a migração:

### **Opção 1: Migração Automática (Recomendado)**

Aceder ao endpoint de migração:

```
https://[seu-app].ondigitalocean.app/api/migrate_remove_unique_count.php
```

**Ou localmente:**
```
http://localhost:8080/api/migrate_remove_unique_count.php
```

**Resultado esperado:**
```json
{
    "success": true,
    "message": "UNIQUE KEY removida com sucesso. Agora é possível criar múltiplas contagens do mesmo artigo na mesma sessão."
}
```

### **Opção 2: Migração Manual (SQL)**

Se preferir fazer manualmente:

```sql
ALTER TABLE inventory_counts DROP INDEX unique_session_item;
```

---

## ✅ **Após Migração:**

1. **Testar múltiplas contagens:**
   - Fazer scan do mesmo artigo várias vezes
   - Cada scan deve criar um novo registo
   - Verificar na lista de contagens que aparecem múltiplas entradas

2. **Testar editar contagem:**
   - Abrir detalhes da sessão
   - Clicar em "Editar" numa contagem
   - Alterar quantidade e guardar
   - Verificar que a contagem foi atualizada

---

## 🎯 **Funcionalidades Novas:**

### **1. Múltiplas Contagens:**
- Cada scan cria um novo registo
- Histórico completo de todas as contagens
- Útil para rastrear múltiplas contagens do mesmo artigo

### **2. Editar Contagem:**
- Botão "Editar" na lista de contagens (apenas para sessões abertas)
- Modal para editar quantidade e notas
- Atualização automática da interface

---

## 📝 **Notas Importantes:**

- **Movimentos de stock:** Agora são criados apenas quando a sessão é fechada (não a cada scan)
- **Histórico completo:** Todas as contagens são mantidas, mesmo do mesmo artigo
- **Edição:** Só é possível editar contagens de sessões abertas

---

**Migração concluída! Agora pode fazer múltiplas contagens do mesmo artigo! 🚀**

