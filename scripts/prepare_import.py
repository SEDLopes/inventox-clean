#!/usr/bin/env python3
"""
Script para Preparar Ficheiro Excel para Importação
Preenche códigos de barras vazios com o valor da coluna "Artigo"
Garante que todos os códigos são únicos
"""

import pandas as pd
import sys
import os
from pathlib import Path

def prepare_import_file(input_file, output_file=None):
    """
    Prepara ficheiro Excel para importação:
    - Preenche códigos de barras vazios com o valor de "Artigo"
    - Garante unicidade de códigos de barras
    - Limpa espaços e colunas vazias
    """
    
    if not os.path.exists(input_file):
        print(f"❌ Erro: Ficheiro não encontrado: {input_file}")
        return False
    
    print(f"📂 A processar: {input_file}")
    
    try:
        # Ler Excel
        df = pd.read_excel(input_file)
        print(f"✅ Ficheiro lido: {len(df)} linhas, {len(df.columns)} colunas")
        
        # Identificar colunas
        barcode_col = None
        artigo_col = None
        
        # Procurar coluna de código de barras (várias variações)
        barcode_variations = ['Código Barras', 'Código_Barras', 'Codigo Barras', 
                             'barcode', 'Barcode', 'BARCODE', 'codigo_barras']
        for col in df.columns:
            if col.strip() in barcode_variations:
                barcode_col = col
                break
        
        # Procurar coluna de artigo
        artigo_variations = ['Artigo', 'artigo', 'ARTIGO', 'Nome', 'nome', 'Nome do Artigo']
        for col in df.columns:
            if col.strip() in artigo_variations:
                artigo_col = col
                break
        
        if not barcode_col:
            print("❌ Erro: Coluna de código de barras não encontrada!")
            print(f"   Colunas disponíveis: {list(df.columns)}")
            return False
        
        if not artigo_col:
            print("❌ Erro: Coluna de artigo não encontrada!")
            print(f"   Colunas disponíveis: {list(df.columns)}")
            return False
        
        print(f"✅ Coluna de código de barras: '{barcode_col}'")
        print(f"✅ Coluna de artigo: '{artigo_col}'")
        
        # Limpar espaços em todas as colunas de texto
        for col in df.columns:
            if df[col].dtype == 'object':
                df[col] = df[col].astype(str).str.strip()
                # Substituir 'nan' string por NaN
                df[col] = df[col].replace(['nan', 'NaN', 'None', ''], pd.NA)
        
        # Contar linhas sem código de barras
        mask_blank = df[barcode_col].isna() | (df[barcode_col].astype(str).str.strip() == '')
        blank_count = mask_blank.sum()
        
        if blank_count > 0:
            print(f"⚠️  Encontradas {blank_count} linhas sem código de barras")
            print(f"   A preencher com valores da coluna '{artigo_col}'...")
            
            # Preencher códigos de barras vazios com o valor de "Artigo"
            df.loc[mask_blank, barcode_col] = df.loc[mask_blank, artigo_col].astype(str)
        
        # Normalizar códigos de barras (remover espaços)
        df[barcode_col] = df[barcode_col].astype(str).str.strip()
        
        # Verificar duplicados
        duplicates = df[barcode_col].duplicated(keep=False)
        if duplicates.any():
            dup_count = duplicates.sum()
            print(f"⚠️  Encontrados {dup_count} códigos de barras duplicados")
            print("   A remover duplicados (mantendo primeira ocorrência)...")
            
            # Remover duplicados, mantendo primeira ocorrência
            df = df.drop_duplicates(subset=[barcode_col], keep='first')
            print(f"   Mantidas {len(df)} linhas únicas")
        
        # Remover colunas vazias ou sem nome
        unnamed_cols = [col for col in df.columns 
                       if col.startswith('Unnamed') or col.strip() == '' or col.strip() == ' ']
        if unnamed_cols:
            df = df.drop(columns=unnamed_cols)
            print(f"   Removidas {len(unnamed_cols)} colunas vazias")
        
        # Gerar nome do ficheiro de saída
        if not output_file:
            input_path = Path(input_file)
            output_file = input_path.parent / f"{input_path.stem}_PREPARADO{input_path.suffix}"
        
        # Guardar Excel
        df.to_excel(output_file, index=False)
        print(f"✅ Ficheiro preparado guardado: {output_file}")
        
        # Guardar também CSV (mais compatível)
        csv_file = str(output_file).replace('.xlsx', '.csv').replace('.xls', '.csv')
        df.to_csv(csv_file, index=False, encoding='utf-8-sig')
        print(f"✅ Versão CSV guardada: {csv_file}")
        
        # Estatísticas finais
        print("\n📊 Estatísticas do ficheiro preparado:")
        print(f"   Total de linhas: {len(df)}")
        print(f"   Códigos de barras únicos: {df[barcode_col].nunique()}")
        print(f"   Linhas sem código de barras: {(df[barcode_col].astype(str).str.strip() == '').sum()}")
        print(f"   Duplicados: {df[barcode_col].duplicated().sum()}")
        
        print(f"\n✅ Ficheiro pronto para importação!")
        print(f"   Use: {output_file}")
        print(f"   Ou: {csv_file}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao processar ficheiro: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Função principal"""
    if len(sys.argv) < 2:
        print("Uso: python prepare_import.py <ficheiro_excel> [ficheiro_saida]")
        print("\nExemplo:")
        print("  python prepare_import.py 'Teste Inventario.xlsx'")
        print("  python prepare_import.py 'Teste Inventario.xlsx' 'Inventario_Limpo.xlsx'")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    success = prepare_import_file(input_file, output_file)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

