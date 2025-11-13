# 📦 Script de Preparação de Importação

Script automatizado para preparar ficheiros Excel antes da importação no sistema InventoX.

## 🎯 Funcionalidades

- ✅ Preenche códigos de barras vazios com o valor da coluna "Artigo"
- ✅ Garante que todos os códigos de barras são únicos
- ✅ Remove duplicados (mantém primeira ocorrência)
- ✅ Limpa espaços e colunas vazias
- ✅ Gera versão Excel e CSV

## 📋 Requisitos

- Python 3.6+
- pandas
- openpyxl (para ler Excel)

Instalar dependências:
```bash
pip install pandas openpyxl
```

## 🚀 Como Usar

### Método 1: Linha de Comando

```bash
# Preparar ficheiro (gera automaticamente nome com _PREPARADO)
python scripts/prepare_import.py "Teste Inventario.xlsx"

# Especificar nome de saída
python scripts/prepare_import.py "Teste Inventario.xlsx" "Inventario_Limpo.xlsx"
```

### Método 2: Integração no Sistema

O script pode ser chamado automaticamente antes da importação ou manualmente quando necessário.

## 📊 O que o Script Faz

1. **Lê o ficheiro Excel** original
2. **Identifica colunas** automaticamente:
   - Código de barras: `Código Barras`, `barcode`, etc.
   - Artigo: `Artigo`, `Nome`, etc.
3. **Preenche códigos vazios** com o valor de "Artigo"
4. **Remove duplicados** (mantém primeira ocorrência)
5. **Limpa dados** (espaços, colunas vazias)
6. **Gera ficheiros**:
   - `*_PREPARADO.xlsx` (Excel)
   - `*_PREPARADO.csv` (CSV)

## 📝 Exemplo de Saída

```
📂 A processar: Teste Inventario.xlsx
✅ Ficheiro lido: 4356 linhas, 19 colunas
✅ Coluna de código de barras: 'Código Barras'
✅ Coluna de artigo: 'Artigo'
⚠️  Encontradas 1640 linhas sem código de barras
   A preencher com valores da coluna 'Artigo'...
   Removidas 1 colunas vazias
✅ Ficheiro preparado guardado: Teste Inventario_PREPARADO.xlsx
✅ Versão CSV guardada: Teste Inventario_PREPARADO.csv

📊 Estatísticas do ficheiro preparado:
   Total de linhas: 4356
   Códigos de barras únicos: 4356
   Linhas sem código de barras: 0
   Duplicados: 0

✅ Ficheiro pronto para importação!
```

## ⚠️ Notas Importantes

- O script **não modifica** o ficheiro original
- Cria sempre uma **cópia preparada**
- Remove duplicados mantendo a **primeira ocorrência**
- Se houver duplicados mesmo após preencher, remove-os automaticamente

## 🔧 Troubleshooting

### Erro: "Coluna de código de barras não encontrada"
- Verifique se a coluna tem um dos nomes esperados
- O script mostra as colunas disponíveis

### Erro: "pandas não encontrado"
- Instale: `pip install pandas openpyxl`

### Ficheiro muito grande
- O script processa ficheiros grandes, mas pode demorar
- Para ficheiros > 10MB, considere dividir em lotes

---

**Última atualização**: 2024-11-13

