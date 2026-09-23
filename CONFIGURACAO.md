# Guia das configurações

Responsável pela documentação: Codex (OpenAI), 23/09/2026.

JSON não aceita comentários. Este documento explica os arquivos de configuração sem invalidá-los. Funções e seções dos arquivos próprios JavaScript, HTML, CSS e regras Firestore são comentadas no código.

## Firebase

`.firebaserc` seleciona o projeto padrão `site-maneirin-studio`. `firebase.json` define:

- `firestore.database` e `location`: banco padrão e região configurada, São Paulo.
- `firestore.rules` e `indexes`: caminhos das regras de acesso e índices publicados.
- `hosting.public`: somente a pasta `public` é enviada ao Hosting.
- `hosting.ignore`: exclui arquivos ocultos, dependências e arquivos do editor.
- `hosting.rewrites`: páginas sem arquivo correspondente recebem a página inicial. Arquivos e diretórios existentes são servidos normalmente.
- `hosting.headers`: bloqueia enquadramento externo, detecção incorreta de MIME e recursos desnecessários do dispositivo. CSP restringe scripts ao próprio site e ao SDK Firebase; permite fontes e imagens usadas pelo site. `no-cache` solicita revalidação de HTML, CSS e JavaScript.

`firestore.indexes.json` mantém listas vazias porque as consultas atuais não exigem índices compostos ou exceções de campo. Novas consultas podem exigir uma entrada explícita.

`public/js/firebase.js` contém a configuração pública do aplicativo web e inicializa Auth/Firestore uma vez. A autorização real está em `firestore.rules`; a configuração web não substitui essas regras nem contém credenciais administrativas.

## Papéis e permissões

O papel `admin` existente corresponde ao administrador master. A aba **Barbeiros** permite aprovar, revogar e definir Agenda, Fotos e Produtos para outras contas. Não cria administradores nem permite editar a própria conta. Novos cadastros começam como `pending`, sem acesso de gestão.

O campo `users/{uid}.permissions` tem exatamente três booleanos: `schedules`, `gallery` e `products`. A interface salva o mapa completo junto ao papel em uma transação e detecta mudanças concorrentes. Uma conta aprovada com os três valores falsos não tem nenhuma área liberada.

Para preservar o acesso anterior, um barbeiro legado sem esse campo continua com as três áreas até o master salvar suas permissões. Depois disso, o mapa não pode ser removido pelo cliente. A conta master mantém acesso integral. Produtos e fotos continuam públicos para consulta; essas permissões controlam a gestão. Agenda também controla a leitura de reservas com dados de clientes. Os horários são compartilhados pela equipe autorizada, sem isolamento por barbeiro.

O painel acompanha o próprio perfil em tempo real. Alterações de acesso limpam formulários/listas, invalidam respostas pendentes e ocultam abas indisponíveis. As regras do banco barram operações fora das permissões mesmo que alguém modifique a interface.

## PWA e cache

`public/manifest.webmanifest` define identidade (`id`, nomes, descrição e idioma), abertura (`start_url`, `scope`, `display`, `orientation`), cores, categorias, ícones e atalhos para Agenda, Produtos e Área do Barbeiro. Os ícones informam tamanho, tipo e uso adaptável (`maskable`).

`public/sw.js` usa o cache `maneirin-studio-v20`. `APP_SHELL` enumera os arquivos estáticos; novos módulos precisam entrar nessa lista e exigir nova versão do cache. Dados Firestore e autenticação não são armazenados nesse cache. A consulta da agenda exige internet.

## Verificações e manutenção

`package.json` identifica o projeto privado, exige Node.js 22 ou superior e oferece `check` (sintaxe/imports/configuração), `test` (testes locais) e `test:rules` (simulação Firebase com CLI autenticado). Não há dependências npm nem etapa de build.

`.gitignore` impede versionar credenciais locais, arquivos de editor, cache e artefatos de revisão. `.qa/` é uma área local ignorada; não faz parte do aplicativo ou do Hosting. Nunca coloque tokens, senhas ou chaves de serviço em arquivos públicos.

Ao adicionar uma funcionalidade, mantenha alinhados o módulo, a interface, as regras, os testes pertinentes e o histórico em `CONTEXT.md`. O Google Calendar continua sendo aberto com dados preenchidos: salvar o evento na conta Google é um passo manual.
