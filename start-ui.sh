#!/bin/bash

# Script para iniciar a aplicação Local File Organizer UI
# Este script instala as dependências e inicia a aplicação Electron

echo "🚀 Iniciando Local File Organizer UI..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado. Por favor, instale o Node.js primeiro."
    echo "   Visite: https://nodejs.org/"
    exit 1
fi

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    echo "❌ npm não está instalado. Por favor, instale o npm primeiro."
    exit 1
fi

# Verificar se Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 não está instalado. Por favor, instale o Python3 primeiro."
    exit 1
fi

echo "✅ Dependências básicas verificadas"

# Navegar para o diretório da UI
cd ui

# Verificar se package.json existe
if [ ! -f "package.json" ]; then
    echo "❌ package.json não encontrado no diretório ui/"
    exit 1
fi

# Instalar dependências se node_modules não existir
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências Node.js..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Erro ao instalar dependências Node.js"
        exit 1
    fi
    echo "✅ Dependências Node.js instaladas"
else
    echo "✅ Dependências Node.js já instaladas"
fi

# Verificar se requirements.txt existe na raiz e instalar dependências Python
cd ..
if [ -f "requirements.txt" ]; then
    echo "🐍 Verificando dependências Python..."
    python3 -m pip install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo "⚠️  Aviso: Erro ao instalar dependências Python. A aplicação pode não funcionar corretamente."
    else
        echo "✅ Dependências Python instaladas"
    fi
else
    echo "⚠️  Aviso: requirements.txt não encontrado. Dependências Python não serão instaladas."
fi

# Voltar para o diretório da UI
cd ui

echo "🎯 Iniciando aplicação..."
echo "   Pressione Ctrl+C para parar a aplicação"

# Iniciar a aplicação
npm start
