# Image Tagger 📷🏷️

Uma aplicação web estática, leve e moderna para capturar ou selecionar fotos e aplicar tags visuais (textos/rótulos) diretamente na imagem usando Canvas. Projetada especialmente para dispositivos móveis, funciona totalmente no navegador de forma offline e rápida.

## ✨ Recursos

* **Captura direta ou Galeria**: Suporte para tirar fotos usando a câmera do dispositivo ou escolher imagens salvas na galeria.
* **Sistema de Tags & Prefixos**: Adicione e selecione facilmente tags e prefixos dinâmicos para compor o nome final.
* **Modo Incrementador**: Substituição automática de `{}` por um contador numérico incremental automático ao salvar.
* **Histórico Local**: Mantém as últimas 20 tags criadas salvas localmente com miniaturas visuais (*thumbnails*) para reutilização rápida.
* **Processamento Local**: Todo o redimensionamento e gravação de texto é feito em um canvas no cliente. Nenhum dado é enviado para servidores.

## 🚀 Como Executar Localmente

Sendo uma aplicação estática e modular, você pode executá-la de várias formas simples:

1. **Abertura Direta**: Basta abrir o arquivo `index.html` em qualquer navegador moderno.
2. **Servidor Local Simples**:
   Se você tiver o Python instalado:
   ```bash
   python -m http.server 8000
   ```
   Ou via Node.js / Nix:
   ```bash
   nix develop -c python3 -m http.server 8000
   ```
   Acesse no navegador: `http://localhost:8000`.

## 📦 Estrutura do Projeto

* `index.html`: Estrutura de marcação HTML5 semântica e limpa.
* `style.css`: Estilos e tokens de design responsivos (modo escuro nativo).
* `app.js`: Lógica funcional, manipulação do canvas, salvamento local e fluxo da aplicação.
* `flake.nix` / `flake.lock`: Configuração do ambiente Nix para desenvolvimento consistente.

## 🛡️ Privacidade

Tudo roda 100% no seu dispositivo. As fotos e informações de tags nunca saem do seu navegador.
